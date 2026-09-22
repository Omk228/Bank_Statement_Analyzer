from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field
from .document import DocumentMetadata
from .account import ExtractedAccountInfo, BankInfo, StatementPeriod
from .transaction import NormalizedTransaction
from .analytics import FinancialSummary, MonthlyCashFlow, CategoryAnalysis, RecurringIncome, RiskMetrics
from .fraud import FraudRuleResult


class DocumentHeader(BaseModel):
    document_type: str = "BANK_STATEMENT"
    confidence: float = 1.0
    page_count: int = 1
    currency: str = "INR"


class ExtractionSummary(BaseModel):
    native_pages: int = 0
    ocr_pages: int = 0
    hybrid_pages: int = 0
    average_ocr_confidence: float = 1.0
    warnings: List[str] = Field(default_factory=list)
    completeness_score: float = 1.0
    audit_report: Optional[Dict[str, Any]] = None
    completeness_verification: Optional[Dict[str, Any]] = None


class ProcessingInfo(BaseModel):
    request_id: str
    processing_time_ms: float = 0.0


class StatementAnalysisResult(BaseModel):
    success: bool = True
    document: DocumentHeader
    bank: BankInfo
    account: ExtractedAccountInfo
    statement_period: StatementPeriod
    summary: FinancialSummary
    transactions: List[NormalizedTransaction] = Field(default_factory=list)
    monthly_cash_flow: List[MonthlyCashFlow] = Field(default_factory=list)
    categories: CategoryAnalysis = Field(default_factory=CategoryAnalysis)
    recurring_income: List[RecurringIncome] = Field(default_factory=list)
    risk_profile: RiskMetrics = Field(default_factory=RiskMetrics)
    fraud_detection: List[FraudRuleResult] = Field(default_factory=list)
    extraction: ExtractionSummary = Field(default_factory=ExtractionSummary)
    processing: ProcessingInfo
    response_json: Optional[Dict[str, Any]] = None  # Full Finvu/Response.json standard structure


class ApiErrorResponse(BaseModel):
    success: bool = False
    request_id: str
    error: Dict[str, Any]
