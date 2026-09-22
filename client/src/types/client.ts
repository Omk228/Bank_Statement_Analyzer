export type UploadState =
  | 'IDLE'
  | 'SELECTED'
  | 'VALIDATING'
  | 'UPLOADING'
  | 'READING_PDF'
  | 'VERIFYING_DOCUMENT'
  | 'ANALYZING'
  | 'SUCCESS'
  | 'ERROR';

export interface ClientError {
  code: string;
  message: string;
  details?: string;
  requestId?: string;
}

export const ERROR_MESSAGES_MAP: Record<string, string> = {
  INVALID_FILE_TYPE: 'Only PDF files are accepted. Please upload your bank statement in PDF format.',
  FILE_TOO_LARGE: 'This file is too large. Please upload a bank statement PDF under the size limit.',
  EMPTY_FILE: 'The uploaded file is empty. Please select a valid bank statement PDF.',
  INVALID_PDF: 'This file is not a valid PDF. Please upload a genuine bank statement PDF.',
  CORRUPTED_PDF: 'This PDF appears to be corrupted. Please upload another copy.',
  ENCRYPTED_PDF: 'This PDF is password protected. Please upload an unlocked bank statement PDF.',
  PDF_UNREADABLE: 'We couldn\'t read this PDF. Please upload a clear bank statement PDF.',
  OCR_FAILED: 'Scanned document OCR recognition failed. Please upload a higher resolution copy.',
  NOT_BANK_STATEMENT: 'This PDF does not appear to be a bank statement. Please upload a valid bank statement PDF.',
  UNCERTAIN_DOCUMENT: 'We couldn\'t confidently identify this document as a bank statement. Please upload a clear bank statement PDF.',
  EXTRACTION_FAILED: 'We couldn\'t extract the statement information. Please try another copy of the statement.',
  INVALID_EXTRACTION: 'Extracted statement transactions could not be verified. Please upload a clearer statement PDF.',
  ANALYZER_TIMEOUT: 'Statement analysis is taking too long. Please try again.',
  ANALYZER_RATE_LIMITED: 'Service is currently experiencing high load. Please try again shortly.',
  ANALYZER_UNAVAILABLE: 'Statement analysis is temporarily unavailable. Please try again later.',
  STORAGE_FAILED: 'Could not store statement metadata.',
  INTERNAL_ERROR: 'We couldn\'t process this document right now. Please try again.',
};

export type DashboardTab =
  | 'overview'
  | 'accounts'
  | 'cashflow'
  | 'categories'
  | 'risk'
  | 'fraud'
  | 'recurring'
  | 'transactions'
  | 'profile';
