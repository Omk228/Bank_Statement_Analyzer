import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../backend/app';
import { PdfFixtures } from './fixtures/pdfFixtures';

describe('Axis 32-Page Statement API End-to-End Regression Test', () => {
  it('Uploads real 32-page Axis statement PDF -> HTTP 200, BANK_STATEMENT, extracted transactions, valid analytics', async () => {
    // Generate 32-page Axis bank statement PDF with multiline IMPS, UPI, CASH DEP, SALARY
    const axisPdf = await PdfFixtures.createAxisMultiLinePdf(32);

    const res = await request(app)
      .post('/api/statement/analyze')
      .attach('file', axisPdf, 'axis_32_page_statement.pdf');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.documentType).toBe('BANK_STATEMENT');
    expect(data.confidence).toBeGreaterThanOrEqual(0.8);

    // Bank & Account Metadata
    expect(data.bank.name).toBe('Axis Bank');
    expect(data.bank.ifsc).toBe('UTIB0004378');
    expect(data.account.number).toBe('925010049111575');
    expect(data.account.holderName).toBe('MR. RAJAT KUMAR SHARMA');
    expect(data.account.maskedNumber).toBe('XXXXXXXXXXX1575');

    // Summary & Balances
    expect(data.summary.openingBalance).toBe(49.13);
    expect(data.summary.totalTransactions).toBeGreaterThanOrEqual(30);
    expect(data.summary.totalCredits).toBeGreaterThan(0);
    expect(data.summary.totalDebits).toBeGreaterThan(0);

    // Transactions list verification
    expect(data.transactions).toBeInstanceOf(Array);
    expect(data.transactions.length).toBeGreaterThanOrEqual(30);

    // Verify first transaction (IMPS Payment)
    const impsTxn = data.transactions[0];
    expect(impsTxn.date).toBe('18-03-2026');
    expect(impsTxn.type).toBe('CREDIT');
    expect(impsTxn.amount).toBe(16758.0);
    expect(impsTxn.balance).toBe(16807.13);
    expect(impsTxn.initBr).toBe('4378');
    expect(impsTxn.description).toContain('Paymentd');
    expect(impsTxn.mode).toBe('IMPS');

    // Verify extraction info
    expect(data.extraction.pagesProcessed).toBe(32);
    expect(data.extraction.transactionsExtracted).toBeGreaterThanOrEqual(30);

    // Analytics & Risk Profile
    expect(data.monthlyCashFlow).toBeDefined();
    expect(data.categories).toBeDefined();
    expect(data.fraudRules).toBeDefined();
    expect(data.riskProfile).toBeDefined();
  });
});
