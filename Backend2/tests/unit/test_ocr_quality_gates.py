import pytest
from app.models.document import SpatialToken
from app.services.ocr.quality import OCRQualityGate


def test_ocr_quality_gate_evaluation():
    # Good tokens with banking keywords
    good_tokens = [
        SpatialToken(text="Date", confidence=0.98, x0=10, y0=50, x1=40, y1=62),
        SpatialToken(text="Particulars", confidence=0.95, x0=50, y0=50, x1=120, y1=62),
        SpatialToken(text="Withdrawal", confidence=0.97, x0=130, y0=50, x1=180, y1=62),
        SpatialToken(text="Deposit", confidence=0.96, x0=190, y0=50, x1=230, y1=62),
        SpatialToken(text="Balance", confidence=0.99, x0=240, y0=50, x1=280, y1=62),
        SpatialToken(text="01/08/2026", confidence=0.99, x0=10, y0=80, x1=60, y1=92),
        SpatialToken(text="UPI/Swiggy", confidence=0.94, x0=50, y0=80, x1=120, y1=92),
        SpatialToken(text="500.00", confidence=0.98, x0=130, y0=80, x1=170, y1=92),
        SpatialToken(text="4500.00", confidence=0.98, x0=240, y0=80, x1=280, y1=92),
    ] + [
        SpatialToken(text=f"Word{i}", confidence=0.90, x0=10 + i * 5, y0=100 + i * 10, x1=30 + i * 5, y1=112 + i * 10)
        for i in range(10)
    ]

    quality = OCRQualityGate.evaluate_tokens_quality(good_tokens)
    assert quality["token_count"] == 19
    assert quality["avg_confidence"] > 0.90
    assert quality["passed_gate"] is True

    # Empty tokens
    empty_quality = OCRQualityGate.evaluate_tokens_quality([])
    assert empty_quality["passed_gate"] is False
