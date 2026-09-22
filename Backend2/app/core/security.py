import re
import uuid
from typing import Tuple, Optional
import pypdf
import fitz  # PyMuPDF
from .config import settings


class StatementErrorCode:
    INVALID_FILE_TYPE = "INVALID_FILE_TYPE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    EMPTY_FILE = "EMPTY_FILE"
    INVALID_PDF = "INVALID_PDF"
    ENCRYPTED_PDF = "ENCRYPTED_PDF"
    CORRUPTED_PDF = "CORRUPTED_PDF"
    PAGE_LIMIT_EXCEEDED = "PAGE_LIMIT_EXCEEDED"
    PROCESSING_TIMEOUT = "PROCESSING_TIMEOUT"
    OCR_ENGINE_UNAVAILABLE = "OCR_ENGINE_UNAVAILABLE"
    OCR_FAILURE = "OCR_FAILURE"
    NO_READABLE_CONTENT = "NO_READABLE_CONTENT"
    NOT_BANK_STATEMENT = "NOT_BANK_STATEMENT"
    UNCERTAIN_DOCUMENT = "UNCERTAIN_DOCUMENT"
    PARSER_FAILURE = "PARSER_FAILURE"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class SecurityValidator:
    PDF_MAGIC_BYTES = b"%PDF-"

    @staticmethod
    def generate_id(prefix: str = "") -> str:
        uid = str(uuid.uuid4())
        return f"{prefix}_{uid}" if prefix else uid

    @classmethod
    def validate_file_metadata(cls, filename: str, content: bytes) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Validates basic file parameters: non-empty, size limits, extension, magic bytes.
        """
        if not content or len(content) == 0:
            return False, StatementErrorCode.EMPTY_FILE, "Uploaded file is empty"

        if len(content) > settings.MAX_FILE_SIZE_BYTES:
            return False, StatementErrorCode.FILE_TOO_LARGE, f"File size exceeds maximum allowed {settings.MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB"

        # Check extension
        if not filename.lower().endswith(".pdf"):
            return False, StatementErrorCode.INVALID_FILE_TYPE, "Only PDF files are accepted"

        # Check magic bytes within first 1024 bytes
        header_sample = content[:1024]
        if cls.PDF_MAGIC_BYTES not in header_sample:
            return False, StatementErrorCode.INVALID_PDF, "Invalid PDF header: Missing %PDF- magic bytes"

        return True, None, None

    @classmethod
    def validate_pdf_structure(cls, content: bytes) -> Tuple[bool, Optional[str], Optional[str], Optional[int]]:
        """
        Validates internal PDF structure, encryption, corruption, and page count limits.
        """
        # 1. Try PyMuPDF
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            if doc.is_encrypted:
                doc.close()
                return False, StatementErrorCode.ENCRYPTED_PDF, "PDF is password protected or encrypted", 0

            page_count = len(doc)
            if page_count == 0:
                doc.close()
                return False, StatementErrorCode.CORRUPTED_PDF, "PDF contains 0 pages", 0

            if page_count > settings.MAX_PAGE_COUNT:
                doc.close()
                return False, StatementErrorCode.PAGE_LIMIT_EXCEEDED, f"PDF page count ({page_count}) exceeds limit ({settings.MAX_PAGE_COUNT})", page_count

            doc.close()
            return True, None, None, page_count
        except Exception as e:
            # Fallback check with pypdf for detailed error message
            try:
                import io
                reader = pypdf.PdfReader(io.BytesIO(content))
                if reader.is_encrypted:
                    return False, StatementErrorCode.ENCRYPTED_PDF, "PDF is password protected or encrypted", 0
                page_count = len(reader.pages)
                return True, None, None, page_count
            except Exception as pe:
                return False, StatementErrorCode.CORRUPTED_PDF, f"Malformed or corrupted PDF stream: {str(e)}", 0
