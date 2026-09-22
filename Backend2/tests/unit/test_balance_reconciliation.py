import pytest
from app.models.transaction import NormalizedTransaction
from app.services.analytics.summary import FinancialSummaryEngine


def test_balance_reconciliation_exact():
    # Opening 10000 + Credits 50000 - Debits 25650 = Closing 34350
    transactions = [
        NormalizedTransaction(
            transaction_id="1", date="2026-08-05", description="Salary", type="CREDIT",
            debit=0.0, credit=50000.0, amount=50000.0, balance=60000.0
        ),
        NormalizedTransaction(
            transaction_id="2", date="2026-08-10", description="Swiggy", type="DEBIT",
            debit=650.0, credit=0.0, amount=650.0, balance=59350.0
        ),
        NormalizedTransaction(
            transaction_id="3", date="2026-08-15", description="Cash WDL", type="DEBIT",
            debit=5000.0, credit=0.0, amount=5000.0, balance=54350.0
        ),
        NormalizedTransaction(
            transaction_id="4", date="2026-08-20", description="EMI", type="DEBIT",
            debit=20000.0, credit=0.0, amount=20000.0, balance=34350.0
        ),
    ]

    summary = FinancialSummaryEngine.calculate_summary(
        transactions=transactions,
        explicit_opening=10000.0,
        explicit_closing=34350.0,
        period_days=30,
    )

    assert summary.opening_balance == 10000.0
    assert summary.closing_balance == 34350.0
    assert summary.total_credits == 50000.0
    assert summary.total_debits == 25650.0
    assert summary.net_cash_flow == 24350.0
    assert summary.balance_reconciled is True
    assert summary.reconciliation_difference == 0.0
    assert len(summary.failed_transaction_ids) == 0


def test_balance_reconciliation_discrepancy():
    transactions = [
        NormalizedTransaction(
            transaction_id="1", date="2026-08-05", description="Income", type="CREDIT",
            debit=0.0, credit=1000.0, amount=1000.0, balance=2000.0
        ),
    ]

    # Stated closing balance 5000 when calculated is 2000
    summary = FinancialSummaryEngine.calculate_summary(
        transactions=transactions,
        explicit_opening=1000.0,
        explicit_closing=5000.0,
        period_days=30,
    )

    assert summary.balance_reconciled is False
    assert summary.reconciliation_difference == 3000.0
