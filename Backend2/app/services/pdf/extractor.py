import fitz  # PyMuPDF
from typing import List, Optional
from ...models.document import PageExtractionResult, SpatialToken
from ..ocr.base import OCREngineInterface
from ..ocr.tesseract import TesseractOCREngine
from ..ocr.preprocessing import ImagePreprocessor
from ..ocr.quality import OCRQualityGate
from .renderer import PDFRenderer
from ...core.logging import logger
from ...core.security import StatementErrorCode


class UniversalPDFExtractor:
    def __init__(self, ocr_engine: Optional[OCREngineInterface] = None):
        self.ocr_engine = ocr_engine or TesseractOCREngine()

    def extract_document(self, pdf_bytes: bytes, request_id: str = "") -> List[PageExtractionResult]:
        """
        Processes multi-page PDF with multi-engine spatial extraction:
        1. Native PyMuPDF Spatial Text with Bounding Boxes
        2. Quality Gate Evaluation
        3. 300 DPI Preprocessed OCR Fallback where required
        """
        page_results: List[PageExtractionResult] = []
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_num = page_idx + 1
            rect = page.rect
            page_w, page_h = rect.width, rect.height

            # 1. Native Extraction with PyMuPDF
            native_tokens: List[SpatialToken] = []
            raw_text = page.get_text() or ""
            words = page.get_text("words")  # (x0, y0, x1, y1, word, block_no, line_no, word_no)

            for w in words:
                text_val = w[4].strip()
                if text_val:
                    native_tokens.append(
                        SpatialToken(
                            text=text_val,
                            confidence=1.0,
                            x0=float(w[0]),
                            y0=float(w[1]),
                            x1=float(w[2]),
                            y1=float(w[3]),
                            page_number=page_num,
                            block_number=int(w[5]),
                            line_number=int(w[6]),
                        )
                    )

            quality = OCRQualityGate.evaluate_tokens_quality(native_tokens)

            # 2. Check if Native text is sufficient or if OCR fallback is needed
            if quality["passed_gate"] and len(native_tokens) >= 15:
                # High quality native extraction
                page_results.append(
                    PageExtractionResult(
                        page_number=page_num,
                        extraction_method="NATIVE",
                        raw_text=raw_text,
                        native_text=raw_text,
                        tokens=native_tokens,
                        confidence=1.0,
                        width=page_w,
                        height=page_h,
                        is_scanned=False,
                        ocr_applied=False,
                    )
                )
            else:
                # Scanned or image-only page -> Check OCR availability
                if not self.ocr_engine.is_available():
                    if len(native_tokens) == 0:
                        raise ValueError(
                            f"[{StatementErrorCode.OCR_ENGINE_UNAVAILABLE}] Page {page_num} is a scanned/image PDF page with 0 native words, "
                            f"but OCR Engine (Tesseract) is unavailable on this system. Please install Tesseract or configure TESSERACT_CMD."
                        )
                    logger.warning(
                        f"Page {page_num} requires OCR (Native words: {len(native_tokens)}), but OCR engine is unavailable. "
                        f"Proceeding with {len(native_tokens)} native tokens."
                    )
                else:
                    logger.info(f"Page {page_num} requires OCR (Native words: {len(native_tokens)}). Triggering OCR pipeline.")

                rendered_img = PDFRenderer.render_page_to_image(page, dpi=300)
                
                # Apply 30px white border padding to prevent Tesseract from clipping edge/margin text
                pad_px = 30
                from PIL import ImageOps
                padded_img = ImageOps.expand(rendered_img, border=pad_px, fill='white')
                
                # Pass 1: Original + Grayscale OCR
                enhanced_img = ImagePreprocessor.enhance_for_ocr(padded_img, pass_num=1)
                ocr_tokens = self.ocr_engine.extract_spatial_tokens(enhanced_img, page_number=page_num)
                
                ocr_quality = OCRQualityGate.evaluate_tokens_quality(ocr_tokens)
                
                # Only retry Pass 2 (Adaptive CLAHE) if Pass 1 returned 0 tokens or critically low confidence (< 45%)
                if len(ocr_tokens) == 0 or (ocr_quality["avg_confidence"] < 0.45 and len(ocr_tokens) < 10):
                    logger.info(f"Page {page_num} Pass 1 OCR yielded weak results ({len(ocr_tokens)} tokens, conf: {ocr_quality['avg_confidence']}). Retrying Pass 2.")
                    enhanced_img_p2 = ImagePreprocessor.enhance_for_ocr(padded_img, pass_num=2)
                    p2_tokens = self.ocr_engine.extract_spatial_tokens(enhanced_img_p2, page_number=page_num)
                    if len(p2_tokens) > len(ocr_tokens):
                        ocr_tokens = p2_tokens
                        ocr_quality = OCRQualityGate.evaluate_tokens_quality(ocr_tokens)

                # Convert OCR coordinates back to original unpadded image pixel space first,
                # then apply the pixel-to-PDF coordinate transformation.
                scale_x = page_w / max(1.0, float(rendered_img.width))
                scale_y = page_h / max(1.0, float(rendered_img.height))

                scaled_tokens: List[SpatialToken] = []
                for t in ocr_tokens:
                    # Unpad in pixel space
                    x0_orig_px = max(0.0, min(float(rendered_img.width), float(t.x0) - pad_px))
                    y0_orig_px = max(0.0, min(float(rendered_img.height), float(t.y0) - pad_px))
                    x1_orig_px = max(0.0, min(float(rendered_img.width), float(t.x1) - pad_px))
                    y1_orig_px = max(0.0, min(float(rendered_img.height), float(t.y1) - pad_px))

                    # Scale from unpadded pixels to PDF points
                    scaled_tokens.append(
                        SpatialToken(
                            text=t.text,
                            confidence=t.confidence,
                            x0=round(x0_orig_px * scale_x, 2),
                            y0=round(y0_orig_px * scale_y, 2),
                            x1=round(x1_orig_px * scale_x, 2),
                            y1=round(y1_orig_px * scale_y, 2),
                            page_number=page_num,
                            line_number=t.line_number,
                            block_number=t.block_number,
                        )
                    )

                # If we had some native text + OCR, it's hybrid
                final_tokens = scaled_tokens if len(scaled_tokens) >= len(native_tokens) else native_tokens
                method = "HYBRID" if (len(native_tokens) > 5 and len(scaled_tokens) > 5) else "OCR"
                ocr_text = " ".join([t.text for t in final_tokens])

                page_results.append(
                    PageExtractionResult(
                        page_number=page_num,
                        extraction_method=method,
                        raw_text=ocr_text,
                        native_text=raw_text,
                        ocr_text=ocr_text,
                        tokens=final_tokens,
                        confidence=ocr_quality["avg_confidence"] or 0.85,
                        width=page_w,
                        height=page_h,
                        is_scanned=True,
                        ocr_applied=True,
                    )
                )

        doc.close()
        return page_results
