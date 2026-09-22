from decimal import Decimal
import pytest
from app.utils.dates import parse_universal_date, extract_period_dates
from app.utils.amounts import clean_amount_string, clean_amount_to_decimal, parse_amount_with_indicator


def test_universal_date_parser():
    # ISO
    assert parse_universal_date("2026-08-15") == "2026-08-15"
    # DD/MM/YYYY
    assert parse_universal_date("15/08/2026") == "2026-08-15"
    # DD-MM-YYYY
    assert parse_universal_date("15-08-2026") == "2026-08-15"
    # DD-MMM-YYYY
    assert parse_universal_date("15-Aug-2026") == "2026-08-15"
    # DD MMM YYYY
    assert parse_universal_date("15 Aug 2026") == "2026-08-15"
    # MMM DD, YYYY
    assert parse_universal_date("Aug 15, 2026") == "2026-08-15"
    # Invalid
    assert parse_universal_date("invalid_date") is None


def test_extract_period_dates():
    text1 = "Statement Period: 01/08/2026 to 31/08/2026 for Account 12345"
    s1, e1 = extract_period_dates(text1)
    assert s1 == "2026-08-01"
    assert e1 == "2026-08-31"

    text2 = "From 01-Aug-2026 - 31-Aug-2026"
    s2, e2 = extract_period_dates(text2)
    assert s2 == "2026-08-01"
    assert e2 == "2026-08-31"


def test_amount_cleaning():
    # Standard format
    assert clean_amount_string("1,234.56") == 1234.56
    assert clean_amount_to_decimal("1,234.56") == Decimal('1234.56')
    # With Currency symbol
    assert clean_amount_string("₹50,000.00") == 50000.00
    assert clean_amount_to_decimal("₹50,000.00") == Decimal('50000.00')
    assert clean_amount_string("$1,234.56") == 1234.56
    # Negative with minus
    assert clean_amount_string("-1,234.56") == -1234.56
    assert clean_amount_to_decimal("-1,234.56") == Decimal('-1234.56')
    # Negative with parentheses
    assert clean_amount_string("(1,234.56)") == -1234.56
    assert clean_amount_to_decimal("(1,234.56)") == Decimal('-1234.56')
    # European format
    assert clean_amount_string("1.234,56") == 1234.56
    assert clean_amount_to_decimal("1.234,56") == Decimal('1234.56')


def test_parse_amount_with_indicator():
    amt, ind = parse_amount_with_indicator("1,234.56 Cr")
    assert amt == Decimal('1234.56')
    assert ind == "CREDIT"

    amt, ind = parse_amount_with_indicator("500.00 Dr")
    assert amt == Decimal('500.00')
    assert ind == "DEBIT"

