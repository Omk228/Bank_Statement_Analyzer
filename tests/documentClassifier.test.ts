import { describe, it, expect } from 'vitest';
import { BankStatementClassifier } from '../backend/services/BankStatementClassifier';
import { PdfTextExtractionService } from '../backend/services/PdfTextExtractionService';
import { PdfFixtures } from './fixtures/pdfFixtures';

describe('BankStatementClassifier', () => {
  it('should classify real Axis Bank Statement as BANK_STATEMENT with confidence >= 0.75', async () => {
    const pdf = await PdfFixtures.createBankStatementPdf({ bankName: 'AXIS BANK' });
    const extraction = await PdfTextExtractionService.extractText(pdf, 'REQ-CLS-01');

    const classification = BankStatementClassifier.classifyDocument(extraction.text, 'REQ-CLS-01');

    expect(classification.type).toBe('BANK_STATEMENT');
    expect(classification.confidence).toBeGreaterThanOrEqual(0.75);
    expect(classification.detectedBank).toBe('Axis Bank');
    expect(classification.matchedSignals.length).toBeGreaterThanOrEqual(3);
  });

  it('should classify HDFC, ICICI, SBI, Yes Bank, and Kotak statements as BANK_STATEMENT', async () => {
    const banks = [
      'HDFC Bank',
      'ICICI Bank Limited',
      'State Bank of India',
      'Kotak Mahindra Bank',
      'Yes Bank Ltd',
      'Punjab National Bank',
    ];

    for (const bank of banks) {
      const pdf = await PdfFixtures.createBankStatementPdf({ bankName: bank });
      const extraction = await PdfTextExtractionService.extractText(pdf, `REQ-CLS-${bank}`);
      const classification = BankStatementClassifier.classifyDocument(extraction.text, `REQ-CLS-${bank}`);

      expect(classification.type).toBe('BANK_STATEMENT');
      expect(classification.confidence).toBeGreaterThanOrEqual(0.75);
    }
  });

  it('should reject Aadhaar PDF as NOT_BANK_STATEMENT', async () => {
    const aadhaarPdf = await PdfFixtures.createAadhaarPdf();
    const extraction = await PdfTextExtractionService.extractText(aadhaarPdf, 'REQ-AADHAAR');
    const classification = BankStatementClassifier.classifyDocument(extraction.text, 'REQ-AADHAAR');

    expect(classification.type).toBe('NOT_BANK_STATEMENT');
    expect(classification.negativeMatches).toContain('Aadhaar Card / UIDAI Document');
  });

  it('should reject PAN Card PDF as NOT_BANK_STATEMENT', async () => {
    const panPdf = await PdfFixtures.createPanPdf();
    const extraction = await PdfTextExtractionService.extractText(panPdf, 'REQ-PAN');
    const classification = BankStatementClassifier.classifyDocument(extraction.text, 'REQ-PAN');

    expect(classification.type).toBe('NOT_BANK_STATEMENT');
    expect(classification.negativeMatches).toContain('PAN Card / Income Tax Filing');
  });

  it('should reject Tax Invoice PDF as NOT_BANK_STATEMENT', async () => {
    const invoicePdf = await PdfFixtures.createInvoicePdf();
    const extraction = await PdfTextExtractionService.extractText(invoicePdf, 'REQ-INV');
    const classification = BankStatementClassifier.classifyDocument(extraction.text, 'REQ-INV');

    expect(classification.type).toBe('NOT_BANK_STATEMENT');
    expect(classification.negativeMatches).toContain('Tax Invoice / Commercial Bill');
  });

  it('should reject Salary Slip PDF as NOT_BANK_STATEMENT', async () => {
    const salaryPdf = await PdfFixtures.createSalarySlipPdf();
    const extraction = await PdfTextExtractionService.extractText(salaryPdf, 'REQ-SALARY');
    const classification = BankStatementClassifier.classifyDocument(extraction.text, 'REQ-SALARY');

    expect(classification.type).toBe('NOT_BANK_STATEMENT');
    expect(classification.negativeMatches).toContain('Salary Slip / Payslip');
  });

  it('should reject Loan Sanction Letter as NOT_BANK_STATEMENT', async () => {
    const loanPdf = await PdfFixtures.createLoanSanctionPdf();
    const extraction = await PdfTextExtractionService.extractText(loanPdf, 'REQ-LOAN');
    const classification = BankStatementClassifier.classifyDocument(extraction.text, 'REQ-LOAN');

    expect(classification.type).toBe('NOT_BANK_STATEMENT');
    expect(classification.negativeMatches).toContain('Loan Agreement / Sanction Letter');
  });

  it('should reject random non-banking text as NOT_BANK_STATEMENT', () => {
    const randomText =
      'This is an essay about quantum physics and general relativity. There are no financial accounts or ledgers here.';
    const classification = BankStatementClassifier.classifyDocument(randomText, 'REQ-RANDOM');

    expect(classification.type).toBe('NOT_BANK_STATEMENT');
  });

  it('should return UNREADABLE for empty or insufficient text', () => {
    const classification = BankStatementClassifier.classifyDocument('hello', 'REQ-EMPTY');
    expect(classification.type).toBe('UNREADABLE');
    expect(classification.confidence).toBe(0);
  });
});
