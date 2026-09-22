import pytest
from app.core.security import SecurityValidator, StatementErrorCode


def test_magic_bytes_validation():
    # Valid PDF magic bytes
    valid_pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    is_valid, err_code, _ = SecurityValidator.validate_file_metadata("sample.pdf", valid_pdf_content)
    assert is_valid is True
    assert err_code is None

    # Invalid header
    fake_content = b"<html><body>Not a PDF</body></html>"
    is_valid, err_code, _ = SecurityValidator.validate_file_metadata("fake.pdf", fake_content)
    assert is_valid is False
    assert err_code == StatementErrorCode.INVALID_PDF

    # Invalid extension
    is_valid, err_code, _ = SecurityValidator.validate_file_metadata("statement.png", valid_pdf_content)
    assert is_valid is False
    assert err_code == StatementErrorCode.INVALID_FILE_TYPE

    # Empty content
    is_valid, err_code, _ = SecurityValidator.validate_file_metadata("empty.pdf", b"")
    assert is_valid is False
    assert err_code == StatementErrorCode.EMPTY_FILE


def test_corrupted_pdf_structure():
    corrupt_bytes = b"%PDF-1.4 completely corrupt content that cannot be parsed"
    is_valid, err_code, _, _ = SecurityValidator.validate_pdf_structure(corrupt_bytes)
    assert is_valid is False
    assert err_code in [StatementErrorCode.CORRUPTED_PDF, StatementErrorCode.INVALID_PDF]
