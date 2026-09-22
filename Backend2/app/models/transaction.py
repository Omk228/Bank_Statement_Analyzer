from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_serializer
from .document import BoundingBox


class NormalizedTransaction(BaseModel):
    transaction_id: str
    date: str  # YYYY-MM-DD
    value_date: Optional[str] = None
    description: str
    narration: Optional[str] = None
    reference: Optional[str] = None
    type: str  # 'DEBIT' or 'CREDIT'
    debit: Decimal = Decimal('0.00')
    credit: Decimal = Decimal('0.00')
    amount: Decimal = Decimal('0.00')
    balance: Optional[Decimal] = None
    currency: str = "INR"
    page_number: int = 1
    extraction_method: str = "NATIVE"  # 'NATIVE', 'OCR', 'HYBRID'
    confidence: float = 1.0
    category_code: Optional[str] = None
    category_name: Optional[str] = None
    payment_mode: Optional[str] = None
    raw_source_text: Optional[str] = None
    bbox: Optional[BoundingBox] = None

    @field_serializer('debit', 'credit', 'amount')
    def serialize_decimal(self, v: Decimal, _info) -> str:
        return f"{v:.2f}"

    @field_serializer('balance')
    def serialize_opt_decimal(self, v: Optional[Decimal], _info) -> Optional[str]:
        return f"{v:.2f}" if v is not None else None


class ColumnRange(BaseModel):
    name: str  # 'DATE', 'DESCRIPTION', 'REFERENCE', 'DEBIT', 'CREDIT', 'AMOUNT', 'BALANCE', 'DR_CR'
    x0: float
    x1: float
    confidence: float = 1.0


class TableHeaderCandidate(BaseModel):
    page_number: int
    y0: float
    y1: float
    columns: List[ColumnRange] = Field(default_factory=list)
    raw_text: str = ""
    confidence: float = 1.0


class TableExtractionResult(BaseModel):
    transactions: List[NormalizedTransaction] = Field(default_factory=list)
    opening_balance: Optional[Decimal] = None
    closing_balance: Optional[Decimal] = None
    total_credits: Decimal = Decimal('0.00')
    total_debits: Decimal = Decimal('0.00')
    net_cash_flow: Decimal = Decimal('0.00')
    balance_reconciled: bool = False
    reconciliation_difference: Decimal = Decimal('0.00')
    warnings: List[str] = Field(default_factory=list)

    @field_serializer('total_credits', 'total_debits', 'net_cash_flow', 'reconciliation_difference')
    def serialize_decimal(self, v: Decimal, _info) -> str:
        return f"{v:.2f}"

    @field_serializer('opening_balance', 'closing_balance')
    def serialize_opt_decimal(self, v: Optional[Decimal], _info) -> Optional[str]:
        return f"{v:.2f}" if v is not None else None

