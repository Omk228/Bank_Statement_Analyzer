import os
import time
from typing import List, Optional
from PIL import Image
import pytesseract
from pytesseract import Output
from .base import OCREngineInterface
from .discovery import find_tesseract_binary
from ...models.document import SpatialToken
from ...core.logging import logger


class TesseractOCREngine(OCREngineInterface):
    def __init__(self, tesseract_cmd: Optional[str] = None):
        path, version, available = find_tesseract_binary(tesseract_cmd)
        self.tesseract_cmd = path
        self.version = version
        self.available = available

        if self.available:
            pytesseract.pytesseract.tesseract_cmd = self.tesseract_cmd
            logger.info(
                f"OCR engine detected: Tesseract | Path: {self.tesseract_cmd} | Version: {self.version}"
            )
        else:
            logger.warning(
                "OCR engine unavailable. Scanned/image PDFs cannot be analyzed until Tesseract is installed/configured."
            )

    def is_available(self) -> bool:
        if self.tesseract_cmd and os.path.exists(self.tesseract_cmd):
            return True
        # Re-check in case it was installed dynamically
        path, version, available = find_tesseract_binary()
        if available:
            self.tesseract_cmd = path
            self.version = version
            self.available = True
            pytesseract.pytesseract.tesseract_cmd = path
            return True
        return False

    def extract_spatial_tokens(self, image: Image.Image, page_number: int = 1) -> List[SpatialToken]:
        tokens: List[SpatialToken] = []
        if not self.is_available():
            logger.warning(f"Page {page_number} OCR skipped: Tesseract binary not found on system PATH.")
            return tokens

        start_time = time.time()
        logger.info(f"Page {page_number} OCR started (Engine: Tesseract, Version: {self.version})")

        try:
            # PSM 6: Assume a single uniform block of text or tabular content
            custom_config = r'--oem 3 --psm 6'
            data = pytesseract.image_to_data(image, output_type=Output.DICT, config=custom_config)

            n_boxes = len(data.get('text', []))
            confidences = []
            total_chars = 0

            for i in range(n_boxes):
                raw_text = str(data['text'][i]).strip()
                if not raw_text:
                    continue

                try:
                    conf_val = float(data['conf'][i])
                except (ValueError, TypeError):
                    conf_val = -1.0

                if conf_val < 0:  # Invalid/special confidence token
                    conf_val = 50.0

                x = float(data['left'][i])
                y = float(data['top'][i])
                w = float(data['width'][i])
                h = float(data['height'][i])

                normalized_conf = round(conf_val / 100.0, 4)
                confidences.append(conf_val)
                total_chars += len(raw_text)

                tokens.append(
                    SpatialToken(
                        text=raw_text,
                        confidence=normalized_conf,
                        x0=x,
                        y0=y,
                        x1=x + w,
                        y1=y + h,
                        page_number=page_number,
                        line_number=int(data.get('line_num', [0])[i]) if 'line_num' in data else None,
                        block_number=int(data.get('block_num', [0])[i]) if 'block_num' in data else None,
                    )
                )

            duration_ms = round((time.time() - start_time) * 1000, 2)
            avg_conf = round(sum(confidences) / len(confidences), 2) if confidences else 0.0

            logger.info(
                f"Page {page_number} OCR completed in {duration_ms}ms | Tokens: {len(tokens)} | "
                f"Text Length: {total_chars} chars | Avg Confidence: {avg_conf}%"
            )
        except Exception as e:
            logger.error(f"Page {page_number} OCR execution failed: {str(e)}")

        return tokens
