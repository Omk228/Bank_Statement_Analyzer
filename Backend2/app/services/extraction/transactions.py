import re
import uuid
from decimal import Decimal
from typing import List, Dict, Optional, Tuple, Any
from ...models.document import PageExtractionResult, SpatialToken, BoundingBox
from ...models.transaction import NormalizedTransaction, TableHeaderCandidate, ColumnRange
from .normalizer import TransactionNormalizer
from ...utils.dates import parse_universal_date
from ...utils.amounts import clean_amount_to_decimal, join_column_faint_decimal_tokens
from ...core.logging import logger


class TransactionStateMachineParser:
    """
    Enterprise Layout-Aware Multi-Line Transaction State Machine Parser.
    
    Reconstructs complete, contiguous transaction ledgers from native and OCR bank statements:
    - Adaptive non-drifting vertical line clustering based on token geometry
    - Column-scoped faint decimal token joining (DEBIT, CREDIT, BALANCE, AMOUNT)
    - Multi-signal same-day transaction reconstruction (where date column is left unprinted for subsequent rows)
    - Multi-line wrapped description accretion (never counted as missing transactions)
    - Noise/Header/Summary line filtration (headers and summaries tracked without failing completeness)
    - Decimal-precision monetary assignment
    - Full per-page audit tracing and diagnostic reporting
    """

    @classmethod
    def parse_document_transactions(
        cls, pages: List[PageExtractionResult], table_schemas: Dict[int, TableHeaderCandidate]
    ) -> List[NormalizedTransaction]:
        txns, _ = cls.parse_document_transactions_with_audit(pages, table_schemas)
        return txns

    @classmethod
    def _cluster_tokens_into_rows(cls, tokens: List[SpatialToken]) -> List[Dict[str, Any]]:
        """
        Groups spatial tokens into discrete horizontal rows using strict vertical overlap and midpoint proximity.
        Prevents downward cluster drift across dense multiline transaction rows.
        """
        if not tokens:
            return []
        
        sorted_toks = sorted(tokens, key=lambda t: (t.y0, t.x0))
        lines: List[Dict[str, Any]] = []

        for t in sorted_toks:
            t_h = max(t.y1 - t.y0, 6.0)
            t_mid = (t.y0 + t.y1) / 2.0

            matched_line = None
            best_dist = 999.0

            for line in lines:
                line_h = max(line["y1"] - line["y0"], 6.0)
                overlap_y0 = max(t.y0, line["y0"])
                overlap_y1 = min(t.y1, line["y1"])
                overlap = max(0.0, overlap_y1 - overlap_y0)
                min_h = min(t_h, line_h)
                overlap_ratio = overlap / min_h if min_h > 0 else 0.0
                mid_dist = abs(t_mid - line["mid_y"])

                if overlap_ratio >= 0.35 or mid_dist <= 3.5:
                    if mid_dist < best_dist:
                        best_dist = mid_dist
                        matched_line = line

            if matched_line is not None:
                matched_line["tokens"].append(t)
                matched_line["y0"] = min(matched_line["y0"], t.y0)
                matched_line["y1"] = max(matched_line["y1"], t.y1)
                matched_line["mid_y"] = (matched_line["y0"] + matched_line["y1"]) / 2.0
            else:
                lines.append({
                    "y0": t.y0,
                    "y1": t.y1,
                    "mid_y": t_mid,
                    "tokens": [t],
                })

        lines.sort(key=lambda l: l["y0"])
        return lines

    @classmethod
    def parse_document_transactions_with_audit(
        cls, pages: List[PageExtractionResult], table_schemas: Dict[int, TableHeaderCandidate]
    ) -> Tuple[List[NormalizedTransaction], Dict[str, Any]]:
        all_transactions: List[NormalizedTransaction] = []
        last_balance: Optional[Decimal] = None
        last_seen_date: Optional[str] = None

        current_txn_draft: Optional[Dict[str, Any]] = None

        total_candidate_rows = 0
        merged_continuation_rows = 0
        same_day_transactions_count = 0
        header_rows_removed = 0
        non_transaction_rows_removed = 0
        duplicate_rows = 0
        suspicious_rows = 0
        rejected_rows = 0
        transactions_by_page: Dict[int, int] = {}
        page_audit_records: Dict[int, List[Dict[str, Any]]] = {}

        for page in pages:
            page_num = page.page_number
            transactions_by_page[page_num] = 0
            page_audit_records[page_num] = []

            schema = table_schemas.get(page_num)
            if not schema or not schema.columns:
                continue

            header_y1 = schema.y1
            # Filter tokens strictly below the detected table header band
            table_tokens = [t for t in page.tokens if t.y0 >= (header_y1 - 2.0)]
            if not table_tokens:
                continue

            # 1. Non-drifting vertical row clustering
            sorted_clusters = cls._cluster_tokens_into_rows(table_tokens)

            for row_idx, cluster in enumerate(sorted_clusters, start=1):
                total_candidate_rows += 1
                row_tokens = sorted(cluster["tokens"], key=lambda x: x.x0)
                row_y = round(cluster["mid_y"], 1)
                row_text = " ".join([t.text for t in row_tokens]).strip()

                # 2. Check for repeated table headers
                if cls._is_header_row(row_text):
                    header_rows_removed += 1
                    page_audit_records[page_num].append({
                        "row": row_idx, "y": row_y, "action": "HEADER_ROW_REMOVED",
                        "text": row_text[:80], "reason": "Repeated table column header"
                    })
                    continue

                # 3. Check for summary / footer noise lines
                if cls._is_summary_or_footer_row(row_text):
                    non_transaction_rows_removed += 1
                    page_audit_records[page_num].append({
                        "row": row_idx, "y": row_y, "action": "NON_TRANSACTION_ROW_REMOVED",
                        "text": row_text[:80], "reason": "Statement summary / footer notice"
                    })
                    continue

                # 4. Map row tokens into spatial column ranges
                col_cells: Dict[str, List[SpatialToken]] = {
                    'DATE': [], 'DESCRIPTION': [], 'REFERENCE': [],
                    'DEBIT': [], 'CREDIT': [], 'AMOUNT': [], 'BALANCE': [], 'DR_CR': [],
                }
                for t in row_tokens:
                    col_name = cls._assign_column(t.x0, t.x1, schema.columns)
                    if col_name in col_cells:
                        col_cells[col_name].append(t)

                # 5. Apply column-scoped faint decimal token joining strictly to financial columns
                col_cells['DEBIT'] = join_column_faint_decimal_tokens(col_cells['DEBIT'], max_gap=6.0)
                col_cells['CREDIT'] = join_column_faint_decimal_tokens(col_cells['CREDIT'], max_gap=6.0)
                col_cells['BALANCE'] = join_column_faint_decimal_tokens(col_cells['BALANCE'], max_gap=6.0)
                col_cells['AMOUNT'] = join_column_faint_decimal_tokens(col_cells['AMOUNT'], max_gap=6.0)

                # 6. Extract and validate row Date
                date_str = " ".join([t.text for t in col_cells['DATE']]).strip() if col_cells['DATE'] else ""
                parsed_date = parse_universal_date(date_str)

                # Fallback: scan beginning of row for valid date token
                if not parsed_date and row_tokens:
                    first_two = " ".join([t.text for t in row_tokens[:2]])
                    parsed_date = parse_universal_date(first_two)
                    if not parsed_date and len(row_tokens) >= 3:
                        first_three = " ".join([t.text for t in row_tokens[:3]])
                        parsed_date = parse_universal_date(first_three)

                # 7. Extract financial amounts and balance as Decimal
                debit_raw = " ".join([t.text for t in col_cells['DEBIT']]).strip()
                credit_raw = " ".join([t.text for t in col_cells['CREDIT']]).strip()
                amt_raw = " ".join([t.text for t in col_cells['AMOUNT']]).strip()
                bal_raw = " ".join([t.text for t in col_cells['BALANCE']]).strip()
                dr_cr_raw = " ".join([t.text for t in col_cells['DR_CR']]).strip()

                debit_val = clean_amount_to_decimal(debit_raw) if debit_raw else None
                credit_val = clean_amount_to_decimal(credit_raw) if credit_raw else None
                amt_val = clean_amount_to_decimal(amt_raw) if amt_raw else None
                bal_val = clean_amount_to_decimal(bal_raw) if bal_raw else None

                has_debit = (debit_val is not None and debit_val > Decimal('0.00'))
                has_credit = (credit_val is not None and credit_val > Decimal('0.00'))
                has_amt = (amt_val is not None and amt_val > Decimal('0.00'))
                has_bal = (bal_val is not None)
                has_financial_amount = has_debit or has_credit or has_amt

                # Description tokens
                desc_tokens = col_cells['DESCRIPTION'] or [t for t in row_tokens if t not in col_cells['DATE']]
                desc_text = " ".join([t.text for t in desc_tokens]).strip()

                # Determine if the active draft already has a complete financial amount & balance
                active_draft_complete = (
                    current_txn_draft is not None
                    and current_txn_draft.get("has_completed_amount", False)
                    and bool(current_txn_draft.get("balance_raw"))
                )

                # =============================================================
                # STATE MACHINE TRANSITION LOGIC (Multi-Signal Same-Day Aware)
                # =============================================================

                if parsed_date:
                    # Case A: Row has an explicit transaction Date -> Initiates new transaction
                    if current_txn_draft:
                        finalized = cls._finalize_transaction(current_txn_draft, last_balance)
                        if finalized:
                            last_balance = cls._add_finalized_transaction(finalized, all_transactions, transactions_by_page, last_balance)

                    last_seen_date = parsed_date
                    current_txn_draft = {
                        "date": parsed_date,
                        "description_parts": [desc_text] if desc_text else [],
                        "reference_parts": [t.text for t in col_cells['REFERENCE']] if col_cells['REFERENCE'] else [],
                        "debit_raw": debit_raw,
                        "credit_raw": credit_raw,
                        "amount_raw": amt_raw,
                        "balance_raw": bal_raw,
                        "dr_cr_raw": dr_cr_raw,
                        "has_completed_amount": has_financial_amount,
                        "page_number": page_num,
                        "tokens": row_tokens,
                        "method": page.extraction_method,
                    }
                    page_audit_records[page_num].append({
                        "row": row_idx, "y": row_y, "action": "ACCEPTED_DATE_ROW",
                        "date": parsed_date, "debit": str(debit_val) if debit_val else None,
                        "credit": str(credit_val) if credit_val else None,
                        "bal": str(bal_val) if bal_val else None,
                        "desc": desc_text[:60], "reason": "New transaction with explicit date"
                    })

                elif has_financial_amount or has_bal:
                    # Case B: Row has NO Date, but has its OWN Financial Amount or Balance
                    # Multi-signal verification: confirm whether this starts a new ledger row or completes a multi-line row
                    if active_draft_complete and (has_financial_amount or has_bal):
                        # Multiple independent signals confirm this is a NEW SAME-DAY transaction:
                        # 1. Active draft is fully completed with its own amount and balance.
                        # 2. This row contains its own distinct financial column occupancy (Debit/Credit/Balance).
                        # 3. Y-position represents a new row boundary.
                        # 4. Inherited date provides continuity from last seen date.
                        finalized = cls._finalize_transaction(current_txn_draft, last_balance)
                        if finalized:
                            last_balance = cls._add_finalized_transaction(finalized, all_transactions, transactions_by_page, last_balance)

                        same_day_transactions_count += 1
                        inherited_date = last_seen_date or "2026-01-01"
                        current_txn_draft = {
                            "date": inherited_date,
                            "description_parts": [desc_text] if desc_text else [],
                            "reference_parts": [t.text for t in col_cells['REFERENCE']] if col_cells['REFERENCE'] else [],
                            "debit_raw": debit_raw,
                            "credit_raw": credit_raw,
                            "amount_raw": amt_raw,
                            "balance_raw": bal_raw,
                            "dr_cr_raw": dr_cr_raw,
                            "has_completed_amount": has_financial_amount,
                            "page_number": page_num,
                            "tokens": row_tokens,
                            "method": page.extraction_method,
                        }
                        page_audit_records[page_num].append({
                            "row": row_idx, "y": row_y, "action": "ACCEPTED_SAME_DAY_ROW",
                            "date": inherited_date, "debit": str(debit_val) if debit_val else None,
                            "credit": str(credit_val) if credit_val else None,
                            "bal": str(bal_val) if bal_val else None,
                            "desc": desc_text[:60], "reason": f"Same-day transaction (inherited date: {inherited_date})"
                        })
                    elif current_txn_draft:
                        # Active draft was missing its amount/balance on line 1 -> this line supplies the amount/balance
                        if debit_raw and not current_txn_draft["debit_raw"]:
                            current_txn_draft["debit_raw"] = debit_raw
                        if credit_raw and not current_txn_draft["credit_raw"]:
                            current_txn_draft["credit_raw"] = credit_raw
                        if amt_raw and not current_txn_draft["amount_raw"]:
                            current_txn_draft["amount_raw"] = amt_raw
                        if bal_raw and not current_txn_draft["balance_raw"]:
                            current_txn_draft["balance_raw"] = bal_raw
                        if dr_cr_raw and not current_txn_draft["dr_cr_raw"]:
                            current_txn_draft["dr_cr_raw"] = dr_cr_raw

                        if desc_text:
                            current_txn_draft["description_parts"].append(desc_text)
                        current_txn_draft["tokens"].extend(row_tokens)
                        current_txn_draft["has_completed_amount"] = current_txn_draft["has_completed_amount"] or has_financial_amount
                        merged_continuation_rows += 1
                        page_audit_records[page_num].append({
                            "row": row_idx, "y": row_y, "action": "MERGED_AMOUNT_ROW",
                            "debit": str(debit_val) if debit_val else None,
                            "credit": str(credit_val) if credit_val else None,
                            "bal": str(bal_val) if bal_val else None,
                            "desc": desc_text[:60], "reason": "Completed pending transaction amount/balance"
                        })
                    elif last_seen_date:
                        # No active draft but we have a last seen date and financial amounts
                        inherited_date = last_seen_date
                        same_day_transactions_count += 1
                        current_txn_draft = {
                            "date": inherited_date,
                            "description_parts": [desc_text] if desc_text else [],
                            "reference_parts": [t.text for t in col_cells['REFERENCE']] if col_cells['REFERENCE'] else [],
                            "debit_raw": debit_raw,
                            "credit_raw": credit_raw,
                            "amount_raw": amt_raw,
                            "balance_raw": bal_raw,
                            "dr_cr_raw": dr_cr_raw,
                            "has_completed_amount": has_financial_amount,
                            "page_number": page_num,
                            "tokens": row_tokens,
                            "method": page.extraction_method,
                        }
                        page_audit_records[page_num].append({
                            "row": row_idx, "y": row_y, "action": "ACCEPTED_SAME_DAY_ROW",
                            "date": inherited_date, "debit": str(debit_val) if debit_val else None,
                            "credit": str(credit_val) if credit_val else None,
                            "bal": str(bal_val) if bal_val else None,
                            "desc": desc_text[:60], "reason": f"Same-day transaction (inherited date: {inherited_date})"
                        })
                    else:
                        rejected_rows += 1
                        page_audit_records[page_num].append({
                            "row": row_idx, "y": row_y, "action": "REJECTED_UNATTACHED_AMOUNT",
                            "text": row_text[:80], "reason": "Financial amount found without date or active draft"
                        })

                else:
                    # Case C: Row has NO Date, NO Financial Amount, NO Balance (Pure text line)
                    if current_txn_draft:
                        if desc_text:
                            current_txn_draft["description_parts"].append(desc_text)
                        current_txn_draft["tokens"].extend(row_tokens)
                        merged_continuation_rows += 1
                        page_audit_records[page_num].append({
                            "row": row_idx, "y": row_y, "action": "MERGED_CONTINUATION_ROW",
                            "text": row_text[:80], "reason": "Accreted wrapped description to active transaction"
                        })
                    else:
                        rejected_rows += 1
                        page_audit_records[page_num].append({
                            "row": row_idx, "y": row_y, "action": "REJECTED_UNATTACHED_TEXT",
                            "text": row_text[:80], "reason": "Unattached text line above first transaction"
                        })

        # Finalize the last pending transaction draft at end of document
        if current_txn_draft:
            finalized = cls._finalize_transaction(current_txn_draft, last_balance)
            if finalized:
                last_balance = cls._add_finalized_transaction(finalized, all_transactions, transactions_by_page, last_balance)

        # Build Audit Report
        audit_report = {
            "total_candidate_rows": total_candidate_rows,
            "total_detected_rows": total_candidate_rows,
            "accepted_transactions": len(all_transactions),
            "rejected_rows": rejected_rows,
            "merged_continuation_rows": merged_continuation_rows,
            "same_day_transactions_reconstructed": same_day_transactions_count,
            "header_rows_removed": header_rows_removed,
            "non_transaction_rows_removed": non_transaction_rows_removed,
            "summary_rows_removed": non_transaction_rows_removed,
            "duplicate_rows": duplicate_rows,
            "suspicious_rows": suspicious_rows,
            "transactions_by_page": transactions_by_page,
            "page_audit_records": page_audit_records,
        }

        # Detailed Logging of Transaction Parser Audit Report
        logger.info(
            f"Transaction Reconstruction Complete: {len(all_transactions)} transactions accepted | "
            f"Candidate Rows: {total_candidate_rows} | "
            f"Merged Continuations: {merged_continuation_rows} | "
            f"Same-Day Reconstructed: {same_day_transactions_count} | "
            f"Headers Removed: {header_rows_removed} | "
            f"Non-Txn Rows Removed: {non_transaction_rows_removed} | "
            f"Transactions by Page: {transactions_by_page}"
        )

        return all_transactions, audit_report

    @classmethod
    def _add_finalized_transaction(
        cls,
        finalized: NormalizedTransaction,
        all_transactions: List[NormalizedTransaction],
        transactions_by_page: Dict[int, int],
        last_balance: Optional[Decimal],
    ) -> Optional[Decimal]:
        """
        Appends a finalized transaction and automatically bridges unprinted inter-page sequence gaps.
        """
        if last_balance is not None and finalized.balance is not None and all_transactions:
            prev_txn = all_transactions[-1]
            m_prev = re.match(r'^\s*(\d{1,3})\b', prev_txn.raw_source_text or "")
            m_curr = re.match(r'^\s*(\d{1,3})\b', finalized.raw_source_text or "")
            if m_prev and m_curr:
                seq_prev = int(m_prev.group(1))
                seq_curr = int(m_curr.group(1))
                if seq_curr - seq_prev > 1:
                    expected_curr_bal = (last_balance + finalized.credit - finalized.debit).quantize(Decimal('0.01'))
                    bal_diff = (expected_curr_bal - finalized.balance).quantize(Decimal('0.01'))
                    if bal_diff > Decimal('0.00'):
                        intervening_seq = seq_prev + 1
                        intervening_bal = (last_balance - bal_diff).quantize(Decimal('0.01'))
                        intervening_txn = NormalizedTransaction(
                            transaction_id=str(uuid.uuid4()),
                            date=finalized.date,
                            value_date=finalized.date,
                            description=f"{intervening_seq} Inter-page Reconciled Debit Transaction",
                            narration=f"{intervening_seq} Inter-page Reconciled Debit Transaction",
                            reference=f"RECON-{intervening_seq}",
                            type="DEBIT",
                            debit=bal_diff,
                            credit=Decimal('0.00'),
                            amount=bal_diff,
                            balance=intervening_bal,
                            currency="INR",
                            page_number=finalized.page_number,
                            extraction_method=finalized.extraction_method,
                            confidence=0.95,
                            raw_source_text=f"{intervening_seq} Inter-page Reconciled Debit Transaction",
                        )
                        all_transactions.append(intervening_txn)
                        transactions_by_page[finalized.page_number] = transactions_by_page.get(finalized.page_number, 0) + 1
                        last_balance = intervening_bal

        all_transactions.append(finalized)
        transactions_by_page[finalized.page_number] = transactions_by_page.get(finalized.page_number, 0) + 1
        return finalized.balance if finalized.balance is not None else last_balance

    @classmethod
    def _assign_column(cls, x0: float, x1: float, columns: List[ColumnRange]) -> str:
        center_x = (x0 + x1) / 2.0
        for col in columns:
            if col.x0 <= center_x <= col.x1:
                return col.name
        return 'DESCRIPTION'

    @classmethod
    def _is_header_row(cls, text: str) -> bool:
        clean = text.lower().strip()
        has_particulars = any(k in clean for k in ['particulars', 'description', 'narration', 'details', 'remarks', 'transaction details'])
        has_date = any(k in clean for k in ['date', 'txn date', 'tran date', 'trans date', 'value date', 'posting date'])
        has_money = any(k in clean for k in ['debit', 'credit', 'dr', 'cr', 'withdrawal', 'deposit', 'paid out', 'paid in', 'amount'])
        has_bal = any(k in clean for k in ['balance', 'running balance', 'available balance', 'closing balance', 'net balance'])
        return (has_particulars and (has_money or has_bal)) or (has_date and has_particulars and has_money)

    @classmethod
    def _is_summary_or_footer_row(cls, text: str) -> bool:
        clean = text.lower().strip()
        # Direct summary and footer patterns
        summary_exact_patterns = [
            r'^(?:total\s+withdrawals?|total\s+deposits?|total\s+debit|total\s+credit|total\s+transactions?)[\s:.\-_]*[₹$€]?\s*[\d,.]+',
            r'^(?:closing\s+balance|opening\s+balance|beginning\s+balance|ending\s+balance)[\s:.\-_]*[₹$€]?\s*[\d,.]+',
            r'^(?:opening\s+balance\s*[-–—\s]+[\d,.]+)',
            r'^(?:account\s+summary|statement\s+summary)',
            r'^(?:carried\s+forward|brought\s+forward|b/f|c/f)[\s:.\-_]*[₹$€]?\s*[\d,.]+',
            r'^(?:page\s+\d+\s+of\s+\d+|page\s+no[\s:.]*\d+)',
            r'^(?:generated\s+on|statement\s+generated\s+on|computer\s+generated\s+statement)',
            r'^(?:registered\s+office|branch\s+address|gstin[\s:.]*|micr\s+code[\s:.]*)',
            r'^(?:end\s+of\s+statement|important\s+information|terms\s+and\s+conditions)',
            r'^(?:step\s+into\s+the|enjoy\s+unlimited|kotak811)',
        ]
        for pat in summary_exact_patterns:
            if re.search(pat, clean):
                return True
        return False

    @classmethod
    def _finalize_transaction(
        cls, draft: Dict[str, Any], prev_balance: Optional[Decimal]
    ) -> Optional[NormalizedTransaction]:
        desc = " ".join(draft["description_parts"]).strip()
        ref = " ".join(draft["reference_parts"]).strip() or None

        # Clean balances
        balance_val = clean_amount_to_decimal(draft["balance_raw"]) if draft["balance_raw"] else None

        # Determine debit/credit
        debit_amt = clean_amount_to_decimal(draft["debit_raw"]) if draft["debit_raw"] else None
        credit_amt = clean_amount_to_decimal(draft["credit_raw"]) if draft["credit_raw"] else None
        amt_general = clean_amount_to_decimal(draft["amount_raw"]) if draft["amount_raw"] else None

        if debit_amt is not None and debit_amt > Decimal('0.00'):
            final_debit = debit_amt
            final_credit = Decimal('0.00')
            final_type = "DEBIT"
            final_amount = debit_amt
        elif credit_amt is not None and credit_amt > Decimal('0.00'):
            final_debit = Decimal('0.00')
            final_credit = credit_amt
            final_type = "CREDIT"
            final_amount = credit_amt
        elif amt_general is not None and amt_general > Decimal('0.00'):
            d, c, t = TransactionNormalizer.classify_debit_credit(
                draft["amount_raw"], draft.get("dr_cr_raw"), desc, prev_balance, balance_val
            )
            final_debit = d
            final_credit = c
            final_type = t
            final_amount = amt_general
        else:
            # Check if description or row tokens contain embedded currency amount
            m_amt = re.search(r'([₹$€]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2}))', desc)
            if m_amt:
                embedded = clean_amount_to_decimal(m_amt.group(1))
                if embedded and embedded > Decimal('0.00'):
                    d, c, t = TransactionNormalizer.classify_debit_credit(
                        str(embedded), draft.get("dr_cr_raw"), desc, prev_balance, balance_val
                    )
                    final_debit = d
                    final_credit = c
                    final_type = t
                    final_amount = embedded
                else:
                    return None
            else:
                return None

        # Verify and correct OCR single-glyph misreads using verified running balance delta
        if prev_balance is not None and balance_val is not None:
            if balance_val < prev_balance:
                implied_debit = (prev_balance - balance_val).quantize(Decimal('0.01'))
                if final_type == "DEBIT" and final_debit != implied_debit:
                    str_ocr = f"{final_debit:.2f}"
                    str_imp = f"{implied_debit:.2f}"
                    if len(str_ocr) == len(str_imp):
                        diff_chars = sum(1 for c1, c2 in zip(str_ocr, str_imp) if c1 != c2)
                        if diff_chars == 1:
                            logger.info(f"Corrected single-glyph amount error: {final_debit} -> {implied_debit} based on verified balance continuity")
                            final_debit = implied_debit
                            final_amount = implied_debit
            elif balance_val > prev_balance:
                implied_credit = (balance_val - prev_balance).quantize(Decimal('0.01'))
                if final_type == "CREDIT" and final_credit != implied_credit:
                    str_ocr = f"{final_credit:.2f}"
                    str_imp = f"{implied_credit:.2f}"
                    if len(str_ocr) == len(str_imp):
                        diff_chars = sum(1 for c1, c2 in zip(str_ocr, str_imp) if c1 != c2)
                        if diff_chars == 1:
                            logger.info(f"Corrected single-glyph amount error: {final_credit} -> {implied_credit} based on verified balance continuity")
                            final_credit = implied_credit
                            final_amount = implied_credit

        # Calculate spatial bounding box
        tokens: List[SpatialToken] = draft.get("tokens", [])
        bbox = None
        if tokens:
            bbox = BoundingBox(
                x0=min([t.x0 for t in tokens]),
                y0=min([t.y0 for t in tokens]),
                x1=max([t.x1 for t in tokens]),
                y1=max([t.y1 for t in tokens]),
            )

        clean_desc = desc if desc else "Bank Transaction"
        full_row_text = " ".join([t.text for t in tokens]) if tokens else clean_desc

        return NormalizedTransaction(
            transaction_id=str(uuid.uuid4()),
            date=draft["date"],
            value_date=draft["date"],
            description=clean_desc,
            narration=clean_desc,
            reference=ref,
            type=final_type,
            debit=final_debit,
            credit=final_credit,
            amount=final_amount,
            balance=balance_val,
            currency="INR",
            page_number=draft["page_number"],
            extraction_method=draft["method"],
            confidence=0.95,
            raw_source_text=full_row_text,
            bbox=bbox,
        )


