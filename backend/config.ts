import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  maxPdfSizeMb: parseFloat(process.env.MAX_STATEMENT_PDF_SIZE_MB || '15'),
  tempUploadDir: process.env.TEMP_UPLOAD_DIR || path.join(os.tmpdir(), 'bank_statement_uploads'),
  
  // Classification scoring thresholds
  classification: {
    statementThreshold: parseInt(process.env.CONFIDENCE_THRESHOLD_STATEMENT || '50', 10),
    uncertainThreshold: parseInt(process.env.CONFIDENCE_THRESHOLD_UNCERTAIN || '25', 10),
    minTextLength: parseInt(process.env.MIN_EXTRACTED_TEXT_LENGTH || '10', 10),
    weights: {
      bankIdentity: 20,
      accountInfo: 20,
      statementPeriod: 15,
      transactionTable: 25,
      financialColumns: 15,
      bankingKeywords: 5,
    },
  },

  // Extraction validation
  validation: {
    balanceTolerance: parseFloat(process.env.BALANCE_TOLERANCE_AMOUNT || '10.0'),
  },

  // External analyzer resilience
  analyzer: {
    timeoutMs: parseInt(process.env.ANALYZER_TIMEOUT_MS || '30000', 10),
    maxRetries: parseInt(process.env.ANALYZER_MAX_RETRIES || '2', 10),
    retryDelayMs: parseInt(process.env.ANALYZER_RETRY_DELAY_MS || '1000', 10),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
};
