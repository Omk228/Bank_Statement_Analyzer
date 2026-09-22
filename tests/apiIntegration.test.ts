import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../backend/app';
import { PdfFixtures } from './fixtures/pdfFixtures';
import { StatementErrorCode } from '../backend/types/statement';

describe('API Integration: Bank Statement Upload Pipeline', () => {
  it('Test 1: Uploading genuine Bank Statement PDF -> HTTP 200 with BANK_STATEMENT', async () => {
    const validPdf = await PdfFixtures.createBankStatementPdf({ bankName: 'AXIS BANK' });

    const res = await request(app)
      .post('/api/statement/analyze')
      .attach('file', validPdf, 'axis_statement.pdf');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.classification.type).toBe('BANK_STATEMENT');
    expect(res.body.data.classification.confidence).toBeGreaterThanOrEqual(0.75);
    expect(res.body.data.analysis).toBeDefined();
    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(res.body.requestId).toBeDefined();
  });

  it('Test 2: Uploading Aadhaar PDF -> HTTP 422 with NOT_BANK_STATEMENT', async () => {
    const aadhaarPdf = await PdfFixtures.createAadhaarPdf();

    const res = await request(app)
      .post('/api/statement/analyze')
      .attach('file', aadhaarPdf, 'aadhaar.pdf');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(StatementErrorCode.NOT_BANK_STATEMENT);
    expect(res.body.error.message).toBe(
      'This PDF does not appear to be a bank statement. Please upload a valid bank statement PDF.'
    );
  });

  it('Test 3: Uploading Tax Invoice PDF -> HTTP 422 with NOT_BANK_STATEMENT', async () => {
    const invoicePdf = await PdfFixtures.createInvoicePdf();

    const res = await request(app)
      .post('/api/statement/analyze')
      .attach('file', invoicePdf, 'tax_invoice.pdf');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(StatementErrorCode.NOT_BANK_STATEMENT);
  });

  it('Test 4: Uploading Fake PDF (renamed jpg/txt) -> HTTP 400 with INVALID_PDF', async () => {
    const fakeBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

    const res = await request(app)
      .post('/api/statement/analyze')
      .attach('file', fakeBuffer, 'fake_statement.pdf');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(StatementErrorCode.INVALID_PDF);
  });

  it('Test 5: Uploading Password-Protected PDF -> HTTP 422 with ENCRYPTED_PDF', async () => {
    const encryptedPdf = PdfFixtures.createPasswordProtectedPdf();

    const res = await request(app)
      .post('/api/statement/analyze')
      .attach('file', encryptedPdf, 'locked_statement.pdf');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(StatementErrorCode.ENCRYPTED_PDF);
    expect(res.body.error.message).toContain('password protected');
  });

  it('Test 6: Uploading Corrupted PDF -> HTTP 422 with CORRUPTED_PDF', async () => {
    const corruptPdf = PdfFixtures.createCorruptedPdf();

    const res = await request(app)
      .post('/api/statement/analyze')
      .attach('file', corruptPdf, 'broken_statement.pdf');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(StatementErrorCode.CORRUPTED_PDF);
  });

  it('Test 7: Uploading non-PDF file (.csv) -> HTTP 415 with INVALID_FILE_TYPE', async () => {
    const csvBuffer = Buffer.from('Date,Amount,Description\n2025-10-01,500,Test');

    const res = await request(app)
      .post('/api/statement/analyze')
      .attach('file', csvBuffer, 'statement.csv');

    expect(res.status).toBe(415);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(StatementErrorCode.INVALID_FILE_TYPE);
  });

  it('Test 8: Uploading Empty 0-byte file -> HTTP 400 with EMPTY_FILE', async () => {
    const emptyBuffer = Buffer.alloc(0);

    const res = await request(app)
      .post('/api/statement/analyze')
      .attach('file', emptyBuffer, 'empty.pdf');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(StatementErrorCode.EMPTY_FILE);
  });

  it('Test 9: Health check & History endpoints work smoothly', async () => {
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');

    const historyRes = await request(app).get('/api/statement/history');
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.success).toBe(true);
    expect(Array.isArray(historyRes.body.data)).toBe(true);
  });
});
