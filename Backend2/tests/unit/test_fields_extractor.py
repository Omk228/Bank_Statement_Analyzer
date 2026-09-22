import pytest
from Backend2.app.models.document import PageExtractionResult, SpatialToken
from Backend2.app.services.extraction.fields import UniversalFieldExtractor


def test_reject_generic_holder_labels():
    """
    Tests that generic account labels like 'Primary Account', 'Savings Account',
    'Customer', 'Bank Statement', etc. are rejected and holder_name returns None.
    """
    p1_text = """
    Kotak Mahindra Bank
    Primary Account
    Account Number: 918273645012
    IFSC: KKBK0004587
    Statement Period: 01/08/2026 to 31/08/2026
    """
    page = PageExtractionResult(
        page_number=1,
        extraction_method="NATIVE",
        raw_text=p1_text,
        tokens=[SpatialToken(text=w, x0=10, y0=10, x1=50, y1=20) for w in p1_text.split()],
    )

    acc_info, period, balances = UniversalFieldExtractor.extract_all_fields([page], detected_bank="Kotak Mahindra Bank")
    assert acc_info.holder_name is None
    assert acc_info.account_number_raw == "918273645012"
    assert acc_info.account_number_masked == "XXXXXXXX5012"
    assert acc_info.ifsc == "KKBK0004587"


def test_extract_valid_account_holder_with_salutation():
    """
    Tests that a valid name with a salutation or 'Customer Name:' prefix is correctly extracted.
    """
    p1_text = """
    HDFC Bank
    Customer Name: Vikramaditya Singhania
    Account Number: 50100234567891
    IFSC: HDFC0000128
    Statement Period: 01/08/2026 to 31/08/2026
    """
    page = PageExtractionResult(
        page_number=1,
        extraction_method="NATIVE",
        raw_text=p1_text,
        tokens=[SpatialToken(text=w, x0=10, y0=10, x1=50, y1=20) for w in p1_text.split()],
    )

    acc_info, period, balances = UniversalFieldExtractor.extract_all_fields([page], detected_bank="HDFC Bank")
    assert acc_info.holder_name == "Vikramaditya Singhania"
    assert acc_info.account_number_raw == "50100234567891"
    assert acc_info.account_number_masked.endswith("7891")
    assert acc_info.ifsc == "HDFC0000128"



def test_account_number_rejects_alphabetic_words():
    """
    Tests that words like 'transactions' or 'statement' are never mistakenly extracted as account numbers.
    """
    p1_text = """
    Axis Bank
    Account Transactions for Period
    Account Number: 912010034567892
    IFSC: UTIB0000056
    """
    page = PageExtractionResult(
        page_number=1,
        extraction_method="NATIVE",
        raw_text=p1_text,
        tokens=[SpatialToken(text=w, x0=10, y0=10, x1=50, y1=20) for w in p1_text.split()],
    )

    acc_info, period, balances = UniversalFieldExtractor.extract_all_fields([page], detected_bank="Axis Bank")
    assert acc_info.account_number_raw == "912010034567892"
    assert "transactions" not in (acc_info.account_number_raw or "").lower()
