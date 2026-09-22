import re
from typing import List, Dict, Any, Tuple, Optional
from ...models.document import PageExtractionResult, SpatialToken, BoundingBox, ClassifierEvidence
from .bank_profiles import match_bank_profile
from ..layout.regions import DocumentRegionDetector
from ...utils.dates import parse_universal_date
from ...utils.amounts import clean_amount_string
from ...core.logging import logger


class DocumentClassifier:
    """
    Enterprise-Grade Layout-Aware Multi-Signal Document Classifier.
    
    Distinguishes genuine bank statements (from any domestic, international, or unknown bank)
    from non-banking documents (Invoices, Loan Contracts, Payslips, Tax IDs, Resumes)
    using spatial geometry, semantic regions, and multi-point structural evidence.
    """

    @classmethod
    def classify_document(cls, pages: List[PageExtractionResult]) -> Dict[str, Any]:
        if not pages:
            return {
                "document_type": "UNCERTAIN",
                "confidence": 0.0,
                "detected_bank": "Unknown Bank",
                "bank_confidence": 0.0,
                "total_positive_score": 0.0,
                "total_negative_score": 0.0,
                "table_score": 0.0,
                "evidence": [],
                "positive_signals": {},
                "negative_matches": [],
            }

        combined_text = " ".join([p.raw_text for p in pages]).lower()
        regions_by_page = {p.page_number: DocumentRegionDetector.segment_page(p) for p in pages}

        evidence_list: List[ClassifierEvidence] = []

        # 1. Evaluate Bank Identity Evidence
        bank_evidences, detected_bank, bank_conf = cls._evaluate_bank_identity(pages, combined_text, regions_by_page)
        evidence_list.extend(bank_evidences)

        # 2. Evaluate Account Details Evidence
        account_evidences = cls._evaluate_account_details(pages, regions_by_page)
        evidence_list.extend(account_evidences)

        # 3. Evaluate Routing / Branch Codes Evidence
        routing_evidences = cls._evaluate_routing_codes(pages, combined_text)
        evidence_list.extend(routing_evidences)

        # 4. Evaluate Statement Period Evidence
        period_evidences = cls._evaluate_statement_period(pages, combined_text, regions_by_page)
        evidence_list.extend(period_evidences)

        # 5. Evaluate Transaction Ledger Table & Rows Evidence
        ledger_evidences, table_score, has_bank_ledger = cls._evaluate_ledger_structure(pages, regions_by_page)
        evidence_list.extend(ledger_evidences)

        # 6. Evaluate Balances & Summary Evidence
        balance_evidences = cls._evaluate_balances(pages, combined_text, regions_by_page)
        evidence_list.extend(balance_evidences)

        # 7. Evaluate Negative Document Evidence (Contextual & Corroborated)
        negative_evidences = cls._evaluate_negative_structures(
            pages=pages,
            combined_text=combined_text,
            regions_by_page=regions_by_page,
            has_bank_ledger=has_bank_ledger,
            has_bank_identity=bool(detected_bank != "Unknown Bank" or bank_evidences),
        )
        evidence_list.extend(negative_evidences)

        # Calculate Aggregate Scores
        positive_evidences = [e for e in evidence_list if e.type == "POSITIVE"]
        neg_evidences = [e for e in evidence_list if e.type == "NEGATIVE"]

        total_pos_score = sum(e.weight for e in positive_evidences)
        total_neg_score = sum(e.weight for e in neg_evidences)

        # Signal Breakdown Dictionary
        pos_signal_counts: Dict[str, int] = {}
        for e in positive_evidences:
            pos_signal_counts[e.category] = pos_signal_counts.get(e.category, 0) + 1

        neg_matches = list(set([e.category.lower() for e in neg_evidences]))

        # Final Classification Decision
        # 1. Reject if strong corroborated negative evidence dominates and contradicts bank statement
        if total_neg_score >= 60 and total_neg_score > (total_pos_score + 25):
            doc_type = "NOT_BANK_STATEMENT"
            confidence = 0.0
        # 2. Accept as BANK_STATEMENT if positive score meets threshold OR strong ledger is verified
        elif total_pos_score >= 50 or (table_score >= 35 and total_pos_score >= 35):
            doc_type = "BANK_STATEMENT"
            confidence = round(min(0.99, 0.70 + (total_pos_score / 150.0) * 0.28), 2)
        # 3. Otherwise UNCERTAIN
        else:
            doc_type = "UNCERTAIN"
            confidence = round(max(0.0, total_pos_score / 100.0), 2)

        # Detailed Classifier Debug Logging
        logger.info(
            f"Document Classification Complete: {doc_type} (Confidence: {confidence}) | "
            f"Detected Bank: {detected_bank} (Conf: {bank_conf}) | "
            f"Positive Score: {total_pos_score} | Negative Score: {total_neg_score} | "
            f"Table Score: {table_score} | Positive Signals: {pos_signal_counts} | "
            f"Negative Matches: {neg_matches}"
        )
        for ev in evidence_list:
            logger.info(
                f"  [{ev.type}] Signal={ev.signal} (Category={ev.category}, Page={ev.page}, Weight={ev.weight}, Conf={ev.confidence}): {ev.reason}"
            )

        return {
            "document_type": doc_type,
            "confidence": confidence,
            "detected_bank": detected_bank,
            "bank_confidence": bank_conf,
            "total_positive_score": total_pos_score,
            "total_negative_score": total_neg_score,
            "total_score": total_pos_score,  # backward compatibility
            "table_score": table_score,
            "evidence": [e.model_dump() for e in evidence_list],
            "positive_signals": pos_signal_counts,
            "negative_matches": neg_matches,
        }

    @classmethod
    def _evaluate_bank_identity(
        cls, pages: List[PageExtractionResult], combined_text: str, regions_by_page: Dict[int, Dict[str, List[SpatialToken]]]
    ) -> Tuple[List[ClassifierEvidence], str, float]:
        evidences: List[ClassifierEvidence] = []
        
        # 1. Profile Matching
        bank_profile = match_bank_profile(combined_text)
        detected_bank = bank_profile.bank_name if bank_profile else None
        bank_conf = 0.98 if bank_profile else 0.50

        p1_header_tokens = regions_by_page.get(1, {}).get("HEADER", [])
        p1_header_text = " ".join([t.text for t in p1_header_tokens]).lower()

        if bank_profile:
            evidences.append(
                ClassifierEvidence(
                    signal="KNOWN_BANK_PROFILE_MATCH",
                    type="POSITIVE",
                    category="BANK_IDENTITY",
                    matched_text=bank_profile.bank_name,
                    page=1,
                    confidence=0.98,
                    weight=35.0,
                    reason=f"Matched established bank profile for '{bank_profile.bank_name}'",
                )
            )

        # 2. Generic Banking Keywords in Header Region
        header_bank_patterns = [
            (r'\bbank\b', "Bank"),
            (r'\bbanking\b', "Banking"),
            (r'\bfinancial\s+services\b', "Financial Services"),
            (r'\bcredit\s+union\b', "Credit Union"),
            (r'\bco-?operative\s+bank\b', "Co-operative Bank"),
            (r'\bbuilding\s+society\b', "Building Society"),
            (r'\bfederal\s+credit\s+union\b', "Federal Credit Union"),
            (r'\bnational\s+bank\b', "National Bank"),
            (r'\bsavings\s+bank\b', "Savings Bank"),
            (r'\bfinances?\b', "Finance"),
        ]

        for pat, label in header_bank_patterns:
            m = re.search(pat, p1_header_text)
            if m:
                if not bank_profile:
                    # Extract candidate bank name from header
                    cand = p1_header_text[:60].strip().title()
                    detected_bank = cand if len(cand) <= 40 else f"{label} Institution"
                    bank_conf = 0.75

                evidences.append(
                    ClassifierEvidence(
                        signal=f"HEADER_BANK_KEYWORD_{label.upper()}",
                        type="POSITIVE",
                        category="BANK_IDENTITY",
                        matched_text=m.group(0),
                        page=1,
                        confidence=0.90,
                        weight=25.0,
                        reason=f"Found banking institution keyword '{label}' in header region",
                    )
                )
                break

        # Fallback generic bank search across top 1000 characters if still unknown
        if not detected_bank:
            m_gen = re.search(r'([A-Za-z\s]+)\s+bank\b', combined_text[:1000])
            if m_gen:
                detected_bank = m_gen.group(0).strip().title()
                bank_conf = 0.65
                evidences.append(
                    ClassifierEvidence(
                        signal="GENERIC_BANK_IDENTITY_MATCH",
                        type="POSITIVE",
                        category="BANK_IDENTITY",
                        matched_text=detected_bank,
                        page=1,
                        confidence=0.75,
                        weight=20.0,
                        reason=f"Found generic bank institution name '{detected_bank}'",
                    )
                )

        if not detected_bank:
            detected_bank = "Unknown Bank"

        return evidences, detected_bank, bank_conf

    @classmethod
    def _evaluate_account_details(
        cls, pages: List[PageExtractionResult], regions_by_page: Dict[int, Dict[str, List[SpatialToken]]]
    ) -> List[ClassifierEvidence]:
        evidences: List[ClassifierEvidence] = []
        p1_regions = regions_by_page.get(1, {})
        acc_tokens = p1_regions.get("ACCOUNT_INFORMATION", []) + p1_regions.get("HEADER", [])
        acc_text = " ".join([t.text for t in acc_tokens]).lower()
        full_p1_text = pages[0].raw_text.lower() if pages else ""

        # 1. Account Number Label & Numeric Pattern
        acc_no_patterns = [
            r'(?:account\s*(?:no|number|num)|a/c\s*(?:no|num|number)|acc\s*(?:no|num)|a/c)[\s:.\-_#]*([A-Za-z0-9]{8,22})',
            r'\b(?:account|a/c)[\s:.\-_#]+(\d{9,18})\b',
        ]
        for pat in acc_no_patterns:
            m = re.search(pat, acc_text) or re.search(pat, full_p1_text)
            if m:
                evidences.append(
                    ClassifierEvidence(
                        signal="ACCOUNT_NUMBER_MATCH",
                        type="POSITIVE",
                        category="ACCOUNT_INFO",
                        matched_text=m.group(0),
                        page=1,
                        confidence=0.95,
                        weight=25.0,
                        reason="Found explicit account number specification in account info region",
                    )
                )
                break

        # 2. Customer ID / CRN / CIF
        cust_id_pat = r'\b(?:customer\s*(?:id|no|number)|cust\s*id|crn|cif\s*(?:no|number)|client\s*id)[\s:.\-_#]*([A-Za-z0-9]{4,18})\b'
        m_cust = re.search(cust_id_pat, acc_text) or re.search(cust_id_pat, full_p1_text)
        if m_cust:
            evidences.append(
                ClassifierEvidence(
                    signal="CUSTOMER_ID_MATCH",
                    type="POSITIVE",
                    category="ACCOUNT_INFO",
                    matched_text=m_cust.group(0),
                    page=1,
                    confidence=0.90,
                    weight=15.0,
                    reason="Found customer identifier (Customer ID/CRN/CIF)",
                )
            )

        # 3. Account Holder Name
        holder_pat = r'\b(?:customer\s*name|name\s*of\s*(?:holder|account|customer)|account\s*holder|mr\.|mrs\.|ms\.|shri|smt\.)[\s:]*([A-Za-z\s.]{3,35})'
        m_name = re.search(holder_pat, acc_text) or re.search(holder_pat, full_p1_text)
        if m_name:
            evidences.append(
                ClassifierEvidence(
                    signal="ACCOUNT_HOLDER_NAME_MATCH",
                    type="POSITIVE",
                    category="ACCOUNT_INFO",
                    matched_text=m_name.group(0),
                    page=1,
                    confidence=0.90,
                    weight=15.0,
                    reason="Found explicit account holder name in account info region",
                )
            )

        # 4. Account Type (Savings / Current / Checking / Overdraft)
        type_pat = r'\b(?:savings\s*(?:account|a/c)|current\s*(?:account|a/c)|checking\s*(?:account|a/c)|salary\s*(?:account|a/c)|overdraft\s*(?:account|a/c))\b'
        m_type = re.search(type_pat, acc_text) or re.search(type_pat, full_p1_text)
        if m_type:
            evidences.append(
                ClassifierEvidence(
                    signal="ACCOUNT_TYPE_MATCH",
                    type="POSITIVE",
                    category="ACCOUNT_INFO",
                    matched_text=m_type.group(0),
                    page=1,
                    confidence=0.90,
                    weight=15.0,
                    reason=f"Found explicit banking account type '{m_type.group(0)}'",
                )
            )

        return evidences

    @classmethod
    def _evaluate_routing_codes(cls, pages: List[PageExtractionResult], combined_text: str) -> List[ClassifierEvidence]:
        evidences: List[ClassifierEvidence] = []
        
        # IFSC Code (Indian Banks)
        m_ifsc = re.search(r'\b([A-Z]{4}0[A-Z0-9]{6})\b', combined_text.upper())
        if m_ifsc:
            evidences.append(
                ClassifierEvidence(
                    signal="IFSC_ROUTING_CODE",
                    type="POSITIVE",
                    category="ROUTING_CODES",
                    matched_text=m_ifsc.group(0),
                    page=1,
                    confidence=0.98,
                    weight=20.0,
                    reason=f"Found valid 11-character bank routing IFSC code '{m_ifsc.group(0)}'",
                )
            )

        # MICR Code
        m_micr = re.search(r'\bmicr(?:\s*code)?[\s:.\-_]*(\d{9})\b', combined_text.lower())
        if m_micr:
            evidences.append(
                ClassifierEvidence(
                    signal="MICR_CODE",
                    type="POSITIVE",
                    category="ROUTING_CODES",
                    matched_text=m_micr.group(0),
                    page=1,
                    confidence=0.95,
                    weight=15.0,
                    reason=f"Found 9-digit MICR clearing code '{m_micr.group(0)}'",
                )
            )

        # SWIFT / BIC Code
        m_swift = re.search(r'\b(?:swift|bic)(?:\s*code)?[\s:.\-_]*([A-Z]{6}[A-Z0-9]{2,5})\b', combined_text.upper())
        if m_swift and not m_ifsc:
            evidences.append(
                ClassifierEvidence(
                    signal="SWIFT_BIC_CODE",
                    type="POSITIVE",
                    category="ROUTING_CODES",
                    matched_text=m_swift.group(0),
                    page=1,
                    confidence=0.95,
                    weight=20.0,
                    reason=f"Found international SWIFT/BIC routing code '{m_swift.group(0)}'",
                )
            )

        return evidences

    @classmethod
    def _evaluate_statement_period(
        cls, pages: List[PageExtractionResult], combined_text: str, regions_by_page: Dict[int, Dict[str, List[SpatialToken]]]
    ) -> List[ClassifierEvidence]:
        evidences: List[ClassifierEvidence] = []
        
        period_label_pat = r'\b(?:statement\s*period|period\s*from|statement\s*date|for\s*the\s*period|statement\s*from|account\s*statement\s*for)\b'
        m_period = re.search(period_label_pat, combined_text)
        if m_period:
            evidences.append(
                ClassifierEvidence(
                    signal="STATEMENT_PERIOD_LABEL",
                    type="POSITIVE",
                    category="STATEMENT_PERIOD",
                    matched_text=m_period.group(0),
                    page=1,
                    confidence=0.90,
                    weight=15.0,
                    reason=f"Found statement period descriptor '{m_period.group(0)}'",
                )
            )

        return evidences

    @classmethod
    def _evaluate_ledger_structure(
        cls, pages: List[PageExtractionResult], regions_by_page: Dict[int, Dict[str, List[SpatialToken]]]
    ) -> Tuple[List[ClassifierEvidence], float, bool]:
        evidences: List[ClassifierEvidence] = []
        table_score = 0.0
        has_ledger_header = False
        valid_row_count = 0

        # 1. Search for Ledger Column Header Bands across pages
        for p in pages:
            tokens = p.tokens
            line_groups: Dict[int, List[SpatialToken]] = {}
            for t in sorted(tokens, key=lambda x: x.y0):
                matched_bucket = None
                for bucket_y in line_groups:
                    if abs(t.y0 - bucket_y) <= 8:
                        matched_bucket = bucket_y
                        break
                if matched_bucket is not None:
                    line_groups[matched_bucket].append(t)
                else:
                    line_groups[int(t.y0)] = [t]

            for bucket_y, line_tokens in line_groups.items():
                line_text = " ".join([t.text.lower() for t in sorted(line_tokens, key=lambda x: x.x0)])
                
                has_date_col = bool(re.search(r'\b(date|tran\s*date|trans\s*date|txn\s*date|value\s*date|posting\s*date)\b', line_text))
                has_desc_col = bool(re.search(r'\b(particulars|description|narration|remarks|transaction\s*details|details)\b', line_text))
                has_money_col = bool(re.search(r'\b(debit|credit|dr|cr|withdrawal|deposit|withdrawals|deposits|paid\s*out|paid\s*in|amount)\b', line_text))
                has_bal_col = bool(re.search(r'\b(balance|running\s*balance|available\s*balance|closing\s*balance|net\s*balance)\b', line_text))

                matches = sum([has_date_col, has_desc_col, has_money_col, has_bal_col])

                if matches >= 3 and not has_ledger_header:
                    has_ledger_header = True
                    weight = 35.0 if matches == 4 else 25.0
                    table_score += weight
                    evidences.append(
                        ClassifierEvidence(
                            signal="TRANSACTION_LEDGER_TABLE_HEADER",
                            type="POSITIVE",
                            category="LEDGER_HEADER",
                            matched_text=line_text[:80],
                            page=p.page_number,
                            confidence=0.95,
                            weight=weight,
                            reason=f"Found 4-column ledger table header (Date={has_date_col}, Desc={has_desc_col}, Money={has_money_col}, Bal={has_bal_col})",
                        )
                    )
                    break

        # 2. Count Chronological Ledger Rows with Dates and Numeric Amounts
        for p in pages:
            tokens = p.tokens
            line_groups: Dict[int, List[SpatialToken]] = {}
            for t in sorted(tokens, key=lambda x: x.y0):
                matched_bucket = None
                for bucket_y in line_groups:
                    if abs(t.y0 - bucket_y) <= 6:
                        matched_bucket = bucket_y
                        break
                if matched_bucket is not None:
                    line_groups[matched_bucket].append(t)
                else:
                    line_groups[int(t.y0)] = [t]

            for bucket_y, line_tokens in line_groups.items():
                sorted_line = sorted(line_tokens, key=lambda x: x.x0)
                if not sorted_line:
                    continue
                first_text = sorted_line[0].text
                first_two = " ".join([t.text for t in sorted_line[:2]])

                # Check if row starts with a valid transaction date
                if parse_universal_date(first_text) or parse_universal_date(first_two):
                    # Check if row also contains numeric currency/balance amount
                    has_amount = any([clean_amount_string(t.text) is not None for t in sorted_line[1:]])
                    if has_amount:
                        valid_row_count += 1

        if valid_row_count > 0:
            if valid_row_count >= 10:
                row_weight = 35.0
            elif valid_row_count >= 4:
                row_weight = 25.0
            else:
                row_weight = 15.0

            table_score += row_weight
            evidences.append(
                ClassifierEvidence(
                    signal="CHRONOLOGICAL_LEDGER_ROWS",
                    type="POSITIVE",
                    category="LEDGER_ROWS",
                    matched_text=f"{valid_row_count} transaction rows",
                    page=1,
                    confidence=0.95,
                    weight=row_weight,
                    reason=f"Detected {valid_row_count} sequential transaction ledger rows across pages with valid dates and monetary amounts",
                )
            )

        has_bank_ledger = has_ledger_header or valid_row_count >= 3
        return evidences, table_score, has_bank_ledger

    @classmethod
    def _evaluate_balances(
        cls, pages: List[PageExtractionResult], combined_text: str, regions_by_page: Dict[int, Dict[str, List[SpatialToken]]]
    ) -> List[ClassifierEvidence]:
        evidences: List[ClassifierEvidence] = []
        
        # Opening Balance
        m_open = re.search(r'\b(?:opening\s*balance|beginning\s*balance|brought\s*forward|b/f)\b', combined_text)
        if m_open:
            evidences.append(
                ClassifierEvidence(
                    signal="OPENING_BALANCE_LABEL",
                    type="POSITIVE",
                    category="BALANCES",
                    matched_text=m_open.group(0),
                    page=1,
                    confidence=0.90,
                    weight=15.0,
                    reason="Found explicit opening balance ledger anchor",
                )
            )

        # Closing Balance
        m_close = re.search(r'\b(?:closing\s*balance|ending\s*balance|carried\s*forward|c/f|available\s*balance|cleared\s*balance)\b', combined_text)
        if m_close:
            evidences.append(
                ClassifierEvidence(
                    signal="CLOSING_BALANCE_LABEL",
                    type="POSITIVE",
                    category="BALANCES",
                    matched_text=m_close.group(0),
                    page=pages[-1].page_number if pages else 1,
                    confidence=0.90,
                    weight=15.0,
                    reason="Found explicit closing / available balance anchor",
                )
            )

        return evidences

    @classmethod
    def _evaluate_negative_structures(
        cls,
        pages: List[PageExtractionResult],
        combined_text: str,
        regions_by_page: Dict[int, Dict[str, List[SpatialToken]]],
        has_bank_ledger: bool,
        has_bank_identity: bool,
    ) -> List[ClassifierEvidence]:
        evidences: List[ClassifierEvidence] = []
        p1_text = pages[0].raw_text.lower() if pages else ""
        p1_header_tokens = regions_by_page.get(1, {}).get("HEADER", [])
        p1_header_text = " ".join([t.text for t in p1_header_tokens]).lower()

        # =========================================================================
        # 1. INVOICE STRUCTURAL EVALUATION
        # =========================================================================
        # A document is an invoice only if it exhibits TRUE invoice structural pillars.
        # If it has a verified bank ledger and bank identity, isolated occurrences of
        # "invoice" / "gstin" / "bill to" are transaction narrations or merchant entries.
        if not (has_bank_ledger and has_bank_identity):
            # Pillar 1: Invoice Header Title in Top Header Region
            has_inv_title = bool(re.search(r'\b(tax\s*invoice|commercial\s*invoice|bill\s*of\s*supply|proforma\s*invoice)\b', p1_header_text))
            
            # Pillar 2: Invoice Number & Date
            has_inv_no = bool(re.search(r'\b(invoice\s*(?:no|number|#)|bill\s*(?:no|number))\b', p1_text))
            has_inv_date = bool(re.search(r'\b(invoice\s*date|due\s*date|po\s*(?:no|number|date))\b', p1_text))
            pillar_2 = has_inv_no and has_inv_date
            
            # Pillar 3: Buyer & Seller Identity Structure
            has_seller = bool(re.search(r'\b(sold\s*by|seller|vendor|supplier)\b', p1_text))
            has_buyer = bool(re.search(r'\b(bill\s*to|ship\s*to|buyer|consignee)\b', p1_text))
            pillar_3 = has_seller and has_buyer

            # Pillar 4: Line-Item Quantity/Rate Table
            has_qty = bool(re.search(r'\b(qty|quantity|units?)\b', p1_text))
            has_rate = bool(re.search(r'\b(rate|unit\s*price|price/unit)\b', p1_text))
            has_tax = bool(re.search(r'\b(hsn|sac|cgst|sgst|igst|tax\s*rate)\b', p1_text))
            pillar_4 = has_qty and has_rate and has_tax

            invoice_pillars = sum([has_inv_title, pillar_2, pillar_3, pillar_4])

            # Corroborated invoice require >= 3 pillars
            if invoice_pillars >= 3:
                evidences.append(
                    ClassifierEvidence(
                        signal="CORROBORATED_INVOICE_STRUCTURE",
                        type="NEGATIVE",
                        category="INVOICE",
                        matched_text="Invoice Header + Metadata + Line-Item Structure",
                        page=1,
                        confidence=0.95,
                        weight=70.0 if not has_bank_ledger else 30.0,
                        reason=f"Document contains {invoice_pillars}/4 corroborated structural invoice pillars (Title={has_inv_title}, Meta={pillar_2}, Parties={pillar_3}, Items={pillar_4})",
                    )
                )

        # =========================================================================
        # 2. LOAN AGREEMENT / CONTRACT STRUCTURAL EVALUATION
        # =========================================================================
        # A document is a loan contract only if it contains legal contract preamble,
        # party definitions, legal recitals/clauses, and execution signature sections.
        # Mentions of "loan EMI" or "home loan" in bank transaction lines are NOT contracts.
        if not (has_bank_ledger and has_bank_identity):
            # Pillar 1: Contract Header in Top Region
            has_loan_title = bool(re.search(r'\b(loan\s*agreement|facility\s*agreement|sanction\s*letter|promissory\s*note|mortgage\s*deed|deed\s*of\s*hypothecation)\b', p1_header_text))
            
            # Pillar 2: Contracting Parties
            has_borrower = bool(re.search(r'\b(borrower|debtor|obligor|borrower\s*name)\b', p1_text))
            has_lender = bool(re.search(r'\b(lender|creditor|financier|bank\s*as\s*lender)\b', p1_text))
            pillar_parties = has_borrower and has_lender
            
            # Pillar 3: Legal Contractual Clauses & Recitals
            has_recitals = bool(re.search(r'\b(whereas|recitals|now\s*therefore|terms\s*and\s*conditions|event\s*of\s*default|governing\s*law|jurisdiction)\b', p1_text))
            
            # Pillar 4: Execution & Signature Section
            has_execution = bool(re.search(r'\b(in\s*witness\s*whereof|signature\s*of\s*borrower|authorised\s*signatory|witness\s*1|signed,\s*sealed)\b', combined_text))

            loan_pillars = sum([has_loan_title, pillar_parties, has_recitals, has_execution])

            if loan_pillars >= 3:
                evidences.append(
                    ClassifierEvidence(
                        signal="CORROBORATED_LOAN_CONTRACT_STRUCTURE",
                        type="NEGATIVE",
                        category="LOAN_AGREEMENT",
                        matched_text="Contract Header + Parties + Legal Clauses + Execution",
                        page=1,
                        confidence=0.95,
                        weight=70.0 if not has_bank_ledger else 30.0,
                        reason=f"Document contains {loan_pillars}/4 corroborated structural legal contract pillars (Title={has_loan_title}, Parties={pillar_parties}, Clauses={has_recitals}, Signatures={has_execution})",
                    )
                )

        # =========================================================================
        # 3. PAYSLIP / SALARY SLIP EVALUATION
        # =========================================================================
        if not has_bank_ledger:
            has_payslip_title = bool(re.search(r'\b(payslip|salary\s*slip|pay\s*slip\s*for\s*the\s*month)\b', p1_header_text or p1_text))
            has_emp_meta = bool(re.search(r'\b(employee\s*(?:id|code|name)|uan|pf\s*no|designation|department)\b', p1_text))
            has_earnings = bool(re.search(r'\b(basic|hra|gross\s*salary|gross\s*earnings|net\s*pay|take\s*home)\b', p1_text))
            has_deductions = bool(re.search(r'\b(provident\s*fund|epf|professional\s*tax|tds|deductions)\b', p1_text))

            if has_payslip_title and has_emp_meta and (has_earnings or has_deductions):
                evidences.append(
                    ClassifierEvidence(
                        signal="CORROBORATED_PAYSLIP_STRUCTURE",
                        type="NEGATIVE",
                        category="PAYSLIP",
                        matched_text="Payslip Title + Employee Meta + Earnings/Deductions",
                        page=1,
                        confidence=0.95,
                        weight=75.0,
                        reason="Document structure matches employment salary slip with breakdown and employee metadata",
                    )
                )

        # =========================================================================
        # 4. AADHAAR / PAN / RESUME IDENTIFIERS
        # =========================================================================
        if not has_bank_ledger:
            # Aadhaar
            if re.search(r'\b(unique\s+identification\s+authority\s+of\s+india|uidai|मेरा\s+आधार)\b', combined_text):
                evidences.append(
                    ClassifierEvidence(
                        signal="AADHAAR_CARD_MATCH",
                        type="NEGATIVE",
                        category="AADHAAR",
                        matched_text="UIDAI Government ID",
                        page=1,
                        confidence=0.99,
                        weight=80.0,
                        reason="Document contains UIDAI government identity structure",
                    )
                )
            
            # PAN Card
            if re.search(r'\b(incometax\s+department|permanent\s+account\s+number\s+card)\b', combined_text) and not has_bank_identity:
                evidences.append(
                    ClassifierEvidence(
                        signal="PAN_CARD_MATCH",
                        type="NEGATIVE",
                        category="PAN_CARD",
                        matched_text="Income Tax Department PAN Card",
                        page=1,
                        confidence=0.99,
                        weight=80.0,
                        reason="Document contains Income Tax Department PAN card structure",
                    )
                )

            # Resume / CV
            if re.search(r'\b(curriculum\s+vitae|resume)\b', p1_header_text or p1_text) and re.search(r'\b(education|experience|skills|projects)\b', p1_text):
                evidences.append(
                    ClassifierEvidence(
                        signal="RESUME_CV_MATCH",
                        type="NEGATIVE",
                        category="RESUME",
                        matched_text="Curriculum Vitae / Resume Structure",
                        page=1,
                        confidence=0.95,
                        weight=80.0,
                        reason="Document contains curriculum vitae resume structure without financial ledger",
                    )
                )

        return evidences
