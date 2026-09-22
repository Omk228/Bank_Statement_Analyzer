from decimal import Decimal
import pytest
from app.models.document import PageExtractionResult
from app.models.transaction import NormalizedTransaction
from app.services.extraction.completeness import CompletenessChecker
from app.services.analytics.summary import FinancialSummaryEngine


def test_four_pillar_integrity_engine_green():
    pages = [
        PageExtractionResult(page_number=1, extraction_method="OCR", confidence=0.96),
        PageExtractionResult(page_number=2, extraction_method="OCR", confidence=0.94),
    ]
    # Synthetic ledger: Opening = 50.64, Credits = 33242.00, Debits = 33282.00, Closing = 10.64
    transactions = [
        NormalizedTransaction(
            transaction_id="1", date="2026-08-01", description="Inflow 1", type="CREDIT",
            debit=Decimal('0.00'), credit=Decimal('33242.00'), amount=Decimal('33242.00'), balance=Decimal('33292.64')
        ),
        NormalizedTransaction(
            transaction_id="2", date="2026-08-02", description="Outflow 1", type="DEBIT",
            debit=Decimal('33282.00'), credit=Decimal('0.00'), amount=Decimal('33282.00'), balance=Decimal('10.64')
        ),
    ]

    audit_report = {
        "total_candidate_rows": 4,
        "accepted_transactions": 2,
        "merged_continuation_rows": 0,
        "header_rows_removed": 1,
        "non_transaction_rows_removed": 1,
        "duplicate_rows": 0,
        "suspicious_rows": 0,
    }

    res = CompletenessChecker.verify_document_completeness(
        pages=pages,
        transactions=transactions,
        opening_balance=Decimal('50.64'),
        closing_balance=Decimal('10.64'),
        stated_closing_balance=Decimal('10.64'),
        stated_total_credits=Decimal('33242.00'),
        stated_total_debits=Decimal('33282.00'),
        audit_report=audit_report,
        classification_conf=0.98,
    )

    report = res["integrity_report"]
    assert res["integrity_status"] == "GREEN"
    assert report.check_a_ledger_arithmetic.status == "PASS"
    assert report.check_b_statement_reconciliation.status == "PASS"
    assert report.check_c_running_balance_continuity.status == "PASS"
    assert report.check_d_transaction_completeness.status == "PASS"
    assert res["continuity_failed_count"] == 0

    # Test summary engine integration
    summary = FinancialSummaryEngine.calculate_summary(
        transactions=transactions,
        explicit_opening=Decimal('50.64'),
        explicit_closing=Decimal('10.64'),
        explicit_stated_credits=Decimal('33242.00'),
        explicit_stated_debits=Decimal('33282.00'),
        period_days=31,
    )
    summary.integrity_report = report
    summary.confidence_decomposition = res["confidence_decomposition"]

    assert summary.opening_balance == Decimal('50.64')
    assert summary.calculated_closing_balance == Decimal('10.64')
    assert summary.total_credits == Decimal('33242.00')
    assert summary.total_debits == Decimal('33282.00')
    assert summary.balance_reconciled is True
    assert summary.reconciliation_difference == Decimal('0.00')


def test_four_pillar_integrity_engine_red_on_broken_arithmetic():
    pages = [PageExtractionResult(page_number=1, extraction_method="NATIVE")]
    # Broken ledger: Opening = 50.64, Credits = 33242.00, Debits = 40124.64, Final Balance = 10.64
    transactions = [
        NormalizedTransaction(
            transaction_id="1", date="2026-08-01", description="Txn", type="DEBIT",
            debit=Decimal('40124.64'), credit=Decimal('0.00'), amount=Decimal('40124.64'), balance=Decimal('10.64')
        ),
    ]

    res = CompletenessChecker.verify_document_completeness(
        pages=pages,
        transactions=transactions,
        opening_balance=Decimal('50.64'),
        closing_balance=Decimal('10.64'),
        stated_closing_balance=Decimal('10.64'),
    )

    report = res["integrity_report"]
    assert res["integrity_status"] == "RED"
    assert report.check_a_ledger_arithmetic.status == "FAIL"
    assert report.check_b_statement_reconciliation.status == "FAIL"
