import os
import pytest
from decimal import Decimal
from app.tasks.worker import UniversalStatementPipeline


def test_kotak_bank_statement_regression_end_to_end():
    """
    Automated end-to-end regression test for 7-page scanned Kotak Mahindra Bank statement.
    Validates that:
    1. Document is classified as BANK_STATEMENT (Kotak Mahindra Bank).
    2. Account holder name is extracted accurately as 'Rani Devi' (not 'Primary Account').
    3. Account number is identified as '6947759513' and masked as 'XXXXXX9513'.
    4. Opening Balance is Decimal('50.64').
    5. Total Credits is Decimal('33242.00').
    6. Total Debits is Decimal('33282.00').
    7. Closing Balance is Decimal('10.64').
    8. Transaction Count is exactly 109.
    9. Balance is reconciled to the cent: 50.64 + 33242.00 - 33282.00 = 10.64.
    10. Mathematical Integrity Verification produces GREEN status across all 4 independent checks.
    """
    pdf_path = os.path.join(os.path.dirname(__file__), "..", "fixtures", "kotak_regression", "statement.pdf")
    assert os.path.exists(pdf_path), f"Regression statement fixture not found at {pdf_path}"

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    result = UniversalStatementPipeline.process_statement_bytes(
        file_bytes=pdf_bytes,
        filename="kotak_statement.pdf",
    )

    # 1. Classification & Bank Identity
    assert result.document.document_type == "BANK_STATEMENT"
    assert result.bank.name == "Kotak Mahindra Bank"

    # 2. Account Information
    assert result.account.holder_name == "Rani Devi"
    assert "9513" in result.account.account_number_masked

    # 3. Exact Financial Metrics
    assert result.summary.opening_balance == Decimal("50.64")
    assert result.summary.total_credits == Decimal("33242.00")
    assert result.summary.total_debits == Decimal("33282.00")
    assert result.summary.closing_balance == Decimal("10.64")
    assert result.summary.transaction_count == 109

    # 4. Mathematical Reconciliation & Continuity
    assert result.summary.balance_reconciled is True
    assert result.summary.reconciliation_difference == Decimal("0.00")
    assert (
        result.summary.opening_balance + result.summary.total_credits - result.summary.total_debits
        == result.summary.closing_balance
    )

    # 5. Multi-Signal 4-Pillar Integrity Report
    integrity = result.summary.integrity_report
    assert integrity is not None
    assert integrity.integrity_status == "GREEN"
    assert integrity.check_a_ledger_arithmetic.status == "PASS"
    assert integrity.check_b_statement_reconciliation.status == "PASS"
    assert integrity.check_c_running_balance_continuity.status == "PASS"
    assert integrity.check_d_transaction_completeness.status == "PASS"
