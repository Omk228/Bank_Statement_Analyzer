import { PDFDocument } from 'pdf-lib';
import { StatementErrorCode } from '../types/statement';
import { logger } from '../utils/logger';

export interface PdfValidationResult {
  isValid: boolean;
  pageCount: number;
  isEncrypted: boolean;
  errorCode?: StatementErrorCode;
  errorMessage?: string;
  metadata?: {
    title?: string;
    author?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
  };
}

export class PdfValidationService {
  /**
   * Checks if raw buffer contains signs of PDF encryption (/Encrypt)
   */
  public static isRawBufferEncrypted(buffer: Buffer): boolean {
    const text = buffer.toString('latin1');
    return /\/Encrypt\s+\d+\s+\d+\s+R/.test(text) || /\/Encrypt\s*<</.test(text);
  }

  public static async validatePdf(buffer: Buffer, requestId: string): Promise<PdfValidationResult> {
    // 1. Raw encryption check
    if (this.isRawBufferEncrypted(buffer)) {
      // Test if it opens without password
      try {
        const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
        if (doc.isEncrypted) {
          logger.warn({
            requestId,
            stage: 'PDF_VALIDATION',
            message: 'PDF document is encrypted / password protected',
            errorCode: StatementErrorCode.ENCRYPTED_PDF,
          });
          return {
            isValid: false,
            pageCount: 0,
            isEncrypted: true,
            errorCode: StatementErrorCode.ENCRYPTED_PDF,
            errorMessage: 'This PDF is password protected. Please upload an unlocked bank statement PDF.',
          };
        }
      } catch (encErr: any) {
        const msg = String(encErr?.message || '').toLowerCase();
        if (msg.includes('encrypt') || msg.includes('password') || msg.includes('protected')) {
          logger.warn({
            requestId,
            stage: 'PDF_VALIDATION',
            message: `PDF encrypted: ${encErr.message}`,
            errorCode: StatementErrorCode.ENCRYPTED_PDF,
          });
          return {
            isValid: false,
            pageCount: 0,
            isEncrypted: true,
            errorCode: StatementErrorCode.ENCRYPTED_PDF,
            errorMessage: 'This PDF is password protected. Please upload an unlocked bank statement PDF.',
          };
        }
      }
    }

    // 2. Load with PDFDocument to verify integrity
    try {
      const pdfDoc = await PDFDocument.load(buffer, {
        ignoreEncryption: false,
        updateMetadata: false,
      });

      const pageCount = pdfDoc.getPageCount();

      if (pageCount === 0) {
        logger.warn({
          requestId,
          stage: 'PDF_VALIDATION',
          message: 'PDF document has 0 pages',
          errorCode: StatementErrorCode.PDF_UNREADABLE,
        });
        return {
          isValid: false,
          pageCount: 0,
          isEncrypted: false,
          errorCode: StatementErrorCode.PDF_UNREADABLE,
          errorMessage: 'The uploaded PDF has no pages. Please upload a valid bank statement PDF.',
        };
      }

      return {
        isValid: true,
        pageCount,
        isEncrypted: false,
        metadata: {
          title: pdfDoc.getTitle(),
          author: pdfDoc.getAuthor(),
          creator: pdfDoc.getCreator(),
          producer: pdfDoc.getProducer(),
          creationDate: pdfDoc.getCreationDate(),
        },
      };
    } catch (error: any) {
      const msg = String(error?.message || '').toLowerCase();

      if (msg.includes('encrypt') || msg.includes('password') || msg.includes('protected')) {
        logger.warn({
          requestId,
          stage: 'PDF_VALIDATION',
          message: `PDF document is password protected: ${error.message}`,
          errorCode: StatementErrorCode.ENCRYPTED_PDF,
        });
        return {
          isValid: false,
          pageCount: 0,
          isEncrypted: true,
          errorCode: StatementErrorCode.ENCRYPTED_PDF,
          errorMessage: 'This PDF is password protected. Please upload an unlocked bank statement PDF.',
        };
      }

      logger.warn({
        requestId,
        stage: 'PDF_VALIDATION',
        message: `PDF is corrupted or truncated: ${error.message}`,
        errorCode: StatementErrorCode.CORRUPTED_PDF,
      });

      return {
        isValid: false,
        pageCount: 0,
        isEncrypted: false,
        errorCode: StatementErrorCode.CORRUPTED_PDF,
        errorMessage: 'This PDF appears to be corrupted. Please upload another copy.',
      };
    }
  }
}
