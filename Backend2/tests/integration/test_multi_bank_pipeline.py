import os
import json
import pytest
import fitz
from Backend2.app.tasks.worker import UniversalStatementPipeline


@pytest.mark.parametrize("bank_folder", [
    "axis",
    "kotak",
    "hdfc",
    "sbi",
    "icici",
    "unknown",
])
def test_pipeline_on_all_bank_fixtures(bank_folder: str):
    fixtures_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "fixtures", bank_folder))
    pdf_path = os.path.join(fixtures_dir, "statement.pdf")
    expected_path = os.path.join(fixtures_dir, "expected.json")

    assert os.path.exists(pdf_path), f"Fixture PDF missing at {pdf_path}"
    assert os.path.exists(expected_path), f"Expected JSON missing at {expected_path}"

    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    with open(expected_path, "r", encoding="utf-8") as f:
        expected = json.load(f)

    result = UniversalStatementPipeline.process_statement_bytes(
        file_bytes=file_bytes,
        filename=f"{bank_folder}_statement.pdf",
    )

    assert result.success is True
    assert result.document.document_type == "BANK_STATEMENT"
    assert result.summary.balance_reconciled is True
    assert len(result.transactions) == expected["transaction_count"]
    assert abs(float(result.summary.opening_balance) - expected["opening_balance"]) < 0.05
    assert abs(float(result.summary.closing_balance) - expected["closing_balance"]) < 0.05
    assert abs(float(result.summary.total_credits) - expected["total_credits"]) < 0.05
    assert abs(float(result.summary.total_debits) - expected["total_debits"]) < 0.05


def test_pipeline_rejects_non_bank_statement(tmp_path):
    # Generate a non-bank PDF (e.g., Resume / CV)
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(
        fitz.Point(50, 100),
        "Curriculum Vitae\n\nSoftware Engineer Resume\nEducation: Bachelor of Computer Science\nSkills: Python, React, TypeScript\nExperience: Senior Developer at Tech Corp",
        fontsize=12,
    )
    resume_path = os.path.join(tmp_path, "resume.pdf")
    doc.save(resume_path)
    doc.close()

    with open(resume_path, "rb") as f:
        resume_bytes = f.read()

    with pytest.raises(ValueError) as exc_info:
        UniversalStatementPipeline.process_statement_bytes(
            file_bytes=resume_bytes,
            filename="resume.pdf",
        )

    assert "NOT_BANK_STATEMENT" in str(exc_info.value)
