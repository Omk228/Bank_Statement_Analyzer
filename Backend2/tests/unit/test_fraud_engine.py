import pytest
from Backend2.app.models.transaction import NormalizedTransaction
from Backend2.app.services.fraud.engine import FraudEngine


def test_fraud_engine_clean_transactions():
    txns = [
        NormalizedTransaction(
            transaction_id="TXN_001",
            date="2026-08-01",
            raw_narration="Salary Credit",
            description="Salary Credit",
            debit=0.0,
            credit=48325.50,
            amount=48325.50,
            type="CREDIT",
            balance=48325.50,
            payment_mode="NEFT",
            category="Salary",
            confidence_score=1.0,
        ),
        NormalizedTransaction(
            transaction_id="TXN_002",
            date="2026-08-05",
            raw_narration="Groceries Grocery Store",
            description="Groceries Grocery Store",
            debit=3450.25,
            credit=0.0,
            amount=3450.25,
            type="DEBIT",
            balance=44875.25,
            payment_mode="UPI",
            category="Groceries",
            confidence_score=1.0,
        ),
    ]

    rules = FraudEngine.evaluate_all_rules(
        transactions=txns,
        total_credits=48325.50,
        total_debits=3450.25,
        opening_balance=0.0,
        closing_balance=44875.25,
        average_balance=46600.0,
    )

    assert len(rules) == 34
    triggered = [r for r in rules if r.triggered]
    assert len(triggered) == 0


def test_fraud_engine_triggered_anomalies():
    txns = [
        NormalizedTransaction(
            transaction_id="TXN_001",
            date="2026-08-01",
            raw_narration="Crypto Exchange Binance Outflow",
            description="Crypto Exchange Binance Outflow",
            debit=60000.0,
            credit=0.0,
            amount=60000.0,
            type="DEBIT",
            balance=-1000.0,  # Negative balance breach
            payment_mode="NETBANKING",
            category="Crypto",
            confidence_score=1.0,
        ),
        NormalizedTransaction(
            transaction_id="TXN_002",
            date="2026-08-02",
            raw_narration="Cheque Bounce Penal Return Charges",
            description="Cheque Bounce Penal Return Charges",
            debit=500.0,
            credit=0.0,
            amount=500.0,
            type="DEBIT",
            balance=-1500.0,
            payment_mode="CHARGES",
            category="Bank Charges",
            confidence_score=1.0,
        ),
        NormalizedTransaction(
            transaction_id="TXN_003",
            date="2026-08-03",
            raw_narration="Dream11 Gaming Gateway Wagering",
            description="Dream11 Gaming Gateway Wagering",
            debit=2000.0,
            credit=0.0,
            amount=2000.0,
            type="DEBIT",
            balance=-3500.0,
            payment_mode="UPI",
            category="Gambling",
            confidence_score=1.0,
        ),
    ]

    rules = FraudEngine.evaluate_all_rules(
        transactions=txns,
        total_credits=0.0,
        total_debits=62500.0,
        opening_balance=59000.0,
        closing_balance=-3500.0,
        average_balance=10000.0,
    )

    triggered_ids = {r.rule_id for r in rules if r.triggered}
    
    # FA_02: Round Figure Structuring (60000 % 10000 == 0)
    assert "FA_02" in triggered_ids
    # FA_03: Negative Balance Breach (-1000.0)
    assert "FA_03" in triggered_ids
    # FA_06: Bounced / Returned Debits
    assert "FA_06" in triggered_ids
    # FA_18: Gambling / Betting Outflows (Dream11)
    assert "FA_18" in triggered_ids
    # FA_19: Crypto Exchange Transfers (Binance)
    assert "FA_19" in triggered_ids
