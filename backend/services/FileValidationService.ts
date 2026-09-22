import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { StatementErrorCode } from '../types/statement';
import { logger } from '../utils/logger';

export interface FileValidationResult {
  isValid: boolean;
  errorCode?: StatementErrorCode;
  errorMessage?: string;
  sanitizedFilename: string;
  tempFilePath: string;
  fileSizeBytes: number;
}

export class FileValidationService {
  private static readonly PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-

  public static ensureTempDirectory(): void {
    if (!fs.existsSync(config.tempUploadDir)) {
      fs.mkdirSync(config.tempUploadDir, { recursive: true });
    }
  }

  public static sanitizeFilename(filename: string): string {
    if (!filename) return 'unnamed.pdf';
    // Remove null bytes, path traversal sequences
    let clean = filename
      .replace(/\0/g, '')
      .replace(/(\.\.[\/\\])+/g, '')
      .replace(/[^a-zA-Z0-9._\s-]/g, '_')
      .trim();

    // Prevent oversized filenames
    if (clean.length > 200) {
      const ext = path.extname(clean);
      clean = clean.substring(0, 190) + ext;
    }
    return clean || 'document.pdf';
  }

  public static generateSafeTempFilePath(originalFilename: string): { tempFileName: string; tempFilePath: string } {
    this.ensureTempDirectory();
    const uniqueId = uuidv4();
    const tempFileName = `stmt_${Date.now()}_${uniqueId}.pdf`;
    const tempFilePath = path.join(config.tempUploadDir, tempFileName);
    return { tempFileName, tempFilePath };
  }

  public static validateBuffer(
    buffer: Buffer,
    originalFilename: string,
    requestId: string
  ): FileValidationResult {
    const sanitizedFilename = this.sanitizeFilename(originalFilename);
    const { tempFilePath } = this.generateSafeTempFilePath(originalFilename);
    const fileSizeBytes = buffer.length;

    // 1. Empty file validation
    if (!buffer || buffer.length === 0) {
      logger.warn({
        requestId,
        stage: 'FILE_VALIDATION',
        message: 'Uploaded file is 0 bytes',
        errorCode: StatementErrorCode.EMPTY_FILE,
      });
      return {
        isValid: false,
        errorCode: StatementErrorCode.EMPTY_FILE,
        errorMessage: 'The uploaded file is empty. Please select a valid bank statement PDF.',
        sanitizedFilename,
        tempFilePath,
        fileSizeBytes: 0,
      };
    }

    // 2. File size validation
    const maxSizeBytes = config.maxPdfSizeMb * 1024 * 1024;
    if (buffer.length > maxSizeBytes) {
      logger.warn({
        requestId,
        stage: 'FILE_VALIDATION',
        message: `File size ${buffer.length} bytes exceeds maximum ${maxSizeBytes} bytes`,
        errorCode: StatementErrorCode.FILE_TOO_LARGE,
        fileSize: buffer.length,
      });
      return {
        isValid: false,
        errorCode: StatementErrorCode.FILE_TOO_LARGE,
        errorMessage: `File is too large. Maximum allowed size is ${config.maxPdfSizeMb}MB. Please upload a smaller bank statement PDF.`,
        sanitizedFilename,
        tempFilePath,
        fileSizeBytes,
      };
    }

    // 3. Extension validation
    const ext = path.extname(originalFilename).toLowerCase();
    if (ext !== '.pdf') {
      logger.warn({
        requestId,
        stage: 'FILE_VALIDATION',
        message: `Invalid file extension: ${ext}`,
        errorCode: StatementErrorCode.INVALID_FILE_TYPE,
      });
      return {
        isValid: false,
        errorCode: StatementErrorCode.INVALID_FILE_TYPE,
        errorMessage: 'Only PDF files are accepted. Please upload your bank statement in PDF format.',
        sanitizedFilename,
        tempFilePath,
        fileSizeBytes,
      };
    }

    // 4. Magic bytes validation (%PDF-)
    // We check the first 1024 bytes in case of header comments or BOM
    const headerSlice = buffer.subarray(0, Math.min(buffer.length, 1024));
    const magicIndex = headerSlice.indexOf(this.PDF_MAGIC_BYTES);

    if (magicIndex === -1) {
      logger.warn({
        requestId,
        stage: 'FILE_VALIDATION',
        message: 'File does not contain valid %PDF- magic bytes signature',
        errorCode: StatementErrorCode.INVALID_PDF,
      });
      return {
        isValid: false,
        errorCode: StatementErrorCode.INVALID_PDF,
        errorMessage: 'This file is not a valid PDF. Please upload a genuine bank statement PDF.',
        sanitizedFilename,
        tempFilePath,
        fileSizeBytes,
      };
    }

    return {
      isValid: true,
      sanitizedFilename,
      tempFilePath,
      fileSizeBytes,
    };
  }

  public static async cleanupTempFile(filePath?: string): Promise<void> {
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      // Non-blocking catch to prevent masking primary response
      console.warn(`[Cleanup] Failed to delete temp file ${filePath}:`, (err as Error).message);
    }
  }
}
