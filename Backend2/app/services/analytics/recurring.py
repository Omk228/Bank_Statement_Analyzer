import re
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any
from ...models.transaction import NormalizedTransaction
from ...models.analytics import RecurringIncome


class RecurringIncomeDetector:
    @classmethod
    def detect_recurring_streams(cls, transactions: List[NormalizedTransaction]) -> List[RecurringIncome]:
        """
        Detects recurring salary and regular client income streams using Decimal.
        """
        credit_txns = [t for t in transactions if t.type == 'CREDIT' and t.credit > Decimal('0.00')]
        if not credit_txns:
            return []

        # Group by approximate description or amount
        candidate_groups: Dict[str, List[NormalizedTransaction]] = {}

        for t in credit_txns:
            desc_clean = re.sub(r'[\d/\-_]', '', t.description.lower()).strip()[:20]
            # Key by rounded amount bracket or description
            key = f"{desc_clean}_{round(float(t.credit) / 1000) * 1000}"
            if key not in candidate_groups:
                candidate_groups[key] = []
            candidate_groups[key].append(t)

        recurring_list: List[RecurringIncome] = []

        # Also search explicit salary credits
        salary_txns = [
            t for t in credit_txns
            if re.search(r'\b(salary|payroll|sprinklr|wipro|infosys|tcs|google|amazon|hcl|accenture|monthly\s*pay)\b', t.description.lower())
        ]

        if salary_txns:
            avg_amt = (sum([t.credit for t in salary_txns], Decimal('0.00')) / Decimal(len(salary_txns))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            recurring_list.append(
                RecurringIncome(
                    type="SALARY",
                    source=salary_txns[0].description,
                    monthly_average_amount=avg_amt,
                    frequency="MONTHLY",
                    matched_transactions_count=len(salary_txns),
                    matched_transaction_ids=[t.transaction_id for t in salary_txns],
                    confidence=0.96,
                )
            )

        return recurring_list

