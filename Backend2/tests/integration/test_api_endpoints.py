import os
import io
import pytest
from fastapi.testclient import TestClient
from Backend2.app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data


def test_version_endpoint():
    response = client.get("/api/v1/version")
    assert response.status_code == 200
    data = response.json()
    assert "version" in data


def test_analyze_statement_endpoint_axis():
    axis_pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "fixtures", "axis", "statement.pdf"))
    assert os.path.exists(axis_pdf_path)

    with open(axis_pdf_path, "rb") as f:
        pdf_bytes = f.read()

    response = client.post(
        "/api/v1/statements/analyze",
        files={"file": ("axis_statement.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )

    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["bank"]["name"] == "Axis Bank"
    assert len(res_data["transactions"]) == 4
    assert res_data["summary"]["balance_reconciled"] is True
    assert float(res_data["summary"]["closing_balance"]) == 34350.0


def test_frontend_compatibility_endpoint_kotak():
    kotak_pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "fixtures", "kotak", "statement.pdf"))
    assert os.path.exists(kotak_pdf_path)

    with open(kotak_pdf_path, "rb") as f:
        pdf_bytes = f.read()

    response = client.post(
        "/api/statement/analyze",
        files={"file": ("kotak_statement.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )

    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert "data" in res_data
    assert res_data["data"]["bank"]["name"] == "Kotak Mahindra Bank"
    assert len(res_data["data"]["transactions"]) == 3
    assert float(res_data["data"]["summary"]["closingBalance"]) == 10.64


def test_reject_invalid_file_extension():
    response = client.post(
        "/api/v1/statements/analyze",
        files={"file": ("malicious.exe", io.BytesIO(b"malicious payload"), "application/octet-stream")},
    )
    assert response.status_code == 422
