import os
import pytest
from PIL import Image, ImageDraw
import fitz
from Backend2.app.tasks.worker import UniversalStatementPipeline
from Backend2.app.services.classification.classifier import DocumentClassifier
from Backend2.app.services.pdf.extractor import UniversalPDFExtractor
from Backend2.app.services.ocr.tesseract import TesseractOCREngine


def generate_7_page_scanned_pdf(file_path: str):
    """
    Generates a 7-page purely scanned PDF (raster images with 0 native words)
    containing multi-page ledger tables, mixed transaction narrations with potential
    false-positive keywords (GST invoice, Loan EMI, Bill payment, Vendor receipt),
    and account metadata.
    """
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    width, height = 1654, 2338  # A4 at 200 DPI

    doc = fitz.open()

    for page_num in range(1, 8):
        img = Image.new("RGB", (width, height), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)

        if page_num == 1:
            # Page 1: Bank Header, Account Info, Statement Period, Table Header, Initial Rows
            draw.text((100, 100), "Kotak Mahindra Bank", fill=(0, 0, 0), font_size=36)
            draw.text((100, 160), "Savings Account Statement", fill=(0, 0, 0), font_size=28)
            draw.text((100, 220), "Customer Name: Rajesh Sharma", fill=(0, 0, 0), font_size=24)
            draw.text((100, 260), "Account Number: 918273645012", fill=(0, 0, 0), font_size=24)
            draw.text((100, 300), "Customer ID / CRN: 88726154", fill=(0, 0, 0), font_size=24)
            draw.text((100, 340), "IFSC Code: KKBK0000921", fill=(0, 0, 0), font_size=24)
            draw.text((100, 380), "MICR Code: 400485002", fill=(0, 0, 0), font_size=24)
            draw.text((100, 420), "Statement Period: 01/01/2026 to 31/01/2026", fill=(0, 0, 0), font_size=24)
            draw.text((100, 460), "Opening Balance: 15000.00", fill=(0, 0, 0), font_size=24)

            # Table Header
            y_hdr = 540
            draw.text((100, y_hdr), "Date", fill=(0, 0, 0), font_size=24)
            draw.text((350, y_hdr), "Particulars / Narration", fill=(0, 0, 0), font_size=24)
            draw.text((950, y_hdr), "Debit (DR)", fill=(0, 0, 0), font_size=24)
            draw.text((1150, y_hdr), "Credit (CR)", fill=(0, 0, 0), font_size=24)
            draw.text((1350, y_hdr), "Balance", fill=(0, 0, 0), font_size=24)

            # Row 1 with potentially tricky narration keyword 'Invoice'
            draw.text((100, 600), "2026-01-02", fill=(0, 0, 0), font_size=22)
            draw.text((350, 600), "UPI Payment for Amazon Tax Invoice #84729", fill=(0, 0, 0), font_size=22)
            draw.text((950, 600), "1250.00", fill=(0, 0, 0), font_size=22)
            draw.text((1350, 600), "13750.00", fill=(0, 0, 0), font_size=22)

            # Row 2 with keyword 'Salary'
            draw.text((100, 660), "2026-01-05", fill=(0, 0, 0), font_size=22)
            draw.text((350, 660), "NEFT Inward Salary Credit Infosys Tech", fill=(0, 0, 0), font_size=22)
            draw.text((1150, 660), "55000.00", fill=(0, 0, 0), font_size=22)
            draw.text((1350, 660), "68750.00", fill=(0, 0, 0), font_size=22)

        elif page_num in (2, 3, 4, 5):
            # Mid pages: Continuation table headers & multi-row transactions with tricky keywords
            draw.text((100, 80), "Kotak Mahindra Bank - Account Statement (Continued)", fill=(0, 0, 0), font_size=26)
            draw.text((100, 120), "Account No: 918273645012", fill=(0, 0, 0), font_size=22)

            y_hdr = 180
            draw.text((100, y_hdr), "Date", fill=(0, 0, 0), font_size=24)
            draw.text((350, y_hdr), "Narration", fill=(0, 0, 0), font_size=24)
            draw.text((950, y_hdr), "Withdrawal (Dr)", fill=(0, 0, 0), font_size=24)
            draw.text((1150, y_hdr), "Deposit (Cr)", fill=(0, 0, 0), font_size=24)
            draw.text((1350, y_hdr), "Running Balance", fill=(0, 0, 0), font_size=24)

            # Row with 'Loan Agreement' / 'Home Loan EMI' keywords in narration
            draw.text((100, 240), f"2026-01-0{page_num+3}", fill=(0, 0, 0), font_size=22)
            draw.text((350, 240), "ACH Debit HDFC Home Loan EMI Agreement #LN82910", fill=(0, 0, 0), font_size=22)
            draw.text((950, 240), "15000.00", fill=(0, 0, 0), font_size=22)
            draw.text((1350, 240), "53750.00", fill=(0, 0, 0), font_size=22)

            # Row with 'Vendor Bill' / 'GST'
            draw.text((100, 300), f"2026-01-0{page_num+4}", fill=(0, 0, 0), font_size=22)
            draw.text((350, 300), "IMPS Transfer to Vendor Bill Payment GST #07AAACG", fill=(0, 0, 0), font_size=22)
            draw.text((950, 300), "3500.00", fill=(0, 0, 0), font_size=22)
            draw.text((1350, 300), "50250.00", fill=(0, 0, 0), font_size=22)

        elif page_num == 6:
            # Page 6: Sparse page testing single OCR execution without duplicate rerun
            draw.text((100, 80), "Kotak Mahindra Bank - Account Statement (Page 6 of 7)", fill=(0, 0, 0), font_size=26)
            draw.text((100, 140), "Date", fill=(0, 0, 0), font_size=24)
            draw.text((350, 140), "Description", fill=(0, 0, 0), font_size=24)
            draw.text((950, 140), "Debit", fill=(0, 0, 0), font_size=24)
            draw.text((1150, 140), "Credit", fill=(0, 0, 0), font_size=24)
            draw.text((1350, 140), "Balance", fill=(0, 0, 0), font_size=24)

            draw.text((100, 200), "2026-01-22", fill=(0, 0, 0), font_size=22)
            draw.text((350, 200), "POS Purchase Reliance Retail", fill=(0, 0, 0), font_size=22)
            draw.text((950, 200), "250.00", fill=(0, 0, 0), font_size=22)
            draw.text((1350, 200), "50000.00", fill=(0, 0, 0), font_size=22)

        elif page_num == 7:
            # Page 7: Final Transactions, Balances & Summary
            draw.text((100, 80), "Kotak Mahindra Bank - Summary (Page 7 of 7)", fill=(0, 0, 0), font_size=26)
            
            draw.text((100, 140), "Date", fill=(0, 0, 0), font_size=24)
            draw.text((350, 140), "Particulars", fill=(0, 0, 0), font_size=24)
            draw.text((950, 140), "Debit", fill=(0, 0, 0), font_size=24)
            draw.text((1150, 140), "Credit", fill=(0, 0, 0), font_size=24)
            draw.text((1350, 140), "Balance", fill=(0, 0, 0), font_size=24)

            draw.text((100, 200), "2026-01-30", fill=(0, 0, 0), font_size=22)
            draw.text((350, 200), "Interest Credited for Q4", fill=(0, 0, 0), font_size=22)
            draw.text((1150, 200), "450.00", fill=(0, 0, 0), font_size=22)
            draw.text((1350, 200), "50450.00", fill=(0, 0, 0), font_size=22)

            # Statement Totals and Closing Balance
            draw.text((100, 320), "Closing Balance: 50450.00", fill=(0, 0, 0), font_size=26)
            draw.text((100, 370), "Total Withdrawals: 20000.00", fill=(0, 0, 0), font_size=24)
            draw.text((100, 410), "Total Deposits: 55450.00", fill=(0, 0, 0), font_size=24)
            draw.text((100, 460), "Generated on 2026-01-31. This is a computer generated bank statement.", fill=(0, 0, 0), font_size=20)

        img_temp = file_path.replace(".pdf", f"_temp_{page_num}.jpg")
        img.save(img_temp, "JPEG", quality=85)

        pdf_page = doc.new_page(width=595, height=842)
        pdf_page.insert_image(pdf_page.rect, filename=img_temp)

        if os.path.exists(img_temp):
            os.remove(img_temp)

    doc.save(file_path, deflate=True)
    doc.close()


def test_seven_page_scanned_bank_statement_classification(tmp_path):
    """
    Test that a 7-page purely scanned PDF containing narrations with words like
    'Tax Invoice', 'Home Loan EMI Agreement', 'Salary', and 'Bill Payment':
    1. Extracts 7 pages via OCR with 0 native words.
    2. Correctly classifies as BANK_STATEMENT with high confidence.
    3. Does NOT get falsely classified as INVOICE or LOAN_AGREEMENT.
    4. Has positive score >= 50 and detailed evidence breakdown.
    """
    scanned_pdf_path = os.path.join(tmp_path, "seven_page_scanned_statement.pdf")
    generate_7_page_scanned_pdf(scanned_pdf_path)

    # 1. Verify 0 native text words across all 7 pages
    doc = fitz.open(scanned_pdf_path)
    assert len(doc) == 7, f"Expected 7 pages, got {len(doc)}"
    for idx, page in enumerate(doc):
        native_words = page.get_text("words")
        assert len(native_words) == 0, f"Page {idx+1} had {len(native_words)} native words; expected 0"
    doc.close()

    # 2. Extract with UniversalPDFExtractor
    with open(scanned_pdf_path, "rb") as f:
        pdf_bytes = f.read()

    extractor = UniversalPDFExtractor()
    page_results = extractor.extract_document(pdf_bytes)
    assert len(page_results) == 7

    # 3. Classify Document
    classification = DocumentClassifier.classify_document(page_results)

    # Verify Classification Result
    assert classification["document_type"] == "BANK_STATEMENT", (
        f"Expected BANK_STATEMENT, got {classification['document_type']}. "
        f"Positive Score: {classification['total_positive_score']}, "
        f"Negative Score: {classification['total_negative_score']}, "
        f"Negative Matches: {classification['negative_matches']}"
    )
    assert classification["confidence"] >= 0.70
    assert classification["total_positive_score"] >= 50.0
    assert classification["total_negative_score"] == 0.0 or classification["total_negative_score"] < classification["total_positive_score"]

    # Verify that 'invoice' and 'loan_agreement' are NOT in negative_matches
    assert "invoice" not in classification["negative_matches"]
    assert "loan_agreement" not in classification["negative_matches"]

    # 4. Verify End-to-End Pipeline Execution
    result = UniversalStatementPipeline.process_statement_bytes(
        file_bytes=pdf_bytes,
        filename="seven_page_scanned_statement.pdf",
    )

    assert result.success is True
    assert result.document.document_type == "BANK_STATEMENT"
    assert result.document.page_count == 7
    assert result.extraction.ocr_pages == 7
    assert result.extraction.average_ocr_confidence >= 0.70
    assert result.account.account_number_raw == "918273645012"
    assert len(result.transactions) >= 3
