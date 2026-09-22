import { describe, it, expect } from 'vitest';
import { PdfTextExtractionService } from '../backend/services/PdfTextExtractionService';
import { BankStatementClassifier } from '../backend/services/BankStatementClassifier';
import { StatementExtractionService } from '../backend/services/StatementExtractionService';
import { StatementResultValidator } from '../backend/services/StatementResultValidator';
import { PdfFixtures } from './fixtures/pdfFixtures';

describe('Universal Bank Statement Ingestion & OCR Pipeline', () => {
  it('should process scanned Kotak Bank statement with ZERO native text via OCR', async () => {
    const scannedKotakPdf = await PdfFixtures.createKotakScannedPdf({
      accountHolder: 'Rani Devi',
      accountNo: '6947759513',
      ifsc: 'KKBK0004587',
      startDate: '01 Aug 2026',
      endDate: '31 Aug 2026',
      openingBalance: 50.64,
      closingBalance: 10.64,
    });

    // 1. Text Extraction with automatic OCR fallback
    const extractedContent = await PdfTextExtractionService.extractText(scannedKotakPdf, 'REQ-KOTAK-OCR-01');

    expect(extractedContent.isUnreadable).toBe(false);
    expect(extractedContent.ocrApplied).toBe(true);
    expect(extractedContent.isScanned).toBe(true);
    expect(extractedContent.pages.length).toBe(1);
    expect(extractedContent.pages[0].extractionMethod).toBe('OCR');
    expect(extractedContent.pages[0].ocrConfidence).toBeGreaterThan(60);

    // 2. Document Classification
    const classification = BankStatementClassifier.classifyDocument(extractedContent.text, 'REQ-KOTAK-OCR-01');
    expect(classification.type).toBe('BANK_STATEMENT');
    expect(classification.confidence).toBeGreaterThanOrEqual(0.70);
    expect(classification.detectedBank).toBe('Kotak Mahindra Bank');

    // 3. Modular Statement Ledger & Metadata Parsing
    const extraction = StatementExtractionService.extractStatementData(
      extractedContent.text,
      extractedContent.lines,
      'REQ-KOTAK-OCR-01',
      extractedContent.pages
    );

    expect(extraction.account.bankName).toBe('Kotak Mahindra Bank');
    expect(extraction.account.accountHolderName).toMatch(/Rani\s+Devi/i);
    expect(extraction.account.accountNumber).toBe('6947759513');
    expect(extraction.account.ifsc).toBe('KKBK0004587');
    expect(extraction.account.startDate).toMatch(/01\s+Aug\s+2026/i);
    expect(extraction.account.endDate).toMatch(/31\s+Aug\s+2026/i);
    expect(extraction.openingBalance).toBe(50.64);
    expect(extraction.closingBalance).toBe(10.64);

    // Ledger transactions
    expect(extraction.transactions.length).toBeGreaterThanOrEqual(1);
    const txn1 = extraction.transactions[0];
    expect(txn1.type).toBe('DEBIT');
    expect(txn1.debit).toBe(40.00);
    expect(txn1.balance).toBe(10.64);

    // Reconciliation
    const validation = StatementResultValidator.validate(extraction, 'REQ-KOTAK-OCR-01');
    expect(validation.isValid).toBe(true);
    expect(validation.balanceIntegrity.balanceContinuityVerified).toBe(true);
  }, 90000);

  it('should process hybrid PDF with Page 1 Native text and Page 2 OCR', async () => {
    const hybridPdf = await PdfFixtures.createHybridBankStatementPdf();

    const extractedContent = await PdfTextExtractionService.extractText(hybridPdf, 'REQ-HYBRID-01');

    expect(extractedContent.isUnreadable).toBe(false);
    expect(extractedContent.pages.length).toBe(2);
    expect(extractedContent.pages[0].extractionMethod).toBe('NATIVE');
    expect(extractedContent.pages[1].extractionMethod).toBe('OCR');

    const classification = BankStatementClassifier.classifyDocument(extractedContent.text, 'REQ-HYBRID-01');
    expect(classification.type).toBe('BANK_STATEMENT');
    expect(classification.detectedBank).toBe('HDFC Bank');

    const extraction = StatementExtractionService.extractStatementData(
      extractedContent.text,
      extractedContent.lines,
      'REQ-HYBRID-01',
      extractedContent.pages
    );

    expect(extraction.account.bankName).toBe('HDFC Bank');
    expect(extraction.transactions.length).toBeGreaterThanOrEqual(2);
  }, 30000);

  it('should continue to extract machine-readable Axis Statement cleanly', async () => {
    const axisPdf = await PdfFixtures.createAxisMultiLinePdf(2);

    const extractedContent = await PdfTextExtractionService.extractText(axisPdf, 'REQ-AXIS-01');
    expect(extractedContent.isUnreadable).toBe(false);
    expect(extractedContent.ocrApplied).toBe(false);

    const classification = BankStatementClassifier.classifyDocument(extractedContent.text, 'REQ-AXIS-01');
    expect(classification.type).toBe('BANK_STATEMENT');
    expect(classification.detectedBank).toBe('Axis Bank');

    const extraction = StatementExtractionService.extractStatementData(
      extractedContent.text,
      extractedContent.lines,
      'REQ-AXIS-01',
      extractedContent.pages
    );

    expect(extraction.account.bankName).toBe('Axis Bank');
    expect(extraction.transactions.length).toBeGreaterThanOrEqual(4);
    expect(extraction.openingBalance).toBe(49.13);
  });

  it('should dynamically extract completely unknown / unregistered bank statement', async () => {
    const unknownBankText = `Apex Horizon Community Bank
Account Statement
Account Title: Dr. Sunita Mehra
Account Number: 998877665544
Account Type: SAVINGS
Statement Period: 01/09/2026 to 15/09/2026
Opening Balance: 25000.00

Date | Particulars | Withdrawal | Deposit | Balance
02/09/2026 UPI/Transfer/LocalVendor 500.00 24500.00
05/09/2026 NEFT/ClientPayment 15000.00 39500.00
10/09/2026 ATM/CashWithdrawal 2000.00 37500.00

Closing Balance: 37500.00`;

    const lines = unknownBankText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    const classification = BankStatementClassifier.classifyDocument(unknownBankText, 'REQ-UNKNOWN-01');
    expect(classification.type).toBe('BANK_STATEMENT');
    expect(classification.confidence).toBeGreaterThanOrEqual(0.70);

    const extraction = StatementExtractionService.extractStatementData(
      unknownBankText,
      lines,
      'REQ-UNKNOWN-01'
    );

    expect(extraction.account.accountNumber).toBe('998877665544');
    expect(extraction.account.accountHolderName).toMatch(/Sunita\s+Mehra/i);
    expect(extraction.openingBalance).toBe(25000.00);
    expect(extraction.closingBalance).toBe(37500.00);
    expect(extraction.transactions.length).toBe(3);
    expect(extraction.totalCredits).toBe(15000.00);
    expect(extraction.totalDebits).toBe(2500.00);
    expect(extraction.reconciliation?.balanceContinuityVerified).toBe(true);
  });

  it('should extract international multi-currency (USD) bank statement', async () => {
    const internationalText = `JPMorgan Chase Bank, N.A.
Account Statement
Account Holder: Alex Mercer
Account Number: 441098231
Account Type: CHECKING
Statement Period: 01 Aug 2026 - 31 Aug 2026
Beginning Balance: $5,000.00

Date | Transaction Details | Debit | Credit | Balance
02 Aug 2026 Direct Deposit Payroll $3,200.00 $8,200.00
05 Aug 2026 Online Wire Transfer $1,500.00 $6,700.00
12 Aug 2026 Merchant Purchase Coffee $15.50 $6,684.50

Ending Balance: $6,684.50`;

    const lines = internationalText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    const classification = BankStatementClassifier.classifyDocument(internationalText, 'REQ-INT-01');
    expect(classification.type).toBe('BANK_STATEMENT');

    const extraction = StatementExtractionService.extractStatementData(
      internationalText,
      lines,
      'REQ-INT-01'
    );

    expect(extraction.account.bankName).toBe('International Bank');
    expect(extraction.account.accountNumber).toBe('441098231');
    expect(extraction.openingBalance).toBe(5000.00);
    expect(extraction.closingBalance).toBe(6684.50);
    expect(extraction.transactions.length).toBe(3);
    expect(extraction.totalCredits).toBe(3200.00);
    expect(extraction.totalDebits).toBe(1515.50);
    expect(extraction.transactions[0].currency).toBe('USD');
    expect(extraction.reconciliation?.balanceContinuityVerified).toBe(true);
  });

  it('should reject non-bank documents (Aadhaar, PAN, Salary slip, Tax invoice, Loan sanction)', async () => {
    const aadhaar = await PdfFixtures.createAadhaarPdf();
    const pan = await PdfFixtures.createPanPdf();
    const salary = await PdfFixtures.createSalarySlipPdf();
    const invoice = await PdfFixtures.createInvoicePdf();
    const loan = await PdfFixtures.createLoanSanctionPdf();

    for (const [docName, buf] of [
      ['Aadhaar', aadhaar],
      ['PAN', pan],
      ['Salary', salary],
      ['Invoice', invoice],
      ['Loan', loan],
    ] as const) {
      const ext = await PdfTextExtractionService.extractText(buf, `REQ-${docName}`);
      const cls = BankStatementClassifier.classifyDocument(ext.text, `REQ-${docName}`);
      expect(cls.type).toBe('NOT_BANK_STATEMENT');
    }
  });
});
