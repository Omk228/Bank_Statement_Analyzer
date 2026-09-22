import { describe, it, expect } from 'vitest';
import { StatementExtractionService } from '../backend/services/StatementExtractionService';
import { StatementResultValidator } from '../backend/services/StatementResultValidator';
import { PdfTextExtractionService } from '../backend/services/PdfTextExtractionService';
import { PdfFixtures } from './fixtures/pdfFixtures';

describe('StatementExtraction & ResultValidator', () => {
  it('should extract structured bank metadata and transaction rows from PDF', async () => {
    const pdf = await PdfFixtures.createBankStatementPdf();
    const extracted = await PdfTextExtractionService.extractText(pdf, 'REQ-EXT-01');

    const result = StatementExtractionService.extractStatementData(
      extracted.text,
      extracted.lines,
      'REQ-EXT-01'
    );

    expect(result.account.bankName).toBe('Axis Bank');
    expect(result.account.accountNumber).toContain('9843');
    expect(result.account.ifsc).toBe('UTIB0002491');
    expect(result.transactions.length).toBeGreaterThanOrEqual(5);
    expect(result.totalCredits).toBeGreaterThan(0);
    expect(result.totalDebits).toBeGreaterThan(0);
  });

  it('should validate financial balance continuity (opening + credits - debits ≈ closing)', () => {
    const validExtraction = {
      account: { bankName: 'Axis Bank' },
      transactions: [
        { transactionId: '1', date: '2025-10-01', description: 'Salary', type: 'CREDIT' as const, amount: 50000 },
        { transactionId: '2', date: '2025-10-02', description: 'Rent', type: 'DEBIT' as const, amount: 20000 },
      ],
      openingBalance: 10000,
      closingBalance: 40000, // 10000 + 50000 - 20000 = 40000
      totalCredits: 50000,
      totalDebits: 20000,
      netCashFlow: 30000,
    };

    const validation = StatementResultValidator.validate(validExtraction, 'REQ-VAL-01');
    expect(validation.isValid).toBe(true);
    expect(validation.balanceIntegrity.isConsistent).toBe(true);
    expect(validation.balanceIntegrity.discrepancy).toBe(0);
  });

  it('should reject extraction with invalid amounts (e.g. NaN or negative amount values)', () => {
    const invalidExtraction = {
      account: { bankName: 'Axis Bank' },
      transactions: [
        { transactionId: '1', date: '2025-10-01', description: 'Faulty', type: 'DEBIT' as const, amount: NaN },
      ],
      totalCredits: 0,
      totalDebits: 0,
      netCashFlow: 0,
    };

    const validation = StatementResultValidator.validate(invalidExtraction, 'REQ-VAL-02');
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
