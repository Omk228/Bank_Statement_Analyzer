import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, Optional
from ..core.security import SecurityValidator, StatementErrorCode
from ..core.logging import logger
from ..models.document import DocumentMetadata
from ..models.response import StatementAnalysisResult, ExtractionSummary, ProcessingInfo, BankInfo, DocumentHeader
from ..models.account import ExtractedAccountInfo, StatementPeriod
from ..services.pdf.extractor import UniversalPDFExtractor
from ..services.classification.classifier import DocumentClassifier
from ..services.layout.table_detector import TableDetector
from ..services.extraction.fields import UniversalFieldExtractor
from ..services.extraction.transactions import TransactionStateMachineParser
from ..services.extraction.completeness import CompletenessChecker
from ..services.analytics.summary import FinancialSummaryEngine
from ..services.analytics.cashflow import CashFlowEngine
from ..services.analytics.categorization import CategorizationEngine
from ..services.analytics.recurring import RecurringIncomeDetector
from ..services.analytics.risk import RiskAnalyticsEngine
from ..services.fraud.engine import FraudEngine
from ..storage.repository import StatementRepository


class UniversalStatementPipeline:
    @classmethod
    def process_statement_bytes(
        cls, file_bytes: bytes, filename: str = "statement.pdf", request_id: Optional[str] = None
    ) -> StatementAnalysisResult:
        start_time = time.time()
        req_id = request_id or SecurityValidator.generate_id("req")
        doc_id = SecurityValidator.generate_id("doc")

        logger.info(f"Starting statement processing pipeline for {filename}", extra={"request_id": req_id, "stage": "REQUEST_RECEIVED"})

        # 1. Security & File Metadata Validation
        valid_meta, err_code, err_msg = SecurityValidator.validate_file_metadata(filename, file_bytes)
        if not valid_meta:
            raise ValueError(f"[{err_code}] {err_msg}")

        # 2. PDF Structure & Page Limit Validation
        valid_struct, s_err_code, s_err_msg, page_count = SecurityValidator.validate_pdf_structure(file_bytes)
        if not valid_struct:
            raise ValueError(f"[{s_err_code}] {s_err_msg}")

        # 3. Multi-Engine Spatial Geometry Extraction
        extractor = UniversalPDFExtractor()
        page_results = extractor.extract_document(file_bytes, request_id=req_id)
        if not page_results:
            raise ValueError(f"[{StatementErrorCode.NO_READABLE_CONTENT}] Unable to extract any readable content or OCR from document")

        # 4. Multi-Signal Document & Bank Classification
        classification = DocumentClassifier.classify_document(page_results)
        doc_type = classification["document_type"]
        detected_bank = classification["detected_bank"]

        if doc_type != "BANK_STATEMENT":
            raise ValueError(f"[{StatementErrorCode.NOT_BANK_STATEMENT}] Uploaded file is not a valid bank statement (Classification: {doc_type}, Detected issues: {', '.join(classification.get('negative_matches', [])) or 'insufficient banking signals'})")

        # 5. Semantic Field Extraction with Confidence & Evidence
        account_info, statement_period, explicit_balances = UniversalFieldExtractor.extract_all_fields(
            page_results, detected_bank=detected_bank
        )

        # 6. Layout-Aware Table & Column Boundary Detection
        table_schemas = TableDetector.detect_document_tables(page_results)

        # 7. Transaction State Machine Extraction with Full Audit Tracing
        transactions, audit_report = TransactionStateMachineParser.parse_document_transactions_with_audit(
            page_results, table_schemas
        )

        # 8. Completeness & Multi-Signal Ledger Verification (Checks A, B, C, D)
        completeness = CompletenessChecker.verify_document_completeness(
            pages=page_results,
            transactions=transactions,
            opening_balance=explicit_balances.get("opening_balance"),
            closing_balance=explicit_balances.get("closing_balance"),
            stated_closing_balance=explicit_balances.get("stated_closing_balance"),
            stated_total_credits=explicit_balances.get("stated_total_credits"),
            stated_total_debits=explicit_balances.get("stated_total_debits"),
            audit_report=audit_report,
            classification_conf=classification.get("confidence", 0.95),
        )

        # 9. Dynamic Financial Analytics & Balance Reconciliation
        summary = FinancialSummaryEngine.calculate_summary(
            transactions=transactions,
            explicit_opening=explicit_balances.get("opening_balance"),
            explicit_closing=explicit_balances.get("stated_closing_balance") or explicit_balances.get("closing_balance"),
            explicit_stated_credits=explicit_balances.get("stated_total_credits"),
            explicit_stated_debits=explicit_balances.get("stated_total_debits"),
            period_days=statement_period.period_days,
        )
        summary.integrity_report = completeness.get("integrity_report")
        summary.confidence_decomposition = completeness.get("confidence_decomposition")

        # 10. Spending Categorization & Payment Mode Detection
        categories = CategorizationEngine.categorize_transactions(transactions)

        # 11. Monthly Cash Flow Slicing
        monthly_cash_flow = CashFlowEngine.calculate_monthly_cash_flow(transactions)

        # 12. Recurring Income & Salary Detection
        recurring_income = RecurringIncomeDetector.detect_recurring_streams(transactions)

        # 13. Risk Analytics Profile
        risk_profile = RiskAnalyticsEngine.calculate_risk_profile(transactions, summary.total_credits)

        # 14. 34 Forensic Fraud & Anomaly Rules Engine
        fraud_rules = FraudEngine.evaluate_all_rules(
            transactions=transactions,
            total_credits=summary.total_credits,
            total_debits=summary.total_debits,
            opening_balance=summary.opening_balance,
            closing_balance=summary.closing_balance,
            average_balance=summary.average_balance,
        )

        duration_ms = round((time.time() - start_time) * 1000, 2)

        # 15. Extraction Summary
        native_count = len([p for p in page_results if p.extraction_method == 'NATIVE'])
        ocr_count = len([p for p in page_results if p.extraction_method == 'OCR'])
        hybrid_count = len([p for p in page_results if p.extraction_method == 'HYBRID'])
        avg_ocr_conf = sum([p.confidence for p in page_results]) / len(page_results) if page_results else 1.0

        # 16. Build Full Finvu / Response.json Dynamic Schema
        min_balance = min([t.balance for t in transactions if t.balance is not None], default=summary.closing_balance)
        max_balance = max([t.balance for t in transactions if t.balance is not None], default=summary.closing_balance)

        response_json_structure = {
            "analytics": {
                "consumer": {
                    "base": {
                        "subject": {
                            "subjectId": f"{account_info.account_number_masked}@finvu",
                            "dataPeriod": {
                                "startDate": statement_period.start_date,
                                "endDate": statement_period.end_date,
                                "daysCount": statement_period.period_days,
                                "fullMonthCount": max(1, statement_period.period_days // 30),
                            },
                            "kpi": {
                                "countriesCount": 1,
                                "providersCount": 1,
                                "accountsCount": 1,
                                "significantAccountsCount": 1,
                                "balance": {
                                    "totalBalanceAmount": f"{summary.closing_balance:.2f}",
                                    "averageBalanceAmount": f"{summary.average_balance:.2f}",
                                    "minBalanceAmount": f"{min_balance:.2f}",
                                    "maxBalanceAmount": f"{max_balance:.2f}",
                                },
                                "periodTransactionsCount": {
                                    "total": len(transactions),
                                    "income": summary.credit_count,
                                    "expenses": summary.debit_count,
                                },
                            },
                        },
                        "connections": [
                            {
                                "connectionId": detected_bank,
                                "accounts": [
                                    {
                                        "accountId": f"{account_info.account_number_masked}-{account_info.account_type}",
                                        "kpi": {
                                            "balance": {
                                                "totalBalanceAmount": f"{summary.closing_balance:.2f}",
                                                "averageBalanceAmount": f"{summary.average_balance:.2f}",
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    "identity": {
                        "verification": "none",
                        "soleTrader": any(["gst" in t.description.lower() for t in transactions]),
                    },
                    "risk": {
                        "indebtedness": {
                            "loanInstalment": {
                                "periodTotalTransactionsAmount": f"{-risk_profile.total_emi_amount:.2f}",
                                "monthlyAverageTransactionsAmount": f"{-round(float(risk_profile.total_emi_amount) / max(1, len(monthly_cash_flow)), 2):.2f}",
                            },
                            "incomeRatio": risk_profile.emi_to_income_ratio,
                        },
                        "cash": {
                            "withdrawal": {
                                "periodTotalTransactionsAmount": f"{-risk_profile.total_cash_withdrawal:.2f}",
                                "incomeRatio": risk_profile.cash_withdrawal_ratio,
                            }
                        }
                    },
                    "cashFlow": {
                        "monthlyAnalysis": [m.model_dump() for m in monthly_cash_flow],
                        "periodAnalysis": {
                            "incomeAmount": {"total": f"{summary.total_credits:.2f}"},
                            "expensesAmount": {"total": f"{-summary.total_debits:.2f}"},
                            "savingAmount": {"total": f"{summary.net_cash_flow:.2f}"},
                        },
                    },
                    "fraudIndicators": [
                        {
                            "accountId": account_info.account_number_masked,
                            "fraud": [f.model_dump() for f in fraud_rules],
                        }
                    ],
                    "customerProfile": [
                        {
                            "accountId": account_info.account_number_masked,
                            "bank": detected_bank,
                            "name": account_info.holder_name,
                            "accountType": account_info.account_type,
                            "ifsc": account_info.ifsc or "",
                        }
                    ]
                }
            },
            "categorizedTransactions": [t.model_dump() for t in transactions],
        }

        # 17. Assemble Strict Pydantic Response Model
        final_result = StatementAnalysisResult(
            success=True,
            document=DocumentHeader(
                document_type=doc_type,
                confidence=classification["confidence"],
                page_count=len(page_results),
                currency="INR",
            ),
            bank=BankInfo(
                name=detected_bank,
                confidence=classification["bank_confidence"],
                ifsc=account_info.ifsc,
                micr=account_info.micr,
            ),
            account=account_info,
            statement_period=statement_period,
            summary=summary,
            transactions=transactions,
            monthly_cash_flow=monthly_cash_flow,
            categories=categories,
            recurring_income=recurring_income,
            risk_profile=risk_profile,
            fraud_detection=fraud_rules,
            extraction=ExtractionSummary(
                native_pages=native_count,
                ocr_pages=ocr_count,
                hybrid_pages=hybrid_count,
                average_ocr_confidence=round(avg_ocr_conf, 4),
                warnings=[],
                completeness_score=completeness["completeness_score"],
                audit_report=audit_report,
                completeness_verification=completeness,
            ),
            processing=ProcessingInfo(
                request_id=req_id,
                processing_time_ms=duration_ms,
            ),
            response_json=response_json_structure,
        )

        # 18. Save to Persistent Statement Repository
        metadata = DocumentMetadata(
            document_id=doc_id,
            request_id=req_id,
            original_filename=filename,
            file_size_bytes=len(file_bytes),
            page_count=len(page_results),
            created_at=datetime.now(timezone.utc).isoformat(),
            completed_at=datetime.now(timezone.utc).isoformat(),
            processing_duration_ms=duration_ms,
            status="SUCCESS",
        )
        StatementRepository.save_statement_result(req_id, metadata, final_result.model_dump())

        logger.info(f"Statement processing completed in {duration_ms}ms with {len(transactions)} transactions", extra={"request_id": req_id, "duration_ms": duration_ms, "status": "SUCCESS"})

        return final_result

