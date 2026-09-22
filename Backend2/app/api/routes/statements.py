import re
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse
from typing import Optional
from ...tasks.worker import UniversalStatementPipeline
from ...storage.repository import StatementRepository
from ...models.response import StatementAnalysisResult
from ...core.logging import logger

router = APIRouter(tags=["Statements"])


@router.post("/statements/analyze", response_model=StatementAnalysisResult)
async def analyze_statement(file: UploadFile = File(...)):
    """
    Universal Bank Statement Analyzer endpoint.
    Accepts any genuine bank statement PDF (machine-readable, scanned, hybrid, multi-page)
    and returns normalized financial data, reconciliation, cash flow, and 34 fraud checks.
    """
    try:
        content = await file.read()
        result = UniversalStatementPipeline.process_statement_bytes(
            file_bytes=content,
            filename=file.filename or "statement.pdf",
        )
        return result
    except ValueError as ve:
        err_msg = str(ve)
        logger.warning(f"Validation failure: {err_msg}")
        code_match = re.match(r'^\[([A-Z0-9_]+)\]\s*(.*)$', err_msg)
        err_code = code_match.group(1) if code_match else "VALIDATION_ERROR"
        clean_msg = code_match.group(2) if code_match else err_msg
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "error": {
                    "code": err_code,
                    "message": clean_msg,
                },
                "detail": {"message": err_msg, "code": err_code},
            },
        )
    except Exception as e:
        logger.error(f"Internal error processing statement: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An internal error occurred while processing the statement",
                },
                "detail": {"message": "An internal error occurred while processing the statement"},
            },
        )


@router.post("/statement/analyze")
async def analyze_statement_frontend_alias(file: UploadFile = File(...)):
    """
    Compatibility alias endpoint for React frontend dashboard.
    """
    try:
        content = await file.read()
        result = UniversalStatementPipeline.process_statement_bytes(
            file_bytes=content,
            filename=file.filename or "statement.pdf",
        )
        
        integrity_report = result.summary.integrity_report
        confidence_decomp = result.summary.confidence_decomposition
        integrity_status = integrity_report.integrity_status if integrity_report else ("GREEN" if result.summary.balance_reconciled else "RED")
        integrity_msg = integrity_report.integrity_message if integrity_report else ""

        # Format payload wrapped in data for existing frontend compatibility
        summary_dict = {
            "openingBalance": f"{result.summary.opening_balance:.2f}",
            "closingBalance": f"{result.summary.closing_balance:.2f}",
            "statedClosingBalance": f"{result.summary.stated_closing_balance:.2f}" if result.summary.stated_closing_balance is not None else f"{result.summary.closing_balance:.2f}",
            "calculatedClosingBalance": f"{result.summary.calculated_closing_balance:.2f}",
            "totalCredits": f"{result.summary.total_credits:.2f}",
            "totalDebits": f"{result.summary.total_debits:.2f}",
            "transactionDerivedCredits": f"{result.summary.transaction_derived_credits:.2f}",
            "transactionDerivedDebits": f"{result.summary.transaction_derived_debits:.2f}",
            "statementStatedCredits": f"{result.summary.statement_stated_credits:.2f}" if result.summary.statement_stated_credits is not None else None,
            "statementStatedDebits": f"{result.summary.statement_stated_debits:.2f}" if result.summary.statement_stated_debits is not None else None,
            "totalTransactions": result.summary.transaction_count,
            "netCashFlow": f"{result.summary.net_cash_flow:.2f}",
            "averageBalance": f"{result.summary.average_balance:.2f}",
            "averageMonthlyInflow": f"{result.summary.total_credits:.2f}",
            "averageMonthlyOutflow": f"{result.summary.total_debits:.2f}",
            "periodDays": result.summary.period_days,
            "balanceReconciled": result.summary.balance_reconciled,
            "reconciliationDifference": f"{result.summary.reconciliation_difference:.2f}",
            "opening_balance": f"{result.summary.opening_balance:.2f}",
            "closing_balance": f"{result.summary.closing_balance:.2f}",
            "total_credits": f"{result.summary.total_credits:.2f}",
            "total_debits": f"{result.summary.total_debits:.2f}",
            "transaction_count": result.summary.transaction_count,
            "net_cash_flow": f"{result.summary.net_cash_flow:.2f}",
            "average_balance": f"{result.summary.average_balance:.2f}",
            "period_days": result.summary.period_days,
            "balance_reconciled": result.summary.balance_reconciled,
            "integrityReport": integrity_report.model_dump() if integrity_report else None,
            "confidenceDecomposition": confidence_decomp.model_dump() if confidence_decomp else None,
        }

        analytics_obj = result.response_json.get("analytics", {}) if result.response_json else {}
        if "categorizedTransactions" not in analytics_obj and result.response_json:
            analytics_obj["categorizedTransactions"] = result.response_json.get("categorizedTransactions", [t.model_dump() for t in result.transactions])

        return {
            "success": True,
            "message": "Bank statement analyzed successfully",
            "requestId": result.processing.request_id,
            "data": {
                "documentType": result.document.document_type,
                "confidence": result.document.confidence,
                "classification": {
                    "documentType": result.document.document_type,
                    "confidence": result.document.confidence,
                    "breakdown": {
                        "bankIdentity": 20 if result.bank.confidence > 0.5 else 10,
                        "accountInfo": 20 if result.account.confidence > 0.5 else 10,
                        "transactionTable": 25 if len(result.transactions) > 0 else 0,
                        "financialColumns": 15 if result.summary.balance_reconciled else 10,
                        "statementPeriod": 15 if result.statement_period.confidence > 0.5 else 5,
                    },
                },
                "validation": {
                    "balanceContinuityVerified": integrity_status == "GREEN",
                    "integrityStatus": integrity_status,
                    "integrityMessage": integrity_msg,
                    "balanceDifference": f"{result.summary.reconciliation_difference:.2f}",
                    "completenessScore": result.extraction.completeness_score,
                    "ledgerReconciled": result.summary.balance_reconciled,
                    "statedClosingBalance": f"{result.summary.stated_closing_balance:.2f}" if result.summary.stated_closing_balance is not None else f"{result.summary.closing_balance:.2f}",
                    "calculatedClosingBalance": f"{result.summary.calculated_closing_balance:.2f}",
                    "failedTransactions": result.summary.failed_transaction_ids,
                    "integrityReport": integrity_report.model_dump() if integrity_report else None,
                    "confidenceDecomposition": confidence_decomp.model_dump() if confidence_decomp else None,
                },
                "completenessScore": result.extraction.completeness_score,
                "integrityReport": integrity_report.model_dump() if integrity_report else None,
                "confidenceDecomposition": confidence_decomp.model_dump() if confidence_decomp else None,
                "audit": result.extraction.audit_report or {},
                "completenessVerification": result.extraction.completeness_verification or {},
                "bank": {
                    "name": result.bank.name,
                    "confidence": result.bank.confidence,
                    "ifsc": result.bank.ifsc,
                },
                "account": {
                    "number": result.account.account_number_raw or result.account.account_number_masked,
                    "holderName": result.account.holder_name,
                    "type": result.account.account_type,
                    "maskedNumber": result.account.account_number_masked,
                    "ifsc": result.account.ifsc or result.bank.ifsc or "",
                },
                "statementPeriod": {
                    "startDate": result.statement_period.start_date,
                    "endDate": result.statement_period.end_date,
                },
                "summary": summary_dict,
                "transactions": [t.model_dump() for t in result.transactions],
                "monthlyCashFlow": [m.model_dump() for m in result.monthly_cash_flow],
                "categories": result.categories.model_dump(),
                "fraudRules": [f.model_dump() for f in result.fraud_detection],
                "riskProfile": result.risk_profile.model_dump(),
                "analysis": {
                    "document": {
                        "bankName": result.bank.name,
                        "accountHolderName": result.account.holder_name,
                        "accountNumber": result.account.account_number_masked,
                        "ifsc": result.account.ifsc or result.bank.ifsc or "—",
                        "accountType": result.account.account_type,
                        "statementStartDate": result.statement_period.start_date,
                        "statementEndDate": result.statement_period.end_date,
                    },
                    "summary": summary_dict,
                    "transactions": [t.model_dump() for t in result.transactions],
                    "analytics": analytics_obj,
                },
                "responseJson": result.response_json,
            },
        }
    except ValueError as ve:
        err_msg = str(ve)
        logger.warning(f"Validation failure: {err_msg}")
        code_match = re.match(r'^\[([A-Z0-9_]+)\]\s*(.*)$', err_msg)
        err_code = code_match.group(1) if code_match else "VALIDATION_ERROR"
        clean_msg = code_match.group(2) if code_match else err_msg
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "error": {
                    "code": err_code,
                    "message": clean_msg,
                },
                "detail": {"message": err_msg, "code": err_code},
            },
        )
    except Exception as e:
        logger.error(f"Internal error processing statement: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An internal error occurred while processing the statement",
                },
                "detail": {"message": "An internal error occurred while processing the statement"},
            },
        )


@router.get("/statements/{request_id}")
def get_statement_by_id(request_id: str):
    data = StatementRepository.get_statement_result(request_id)
    if not data:
        raise HTTPException(status_code=404, detail="Statement analysis result not found")
    return data


@router.get("/statements/{request_id}/ledger-debug")
def get_statement_ledger_debug(request_id: str):
    """
    Returns complete step-by-step transaction ledger continuity and candidate audit diagnostics.
    PII and full account numbers are strictly masked.
    """
    data = StatementRepository.get_statement_result(request_id)
    if not data:
        raise HTTPException(status_code=404, detail="Statement analysis result not found")

    summary = data.get("summary", {})
    extraction = data.get("extraction", {})
    completeness = extraction.get("completeness_verification", {})
    audit = extraction.get("audit_report", {})
    transactions = data.get("transactions", [])
    account = data.get("account", {})

    # PII masking: Mask account numbers in responses
    masked_acct = account.get("account_number_masked", "XXXXXX9513")

    return {
        "request_id": request_id,
        "account_number_masked": masked_acct,
        "integrity_status": summary.get("integrity_report", {}).get("integrity_status", "UNKNOWN"),
        "integrity_message": summary.get("integrity_report", {}).get("integrity_message", ""),
        "tolerance": summary.get("integrity_report", {}).get("tolerance", "0.01"),
        "opening_balance_source": "Statement Header / Account Summary",
        "closing_balance_source": "Statement Header / Page Summary",
        "candidate_row_count": audit.get("total_candidate_rows", len(transactions)),
        "accepted_transaction_count": len(transactions),
        "rejected_row_count": audit.get("rejected_rows", 0),
        "merged_continuation_count": audit.get("merged_continuation_rows", 0),
        "repeated_header_count": audit.get("header_rows_removed", 0),
        "non_transaction_rows_count": audit.get("non_transaction_rows_removed", 0),
        "suspicious_row_count": audit.get("suspicious_rows", 0),
        "unresolved_gap_count": len(completeness.get("gaps_detected", [])),
        "ledger_summary": {
            "opening_balance": summary.get("opening_balance"),
            "transaction_derived_credits": summary.get("transaction_derived_credits"),
            "transaction_derived_debits": summary.get("transaction_derived_debits"),
            "calculated_closing_balance": summary.get("calculated_closing_balance"),
            "stated_closing_balance": summary.get("stated_closing_balance"),
            "statement_stated_credits": summary.get("statement_stated_credits"),
            "statement_stated_debits": summary.get("statement_stated_debits"),
            "balance_reconciled": summary.get("balance_reconciled"),
            "reconciliation_difference": summary.get("reconciliation_difference"),
        },
        "audit_metrics": audit,
        "integrity_checks": summary.get("integrity_report", {}),
        "confidence_decomposition": summary.get("confidence_decomposition", {}),
        "gaps_detected": completeness.get("gaps_detected", []),
        "failed_transaction_ids": summary.get("failed_transaction_ids", []),
        "transaction_count": len(transactions),
        "transactions_by_page": audit.get("transactions_by_page", {}),
    }

