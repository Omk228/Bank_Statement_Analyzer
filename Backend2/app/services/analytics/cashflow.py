from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any
from ...models.transaction import NormalizedTransaction
from ...models.analytics import MonthlyCashFlow


class CashFlowEngine:
    @classmethod
    def calculate_monthly_cash_flow(cls, transactions: List[NormalizedTransaction]) -> List[MonthlyCashFlow]:
        """
        Groups transactions by month (YYYY-MM) and computes monthly inflow, outflow, savings, and balances using Decimal.
        """
        monthly_groups: Dict[str, List[NormalizedTransaction]] = {}

        for t in transactions:
            m_key = t.date[:7] if len(t.date) >= 7 else "2026-01"
            if m_key not in monthly_groups:
                monthly_groups[m_key] = []
            monthly_groups[m_key].append(t)

        result: List[MonthlyCashFlow] = []

        for m_key in sorted(monthly_groups.keys(), reverse=True):
            txns = monthly_groups[m_key]
            income = sum([t.credit for t in txns if t.credit > Decimal('0.00')], Decimal('0.00'))
            expenses = sum([t.debit for t in txns if t.debit > Decimal('0.00')], Decimal('0.00'))
            income = income.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            expenses = expenses.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            saving = (income - expenses).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            saving_ratio = round(float(saving / income), 4) if income > Decimal('0.00') else 0.0
            inc_exp_ratio = round(float(income / expenses), 4) if expenses > Decimal('0.00') else 1.0

            balances = [t.balance for t in txns if t.balance is not None]
            min_bal = min(balances).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if balances else Decimal('0.00')
            max_bal = max(balances).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if balances else Decimal('0.00')
            avg_bal = (sum(balances, Decimal('0.00')) / Decimal(len(balances))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if balances else Decimal('0.00')
            open_bal = balances[0].quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if balances else Decimal('0.00')
            close_bal = balances[-1].quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if balances else Decimal('0.00')

            result.append(
                MonthlyCashFlow(
                    month=m_key,
                    full_month=len(txns) >= 8,
                    income_amount=income,
                    expenses_amount=-expenses,
                    saving_amount=saving,
                    saving_ratio=saving_ratio,
                    income_expenses_ratio=inc_exp_ratio,
                    opening_balance=open_bal,
                    closing_balance=close_bal,
                    average_balance=avg_bal,
                    minimum_balance=min_bal,
                    maximum_balance=max_bal,
                    transaction_count=len(txns),
                )
            )

        return result

