import re
from datetime import datetime
from typing import Optional, Tuple, List

MONTH_NAME_MAP = {
    "jan": "01", "january": "01",
    "feb": "02", "february": "02",
    "mar": "03", "march": "03",
    "apr": "04", "april": "04",
    "may": "05",
    "jun": "06", "june": "06",
    "jul": "07", "july": "07",
    "aug": "08", "august": "08", "aus": "08", "avg": "08", "auq": "08",
    "sep": "09", "september": "09", "sept": "09",
    "oct": "10", "october": "10",
    "nov": "11", "november": "11",
    "dec": "12", "december": "12",
}

DATE_REGEX_PATTERNS = [
    # YYYY-MM-DD
    (r'\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b', '%Y-%m-%d'),
    # DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    (r'\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](20\d{2}|\d{2})\b', 'DMY'),
    # DD-MMM-YYYY or DD MMM YYYY (e.g. 01 Aug 2026, 01-Aug-2026, 01Aug 2026)
    (r'\b(0[1-9]|[12]\d|3[01])[\s\-_/]*([a-zA-Z]{3,9})[\s\-_/]+(20\d{2}|\d{2})\b', 'DMONTHY'),
    # MMM DD, YYYY or MMM DD YYYY (e.g. Aug 01, 2026)
    (r'\b([a-zA-Z]{3,9})[\s\-_/]+(0[1-9]|[12]\d|3[01])(?:,)?[\s\-_/]+(20\d{2}|\d{2})\b', 'MONTHDY'),
]


def _sanitize_ocr_date_chunk(chunk: str) -> str:
    """
    Substitutes common OCR glyph confusions in numeric date fragments:
    'O' or 'o' -> '0', 'I' or 'l' or '|' -> '1', 'B' -> '8', 'S' -> '5', 'Z' -> '2'
    """
    clean = chunk
    # Replace common OCR digit errors in date prefix/day
    clean = clean.replace('O8', '08').replace('O9', '09').replace('O1', '01').replace('O2', '02').replace('O3', '03').replace('O4', '04').replace('O5', '05').replace('O6', '06').replace('O7', '07')
    clean = re.sub(r'\b[oO](\d)\b', r'0\1', clean)
    clean = re.sub(r'\b[lI](\d)\b', r'1\1', clean)
    return clean


def parse_universal_date(date_str: str) -> Optional[str]:
    """
    Parses any valid date string into strict ISO YYYY-MM-DD.
    Handles OCR misrecognitions (O/0, l/1, B/8), missing intra-token spaces (01Aug 2026),
    leading serial row numbers, and multiple global date formats.
    Returns None if unparseable.
    """
    if not date_str:
        return None
    
    clean_str = date_str.strip()
    
    # Check direct ISO format
    if re.match(r'^\d{4}-\d{2}-\d{2}$', clean_str):
        try:
            datetime.strptime(clean_str, '%Y-%m-%d')
            return clean_str
        except ValueError:
            return None

    # Try candidate strings: raw string, and OCR-sanitized string
    candidates = [clean_str]
    sanitized = _sanitize_ocr_date_chunk(clean_str)
    if sanitized != clean_str:
        candidates.append(sanitized)

    for cand in candidates:
        # 1. Try DD-MMM-YYYY / DD MMM YYYY / DD-MMM-YY / DDMMM YYYY (e.g. 01Aug 2026)
        m_dmonthy = re.search(r'\b(0?[1-9]|[12]\d|3[01])[\s\-_/]*([a-zA-Z]{3,9})[\s\-_/]+(20\d{2}|19\d{2}|\d{2})\b', cand)
        if m_dmonthy:
            day = m_dmonthy.group(1).zfill(2)
            m_name = m_dmonthy.group(2).lower()
            year = m_dmonthy.group(3)
            if len(year) == 2:
                year = f"20{year}"
            month = MONTH_NAME_MAP.get(m_name)
            if month:
                iso = f"{year}-{month}-{day}"
                try:
                    datetime.strptime(iso, '%Y-%m-%d')
                    return iso
                except ValueError:
                    pass

        # 2. Try MMM DD, YYYY / MMM DD YYYY
        m_monthdy = re.search(r'\b([a-zA-Z]{3,9})[\s\-_/]+(0?[1-9]|[12]\d|3[01])(?:,)?[\s\-_/]+(20\d{2}|19\d{2}|\d{2})\b', cand)
        if m_monthdy:
            m_name = m_monthdy.group(1).lower()
            day = m_monthdy.group(2).zfill(2)
            year = m_monthdy.group(3)
            if len(year) == 2:
                year = f"20{year}"
            month = MONTH_NAME_MAP.get(m_name)
            if month:
                iso = f"{year}-{month}-{day}"
                try:
                    datetime.strptime(iso, '%Y-%m-%d')
                    return iso
                except ValueError:
                    pass

        # 3. Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY or DD/MM/YY
        m_dmy = re.search(r'\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2}|19\d{2}|\d{2})\b', cand)
        if m_dmy:
            day = m_dmy.group(1).zfill(2)
            month = m_dmy.group(2).zfill(2)
            year = m_dmy.group(3)
            if len(year) == 2:
                year = f"20{year}"
            iso = f"{year}-{month}-{day}"
            try:
                datetime.strptime(iso, '%Y-%m-%d')
                return iso
            except ValueError:
                pass

        # 4. Try YYYY-MM-DD or YYYY/MM/DD
        m_ymd = re.search(r'\b(20\d{2}|19\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b', cand)
        if m_ymd:
            year = m_ymd.group(1)
            month = m_ymd.group(2).zfill(2)
            day = m_ymd.group(3).zfill(2)
            iso = f"{year}-{month}-{day}"
            try:
                datetime.strptime(iso, '%Y-%m-%d')
                return iso
            except ValueError:
                pass

    return None


def extract_period_dates(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Extracts statement Start Date and End Date from text context such as:
    'From 01/08/2026 to 31/08/2026' or 'Period: 01-Aug-2026 - 31-Aug-2026'.
    """
    if not text:
        return None, None

    # Contextual regex for range patterns
    range_patterns = [
        r'(?:period|statement\s+period|from|dated|duration)[\s:]*([^\n\r]+?)(?:to|through|-|–|\s+till\s+)([^\n\r,]+)',
        r'(?:between)[\s:]*([^\n\r]+?)(?:and)([^\n\r,]+)',
    ]

    for pat in range_patterns:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            start_cand = parse_universal_date(m.group(1))
            end_cand = parse_universal_date(m.group(2))
            if start_cand and end_cand:
                return start_cand, end_cand

    # Fallback: scan for any two dates ordered chronologically
    found_dates = []
    tokens = text.split()
    for i in range(len(tokens)):
        chunk = " ".join(tokens[i:i+4])
        d = parse_universal_date(chunk)
        if d and d not in found_dates:
            found_dates.append(d)

    if len(found_dates) >= 2:
        sorted_dates = sorted(found_dates)
        return sorted_dates[0], sorted_dates[-1]
    elif len(found_dates) == 1:
        return found_dates[0], found_dates[0]

    return None, None
