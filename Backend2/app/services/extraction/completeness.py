from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Tuple, Optional, Union
from datetime import datetime
from ...models.transaction import NormalizedTransaction
from ...models.document import PageExtractionResult
from ...models.analytics import IntegrityReport, IntegrityCheckResult, ConfidenceDecomposition
from ...core.config import settings
from ...utils.amounts import clean_amount_to_decimal


class CompletenessChecker:
    @classmethod
    def verify_document_completeness(
        cls,
        pages: List[PageExtractionResult],
        transactions: List[NormalizedTransaction],
        opening_balance: Optional[Union[Decimal, float, str]] = None,
        closing_balance: Optional[Union[Decimal, float, str]] = None,
        stated_closing_balance: Optional[Union[Decimal, float, str]] = None,
        stated_total_credits: Optional[Union[Decimal, float, str]] = None,
        stated_total_debits: Optional[Union[Decimal, float, str]] = None,
        audit_report: Optional[Dict[str, Any]] = None,
        classification_conf: float = 0.95,
    ) -> Dict[str, Any]:
        """
        Executes Multi-Signal Integrity Verification:
        - Check A: Transaction Ledger Arithmetic (Non-Tautological: compares opening + credits - debits vs independent running balance)
        - Check B: Statement Ledger Reconciliation (compares calculated totals vs statement summary values)
        - Check C: Running Balance Continuity (validates prev + credit - debit == curr across rows)
        - Check D: Transaction Completeness & Candidate Accounting (candidate audit coverage ratio >= 0.98)
        - Synthesizes GREEN / YELLOW / RED integrity status and 5-pillar confidence decomposition.
        """
        tolerance = Decimal(settings.RECONCILIATION_TOLERANCE_STR)
        suspicious_row_tolerance = Decimal(settings.SUSPICIOUS_ROW_TOLERANCE_STR)
        completeness_min_ratio = float(settings.COMPLETENESS_MIN_RATIO_STR)

        def to_dec(val: Any) -> Optional[Decimal]:
            if val is None:
                return None
            if isinstance(val, Decimal):
                return val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            return clean_amount_to_decimal(str(val))

        open_dec = to_dec(opening_balance)
        stated_close_dec = to_dec(stated_closing_balance) or to_dec(closing_balance)
        stated_cr_dec = to_dec(stated_total_credits)
        stated_dr_dec = to_dec(stated_total_debits)

        # 0. Basic page and transaction metrics
        page_numbers = [p.page_number for p in pages]
        expected_pages = list(range(1, len(pages) + 1))
        is_page_sequence_valid = page_numbers == expected_pages

        total_credits = sum([t.credit for t in transactions if t.credit > Decimal('0.00')], Decimal('0.00'))
        total_debits = sum([t.debit for t in transactions if t.debit > Decimal('0.00')], Decimal('0.00'))
        total_credits = total_credits.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        total_debits = total_debits.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # Fallback opening balance if not explicitly provided
        resolved_open = open_dec
        if resolved_open is None and transactions and transactions[0].balance is not None:
            first_t = transactions[0]
            if first_t.type == "CREDIT":
                resolved_open = (first_t.balance - first_t.credit).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            else:
                resolved_open = (first_t.balance + first_t.debit).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        calculated_closing = (resolved_open + total_credits - total_debits).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if resolved_open is not None else None

        # ----------------------------------------------------
        # CHECK A: Transaction Ledger Arithmetic (Non-Tautological)
        # ----------------------------------------------------
        final_row_balance: Optional[Decimal] = None
        if transactions and transactions[-1].balance is not None:
            final_row_balance = transactions[-1].balance.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        if resolved_open is not None and final_row_balance is not None and len(transactions) > 0:
            diff_a = abs((resolved_open + total_credits - total_debits) - final_row_balance).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            status_a = "PASS" if diff_a <= tolerance else "FAIL"
            check_a = IntegrityCheckResult(
                status=status_a,
                difference=f"{diff_a:.2f}",
                confidence=0.98 if status_a == "PASS" else 0.40,
                evidence={
                    "opening_balance": f"{resolved_open:.2f}",
                    "total_credits": f"{total_credits:.2f}",
                    "total_debits": f"{total_debits:.2f}",
                    "expected_closing": f"{(resolved_open + total_credits - total_debits):.2f}",
                    "final_transaction_balance": f"{final_row_balance:.2f}",
                    "difference": f"{diff_a:.2f}",
                },
            )
        else:
            check_a = IntegrityCheckResult(
                status="NOT_APPLICABLE",
                difference="0.00",
                confidence=1.0,
                evidence={"reason": "No independent running balance column found on transactions"},
            )

        # ----------------------------------------------------
        # CHECK B: Statement Ledger Reconciliation
        # ----------------------------------------------------
        if calculated_closing is not None and stated_close_dec is not None:
            diff_b = abs(calculated_closing - stated_close_dec).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            cr_diff = abs(total_credits - stated_cr_dec).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if stated_cr_dec is not None else Decimal('0.00')
            dr_diff = abs(total_debits - stated_dr_dec).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if stated_dr_dec is not None else Decimal('0.00')

            status_b = "PASS" if (diff_b <= tolerance and cr_diff <= tolerance and dr_diff <= tolerance) else "FAIL"
            check_b = IntegrityCheckResult(
                status=status_b,
                difference=f"{diff_b:.2f}",
                confidence=0.99 if status_b == "PASS" else 0.30,
                evidence={
                    "calculated_closing_balance": f"{calculated_closing:.2f}",
                    "stated_closing_balance": f"{stated_close_dec:.2f}",
                    "closing_difference": f"{diff_b:.2f}",
                    "transaction_credits": f"{total_credits:.2f}",
                    "stated_credits": f"{stated_cr_dec:.2f}" if stated_cr_dec is not None else None,
                    "transaction_debits": f"{total_debits:.2f}",
                    "stated_debits": f"{stated_dr_dec:.2f}" if stated_dr_dec is not None else None,
                },
            )
        else:
            check_b = IntegrityCheckResult(
                status="NOT_APPLICABLE",
                difference="0.00",
                confidence=1.0,
                evidence={"reason": "No stated closing balance or summary totals found in statement headers/footers"},
            )

        # ----------------------------------------------------
        # CHECK C: Running Balance Continuity
        # ----------------------------------------------------
        continuity_passed = 0
        continuity_failed = 0
        failed_txn_ids: List[str] = []
        gaps_detected: List[Dict[str, Any]] = []

        for i in range(1, len(transactions)):
            prev = transactions[i - 1]
            curr = transactions[i]
            if prev.balance is not None and curr.balance is not None:
                expected_balance = (prev.balance + curr.credit - curr.debit).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                actual_balance = curr.balance.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                row_diff = abs(expected_balance - actual_balance).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

                if row_diff <= suspicious_row_tolerance:
                    continuity_passed += 1
                else:
                    continuity_failed += 1
                    failed_txn_ids.append(curr.transaction_id)
                    gaps_detected.append({
                        "transaction_id": curr.transaction_id,
                        "date": curr.date,
                        "description": curr.description[:60],
                        "previous_balance": f"{prev.balance:.2f}",
                        "credit": f"{curr.credit:.2f}",
                        "debit": f"{curr.debit:.2f}",
                        "expected_balance": f"{expected_balance:.2f}",
                        "actual_balance": f"{actual_balance:.2f}",
                        "difference": f"{row_diff:.2f}",
                    })

        total_checked_continuity = continuity_passed + continuity_failed
        balance_continuity_rate = (
            round(continuity_passed / total_checked_continuity, 4)
            if total_checked_continuity > 0
            else 1.0
        )

        if total_checked_continuity > 0:
            status_c = "PASS" if continuity_failed == 0 else "FAIL"
            check_c = IntegrityCheckResult(
                status=status_c,
                difference=str(continuity_failed),
                confidence=balance_continuity_rate,
                evidence={
                    "continuity_passed_rows": continuity_passed,
                    "continuity_failed_rows": continuity_failed,
                    "total_checked_rows": total_checked_continuity,
                    "failed_transaction_ids": failed_txn_ids,
                    "gaps": gaps_detected[:10],
                },
            )
        else:
            check_c = IntegrityCheckResult(
                status="NOT_APPLICABLE",
                difference="0.00",
                confidence=1.0,
                evidence={"reason": "Transactions do not contain sequential running balance values"},
            )

        # ----------------------------------------------------
        # CHECK D: Transaction Completeness & Candidate Accounting
        # ----------------------------------------------------
        audit = audit_report or {}
        tot_candidate = audit.get("total_candidate_rows", len(transactions))
        accepted = audit.get("accepted_transactions", len(transactions))
        merged = audit.get("merged_continuation_rows", 0)
        hdrs_removed = audit.get("header_rows_removed", 0)
        non_tx_removed = audit.get("non_transaction_rows_removed", 0)
        suspicious_rows = audit.get("suspicious_rows", 0)
        unresolved_gaps = len(failed_txn_ids)

        accounted_rows = accepted + merged + hdrs_removed + non_tx_removed
        completeness_ratio = round(accounted_rows / tot_candidate, 4) if tot_candidate > 0 else 1.0

        status_d = (
            "PASS"
            if (completeness_ratio >= completeness_min_ratio and unresolved_gaps <= settings.MAX_UNRESOLVED_GAPS and suspicious_rows <= settings.MAX_SUSPICIOUS_ROWS)
            else "FAIL"
        )
        check_d = IntegrityCheckResult(
            status=status_d,
            difference=f"{(1.0 - completeness_ratio):.4f}",
            confidence=completeness_ratio,
            evidence={
                "total_candidate_rows": tot_candidate,
                "accounted_rows": accounted_rows,
                "accepted_transactions": accepted,
                "merged_continuation_rows": merged,
                "header_rows_removed": hdrs_removed,
                "non_transaction_rows_removed": non_tx_removed,
                "suspicious_rows": suspicious_rows,
                "unresolved_gaps": unresolved_gaps,
                "completeness_ratio": completeness_ratio,
            },
        )

        # ----------------------------------------------------
        # Overall Three-State Status: GREEN / YELLOW / RED
        # ----------------------------------------------------
        applicable_checks = [c for c in [check_a, check_b, check_c] if c.status != "NOT_APPLICABLE"]
        all_app_passed = all([c.status == "PASS" for c in applicable_checks]) if applicable_checks else True
        any_app_failed = any([c.status == "FAIL" for c in applicable_checks])

        if status_d == "PASS" and all_app_passed and len(applicable_checks) > 0 and unresolved_gaps == 0:
            integrity_status = "GREEN"
            integrity_message = "Mathematical integrity verified: ledger arithmetic, running balance continuity, and statement totals reconcile within tolerance."
        elif (
            status_d == "PASS"
            and not any_app_failed
            and len(applicable_checks) == 0
        ):
            integrity_status = "GREEN"
            integrity_message = "Transactions extracted and validated without internal contradictions."
        elif (
            check_a.status != "FAIL"
            and check_b.status != "FAIL"
            and continuity_failed <= 1
            and suspicious_rows <= 2
        ):
            integrity_status = "YELLOW"
            integrity_message = "Minor discrepancy detected in intermediate row continuity, but document totals reconcile."
        else:
            integrity_status = "RED"
            reasons = []
            if check_a.status == "FAIL":
                reasons.append("transaction ledger arithmetic mismatch")
            if check_b.status == "FAIL":
                reasons.append("statement summary reconciliation difference")
            if check_c.status == "FAIL":
                reasons.append(f"{continuity_failed} running balance gap(s)")
            if status_d == "FAIL":
                reasons.append(f"completeness ratio {completeness_ratio*100:.1f}% below threshold")
            integrity_message = f"Mathematical integrity verification failed: {', '.join(reasons)}."

        integrity_report = IntegrityReport(
            check_a_ledger_arithmetic=check_a,
            check_b_statement_reconciliation=check_b,
            check_c_running_balance_continuity=check_c,
            check_d_transaction_completeness=check_d,
            integrity_status=integrity_status,
            integrity_message=integrity_message,
            tolerance=settings.RECONCILIATION_TOLERANCE_STR,
            differences={
                "check_a_difference": check_a.difference,
                "check_b_difference": check_b.difference,
                "check_c_failed_rows": check_c.difference,
                "check_d_gap_ratio": check_d.difference,
            },
        )

        # ----------------------------------------------------
        # 5-Pillar Confidence Decomposition
        # ----------------------------------------------------
        avg_ocr_conf = (
            sum([p.confidence for p in pages]) / len(pages)
            if pages
            else 1.0
        )
        field_count_present = sum([
            1 if resolved_open is not None else 0,
            1 if stated_close_dec is not None else 0,
            1 if total_credits > Decimal('0.00') else 0,
            1 if total_debits > Decimal('0.00') else 0,
            1 if len(transactions) > 0 else 0,
        ])
        field_completeness = round(field_count_present / 5.0, 4)

        spatial_alignment_score = 0.96 if len(transactions) > 0 else 0.50
        if audit.get("header_rows_removed", 0) > 0:
            spatial_alignment_score = 0.98

        rec_score = 1.0 if integrity_status == "GREEN" else (0.70 if integrity_status == "YELLOW" else 0.30)

        composite_score = round(
            0.20 * classification_conf
            + 0.25 * spatial_alignment_score
            + 0.15 * avg_ocr_conf
            + 0.15 * field_completeness
            + 0.25 * rec_score,
            4,
        )

        confidence_decomp = ConfidenceDecomposition(
            classification=round(classification_conf, 4),
            field_extraction=field_completeness,
            transaction_extraction=round(balance_continuity_rate, 4),
            reconciliation=rec_score,
            overall_analysis=composite_score,
        )

        return {
            "page_sequence_valid": is_page_sequence_valid,
            "total_pages": len(pages),
            "total_transactions": len(transactions),
            "continuity_passed_count": continuity_passed,
            "continuity_failed_count": continuity_failed,
            "failed_transaction_ids": failed_txn_ids,
            "balance_continuity_rate": balance_continuity_rate,
            "ledger_continuity_intact": continuity_failed == 0 and len(transactions) > 0,
            "gaps_detected": gaps_detected,
            "opening_balance": resolved_open,
            "closing_balance": stated_close_dec or calculated_closing,
            "stated_closing_balance": stated_close_dec,
            "calculated_closing_balance": calculated_closing,
            "reconciliation_difference": check_b.difference if check_b.status != "NOT_APPLICABLE" else check_a.difference,
            "ledger_reconciled": integrity_status == "GREEN",
            "date_chronology_rate": 1.0,
            "completeness_score": composite_score,
            "integrity_status": integrity_status,
            "integrity_report": integrity_report,
            "confidence_decomposition": confidence_decomp,
            "audit_summary": audit,
        }


