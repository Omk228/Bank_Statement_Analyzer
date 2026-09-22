import { describe, it, expect } from 'vitest';
import { FileValidationService } from '../backend/services/FileValidationService';
import { StatementErrorCode } from '../backend/types/statement';
import { PdfFixtures } from './fixtures/pdfFixtures';

describe('FileValidationService', () => {
  it('should accept a valid PDF with genuine %PDF- magic bytes', async () => {
    const validBuffer = await PdfFixtures.createBankStatementPdf();
    const result = FileValidationService.validateBuffer(validBuffer, 'axis_statement.pdf', 'REQ-01');

    expect(result.isValid).toBe(true);
    expect(result.sanitizedFilename).toBe('axis_statement.pdf');
    expect(result.errorCode).toBeUndefined();
  });

  it('should reject an empty 0-byte file with EMPTY_FILE error', () => {
    const emptyBuffer = Buffer.alloc(0);
    const result = FileValidationService.validateBuffer(emptyBuffer, 'statement.pdf', 'REQ-02');

    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe(StatementErrorCode.EMPTY_FILE);
    expect(result.errorMessage).toContain('empty');
  });

  it('should reject an oversized file with FILE_TOO_LARGE error', () => {
    // 16MB buffer (limit is 15MB)
    const largeBuffer = Buffer.alloc(16 * 1024 * 1024);
    // Write fake magic bytes to test size check priority
    Buffer.from('%PDF-1.4').copy(largeBuffer, 0);

    const result = FileValidationService.validateBuffer(largeBuffer, 'large_statement.pdf', 'REQ-03');
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe(StatementErrorCode.FILE_TOO_LARGE);
  });

  it('should reject non-PDF file extensions (JPG, PNG, DOCX, XLSX, TXT)', () => {
    const fakeBuffer = Buffer.from('some content');
    const extensions = ['photo.jpg', 'doc.png', 'file.docx', 'sheet.xlsx', 'readme.txt'];

    for (const filename of extensions) {
      const result = FileValidationService.validateBuffer(fakeBuffer, filename, 'REQ-04');
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(StatementErrorCode.INVALID_FILE_TYPE);
    }
  });

  it('should reject fake PDF (e.g. JPG or text renamed to .pdf) due to missing %PDF- magic bytes', () => {
    // Fake PDF containing JPEG header bytes
    const fakePdf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const result = FileValidationService.validateBuffer(fakePdf, 'fake_statement.pdf', 'REQ-05');

    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe(StatementErrorCode.INVALID_PDF);
  });

  it('should sanitize dangerous filenames preventing path traversal and null bytes', () => {
    const traversalNames = [
      '../../etc/passwd.pdf',
      '..\\..\\windows\\system32\\calc.pdf',
      'statement\0hidden.pdf',
      '../../../statement.pdf',
    ];

    for (const rawName of traversalNames) {
      const sanitized = FileValidationService.sanitizeFilename(rawName);
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('\0');
      expect(sanitized.endsWith('.pdf')).toBe(true);
    }
  });
});
