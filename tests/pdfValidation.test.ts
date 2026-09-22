import { describe, it, expect } from 'vitest';
import { PdfValidationService } from '../backend/services/PdfValidationService';
import { StatementErrorCode } from '../backend/types/statement';
import { PdfFixtures } from './fixtures/pdfFixtures';

describe('PdfValidationService', () => {
  it('should validate a healthy PDF document and return page count', async () => {
    const validPdf = await PdfFixtures.createBankStatementPdf();
    const result = await PdfValidationService.validatePdf(validPdf, 'REQ-PDF-01');

    expect(result.isValid).toBe(true);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    expect(result.isEncrypted).toBe(false);
  });

  it('should detect corrupted or truncated PDFs and return CORRUPTED_PDF', async () => {
    const corruptPdf = PdfFixtures.createCorruptedPdf();
    const result = await PdfValidationService.validatePdf(corruptPdf, 'REQ-PDF-02');

    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe(StatementErrorCode.CORRUPTED_PDF);
  });

  it('should detect password-protected / encrypted PDFs and return ENCRYPTED_PDF', async () => {
    const encryptedPdf = PdfFixtures.createPasswordProtectedPdf();
    const result = await PdfValidationService.validatePdf(encryptedPdf, 'REQ-PDF-03');

    expect(result.isValid).toBe(false);
    expect(result.isEncrypted).toBe(true);
    expect(result.errorCode).toBe(StatementErrorCode.ENCRYPTED_PDF);
    expect(result.errorMessage).toContain('password protected');
  });
});
