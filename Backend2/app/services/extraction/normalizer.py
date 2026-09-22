import re
from decimal import Decimal
from typing import Optional, Tuple
from ...models.transaction import ColumnRange
from ...utils.amounts import clean_amount_to_decimal, parse_amount_with_indicator
from ...utils.dates import parse_universal_date


class TransactionNormalizer:
    @classmethod
    def classify_debit_credit(
        cls,
        amount_raw: str,
        col_type: Optional[str],
        description: str,
        prev_balance: Optional[Decimal] = None,
        curr_balance: Optional[Decimal] = None,
    ) -> Tuple[Decimal, Decimal, str]:
        """
        Determines (debit, credit, type) using multiple signals:
        1. Column Type (DEBIT vs CREDIT)
        2. Indicator strings (DR vs CR)
        3. Balance chain differential (curr_balance - prev_balance)
        4. Narration semantics (Salary, Refund, Deposit vs Purchase, Withdrawal, Transfer)
        """
        cleaned_amt, indicator = parse_amount_with_indicator(amount_raw)
        if cleaned_amt is None or cleaned_amt == Decimal('0.00'):
            return Decimal('0.00'), Decimal('0.00'), "DEBIT"

        amt = abs(cleaned_amt)
        desc_lower = description.lower()

        # Signal 1: Running Balance Differential (Highest Mathematical Precision)
        if prev_balance is not None and curr_balance is not None:
            diff = curr_balance - prev_balance
            if abs(abs(diff) - amt) <= Decimal('0.05'):
                if diff > Decimal('0.00'):
                    return Decimal('0.00'), amt, "CREDIT"
                elif diff < Decimal('0.00'):
                    return amt, Decimal('0.00'), "DEBIT"

        # Signal 2: Explicit Column Type
        if col_type == 'CREDIT':
            return Decimal('0.00'), amt, "CREDIT"
        elif col_type == 'DEBIT':
            return amt, Decimal('0.00'), "DEBIT"

        # Signal 3: Explicit DR/CR Indicator
        if indicator == 'CREDIT':
            return Decimal('0.00'), amt, "CREDIT"
        elif indicator == 'DEBIT':
            return amt, Decimal('0.00'), "DEBIT"

        # Signal 4: Narration Semantic Signals
        if re.search(r'\b(salary|payroll|refund|credit|reversed|inward|interest\s*credit)\b', desc_lower):
            return Decimal('0.00'), amt, "CREDIT"
        elif re.search(r'\b(atm|withdrawal|purchase|pos|emi|debit|charge|fee|paid\s*to)\b', desc_lower):
            return amt, Decimal('0.00'), "DEBIT"

        # Default fallback
        return amt, Decimal('0.00'), "DEBIT"

