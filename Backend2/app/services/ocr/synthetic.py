from typing import List, Optional
from PIL import Image
from .base import OCREngineInterface
from ...models.document import SpatialToken


class SyntheticOCREngine(OCREngineInterface):
    """
    Synthetic / Mock OCR engine for unit testing and deterministic verification
    without requiring external Tesseract binaries.
    """

    def __init__(self, predefined_tokens: Optional[List[SpatialToken]] = None):
        self.predefined_tokens = predefined_tokens or []

    def is_available(self) -> bool:
        return True

    def extract_spatial_tokens(self, image: Image.Image, page_number: int = 1) -> List[SpatialToken]:
        if self.predefined_tokens:
            return self.predefined_tokens
        
        # Default synthetic tokens representing a test bank statement
        return [
            SpatialToken(text="State", confidence=0.98, x0=40, y0=50, x1=80, y1=65, page_number=page_number, line_number=1),
            SpatialToken(text="Bank", confidence=0.98, x0=85, y0=50, x1=120, y1=65, page_number=page_number, line_number=1),
            SpatialToken(text="Statement", confidence=0.98, x0=125, y0=50, x1=180, y1=65, page_number=page_number, line_number=1),
            SpatialToken(text="Account", confidence=0.95, x0=40, y0=90, x1=80, y1=102, page_number=page_number, line_number=2),
            SpatialToken(text="Number:", confidence=0.95, x0=85, y0=90, x1=130, y1=102, page_number=page_number, line_number=2),
            SpatialToken(text="30294857102", confidence=0.99, x0=135, y0=90, x1=210, y1=102, page_number=page_number, line_number=2),
        ]
