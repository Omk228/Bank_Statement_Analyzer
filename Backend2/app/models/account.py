from typing import Optional, Any
from pydantic import BaseModel
from .document import BoundingBox


class FieldEvidence(BaseModel):
    value: Any = None
    confidence: float = 0.0
    source_page: int = 1
    source_region: str = "UNKNOWN"
    raw_text: str = ""
    bbox: Optional[BoundingBox] = None


class BankInfo(BaseModel):
    name: str = "Unknown Bank"
    confidence: float = 0.0
    ifsc: Optional[str] = None
    micr: Optional[str] = None
    branch: Optional[str] = None
    evidence: Optional[FieldEvidence] = None


class ExtractedAccountInfo(BaseModel):
    holder_name: Optional[str] = None
    account_number_raw: Optional[str] = None
    account_number_masked: Optional[str] = None
    account_type: str = "Savings"
    ifsc: Optional[str] = None
    micr: Optional[str] = None
    iban: Optional[str] = None
    routing_number: Optional[str] = None
    branch: Optional[str] = None
    address: Optional[str] = None
    confidence: float = 0.0
    holder_evidence: Optional[FieldEvidence] = None
    account_evidence: Optional[FieldEvidence] = None


class StatementPeriod(BaseModel):
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None    # YYYY-MM-DD
    period_days: int = 30
    confidence: float = 0.0
    evidence: Optional[FieldEvidence] = None
