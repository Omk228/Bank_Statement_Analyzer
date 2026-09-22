import os
import pytest
from PIL import Image, ImageDraw
from Backend2.app.services.ocr.discovery import find_tesseract_binary, check_ocr_engine
from Backend2.app.services.ocr.synthetic import SyntheticOCREngine
from Backend2.app.services.ocr.tesseract import TesseractOCREngine
from Backend2.app.services.pdf.extractor import UniversalPDFExtractor
from Backend2.app.core.security import StatementErrorCode
import fitz


def test_tesseract_discovery():
    path, version, available = find_tesseract_binary()
    assert available is True
    assert path is not None
    assert os.path.exists(path)
    assert version is not None
    assert "tesseract" in version.lower()

    status = check_ocr_engine()
    assert status["available"] is True
    assert status["engine"] == "tesseract"
    assert status["executable_path"] == path


def test_synthetic_ocr_engine():
    engine = SyntheticOCREngine()
    assert engine.is_available() is True
    
    img = Image.new("RGB", (300, 100), color=(255, 255, 255))
    tokens = engine.extract_spatial_tokens(img, page_number=1)
    
    assert len(tokens) > 0
    assert tokens[0].text == "State"
    assert tokens[0].confidence >= 0.90
    assert tokens[0].bbox.width > 0


def test_real_tesseract_ocr_execution():
    engine = TesseractOCREngine()
    assert engine.is_available() is True

    # Render a clean image containing known test text
    img = Image.new("RGB", (600, 150), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((40, 50), "TEST BANK STATEMENT", fill=(0, 0, 0), font_size=28)

    tokens = engine.extract_spatial_tokens(img, page_number=1)
    extracted_words = [t.text for t in tokens]
    
    assert len(tokens) >= 3
    assert "TEST" in extracted_words
    assert "BANK" in extracted_words
    assert "STATEMENT" in extracted_words
    assert all(t.confidence > 0.30 for t in tokens)


def test_fail_fast_when_ocr_unavailable_on_scanned_pdf(tmp_path):
    class MockUnavailableOCREngine:
        def is_available(self):
            return False
        def extract_spatial_tokens(self, image, page_number=1):
            return []

    extractor = UniversalPDFExtractor(ocr_engine=MockUnavailableOCREngine())

    # Create a 0-native-word image-only PDF
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    img = Image.new("RGB", (595, 842), color=(255, 255, 255))
    img_path = os.path.join(tmp_path, "blank.png")
    img.save(img_path)
    page.insert_image(page.rect, filename=img_path)
    
    pdf_bytes = doc.tobytes()
    doc.close()

    with pytest.raises(ValueError) as exc_info:
        extractor.extract_document(pdf_bytes, request_id="test_req")

    assert StatementErrorCode.OCR_ENGINE_UNAVAILABLE in str(exc_info.value)
