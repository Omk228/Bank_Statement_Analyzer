import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Optional, Tuple


def clean_amount_to_decimal(raw: Optional[str]) -> Optional[Decimal]:
    """
    Parses complex numeric string into exact Python Decimal quantized to 2 decimal places.
    Handles:
    - 1,234.56 or 1234.56 or 1,23,456.78
    - ₹1,234.56, $1,234.56, €1.234,56
    - Negative: -1234.56, (1,234.56), 1,234.56 Cr / Dr
    Returns None if not a valid amount.
    """
    if not raw or not isinstance(raw, str):
        return None

    text = raw.strip()
    if not text:
        return None

    # Check for parentheses: (1,234.56) => negative
    is_negative = False
    if text.startswith('(') and text.endswith(')'):
        is_negative = True
        text = text[1:-1].strip()

    if text.startswith('-'):
        is_negative = True
        text = text[1:].strip()

    # Remove currency symbols and alphabetic characters
    text = re.sub(r'[₹$€£¥\sA-Za-z]', '', text)

    if not text:
        return None

    # Check European formatting: 1.234,56
    if re.match(r'^\d{1,3}(\.\d{3})+,\d{2}$', text):
        text = text.replace('.', '').replace(',', '.')
    # Check Indian / Standard formatting: 1,23,456.78 or 1,234.56
    elif ',' in text and '.' in text:
        if text.rfind(',') < text.rfind('.'):
            text = text.replace(',', '')
        else:
            text = text.replace('.', '').replace(',', '.')
    elif ',' in text and '.' not in text:
        parts = text.split(',')
        if len(parts) == 2 and len(parts[1]) == 2:
            text = text.replace(',', '.')
        else:
            text = text.replace(',', '')

    try:
        dec = Decimal(text).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return -dec if is_negative else dec
    except (InvalidOperation, TypeError, ValueError):
        return None


def clean_amount_string(raw: Optional[str]) -> Optional[float]:
    """Backwards-compatibility wrapper returning float."""
    dec = clean_amount_to_decimal(raw)
    return float(dec) if dec is not None else None


def parse_amount_with_indicator(raw: str) -> Tuple[Optional[Decimal], Optional[str]]:
    """
    Parses amount and detects explicit DR/CR indicators.
    Returns (abs_amount_decimal, 'DEBIT' | 'CREDIT' | None).
    """
    if not raw:
        return None, None

    text = raw.strip().upper()
    indicator = None

    if 'CR' in text or 'CREDIT' in text:
        indicator = 'CREDIT'
    elif 'DR' in text or 'DEBIT' in text:
        indicator = 'DEBIT'

    cleaned = clean_amount_to_decimal(raw)
    if cleaned is None:
        return None, indicator

    if cleaned < Decimal('0.00'):
        return abs(cleaned), 'DEBIT'
    elif indicator:
        return abs(cleaned), indicator
    else:
        return abs(cleaned), None


def join_column_faint_decimal_tokens(tokens: list, max_gap: float = 6.0) -> list:
    """
    Strictly joins adjacent tokens within the same OCR row and financial amount column
    where a faint decimal point was dropped into two separate tokens (e.g., '42' + '00' -> '42.00').
    
    Safety constraints:
    - Only applies within the same financial amount column.
    - Horizontal gap between curr.x1 and next.x0 must be <= max_gap points.
    - Next token must be exactly 2 digits (cents/paise).
    - Curr token must be valid integer/comma-separated digits.
    - Merged result must successfully parse into a valid Decimal.
    """
    if len(tokens) <= 1:
        return tokens

    sorted_toks = sorted(tokens, key=lambda t: t.x0)
    merged = []
    i = 0
    while i < len(sorted_toks):
        curr = sorted_toks[i]
        if i + 1 < len(sorted_toks):
            next_t = sorted_toks[i + 1]
            gap = next_t.x0 - curr.x1
            clean_curr = re.sub(r'[₹$€£¥\s]', '', curr.text)
            clean_next = next_t.text.strip()

            # Check if curr is integer/commas and next is exactly 2 digits without dot
            if (0.0 <= gap <= max_gap and 
                re.match(r'^\d{1,3}(,\d{3})*$', clean_curr) and 
                re.match(r'^\d{2}$', clean_next)):
                candidate_merged_text = f"{curr.text}.{next_t.text}"
                parsed_dec = clean_amount_to_decimal(candidate_merged_text)
                if parsed_dec is not None:
                    # Create combined token
                    from ..models.document import SpatialToken
                    combined_tok = SpatialToken(
                        text=candidate_merged_text,
                        confidence=min(curr.confidence, next_t.confidence),
                        x0=curr.x0,
                        y0=min(curr.y0, next_t.y0),
                        x1=next_t.x1,
                        y1=max(curr.y1, next_t.y1),
                        page_number=curr.page_number,
                        line_number=curr.line_number,
                        block_number=curr.block_number,
                    )
                    merged.append(combined_tok)
                    i += 2
                    continue

        merged.append(curr)
        i += 1

    return merged


