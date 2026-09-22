from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class FraudRuleResult(BaseModel):
    rule_id: str  # FA_01 .. FA_34
    name: str
    category: str  # 'accounting', 'behavioural', 'transactional'
    triggered: bool
    identified: str = "NO"  # "YES" or "NO"
    severity: str = "LOW"   # 'HIGH', 'MEDIUM', 'LOW'
    confidence: float = 1.0
    description: str = ""
    evidence: Optional[str] = None
    transaction_ids: List[str] = Field(default_factory=list)


class FraudEvaluation(BaseModel):
    total_rules_evaluated: int = 34
    triggered_rules_count: int = 0
    overall_fraud_risk: str = "LOW"  # 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    risk_score: float = 0.0  # 0 to 100
    rules: List[FraudRuleResult] = Field(default_factory=list)
