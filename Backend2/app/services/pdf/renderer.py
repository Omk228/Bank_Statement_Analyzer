import io
from typing import Optional
from PIL import Image
import fitz  # PyMuPDF
from ...core.config import settings
from ...core.logging import logger


class PDFRenderer:
    @staticmethod
    def render_page_to_image(page: fitz.Page, dpi: int = 300) -> Image.Image:
        """
        Renders a PyMuPDF PDF page into a high-resolution PIL Image.
        """
        try:
            # Render at specified DPI for crisp OCR resolution
            zoom = dpi / 72.0
            matrix = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            img_data = pix.tobytes("png")
            return Image.open(io.BytesIO(img_data))
        except Exception as e:
            logger.error(f"Failed to render page {page.number} to image: {str(e)}")
            # Fallback to standard 150 DPI
            pix = page.get_pixmap(dpi=150, alpha=False)
            return Image.open(io.BytesIO(pix.tobytes("png")))
