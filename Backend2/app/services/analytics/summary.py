from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Dict, Any, Union
from ...models.transaction import NormalizedTransaction
from ...models.analytics import FinancialSummary
from ...core.config import settings
from ...utils.amounts import clean_amount_to_decimal


class FinancialSummaryEngine:
    @classmethod
    def calculate_summary(
        cls,
        transactions: List[NormalizedTransaction],
        explicit_opening: Optional[Union[Decimal, float, str]] = None,
        explicit_closing: Optional[Union[Decimal, float, str]] = None,
        explicit_stated_credits: Optional[Union[Decimal, float, str]] = None,
        explicit_stated_debits: Optional[Union[Decimal, float, str]] = None,
        period_days: int = 30,
    ) -> FinancialSummary:
        """
        Calculates financial summary using exact Python Decimal arithmetic.
        Maintains distinct transaction-derived totals and statement-stated totals.
        """
        # Convert any incoming numeric floats/strings to Decimal
        def to_dec(val: Any) -> Optional[Decimal]:
            if val is None:
                return None
            if isinstance(val, Decimal):
                return val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            return clean_amount_to_decimal(str(val))

        open_dec = to_dec(explicit_opening)
        close_dec = to_dec(explicit_closing)
        stated_cr_dec = to_dec(explicit_stated_credits)
        stated_dr_dec = to_dec(explicit_stated_debits)

        # 1. Compute Transaction-Derived Totals (Decimal)
        total_credits = sum([t.credit for t in transactions if t.credit > Decimal('0.00')], Decimal('0.00'))
        total_debits = sum([t.debit for t in transactions if t.debit > Decimal('0.00')], Decimal('0.00'))
        total_credits = total_credits.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        total_debits = total_debits.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        net_cash_flow = (total_credits - total_debits).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        credit_count = len([t for t in transactions if t.credit > Decimal('0.00')])
        debit_count = len([t for t in transactions if t.debit > Decimal('0.00')])

        # 2. Resolve Opening Balance
        if open_dec is not None:
            opening_balance = open_dec
        elif transactions and transactions[0].balance is not None:
            first_t = transactions[0]
            if first_t.type == "CREDIT":
                opening_balance = (first_t.balance - first_t.credit).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            else:
                opening_balance = (first_t.balance + first_t.debit).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        else:
            opening_balance = Decimal('0.00')

        # 3. Compute Calculated Closing Balance vs Stated Closing Balance
        calculated_closing = (opening_balance + total_credits - total_debits).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        stated_closing_balance = close_dec
        if stated_closing_balance is not None:
            closing_balance = stated_closing_balance
        elif transactions and transactions[-1].balance is not None:
            closing_balance = transactions[-1].balance.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        else:
            closing_balance = calculated_closing

        # 4. Average Balance (Decimal)
        valid_balances = [t.balance for t in transactions if t.balance is not None]
        if valid_balances:
            avg_balance = (sum(valid_balances) / Decimal(len(valid_balances))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        else:
            avg_balance = ((opening_balance + closing_balance) / Decimal('2.00')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # 5. Ledger Reconciliation Difference
        tolerance = Decimal(settings.RECONCILIATION_TOLERANCE_STR)
        if stated_closing_balance is not None:
            reconciliation_diff = abs(calculated_closing - stated_closing_balance).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            balance_reconciled = reconciliation_diff <= tolerance
        else:
            reconciliation_diff = Decimal('0.00')
            balance_reconciled = True

        # 6. Sequential Continuity Check on Transaction Rows
        failed_ids: List[str] = []
        suspicious_row_tolerance = Decimal(settings.SUSPICIOUS_ROW_TOLERANCE_STR)
        for i in range(1, len(transactions)):
            p = transactions[i - 1]
            c = transactions[i]
            if p.balance is not None and c.balance is not None:
                expected_row_balance = (p.balance + c.credit - c.debit).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                if abs(expected_row_balance - c.balance) > suspicious_row_tolerance:
                    failed_ids.append(c.transaction_id)

        return FinancialSummary(
            opening_balance=opening_balance,
            closing_balance=closing_balance,
            stated_closing_balance=stated_closing_balance,
            calculated_closing_balance=calculated_closing,
            total_credits=total_credits,
            total_debits=total_debits,
            transaction_derived_credits=total_credits,
            transaction_derived_debits=total_debits,
            statement_stated_credits=stated_cr_dec,
            statement_stated_debits=stated_dr_dec,
            net_cash_flow=net_cash_flow,
            average_balance=avg_balance,
            transaction_count=len(transactions),
            credit_count=credit_count,
            debit_count=debit_count,
            period_days=period_days,
            balance_reconciled=balance_reconciled,
            reconciliation_difference=reconciliation_diff,
            failed_transaction_ids=failed_ids,
        )

