import os
import pytest
from PIL import Image, ImageDraw, ImageFont
import fitz
from Backend2.app.tasks.worker import UniversalStatementPipeline


def create_scanned_kotak_pdf(file_path: str):
    """
    Creates a genuinely scanned PDF with ZERO native text layer (pure raster image).
    """
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    # 1. Create a high-resolution PIL Image (equivalent to a 300 DPI scan)
    width, height = 1654, 2338  # A4 at 200 DPI
    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Draw header text with standard spacing
    draw.text((100, 100), "Kotak Mahindra Bank", fill=(0, 0, 0), font_size=36)
    draw.text((100, 160), "Account Statement", fill=(0, 0, 0), font_size=28)
    draw.text((100, 230), "Customer Name: Rani Devi", fill=(0, 0, 0), font_size=24)
    draw.text((100, 270), "Account Number: 6947759513", fill=(0, 0, 0), font_size=24)
    draw.text((100, 310), "IFSC Code: KKBK0004587", fill=(0, 0, 0), font_size=24)
    draw.text((100, 350), "Statement Period: 01/08/2026 to 31/08/2026", fill=(0, 0, 0), font_size=24)
    draw.text((100, 390), "Opening Balance: 50.64", fill=(0, 0, 0), font_size=24)

    # Draw Table Header
    y_hdr = 480
    draw.text((100, y_hdr), "Date", fill=(0, 0, 0), font_size=24)
    draw.text((350, y_hdr), "Particulars", fill=(0, 0, 0), font_size=24)
    draw.text((950, y_hdr), "Debit", fill=(0, 0, 0), font_size=24)
    draw.text((1150, y_hdr), "Credit", fill=(0, 0, 0), font_size=24)
    draw.text((1350, y_hdr), "Balance", fill=(0, 0, 0), font_size=24)

    # Draw Transaction Rows
    y_row1 = 540
    draw.text((100, y_row1), "2026-08-02", fill=(0, 0, 0), font_size=22)
    draw.text((350, y_row1), "UPI Payment Outward Transfer", fill=(0, 0, 0), font_size=22)
    draw.text((950, y_row1), "40.00", fill=(0, 0, 0), font_size=22)
    draw.text((1350, y_row1), "10.64", fill=(0, 0, 0), font_size=22)

    # Draw Summary
    draw.text((100, 650), "Closing Balance: 10.64", fill=(0, 0, 0), font_size=24)
    draw.text((100, 690), "Total Transactions: 1", fill=(0, 0, 0), font_size=24)

    img_temp = file_path.replace(".pdf", "_temp.png")
    img.save(img_temp, "PNG")

    # 2. Insert image into PDF with NO text layer
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_image(page.rect, filename=img_temp)
    doc.save(file_path)
    doc.close()

    if os.path.exists(img_temp):
        os.remove(img_temp)


def test_scanned_statement_pure_ocr_pipeline(tmp_path):
    scanned_pdf_path = os.path.join(tmp_path, "scanned_kotak_statement.pdf")
    create_scanned_kotak_pdf(scanned_pdf_path)

    # Verify that native text words is ZERO
    doc = fitz.open(scanned_pdf_path)
    native_words = doc[0].get_text("words")
    doc.close()
    assert len(native_words) == 0, f"Expected 0 native words for scanned PDF, got {len(native_words)}"

    with open(scanned_pdf_path, "rb") as f:
        pdf_bytes = f.read()

    # Process through the full universal pipeline
    result = UniversalStatementPipeline.process_statement_bytes(
        file_bytes=pdf_bytes,
        filename="scanned_kotak_statement.pdf",
    )

    assert result.success is True
    assert result.extraction.ocr_pages >= 1
    assert result.extraction.average_ocr_confidence > 0.60
    assert result.document.document_type == "BANK_STATEMENT"
    assert result.document.confidence >= 0.70
    assert result.bank.name == "Kotak Mahindra Bank"
    assert result.account.account_number_raw == "6947759513"
    assert result.account.ifsc == "KKBK0004587"
    assert len(result.transactions) >= 1
    assert float(result.summary.closing_balance) == 10.64
