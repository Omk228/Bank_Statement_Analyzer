from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def width(self) -> float:
        return max(0.0, self.x1 - self.x0)

    @property
    def height(self) -> float:
        return max(0.0, self.y1 - self.y0)


class SpatialToken(BaseModel):
    text: str
    confidence: float = 1.0
    x0: float
    y0: float
    x1: float
    y1: float
    page_number: int = 1
    line_number: Optional[int] = None
    block_number: Optional[int] = None

    @property
    def bbox(self) -> BoundingBox:
        return BoundingBox(x0=self.x0, y0=self.y0, x1=self.x1, y1=self.y1)


class PageExtractionResult(BaseModel):
    page_number: int
    extraction_method: str  # 'NATIVE', 'STRUCTURAL', 'OCR', 'HYBRID'
    raw_text: str = ""
    native_text: str = ""
    ocr_text: str = ""
    tokens: List[SpatialToken] = Field(default_factory=list)
    confidence: float = 1.0
    width: float = 595.0
    height: float = 842.0
    is_scanned: bool = False
    ocr_applied: bool = False


class DocumentMetadata(BaseModel):
    document_id: str
    request_id: str
    original_filename: str
    file_size_bytes: int
    page_count: int
    created_at: str
    completed_at: Optional[str] = None
    processing_duration_ms: Optional[float] = None
    status: str = "PROCESSING"  # 'SUCCESS', 'FAILED', 'REJECTED'
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class ClassifierEvidence(BaseModel):
    signal: str
    type: str  # 'POSITIVE' or 'NEGATIVE'
    category: str  # 'BANK_IDENTITY', 'ACCOUNT_INFO', 'ROUTING_CODES', 'STATEMENT_PERIOD', 'LEDGER_HEADER', 'LEDGER_ROWS', 'BALANCES', 'INVOICE_STRUCTURE', 'LOAN_CONTRACT', 'PAYSLIP_STRUCTURE', etc.
    matched_text: str
    page: int
    confidence: float = 1.0
    bbox: Optional[BoundingBox] = None
    weight: float
    reason: str

