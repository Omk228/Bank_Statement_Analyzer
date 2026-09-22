from abc import ABC, abstractmethod
from typing import List
from PIL import Image
from ...models.document import SpatialToken


class OCREngineInterface(ABC):
    """
    Abstract Protocol for OCR Engines.
    Any OCR Engine (Tesseract, EasyOCR, PaddleOCR, LayoutOCR, or synthetic test engines)
    must implement this interface and output normalized SpatialToken objects.
    """

    @abstractmethod
    def extract_spatial_tokens(self, image: Image.Image, page_number: int = 1) -> List[SpatialToken]:
        """
        Runs OCR on given PIL Image and returns structured tokens with coordinates (x0, y0, x1, y1)
        and confidence score.
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """
        Returns True if engine binary / dependencies are available in the runtime.
        """
        pass
