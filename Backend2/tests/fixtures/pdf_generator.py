import os
import json
import fitz  # PyMuPDF


def create_sample_pdf(
    file_path: str,
    bank_name: str,
    account_holder: str,
    account_number: str,
    ifsc: str,
    period: str,
    opening_bal: float,
    transactions: list,
    closing_bal: float,
    multi_page: bool = False,
):
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    doc = fitz.open()

    col_x = {
        "date": 40.0,
        "desc": 130.0,
        "debit": 340.0,
        "credit": 420.0,
        "balance": 500.0,
    }

    # Page 1
    page1 = doc.new_page(width=595, height=842)
    
    # Header & Account Info
    page1.insert_text(fitz.Point(40, 50), f"{bank_name}", fontsize=14, fontname="helv")
    page1.insert_text(fitz.Point(40, 70), "Account Statement", fontsize=11, fontname="helv")
    page1.insert_text(fitz.Point(40, 95), f"Customer Name: {account_holder}", fontsize=9, fontname="helv")
    page1.insert_text(fitz.Point(40, 110), f"Account Number: {account_number}", fontsize=9, fontname="helv")
    if ifsc:
        page1.insert_text(fitz.Point(40, 125), f"IFSC Code: {ifsc}", fontsize=9, fontname="helv")
    page1.insert_text(fitz.Point(40, 140), f"Statement Period: {period}", fontsize=9, fontname="helv")
    page1.insert_text(fitz.Point(40, 155), f"Opening Balance: {opening_bal:.2f}", fontsize=9, fontname="helv")

    # Table Header Row
    y_hdr = 185
    page1.insert_text(fitz.Point(col_x["date"], y_hdr), "Date", fontsize=9, fontname="helv")
    page1.insert_text(fitz.Point(col_x["desc"], y_hdr), "Particulars", fontsize=9, fontname="helv")
    page1.insert_text(fitz.Point(col_x["debit"], y_hdr), "Debit", fontsize=9, fontname="helv")
    page1.insert_text(fitz.Point(col_x["credit"], y_hdr), "Credit", fontsize=9, fontname="helv")
    page1.insert_text(fitz.Point(col_x["balance"], y_hdr), "Balance", fontsize=9, fontname="helv")

    y_pos = 210
    txns_p1 = transactions[:len(transactions)//2] if multi_page else transactions

    for t in txns_p1:
        page1.insert_text(fitz.Point(col_x["date"], y_pos), t['date'], fontsize=9, fontname="helv")
        page1.insert_text(fitz.Point(col_x["desc"], y_pos), t['description'][:28], fontsize=9, fontname="helv")
        if t['debit'] > 0:
            page1.insert_text(fitz.Point(col_x["debit"], y_pos), f"{t['debit']:.2f}", fontsize=9, fontname="helv")
        if t['credit'] > 0:
            page1.insert_text(fitz.Point(col_x["credit"], y_pos), f"{t['credit']:.2f}", fontsize=9, fontname="helv")
        page1.insert_text(fitz.Point(col_x["balance"], y_pos), f"{t['balance']:.2f}", fontsize=9, fontname="helv")
        y_pos += 22

    if not multi_page:
        summary_text = f"Closing Balance: {closing_bal:.2f}\nTotal Transactions: {len(transactions)}"
        page1.insert_text(fitz.Point(40, y_pos + 25), summary_text, fontsize=9, fontname="helv")
    else:
        # Page 2 for multi-page statements
        page2 = doc.new_page(width=595, height=842)
        page2.insert_text(fitz.Point(40, 50), f"{bank_name} - Continued", fontsize=11, fontname="helv")
        
        y_p2_hdr = 75
        page2.insert_text(fitz.Point(col_x["date"], y_p2_hdr), "Date", fontsize=9, fontname="helv")
        page2.insert_text(fitz.Point(col_x["desc"], y_p2_hdr), "Particulars", fontsize=9, fontname="helv")
        page2.insert_text(fitz.Point(col_x["debit"], y_p2_hdr), "Debit", fontsize=9, fontname="helv")
        page2.insert_text(fitz.Point(col_x["credit"], y_p2_hdr), "Credit", fontsize=9, fontname="helv")
        page2.insert_text(fitz.Point(col_x["balance"], y_p2_hdr), "Balance", fontsize=9, fontname="helv")

        y_p2 = 100
        txns_p2 = transactions[len(transactions)//2:]
        for t in txns_p2:
            page2.insert_text(fitz.Point(col_x["date"], y_p2), t['date'], fontsize=9, fontname="helv")
            page2.insert_text(fitz.Point(col_x["desc"], y_p2), t['description'][:28], fontsize=9, fontname="helv")
            if t['debit'] > 0:
                page2.insert_text(fitz.Point(col_x["debit"], y_p2), f"{t['debit']:.2f}", fontsize=9, fontname="helv")
            if t['credit'] > 0:
                page2.insert_text(fitz.Point(col_x["credit"], y_p2), f"{t['credit']:.2f}", fontsize=9, fontname="helv")
            page2.insert_text(fitz.Point(col_x["balance"], y_p2), f"{t['balance']:.2f}", fontsize=9, fontname="helv")
            y_p2 += 22

        summary_text = f"Closing Balance: {closing_bal:.2f}\nTotal Transactions: {len(transactions)}"
        page2.insert_text(fitz.Point(40, y_p2 + 25), summary_text, fontsize=9, fontname="helv")

    doc.save(file_path)
    doc.close()


def generate_all_fixtures(fixtures_root: str):
    # 1. Axis Bank Fixture
    axis_dir = os.path.join(fixtures_root, "axis")
    axis_txns = [
        {"date": "2026-08-05", "description": "Salary Credit from Sprinklr", "debit": 0.0, "credit": 50000.0, "balance": 60000.0},
        {"date": "2026-08-10", "description": "UPI/P2M/Swiggy Order Food", "debit": 650.0, "credit": 0.0, "balance": 59350.0},
        {"date": "2026-08-15", "description": "ATM Cash WDL Connaught Place", "debit": 5000.0, "credit": 0.0, "balance": 54350.0},
        {"date": "2026-08-20", "description": "HDFC Home Loan EMI AutoDebit", "debit": 20000.0, "credit": 0.0, "balance": 34350.0},
    ]
    create_sample_pdf(
        os.path.join(axis_dir, "statement.pdf"),
        bank_name="Axis Bank Limited",
        account_holder="Rajat Kumar Sharma",
        account_number="912010045896321",
        ifsc="UTIB0000004",
        period="01/08/2026 to 31/08/2026",
        opening_bal=10000.0,
        transactions=axis_txns,
        closing_bal=34350.0,
        multi_page=True,
    )
    with open(os.path.join(axis_dir, "expected.json"), "w", encoding="utf-8") as f:
        json.dump({
            "bank_name": "Axis Bank",
            "account_holder": "Rajat Kumar Sharma",
            "ifsc": "UTIB0000004",
            "opening_balance": 10000.0,
            "closing_balance": 34350.0,
            "total_credits": 50000.0,
            "total_debits": 25650.0,
            "transaction_count": 4,
            "balance_reconciled": True,
        }, f, indent=2)

    # 2. Kotak Mahindra Bank Fixture
    kotak_dir = os.path.join(fixtures_root, "kotak")
    kotak_txns = [
        {"date": "2026-08-02", "description": "UPI/P2A/Transfer to Rahul", "debit": 30.0, "credit": 0.0, "balance": 20.64},
        {"date": "2026-08-04", "description": "IMPS/Interest Credit", "debit": 0.0, "credit": 5.0, "balance": 25.64},
        {"date": "2026-08-10", "description": "UPI/Blinkit Grocery Payment", "debit": 15.0, "credit": 0.0, "balance": 10.64},
    ]
    create_sample_pdf(
        os.path.join(kotak_dir, "statement.pdf"),
        bank_name="Kotak Mahindra Bank",
        account_holder="Rani Devi",
        account_number="6947759513",
        ifsc="KKBK0004587",
        period="01-Aug-2026 - 31-Aug-2026",
        opening_bal=50.64,
        transactions=kotak_txns,
        closing_bal=10.64,
        multi_page=False,
    )
    with open(os.path.join(kotak_dir, "expected.json"), "w", encoding="utf-8") as f:
        json.dump({
            "bank_name": "Kotak Mahindra Bank",
            "account_holder": "Rani Devi",
            "ifsc": "KKBK0004587",
            "opening_balance": 50.64,
            "closing_balance": 10.64,
            "total_credits": 5.0,
            "total_debits": 45.0,
            "transaction_count": 3,
            "balance_reconciled": True,
        }, f, indent=2)

    # 3. HDFC Bank Fixture
    hdfc_dir = os.path.join(fixtures_root, "hdfc")
    hdfc_txns = [
        {"date": "2026-07-01", "description": "NEFT Inward Company Payout", "debit": 0.0, "credit": 30000.0, "balance": 55000.0},
        {"date": "2026-07-12", "description": "Electricity Bill Payment BESCOM", "debit": 2500.0, "credit": 0.0, "balance": 52500.0},
        {"date": "2026-07-25", "description": "Mutual Fund SIP Investment", "debit": 10000.0, "credit": 0.0, "balance": 42500.0},
    ]
    create_sample_pdf(
        os.path.join(hdfc_dir, "statement.pdf"),
        bank_name="HDFC Bank Limited",
        account_holder="Anita Verma",
        account_number="50100234567890",
        ifsc="HDFC0000123",
        period="01/07/2026 to 31/07/2026",
        opening_bal=25000.0,
        transactions=hdfc_txns,
        closing_bal=42500.0,
        multi_page=False,
    )
    with open(os.path.join(hdfc_dir, "expected.json"), "w", encoding="utf-8") as f:
        json.dump({
            "bank_name": "HDFC Bank",
            "account_holder": "Anita Verma",
            "ifsc": "HDFC0000123",
            "opening_balance": 25000.0,
            "closing_balance": 42500.0,
            "total_credits": 30000.0,
            "total_debits": 12500.0,
            "transaction_count": 3,
            "balance_reconciled": True,
        }, f, indent=2)

    # 4. SBI Fixture
    sbi_dir = os.path.join(fixtures_root, "sbi")
    sbi_txns = [
        {"date": "2026-06-05", "description": "BY TRANSFER-UPI/P2A/52831/VIKRAM", "debit": 0.0, "credit": 5000.0, "balance": 10000.0},
        {"date": "2026-06-15", "description": "TO DEBIT-ATM WDL STATE BANK ATM", "debit": 1800.0, "credit": 0.0, "balance": 8200.0},
    ]
    create_sample_pdf(
        os.path.join(sbi_dir, "statement.pdf"),
        bank_name="State Bank of India",
        account_holder="Vikram Singh",
        account_number="30294857102",
        ifsc="SBIN0001234",
        period="01/06/2026 to 30/06/2026",
        opening_bal=5000.0,
        transactions=sbi_txns,
        closing_bal=8200.0,
        multi_page=False,
    )
    with open(os.path.join(sbi_dir, "expected.json"), "w", encoding="utf-8") as f:
        json.dump({
            "bank_name": "State Bank of India",
            "account_holder": "Vikram Singh",
            "ifsc": "SBIN0001234",
            "opening_balance": 5000.0,
            "closing_balance": 8200.0,
            "total_credits": 5000.0,
            "total_debits": 1800.0,
            "transaction_count": 2,
            "balance_reconciled": True,
        }, f, indent=2)

    # 5. ICICI Fixture
    icici_dir = os.path.join(fixtures_root, "icici")
    icici_txns = [
        {"date": "2026-05-10", "description": "IMPS/P2A/Client Payment Inward", "debit": 0.0, "credit": 20000.0, "balance": 35000.0},
        {"date": "2026-05-20", "description": "ACH Debit Credit Card Payment", "debit": 5000.0, "credit": 0.0, "balance": 30000.0},
    ]
    create_sample_pdf(
        os.path.join(icici_dir, "statement.pdf"),
        bank_name="ICICI Bank Limited",
        account_holder="Pooja Hegde",
        account_number="017701546890",
        ifsc="ICIC0000177",
        period="01/05/2026 to 31/05/2026",
        opening_bal=15000.0,
        transactions=icici_txns,
        closing_bal=30000.0,
        multi_page=False,
    )
    with open(os.path.join(icici_dir, "expected.json"), "w", encoding="utf-8") as f:
        json.dump({
            "bank_name": "ICICI Bank",
            "account_holder": "Pooja Hegde",
            "ifsc": "ICIC0000177",
            "opening_balance": 15000.0,
            "closing_balance": 30000.0,
            "total_credits": 20000.0,
            "total_debits": 5000.0,
            "transaction_count": 2,
            "balance_reconciled": True,
        }, f, indent=2)

    # 6. Unknown International Bank Fixture
    unknown_dir = os.path.join(fixtures_root, "unknown")
    unknown_txns = [
        {"date": "2026-04-01", "description": "Direct Deposit Payroll Acme Corp", "debit": 0.0, "credit": 1000.0, "balance": 2000.0},
        {"date": "2026-04-14", "description": "Online Debit Card Merchant Payment", "debit": 350.0, "credit": 0.0, "balance": 1650.0},
    ]
    create_sample_pdf(
        os.path.join(unknown_dir, "statement.pdf"),
        bank_name="Pacific Alpine Financial",
        account_holder="Johnathan Doe",
        account_number="889922110033",
        ifsc="",
        period="01/04/2026 to 30/04/2026",
        opening_bal=1000.0,
        transactions=unknown_txns,
        closing_bal=1650.0,
        multi_page=False,
    )
    with open(os.path.join(unknown_dir, "expected.json"), "w", encoding="utf-8") as f:
        json.dump({
            "bank_name": "Pacific Alpine Financial",
            "account_holder": "Johnathan Doe",
            "opening_balance": 1000.0,
            "closing_balance": 1650.0,
            "total_credits": 1000.0,
            "total_debits": 350.0,
            "transaction_count": 2,
            "balance_reconciled": True,
        }, f, indent=2)
