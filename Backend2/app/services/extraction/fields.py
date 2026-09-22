import re
from decimal import Decimal
from typing import List, Optional, Tuple, Dict, Any
from ...models.document import PageExtractionResult, SpatialToken, BoundingBox
from ...models.account import ExtractedAccountInfo, BankInfo, StatementPeriod, FieldEvidence
from ..layout.regions import DocumentRegionDetector
from ...utils.dates import parse_universal_date, extract_period_dates
from ...utils.amounts import clean_amount_to_decimal, clean_amount_string
from ...utils.masking import mask_account_number


class UniversalFieldExtractor:
    @classmethod
    def extract_all_fields(
        cls, pages: List[PageExtractionResult], detected_bank: str = "Unknown Bank"
    ) -> Tuple[ExtractedAccountInfo, StatementPeriod, Dict[str, Any]]:
        """
        Extracts all account details, statement period, and opening/closing balances
        from semantic regions of the document, returning exact Python Decimals for amounts.
        """
        if not pages:
            return (
                ExtractedAccountInfo(confidence=0.0),
                StatementPeriod(confidence=0.0),
                {
                    "opening_balance": None,
                    "closing_balance": None,
                    "stated_closing_balance": None,
                    "stated_total_credits": None,
                    "stated_total_debits": None,
                },
            )

        page1 = pages[0]
        regions = DocumentRegionDetector.segment_page(page1)
        account_tokens = regions["ACCOUNT_INFORMATION"] or page1.tokens[:50]
        header_tokens = regions["HEADER"] or page1.tokens[:30]
        summary_tokens = regions["SUMMARY"] or page1.tokens[-50:]

        account_text = " ".join([t.text for t in account_tokens])
        summary_text_p1 = " ".join([t.text for t in summary_tokens])
        full_p1_text = page1.raw_text
        combined_all_text = " ".join([p.raw_text for p in pages])
        last_page_text = pages[-1].raw_text if pages else ""

        # 1. Extract IFSC
        ifsc_val = None
        m_ifsc = re.search(r'\b[A-Z]{4}0[A-Z0-9]{6}\b', combined_all_text)
        if m_ifsc:
            ifsc_val = m_ifsc.group(0)

        # 2. Extract MICR
        micr_val = None
        m_micr = re.search(r'\bmicr(?:\s*code)?[\s:.\-_]*(\d{9})\b', combined_all_text, flags=re.IGNORECASE)
        if m_micr:
            micr_val = m_micr.group(1)
        elif not ifsc_val:
            m_micr_gen = re.search(r'\b\d{9}\b', combined_all_text)
            if m_micr_gen:
                micr_val = m_micr_gen.group(0)

        # 3. Extract Account Number
        account_raw = None
        labeled_acc_patterns = [
            r'(?:account\s*(?:number|num|no)|a/c\s*(?:number|num|no)|acc\s*(?:no|number)|a/c)[\s:.\-_#]*([A-Za-z0-9]{8,22})',
            r'(?:account)[\s:.\-_#]+([A-Za-z0-9]{8,22})',
        ]
        non_acc_words = {"statement", "transactions", "particulars", "description", "information", "summary", "category", "financial", "details", "opening", "closing", "balance"}
        for pat in labeled_acc_patterns:
            for match in list(re.finditer(pat, account_text, flags=re.IGNORECASE)) + list(re.finditer(pat, full_p1_text, flags=re.IGNORECASE)):
                cand = match.group(1).strip()
                if (
                    len(cand) >= 8
                    and sum(c.isdigit() for c in cand) >= 4
                    and cand.lower() not in non_acc_words
                    and not re.match(r'^\d{4}[-/.]\d{2}[-/.]\d{2}$', cand)
                    and not re.match(r'^[A-Z]{4}0[A-Z0-9]{6}$', cand)
                ):
                    account_raw = cand
                    break
            if account_raw:
                break

        # Fallback to standalone digit sequence only if labeled search found nothing
        if not account_raw:
            for pat in [r'\b(\d{9,18})\b']:
                for match in list(re.finditer(pat, account_text)) + list(re.finditer(pat, full_p1_text)):
                    cand = match.group(1).strip()
                    if len(cand) >= 8 and cand != micr_val and cand != ifsc_val:
                        account_raw = cand
                        break
                if account_raw:
                    break

        # 4. Extract Account Holder Name via Semantic Label/Value and Spatial Association
        holder_name = None
        holder_blacklist = {
            "primary account", "account", "savings account", "current account",
            "primary", "customer", "statement", "details", "bank", "transactions",
            "savings", "current", "overdraft", "account holder", "customer name",
            "nominee", "branch", "ifsc", "micr", "period", "number", "type",
            "of", "date", "balance", "opening", "closing", "page", "total",
            "joint account", "joint", "resident", "individual", "salaried",
            "particulars", "description", "summary", "crn", "cif", "pan",
            "mobile", "email", "address", "registered", "branch code", "currency",
            "inr", "mode of operation", "nomination", "registered mobile",
            "customer id", "statement period", "statement date", "from date", "to date",
        }

        holder_patterns = [
            r'(?:customer\s*name|name\s*of\s*(?:the\s*)?(?:account\s*)?holder|account\s*holder(?:\s*name)?|a/c\s*holder(?:\s*name)?|primary\s*holder|account\s*name)[\s:.\-_#]*([A-Za-z\s.]{3,45})(?:\n|\r|,|account|a/c|address|cust|crn|cif|ifsc|micr|phone|mobile|$)',
            r'(?:m/s|mr\.|mrs\.|ms\.|shri|smt\.|dr\.)[\s:]*([A-Za-z\s.]{3,35})(?:\n|\r|,|account|a/c|address|cust|crn|cif|$)',
            r'(?:^|\n|\r)(?:name)[\s:.\-_]+([A-Za-z\s.]{3,35})(?:\n|\r|,|account|a/c|address|$)',
        ]

        def is_valid_holder_candidate(cand_text: str) -> bool:
            if not cand_text:
                return False
            clean = re.sub(r'[\s:.\-_#]+$', '', cand_text).strip()
            clean = re.sub(r'^[\s:.\-_#]+', '', clean).strip()
            clean_lower = clean.lower()
            if len(clean) < 3:
                return False
            # Must not contain digits
            if any(c.isdigit() for c in clean):
                return False
            # Must not match blacklisted generic terms or phrases
            if clean_lower in holder_blacklist:
                return False
            if any(term == clean_lower or clean_lower.startswith(f"{term} ") or clean_lower.endswith(f" {term}") for term in ["primary account", "savings account", "current account", "account details", "bank statement"]):
                return False
            # Must contain alphabetical letters
            words = [w for w in re.split(r'\s+', clean) if len(w) >= 2 and w.isalpha()]
            if not words:
                return False
            # Disallow pure single banking keywords
            if len(words) == 1 and words[0].lower() in holder_blacklist:
                return False
            return True

        for pat in holder_patterns:
            for match in list(re.finditer(pat, account_text, flags=re.IGNORECASE)) + list(re.finditer(pat, full_p1_text, flags=re.IGNORECASE)):
                cand = match.group(1).strip()
                if is_valid_holder_candidate(cand):
                    clean_res = re.sub(r'[\s:.\-_#]+$', '', cand).strip()
                    clean_res = re.sub(r'^[\s:.\-_#]+', '', clean_res).strip()
                    holder_name = clean_res.title()
                    break
            if holder_name:
                break

        if not holder_name:
            # Fallback 1: Scan top running header of continuation pages (Pages 2-7) where Holder Name is printed above Account Number
            for page in pages[1:]:
                top_tokens = [t for t in page.tokens if t.y0 < 35.0]
                if top_tokens:
                    # Group by line
                    top_line_tokens = [t for t in top_tokens if t.y0 < 25.0]
                    if top_line_tokens:
                        top_line_text = " ".join([t.text for t in sorted(top_line_tokens, key=lambda x: x.x0)]).strip()
                        if is_valid_holder_candidate(top_line_text):
                            holder_name = top_line_text.title()
                            break

        if not holder_name:
            # Fallback 2: Scan Page 1 lines in customer info block (y between 140 and 220, x < 300)
            p1_cust_tokens = [t for t in page1.tokens if 140.0 <= t.y0 <= 220.0 and t.x0 < 300.0]
            if p1_cust_tokens:
                # Group by line
                cust_lines: Dict[int, List[SpatialToken]] = {}
                for t in sorted(p1_cust_tokens, key=lambda x: x.y0):
                    matched_y = None
                    for y in cust_lines:
                        if abs(t.y0 - y) <= 4.0:
                            matched_y = y
                            break
                    if matched_y is not None:
                        cust_lines[matched_y].append(t)
                    else:
                        cust_lines[int(t.y0)] = [t]

                for y, toks in sorted(cust_lines.items()):
                    line_txt = " ".join([t.text for t in sorted(toks, key=lambda x: x.x0)]).strip()
                    # Clean out noise characters
                    clean_line = re.sub(r'[H;:.\-_#0-9]', '', line_txt).strip()
                    if is_valid_holder_candidate(clean_line):
                        holder_name = clean_line.title()
                        break

        # 5. Extract Statement Period
        start_date, end_date = extract_period_dates(full_p1_text)
        period_days = 30
        if start_date and end_date:
            try:
                from datetime import datetime
                d1 = datetime.strptime(start_date, "%Y-%m-%d")
                d2 = datetime.strptime(end_date, "%Y-%m-%d")
                diff = abs((d2 - d1).days)
                if diff > 0:
                    period_days = diff
            except Exception:
                pass

        # 6. Extract Opening and Stated Closing Balances + Summary Totals (Scoped to Page 1 / Summary)
        opening_balance: Optional[Decimal] = None
        stated_closing_balance: Optional[Decimal] = None
        stated_total_credits: Optional[Decimal] = None
        stated_total_debits: Optional[Decimal] = None

        # Scope opening balance to Page 1 first (Account Info / Summary / Overview) to avoid intermediate page brought-forward values
        open_patterns = [
            r'(?:opening\s*balance|beginning\s*balance|open\s*bal|op\s*bal)[\s:.\-_#=]*([₹$€\d,.\-]+)',
            r'(?:b/f|brought\s*forward)[\s:.\-_#=]*([₹$€\d,.\-]+)',
        ]
        for pat in open_patterns:
            # Check Page 1 summary region or Page 1 account info first
            m_open = re.search(pat, summary_text_p1, flags=re.IGNORECASE) or re.search(pat, full_p1_text, flags=re.IGNORECASE)
            if m_open:
                parsed_open = clean_amount_to_decimal(m_open.group(1))
                if parsed_open is not None:
                    opening_balance = parsed_open
                    break

        # Check Account Summary tables across all pages (e.g. Page 5 "Savings Account (SA): 50.64 10.64")
        for page in pages:
            text_p = page.raw_text
            m_summary = re.search(
                r'(?:savings\s*account|current\s*account|account\s*summary|particulars)[\s:.\-_#=(A-Za-z)]*:\s*([₹$€\d,.\-]+)\s+([₹$€\d,.\-]+)',
                text_p,
                flags=re.IGNORECASE,
            )
            if m_summary:
                open_cand = clean_amount_to_decimal(m_summary.group(1))
                close_cand = clean_amount_to_decimal(m_summary.group(2))
                if open_cand is not None and opening_balance is None:
                    opening_balance = open_cand
                if close_cand is not None and stated_closing_balance is None:
                    stated_closing_balance = close_cand

        # Fallback to combined text opening balance only if not found on page 1 / summary
        if opening_balance is None:
            for pat in open_patterns:
                m_open = re.search(pat, combined_all_text, flags=re.IGNORECASE)
                if m_open:
                    parsed_open = clean_amount_to_decimal(m_open.group(1))
                    if parsed_open is not None:
                        opening_balance = parsed_open
                        break

        # Stated closing balance (search last page first, then combined text)
        close_patterns = [
            r'(?:closing\s*balance|ending\s*balance|close\s*bal|cl\s*bal|total\s*closing\s*balance)[\s:.\-_#=]*([₹$€\d,.\-]+)',
            r'(?:c/f|carried\s*forward|available\s*balance)[\s:.\-_#=]*([₹$€\d,.\-]+)',
        ]
        if stated_closing_balance is None:
            for pat in close_patterns:
                m_close = re.search(pat, last_page_text, flags=re.IGNORECASE) or re.search(pat, combined_all_text, flags=re.IGNORECASE)
                if m_close:
                    parsed_close = clean_amount_to_decimal(m_close.group(1))
                    if parsed_close is not None:
                        stated_closing_balance = parsed_close
                        break

        # Stated Summary Totals (e.g. Total Credits / Deposits, Total Debits / Withdrawals)
        credit_summary_patterns = [
            r'(?:total\s*credits?|total\s*deposits?|total\s*cr(?:\.?\s*amount)?)[\s:.\-_#=]*([₹$€\d,.\-]+)',
        ]
        debit_summary_patterns = [
            r'(?:total\s*debits?|total\s*withdrawals?|total\s*dr(?:\.?\s*amount)?)[\s:.\-_#=]*([₹$€\d,.\-]+)',
        ]
        for pat in credit_summary_patterns:
            m_cr = re.search(pat, full_p1_text, flags=re.IGNORECASE) or re.search(pat, last_page_text, flags=re.IGNORECASE) or re.search(pat, combined_all_text, flags=re.IGNORECASE)
            if m_cr:
                parsed_cr = clean_amount_to_decimal(m_cr.group(1))
                if parsed_cr is not None:
                    stated_total_credits = parsed_cr
                    break

        for pat in debit_summary_patterns:
            m_dr = re.search(pat, full_p1_text, flags=re.IGNORECASE) or re.search(pat, last_page_text, flags=re.IGNORECASE) or re.search(pat, combined_all_text, flags=re.IGNORECASE)
            if m_dr:
                parsed_dr = clean_amount_to_decimal(m_dr.group(1))
                if parsed_dr is not None:
                    stated_total_debits = parsed_dr
                    break

        account_info = ExtractedAccountInfo(
            holder_name=holder_name,
            account_number_raw=account_raw,
            account_number_masked=mask_account_number(account_raw),
            account_type="Savings" if "saving" in combined_all_text.lower() else "Current",
            ifsc=ifsc_val,
            micr=micr_val,
            confidence=0.95 if (account_raw and holder_name) else 0.75,
        )

        statement_period = StatementPeriod(
            start_date=start_date,
            end_date=end_date,
            period_days=period_days,
            confidence=0.95 if (start_date and end_date) else 0.50,
        )

        return account_info, statement_period, {
            "opening_balance": opening_balance,
            "closing_balance": stated_closing_balance,
            "stated_closing_balance": stated_closing_balance,
            "stated_total_credits": stated_total_credits,
            "stated_total_debits": stated_total_debits,
        }


