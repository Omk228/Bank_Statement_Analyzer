from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_serializer


class IntegrityCheckResult(BaseModel):
    status: str  # "PASS" | "FAIL" | "NOT_APPLICABLE"
    difference: str = "0.00"
    confidence: float = 1.0
    evidence: Dict[str, Any] = Field(default_factory=dict)


class IntegrityReport(BaseModel):
    check_a_ledger_arithmetic: IntegrityCheckResult
    check_b_statement_reconciliation: IntegrityCheckResult
    check_c_running_balance_continuity: IntegrityCheckResult
    check_d_transaction_completeness: IntegrityCheckResult
    integrity_status: str  # "GREEN" | "YELLOW" | "RED"
    integrity_message: str
    tolerance: str = "0.01"
    differences: Dict[str, str] = Field(default_factory=dict)


class ConfidenceDecomposition(BaseModel):
    classification: float = 1.0
    field_extraction: float = 1.0
    transaction_extraction: float = 1.0
    reconciliation: float = 1.0
    overall_analysis: float = 1.0


class FinancialSummary(BaseModel):
    opening_balance: Decimal = Decimal('0.00')
    closing_balance: Decimal = Decimal('0.00')
    stated_closing_balance: Optional[Decimal] = None
    calculated_closing_balance: Decimal = Decimal('0.00')
    total_credits: Decimal = Decimal('0.00')
    total_debits: Decimal = Decimal('0.00')
    transaction_derived_credits: Decimal = Decimal('0.00')
    transaction_derived_debits: Decimal = Decimal('0.00')
    statement_stated_credits: Optional[Decimal] = None
    statement_stated_debits: Optional[Decimal] = None
    net_cash_flow: Decimal = Decimal('0.00')
    average_balance: Decimal = Decimal('0.00')
    transaction_count: int = 0
    credit_count: int = 0
    debit_count: int = 0
    period_days: int = 30
    balance_reconciled: bool = False
    reconciliation_difference: Decimal = Decimal('0.00')
    failed_transaction_ids: List[str] = Field(default_factory=list)
    integrity_report: Optional[IntegrityReport] = None
    confidence_decomposition: Optional[ConfidenceDecomposition] = None

    @field_serializer(
        'opening_balance', 'closing_balance', 'calculated_closing_balance',
        'total_credits', 'total_debits', 'transaction_derived_credits',
        'transaction_derived_debits', 'net_cash_flow', 'average_balance',
        'reconciliation_difference'
    )
    def serialize_decimal(self, v: Decimal, _info) -> str:
        return f"{v:.2f}"

    @field_serializer('stated_closing_balance', 'statement_stated_credits', 'statement_stated_debits')
    def serialize_opt_decimal(self, v: Optional[Decimal], _info) -> Optional[str]:
        return f"{v:.2f}" if v is not None else None


class CategoryItem(BaseModel):
    code: str
    name: str
    amount: Decimal = Decimal('0.00')
    count: int = 0
    percentage: float = 0.0

    @field_serializer('amount')
    def serialize_decimal(self, v: Decimal, _info) -> str:
        return f"{v:.2f}"


class CategoryAnalysis(BaseModel):
    income_categories: List[CategoryItem] = Field(default_factory=list)
    expense_categories: List[CategoryItem] = Field(default_factory=list)


class MonthlyCashFlow(BaseModel):
    month: str  # YYYY-MM
    full_month: bool = True
    income_amount: Decimal = Decimal('0.00')
    expenses_amount: Decimal = Decimal('0.00')
    saving_amount: Decimal = Decimal('0.00')
    saving_ratio: float = 0.0
    income_expenses_ratio: float = 1.0
    opening_balance: Decimal = Decimal('0.00')
    closing_balance: Decimal = Decimal('0.00')
    average_balance: Decimal = Decimal('0.00')
    minimum_balance: Decimal = Decimal('0.00')
    maximum_balance: Decimal = Decimal('0.00')
    transaction_count: int = 0
    income_by_category: List[Dict[str, Any]] = Field(default_factory=list)
    expenses_by_category: List[Dict[str, Any]] = Field(default_factory=list)

    @field_serializer(
        'income_amount', 'expenses_amount', 'saving_amount',
        'opening_balance', 'closing_balance', 'average_balance',
        'minimum_balance', 'maximum_balance'
    )
    def serialize_decimal(self, v: Decimal, _info) -> str:
        return f"{v:.2f}"


class RecurringIncome(BaseModel):
    type: str = "SALARY"
    source: str = ""
    monthly_average_amount: Decimal = Decimal('0.00')
    frequency: str = "MONTHLY"
    matched_transactions_count: int = 0
    matched_transaction_ids: List[str] = Field(default_factory=list)
    confidence: float = 0.0

    @field_serializer('monthly_average_amount')
    def serialize_decimal(self, v: Decimal, _info) -> str:
        return f"{v:.2f}"


class RiskMetrics(BaseModel):
    emi_to_income_ratio: float = 0.0
    cash_withdrawal_ratio: float = 0.0
    returned_debit_count: int = 0
    returned_debit_amount: Decimal = Decimal('0.00')
    total_emi_amount: Decimal = Decimal('0.00')
    total_cash_withdrawal: Decimal = Decimal('0.00')
    income_stability_score: float = 0.0
    expense_volatility_score: float = 0.0
    negative_balance_days: int = 0

    @field_serializer('returned_debit_amount', 'total_emi_amount', 'total_cash_withdrawal')
    def serialize_decimal(self, v: Decimal, _info) -> str:
        return f"{v:.2f}"

