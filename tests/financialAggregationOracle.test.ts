import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import request from 'supertest';
import { app } from '../backend/app';
import { NormalizedPageModel } from '../backend/types/statement';
import { StatementExtractionService } from '../backend/services/StatementExtractionService';

describe('Financial Aggregation Oracle & Regression Verification', () => {
  /**
   * Generates a multi-page Axis Bank statement ledger whose transactions mathematically sum to:
   * Opening: 49.13
   * Total Credit: 4,740,214.86
   * Total Debit: 4,726,526.59
   * Closing Balance: 13,737.40
   */
  async function generateOracleStatementPdf(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const transactions = [
      // 1. IMPS High-value Inward Credit
      {
        date: '18-03-2026',
        lines: ['IMPS/P2A/607717366683/IdfFinan/IDFCBank/Pa', 'ymentd/9198452472199751001'],
        amountStr: '2000000.00 2000049.13 4378',
      },
      // 2. Vendor Business Outward Debit
      {
        date: '20-03-2026',
        lines: ['NEFT/UTIBR52026032001/SUPPLIER PAYMENT', 'RAW MATERIALS CO LTD'],
        amountStr: '1500000.00 500049.13 4378',
      },
      // 3. Client Inward NEFT Credit
      {
        date: '25-03-2026',
        lines: ['NEFT/YESIG60970213984/CLIENT INVOICE', 'SETTLEMENT MAR 2026'],
        amountStr: '2740214.86 3240263.99 4378',
      },
      // 4. Commercial Outward Debit
      {
        date: '28-03-2026',
        lines: ['RTGS/AXISR52026032801/EQUIPMENT PURCHASE', 'INDUS MACHINERY LTD'],
        amountStr: '3226526.59 13737.40 4378',
      },
    ];

    const page = doc.addPage([600, 850]);
    let y = 800;

    page.drawText('Statement of Axis Account No: 925010049111575', { x: 50, y, size: 12, font: fontBold });
    y -= 15;
    page.drawText('Customer Name: MR. RAJAT KUMAR SHARMA    IFSC Code: UTIB0004378', { x: 50, y, size: 9, font });
    y -= 15;
    page.drawText('Statement Period: 18-03-2026 to 17-09-2026    Page 1 of 1', { x: 50, y, size: 9, font });
    y -= 15;
    page.drawText('OPENING BALANCE: 49.13', { x: 50, y, size: 10, font: fontBold });
    y -= 20;
    page.drawText('Tran Date  Chq No  Particulars  Debit  Credit  Balance  Init. Br', { x: 50, y, size: 9, font: fontBold });
    y -= 20;

    for (const txn of transactions) {
      page.drawText(txn.date, { x: 50, y, size: 8, font });
      y -= 12;
      for (const nl of txn.lines) {
        page.drawText(nl, { x: 50, y, size: 8, font });
        y -= 12;
      }
      page.drawText(txn.amountStr, { x: 50, y, size: 8, font });
      y -= 20;
    }

    // Statement Footer Oracle Totals
    page.drawText('TRANSACTION TOTAL  4726526.59  4740214.86', { x: 50, y, size: 9, font: fontBold });

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  it('Verifies Oracle regression totals: Opening 49.13, Credit 4740214.86, Debit 4726526.59, Closing 13737.40', async () => {
    const rawLines = [
      'Statement of Axis Account No: 925010049111575',
      'Customer Name: MR. RAJAT KUMAR SHARMA',
      'IFSC Code: UTIB0004378',
      'Statement Period: 18-03-2026 to 17-09-2026',
      'OPENING BALANCE: 49.13',
      'Tran Date Chq No Particulars Debit Credit Balance Init. Br',
      '',
      '18-03-2026',
      'IMPS/P2A/607717366683/IdfFinan/IDFCBank/Pa',
      'ymentd/9198452472199751001',
      '2000000.00 2000049.13 4378',
      '',
      '20-03-2026',
      'NEFT/UTIBR52026032001/SUPPLIER PAYMENT',
      'RAW MATERIALS CO LTD',
      '1500000.00 500049.13 4378',
      '',
      '25-03-2026',
      'NEFT/YESIG60970213984/CLIENT INVOICE',
      'SETTLEMENT MAR 2026',
      '2740214.86 3240263.99 4378',
      '',
      '28-03-2026',
      'RTGS/AXISR52026032801/EQUIPMENT PURCHASE',
      'INDUS MACHINERY LTD',
      '3226526.59 13737.40 4378',
      '',
      'TRANSACTION TOTAL  4726526.59  4740214.86',
    ];

    const fullText = rawLines.join('\n');
    const pageModel: NormalizedPageModel = {
      pageNumber: 1,
      rawText: fullText,
      lines: rawLines,
      normalizedLines: rawLines,
      detectedTransactions: [],
    };

    const extraction = StatementExtractionService.extractStatementData(
      fullText,
      rawLines,
      'ORACLE-TEST-01',
      [pageModel]
    );

    // 1. Verify Individual Balances & Aggregations
    expect(extraction.openingBalance).toBe(49.13);
    expect(extraction.totalCredits).toBe(4740214.86);
    expect(extraction.totalDebits).toBe(4726526.59);
    expect(extraction.closingBalance).toBe(13737.40);

    // 2. Strict Oracle tolerances (<= 0.01)
    expect(Math.abs(extraction.totalCredits - 4740214.86)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(extraction.totalDebits - 4726526.59)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(extraction.closingBalance! - 13737.40)).toBeLessThanOrEqual(0.01);

    // 3. Mathematical Continuity Verification: 49.13 + 4740214.86 - 4726526.59 = 13737.40
    const calculatedClosing = Math.round((extraction.openingBalance! + extraction.totalCredits - extraction.totalDebits) * 100) / 100;
    expect(calculatedClosing).toBe(13737.40);

    // 4. Verify Transaction Reconstruction Structure
    for (const txn of extraction.transactions) {
      expect(txn.id).toBeDefined();
      expect(txn.date).toBeDefined();
      expect(txn.narration).toBeDefined();
      expect(txn.debit).toBeGreaterThanOrEqual(0);
      expect(txn.credit).toBeGreaterThanOrEqual(0);
      expect(txn.amount).toBeGreaterThan(0);
      expect(txn.balance).toBeDefined();
      expect(txn.initBr).toBe('4378');
      expect(txn.sourcePage).toBe(1);
      expect(txn.confidence).toBeGreaterThanOrEqual(0.85);
      expect(txn.balanceContinuity).toBe(true);

      // Verify either debit or credit is positive, never both
      if (txn.type === 'DEBIT') {
        expect(txn.debit).toBe(txn.amount);
        expect(txn.credit).toBe(0);
      } else {
        expect(txn.credit).toBe(txn.amount);
        expect(txn.debit).toBe(0);
      }
    }

    // 5. Verify Reconciliation Report
    const rec = extraction.reconciliation!;
    expect(rec).toBeDefined();
    expect(rec.transactionCount).toBe(4);
    expect(rec.creditTransactionCount).toBe(2);
    expect(rec.debitTransactionCount).toBe(2);
    expect(rec.totalCredits).toBe(4740214.86);
    expect(rec.totalDebits).toBe(4726526.59);
    expect(rec.openingBalance).toBe(49.13);
    expect(rec.closingBalance).toBe(13737.40);
    expect(rec.calculatedClosingBalance).toBe(13737.40);
    expect(rec.statedClosingBalance).toBe(13737.40);
    expect(rec.balanceDifference).toBe(0);
    expect(rec.balanceContinuityVerified).toBe(true);
    expect(rec.transactionsWithBothDebitAndCredit).toBe(0);
    expect(rec.transactionsWithNeitherDebitNorCredit).toBe(0);
    expect(rec.duplicateTransactions).toBe(0);
    expect(rec.balanceContinuityPassed).toBe(4);
    expect(rec.balanceContinuityFailed).toBe(0);
  });

  it('Verifies parsing of Indian numbering system comma formatted amounts (lakhs & crores)', () => {
    const rawLines = [
      'Statement of Axis Account No: 925010049111575',
      'OPENING BALANCE: 49.13',
      'Tran Date Chq No Particulars Debit Credit Balance Init. Br',
      '',
      '18-03-2026',
      'NEFT/YESIG/INWARD LAKHS PAYMENT',
      '20,00,000.00 20,00,049.13 4378',
      '',
      '20-03-2026',
      'RTGS/AXIS/OUTWARD SUPPLIER',
      '15,00,000.00 5,00,049.13 4378',
      '',
      '25-03-2026',
      'NEFT/HDFC/INVOICE SETTLEMENT',
      '27,40,214.86 32,40,263.99 4378',
      '',
      '28-03-2026',
      'RTGS/EQUIPMENT/DEBIT PURCHASE',
      '32,26,526.59 13,737.40 4378',
    ];

    const fullText = rawLines.join('\n');
    const pageModel: NormalizedPageModel = {
      pageNumber: 1,
      rawText: fullText,
      lines: rawLines,
      normalizedLines: rawLines,
      detectedTransactions: [],
    };

    const extraction = StatementExtractionService.extractStatementData(
      fullText,
      rawLines,
      'ORACLE-INDIAN-COMMA-TEST',
      [pageModel]
    );

    expect(extraction.openingBalance).toBe(49.13);
    expect(extraction.totalCredits).toBe(4740214.86);
    expect(extraction.totalDebits).toBe(4726526.59);
    expect(extraction.closingBalance).toBe(13737.40);
    expect(extraction.reconciliation?.calculatedClosingBalance).toBe(13737.40);
    expect(extraction.reconciliation?.statedClosingBalance).toBe(13737.40);
    expect(extraction.reconciliation?.balanceDifference).toBe(0);
    expect(extraction.reconciliation?.balanceContinuityVerified).toBe(true);
  });

  it('Verifies API endpoint returns exact oracle totals and exposed reconciliation diagnostics', async () => {
    const pdfBuffer = await generateOracleStatementPdf();

    const res = await request(app)
      .post('/api/statement/analyze')
      .attach('file', pdfBuffer, 'oracle_axis_statement.pdf');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.summary.openingBalance).toBe(49.13);
    expect(data.summary.totalCredits).toBe(4740214.86);
    expect(data.summary.totalDebits).toBe(4726526.59);
    expect(data.summary.closingBalance).toBe(13737.40);
    expect(data.summary.calculatedClosingBalance).toBe(13737.40);
    expect(data.summary.statedClosingBalance).toBe(13737.40);
    expect(data.summary.balanceDifference).toBe(0);
    expect(data.summary.balanceContinuityVerified).toBe(true);

    // Validation object in API response
    expect(data.validation).toBeDefined();
    expect(data.validation.balanceContinuityVerified).toBe(true);
    expect(data.validation.calculatedClosingBalance).toBe(13737.40);
    expect(data.validation.statedClosingBalance).toBe(13737.40);
    expect(data.validation.balanceDifference).toBe(0);

    // Diagnostics & Reconciliation in API response
    expect(data.reconciliation).toBeDefined();
    expect(data.reconciliation.totalCredits).toBe(4740214.86);
    expect(data.reconciliation.totalDebits).toBe(4726526.59);
    expect(data.reconciliation.openingBalance).toBe(49.13);
    expect(data.reconciliation.closingBalance).toBe(13737.40);
    expect(data.reconciliation.calculatedClosingBalance).toBe(13737.40);
    expect(data.reconciliation.statedClosingBalance).toBe(13737.40);
    expect(data.reconciliation.balanceDifference).toBe(0);
    expect(data.reconciliation.balanceContinuityVerified).toBe(true);
    expect(data.reconciliation.balanceContinuityPassed).toBe(4);
    expect(data.reconciliation.balanceContinuityFailed).toBe(0);
  });
});
