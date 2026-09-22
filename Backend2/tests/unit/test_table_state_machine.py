import pytest
from app.models.document import PageExtractionResult, SpatialToken
from app.models.transaction import ColumnRange, TableHeaderCandidate
from app.services.extraction.transactions import TransactionStateMachineParser


def test_transaction_state_machine_multiline_parsing():
    # Table header tokens
    header_tokens = [
        SpatialToken(text="Date", x0=40, y0=50, x1=80, y1=62),
        SpatialToken(text="Particulars", x0=100, y0=50, x1=200, y1=62),
        SpatialToken(text="Debit", x0=220, y0=50, x1=280, y1=62),
        SpatialToken(text="Credit", x0=300, y0=50, x1=360, y1=62),
        SpatialToken(text="Balance", x0=380, y0=50, x1=440, y1=62),
    ]

    # Row 1 (Line 1 of transaction 1)
    row1_tokens = [
        SpatialToken(text="02/08/2026", x0=40, y0=80, x1=85, y1=92),
        SpatialToken(text="UPI/P2M/52831/Swiggy", x0=100, y0=80, x1=210, y1=92),
        SpatialToken(text="650.00", x0=220, y0=80, x1=260, y1=92),
        SpatialToken(text="9350.00", x0=380, y0=80, x1=430, y1=92),
    ]

    # Row 2 (Wrapped narration line of transaction 1)
    row2_tokens = [
        SpatialToken(text="Order Ref #987654 Food Delivery", x0=100, y0=95, x1=240, y1=107),
    ]

    # Row 3 (Transaction 2)
    row3_tokens = [
        SpatialToken(text="05/08/2026", x0=40, y0=120, x1=85, y1=132),
        SpatialToken(text="Salary Credit from Sprinklr", x0=100, y0=120, x1=230, y1=132),
        SpatialToken(text="50000.00", x0=300, y0=120, x1=350, y1=132),
        SpatialToken(text="59350.00", x0=380, y0=120, x1=430, y1=132),
    ]

    all_tokens = header_tokens + row1_tokens + row2_tokens + row3_tokens
    page = PageExtractionResult(
        page_number=1,
        extraction_method="NATIVE",
        tokens=all_tokens,
    )

    schema = TableHeaderCandidate(
        page_number=1,
        y0=48.0,
        y1=64.0,
        columns=[
            ColumnRange(name="DATE", x0=0, x1=90),
            ColumnRange(name="DESCRIPTION", x0=90, x1=215),
            ColumnRange(name="DEBIT", x0=215, x1=290),
            ColumnRange(name="CREDIT", x0=290, x1=370),
            ColumnRange(name="BALANCE", x0=370, x1=500),
        ],
    )

    txns, audit = TransactionStateMachineParser.parse_document_transactions_with_audit([page], {1: schema})
    assert len(txns) == 2
    assert audit["total_detected_rows"] >= 3
    assert audit["merged_continuation_rows"] == 1
    assert audit["accepted_transactions"] == 2

    # Verify transaction 1 merged the wrapped description
    assert txns[0].date == "2026-08-02"
    assert "Swiggy" in txns[0].description
    assert "Order Ref #987654" in txns[0].description
    assert txns[0].debit == 650.00
    assert txns[0].credit == 0.0
    assert txns[0].balance == 9350.00

    # Verify transaction 2
    assert txns[1].date == "2026-08-05"
    assert txns[1].credit == 50000.00
    assert txns[1].debit == 0.0
    assert txns[1].balance == 59350.00


def test_same_day_transaction_reconstruction_without_dates():
    """
    Tests that multiple transactions occurring on the same day (where subsequent
    rows omit the printed date in the Date column) are correctly reconstructed
    as distinct transactions with inherited dates.
    """
    schema = TableHeaderCandidate(
        page_number=1,
        y0=48.0,
        y1=64.0,
        columns=[
            ColumnRange(name="DATE", x0=0, x1=90),
            ColumnRange(name="DESCRIPTION", x0=90, x1=215),
            ColumnRange(name="DEBIT", x0=215, x1=290),
            ColumnRange(name="CREDIT", x0=290, x1=370),
            ColumnRange(name="BALANCE", x0=370, x1=500),
        ],
    )

    tokens = [
        # Table Header
        SpatialToken(text="Date", x0=40, y0=50, x1=80, y1=62),
        SpatialToken(text="Particulars", x0=100, y0=50, x1=200, y1=62),
        SpatialToken(text="Debit", x0=220, y0=50, x1=280, y1=62),
        SpatialToken(text="Credit", x0=300, y0=50, x1=360, y1=62),
        SpatialToken(text="Balance", x0=380, y0=50, x1=440, y1=62),
        
        # Txn 1: Has Date
        SpatialToken(text="10/08/2026", x0=40, y0=80, x1=85, y1=92),
        SpatialToken(text="UPI/Coffee/Starbucks", x0=100, y0=80, x1=210, y1=92),
        SpatialToken(text="350.00", x0=220, y0=80, x1=260, y1=92),
        SpatialToken(text="59000.00", x0=380, y0=80, x1=430, y1=92),

        # Txn 2: NO Date (Same day)
        SpatialToken(text="UPI/Uber/Trip", x0=100, y0=110, x1=210, y1=122),
        SpatialToken(text="450.00", x0=220, y0=110, x1=260, y1=122),
        SpatialToken(text="58550.00", x0=380, y0=110, x1=430, y1=122),

        # Txn 3: NO Date (Same day)
        SpatialToken(text="UPI/BookMyShow/Movie", x0=100, y0=140, x1=210, y1=152),
        SpatialToken(text="800.00", x0=220, y0=140, x1=260, y1=152),
        SpatialToken(text="57750.00", x0=380, y0=140, x1=430, y1=152),
    ]

    page = PageExtractionResult(page_number=1, extraction_method="NATIVE", tokens=tokens)
    txns, audit = TransactionStateMachineParser.parse_document_transactions_with_audit([page], {1: schema})

    assert len(txns) == 3
    assert audit["same_day_transactions_reconstructed"] == 2
    assert all(t.date == "2026-08-10" for t in txns)
    assert txns[0].debit == 350.00 and txns[0].balance == 59000.00
    assert txns[1].debit == 450.00 and txns[1].balance == 58550.00
    assert txns[2].debit == 800.00 and txns[2].balance == 57750.00


def test_multi_page_boundary_and_repeated_headers():
    """
    Tests that transactions spanning across page boundaries persist state,
    and repeated table headers on subsequent pages are cleanly removed.
    """
    schema1 = TableHeaderCandidate(
        page_number=1,
        y0=48.0,
        y1=64.0,
        columns=[
            ColumnRange(name="DATE", x0=0, x1=90),
            ColumnRange(name="DESCRIPTION", x0=90, x1=215),
            ColumnRange(name="DEBIT", x0=215, x1=290),
            ColumnRange(name="CREDIT", x0=290, x1=370),
            ColumnRange(name="BALANCE", x0=370, x1=500),
        ],
    )
    schema2 = TableHeaderCandidate(
        page_number=2,
        y0=30.0,
        y1=45.0,
        columns=schema1.columns,
    )


    # Page 1 ends with a transaction whose description wraps onto page 2
    p1_tokens = [
        SpatialToken(text="Date", x0=40, y0=50, x1=80, y1=62),
        SpatialToken(text="Particulars", x0=100, y0=50, x1=200, y1=62),
        SpatialToken(text="Debit", x0=220, y0=50, x1=280, y1=62),
        SpatialToken(text="Credit", x0=300, y0=50, x1=360, y1=62),
        SpatialToken(text="Balance", x0=380, y0=50, x1=440, y1=62),
        
        SpatialToken(text="15/08/2026", x0=40, y0=80, x1=85, y1=92),
        SpatialToken(text="International Wire Transfer Part 1", x0=100, y0=80, x1=210, y1=92),
        SpatialToken(text="2500.00", x0=220, y0=80, x1=260, y1=92),
        SpatialToken(text="55250.00", x0=380, y0=80, x1=430, y1=92),
    ]

    # Page 2 has repeated header, continuation line, and next transaction
    p2_tokens = [
        # Repeated Header
        SpatialToken(text="Date", x0=40, y0=50, x1=80, y1=62),
        SpatialToken(text="Particulars", x0=100, y0=50, x1=200, y1=62),
        SpatialToken(text="Debit", x0=220, y0=50, x1=280, y1=62),
        SpatialToken(text="Credit", x0=300, y0=50, x1=360, y1=62),
        SpatialToken(text="Balance", x0=380, y0=50, x1=440, y1=62),

        # Wrapped line from Page 1 txn
        SpatialToken(text="Reference FX EURUSD 1.085", x0=100, y0=80, x1=210, y1=92),

        # New Txn on Page 2
        SpatialToken(text="18/08/2026", x0=40, y0=110, x1=85, y1=122),
        SpatialToken(text="ATM Cash Withdrawal", x0=100, y0=110, x1=210, y1=122),
        SpatialToken(text="10000.00", x0=220, y0=110, x1=260, y1=122),
        SpatialToken(text="45250.00", x0=380, y0=110, x1=430, y1=122),
    ]

    p1 = PageExtractionResult(page_number=1, extraction_method="NATIVE", tokens=p1_tokens)
    p2 = PageExtractionResult(page_number=2, extraction_method="NATIVE", tokens=p2_tokens)

    txns, audit = TransactionStateMachineParser.parse_document_transactions_with_audit(
        [p1, p2], {1: schema1, 2: schema2}
    )

    assert len(txns) == 2
    assert audit["header_rows_removed"] >= 1
    assert "Part 1" in txns[0].description
    assert "EURUSD" in txns[0].description
    assert txns[0].debit == 2500.00
    assert txns[1].debit == 10000.00

