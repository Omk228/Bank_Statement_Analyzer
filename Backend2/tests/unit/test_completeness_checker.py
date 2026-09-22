import pytest
from app.models.document import PageExtractionResult
from app.models.transaction import NormalizedTransaction
from app.services.extraction.completeness import CompletenessChecker


def test_completeness_checker_valid_ledger():
    pages = [
        PageExtractionResult(page_number=1, extraction_method="NATIVE"),
        PageExtractionResult(page_number=2, extraction_method="NATIVE"),
    ]
    transactions = [
        NormalizedTransaction(
            transaction_id="1", date="2026-08-01", description="Txn 1", type="CREDIT",
            debit=0.0, credit=1000.0, amount=1000.0, balance=11000.0
        ),
        NormalizedTransaction(
            transaction_id="2", date="2026-08-02", description="Txn 2", type="DEBIT",
            debit=200.0, credit=0.0, amount=200.0, balance=10800.0  # 11000 - 200 = 10800
        ),
    ]

    res = CompletenessChecker.verify_document_completeness(
        pages, transactions, opening_balance=10000.0, closing_balance=10800.0
    )
    assert res["page_sequence_valid"] is True
    assert res["ledger_continuity_intact"] is True
    assert res["continuity_failed_count"] == 0
    assert res["ledger_reconciled"] is True
    assert res["completeness_score"] >= 0.95
    assert len(res["gaps_detected"]) == 0


def test_completeness_checker_broken_ledger():
    pages = [PageExtractionResult(page_number=1, extraction_method="NATIVE")]
    transactions = [
        NormalizedTransaction(
            transaction_id="1", date="2026-08-01", description="Txn 1", type="CREDIT",
            debit=0.0, credit=1000.0, amount=1000.0, balance=11000.0
        ),
        NormalizedTransaction(
            transaction_id="2", date="2026-08-02", description="Txn 2", type="DEBIT",
            debit=200.0, credit=0.0, amount=200.0, balance=5000.0  # Incorrect balance jump
        ),
    ]

    res = CompletenessChecker.verify_document_completeness(
        pages, transactions, opening_balance=10000.0, closing_balance=10800.0
    )
    assert res["ledger_continuity_intact"] is False
    assert res["continuity_failed_count"] == 1
    assert "2" in res["failed_transaction_ids"]
    assert len(res["gaps_detected"]) == 1
    assert res["gaps_detected"][0]["transaction_id"] == "2"
    assert res["gaps_detected"][0]["expected_balance"] == "10800.00"
    assert res["gaps_detected"][0]["actual_balance"] == "5000.00"
    assert res["completeness_score"] < 0.90

