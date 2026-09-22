from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class BankProfile(BaseModel):
    bank_name: str
    aliases: List[str]
    ifsc_prefix: Optional[str] = None
    micr_pattern: Optional[str] = None
    account_regex: Optional[str] = None
    keywords: List[str] = []


BANK_PROFILES: List[BankProfile] = [
    BankProfile(
        bank_name="Kotak Mahindra Bank",
        aliases=["kotak", "kotak mahindra", "kotak bank", "kkbk"],
        ifsc_prefix="KKBK",
        keywords=["kotak", "kmbl", "kotak.com", "811", "crn"],
    ),
    BankProfile(
        bank_name="Axis Bank",
        aliases=["axis", "axis bank", "utib"],
        ifsc_prefix="UTIB",
        keywords=["axis", "axisbank", "burgundy", "priority banking"],
    ),
    BankProfile(
        bank_name="HDFC Bank",
        aliases=["hdfc", "hdfc bank", "hdfcbank"],
        ifsc_prefix="HDFC",
        keywords=["hdfc", "hdfcbank.com", "classic", "imperia", "preferred"],
    ),
    BankProfile(
        bank_name="State Bank of India",
        aliases=["sbi", "state bank", "state bank of india", "sbin"],
        ifsc_prefix="SBIN",
        keywords=["sbi", "onlinesbi", "state bank", "yono"],
    ),
    BankProfile(
        bank_name="ICICI Bank",
        aliases=["icici", "icici bank", "icic"],
        ifsc_prefix="ICIC",
        keywords=["icici", "icicibank.com", "wealth management", "privilege"],
    ),
    BankProfile(
        bank_name="Punjab National Bank",
        aliases=["pnb", "punjab national bank", "punb"],
        ifsc_prefix="PUNB",
        keywords=["pnb", "punjab national"],
    ),
    BankProfile(
        bank_name="Bank of Baroda",
        aliases=["bob", "bank of baroda", "barb"],
        ifsc_prefix="BARB",
        keywords=["bank of baroda", "bob world"],
    ),
    BankProfile(
        bank_name="Canara Bank",
        aliases=["canara", "canara bank", "cnrb"],
        ifsc_prefix="CNRB",
        keywords=["canara bank", "canara"],
    ),
    BankProfile(
        bank_name="Standard Chartered Bank",
        aliases=["standard chartered", "scb", "sc"],
        ifsc_prefix="SCBL",
        keywords=["standard chartered", "sc.com"],
    ),
    BankProfile(
        bank_name="HSBC",
        aliases=["hsbc", "hsbc bank", "hongkong and shanghai"],
        ifsc_prefix="HSBC",
        keywords=["hsbc", "hsbc.co.in"],
    ),
]


def match_bank_profile(text: str) -> Optional[BankProfile]:
    """
    Finds a matching BankProfile based on text narration and keywords.
    """
    if not text:
        return None
    lower = text.lower()
    for prof in BANK_PROFILES:
        for alias in prof.aliases:
            if alias in lower:
                return prof
        if prof.ifsc_prefix and prof.ifsc_prefix.lower() in lower:
            return prof
    return None
