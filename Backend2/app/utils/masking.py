import re
from typing import Optional


def mask_account_number(acc: Optional[str]) -> str:
    """
    Masks account number keeping only last 4 digits visible: XXXXXX9513
    """
    if not acc:
        return "XXXXXXXXXXXX"
    
    clean = re.sub(r'[\s\-]', '', str(acc))
    if len(clean) <= 4:
        return clean
    
    masked_part = "X" * max(4, len(clean) - 4)
    last_4 = clean[-4:]
    return f"{masked_part}{last_4}"


def mask_pan(pan: Optional[str]) -> str:
    if not pan:
        return "XXXXX0000X"
    clean = pan.strip().upper()
    if len(clean) == 10:
        return f"{clean[:5]}****{clean[-1]}"
    return clean


def mask_phone(phone: Optional[str]) -> str:
    if not phone:
        return "XXXXXX0000"
    clean = re.sub(r'\D', '', phone)
    if len(clean) >= 10:
        return f"XXXXXX{clean[-4:]}"
    return clean
