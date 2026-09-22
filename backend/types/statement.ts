import { PageGeometry } from './geometry';

export enum StatementErrorCode {
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  EMPTY_FILE = 'EMPTY_FILE',
  INVALID_PDF = 'INVALID_PDF',
  CORRUPTED_PDF = 'CORRUPTED_PDF',
  ENCRYPTED_PDF = 'ENCRYPTED_PDF',
  PDF_UNREADABLE = 'PDF_UNREADABLE',
  NO_READABLE_CONTENT = 'NO_READABLE_CONTENT',
  OCR_FAILED = 'OCR_FAILED',
  NOT_BANK_STATEMENT = 'NOT_BANK_STATEMENT',
  UNCERTAIN_DOCUMENT = 'UNCERTAIN_DOCUMENT',
  BANK_STATEMENT_PARSE_FAILED = 'BANK_STATEMENT_PARSE_FAILED',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  INVALID_EXTRACTION = 'INVALID_EXTRACTION',
  ANALYZER_UNAVAILABLE = 'ANALYZER_UNAVAILABLE',
  ANALYZER_TIMEOUT = 'ANALYZER_TIMEOUT',
  ANALYZER_RATE_LIMITED = 'ANALYZER_RATE_LIMITED',
  ANALYZER_BAD_RESPONSE = 'ANALYZER_BAD_RESPONSE',
  STORAGE_FAILED = 'STORAGE_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export type DocumentClassificationType =
  | 'BANK_STATEMENT'
  | 'NOT_BANK_STATEMENT'
  | 'UNCERTAIN'
  | 'UNREADABLE';

export interface ClassificationSignalBreakdown {
  bankIdentity: number;
  accountInfo: number;
  statementPeriod: number;
  transactionTable: number;
  financialColumns: number;
  bankingKeywords: number;
  negativePenalties: number;
}

export interface ClassificationResult {
  type: DocumentClassificationType;
  confidence: number;
  totalScore: number;
  detectedBank?: string;
  detectedAccountNumber?: string;
  detectedIfsc?: string;
  detectedPeriod?: {
    startDate?: string;
    endDate?: string;
  };
  matchedSignals: string[];
  negativeMatches: string[];
  reasons: string[];
  breakdown: ClassificationSignalBreakdown;
}

export interface ExtractedAccountInfo {
  bankName: string;
  accountHolderName?: string;
  accountNumber?: string;
  accountType?: string;
  ifsc?: string;
  micr?: string;
  iban?: string;
  routingNumber?: string;
  openingBalance?: number;
  closingBalance?: number;
  startDate?: string;
  endDate?: string;
  branchName?: string;
}

export interface ExtractedTransaction {
  transactionId: string;
  id?: string;
  date: string;
  bookingDate?: string;
  valueDate?: string;
  description: string;
  narration?: string;
  type: 'DEBIT' | 'CREDIT';
  debit: number;
  credit: number;
  amount: number;
  balance?: number;
  currency?: string;
  reference?: string;
  referenceNumber?: string;
  chequeNumber?: string;
  initBr?: string;
  sourcePage?: number;
  pageNumber?: number;
  extractionMethod?: string;
  rawSourceText?: string;
  confidence?: number;
  balanceContinuity?: boolean;
  category?: string;
  mode?: 'UPI' | 'NEFT' | 'IMPS' | 'RTGS' | 'ACH' | 'ATM' | 'POS' | 'CARD' | 'OTHER';
  rawNarrationLines?: string[];
}

export interface StatementReconciliationReport {
  openingBalance: number;
  calculatedCredits: number;
  calculatedDebits: number;
  calculatedClosingBalance: number;
  statedClosingBalance: number;
  balanceDifference: number;
  balanceContinuityVerified: boolean;
  statementCredits?: number;
  statementDebits?: number;
  statementClosingBalance?: number;

  totalCredits: number;
  totalDebits: number;
  closingBalance: number;
  balanceContinuity: boolean;

  transactionCount: number;

  creditTransactionCount: number;
  debitTransactionCount: number;

  transactionsWithBothDebitAndCredit: number;
  transactionsWithNeitherDebitNorCredit: number;

  duplicateTransactions: number;
  suspiciousTransactions: number;

  balanceContinuityPassed: number;
  balanceContinuityFailed: number;
}

export type PageClassificationType =
  | 'TRANSACTION_PAGE'
  | 'ACCOUNT_INFO_PAGE'
  | 'SUMMARY_PAGE'
  | 'INFORMATION_PAGE'
  | 'ADVERTISEMENT_PAGE'
  | 'UNKNOWN';

export interface PageExtractionResult {
  pageNumber: number;
  nativeText: string;
  ocrText?: string;
  finalText: string;
  extractionMethod: 'NATIVE' | 'OCR' | 'HYBRID';
  nativeTextLength: number;
  ocrTextLength?: number;
  ocrConfidence?: number;
  hasBankSignals: boolean;
  pageType?: PageClassificationType;
  lines: string[];
  geometry?: PageGeometry;
}

export interface NormalizedPageModel {
  pageNumber: number;
  rawText: string;
  lines: string[];
  normalizedLines: string[];
  detectedHeader?: string;
  detectedTransactions: ExtractedTransaction[];
  extractionMethod?: 'NATIVE' | 'OCR' | 'HYBRID';
  ocrConfidence?: number;
  pageType?: PageClassificationType;
  geometry?: PageGeometry;
}

export interface ExtractionMetadataInfo {
  totalPages: number;
  nativeTextPages: number;
  ocrPages: number;
  hybridPages: number;
  failedPages: number;
  averageOCRConfidence: number;
  extractionWarnings: string[];
  pagesProcessed?: number;
  pagesWithText?: number;
  pagesWithOCR?: number;
  transactionsExtracted?: number;
  parseWarnings?: string[];
}

export interface ExtractionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  balanceIntegrity: {
    isConsistent: boolean;
    balanceContinuityVerified: boolean;
    calculatedClosingBalance: number;
    statedClosingBalance: number;
    balanceDifference: number;
    discrepancy?: number;
  };
}

export interface StatementMetadata {
  documentId: string;
  requestId: string;
  originalFilename: string;
  fileSizeBytes: number;
  classification: DocumentClassificationType;
  confidence: number;
  detectedBank?: string;
  maskedAccountNumber?: string;
  statementPeriod?: string;
  processingStatus: 'SUCCESS' | 'FAILED' | 'REJECTED';
  errorCode?: StatementErrorCode;
  createdAt: string;
  completedAt: string;
  processingDurationMs: number;
}

export interface StatementAnalysisResponse {
  document: {
    type: 'BANK_STATEMENT';
    confidence: number;
    bankName?: string;
    accountHolderName?: string;
    accountNumber?: string;
    accountType?: string;
    statementStartDate?: string;
    statementEndDate?: string;
    ifsc?: string;
  };
  summary: {
    openingBalance?: number;
    closingBalance?: number;
    totalCredits: number;
    totalDebits: number;
    totalTransactions: number;
    netCashFlow: number;
    periodDays?: number;
    averageMonthlyInflow?: number;
    averageMonthlyOutflow?: number;
  };
  transactions: ExtractedTransaction[];
  analytics?: any; // Rich Analytics engine model matching Response.json
}

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  requestId: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  requestId: string;
  error: {
    code: StatementErrorCode;
    message: string;
    details?: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
