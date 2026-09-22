import {
  ExtractedAccountInfo,
  ExtractedTransaction,
  ExtractionMetadataInfo,
  NormalizedPageModel,
  StatementReconciliationReport,
} from '../types/statement';
import { BankStatementParserFactory } from './parsers/BankStatementParserFactory';
import { logger, maskAccountNumber } from '../utils/logger';

export interface ExtractionResult {
  account: ExtractedAccountInfo;
  transactions: ExtractedTransaction[];
  openingBalance?: number;
  closingBalance?: number;
  totalCredits: number;
  totalDebits: number;
  netCashFlow: number;
  extractionInfo?: ExtractionMetadataInfo;
  reconciliation?: StatementReconciliationReport;
  diagnostics?: StatementReconciliationReport;
}

export class StatementExtractionService {
  /**
   * Main extraction entry point connecting the modular bank parser engine
   */
  public static extractStatementData(
    text: string,
    lines: string[],
    requestId: string,
    pages?: NormalizedPageModel[]
  ): ExtractionResult {
    logger.info({
      requestId,
      stage: 'EXTRACTION_START',
      message: 'Extracting account metadata and transaction ledger with modular parser engine',
    });

    // Ensure pages model exists
    let pageModels: NormalizedPageModel[] = pages || [];
    if (pageModels.length === 0) {
      pageModels = [
        {
          pageNumber: 1,
          rawText: text,
          lines,
          normalizedLines: lines,
          detectedTransactions: [],
        },
      ];
    }

    // Delegate to BankStatementParserFactory
    const parsed = BankStatementParserFactory.parse(text, pageModels, requestId);
    const { account, ledger } = parsed;
    const transactions = ledger.transactions;

    const totalCredits = ledger.totalCredits;
    const totalDebits = ledger.totalDebits;
    const netCashFlow = Math.round((totalCredits - totalDebits) * 100) / 100;

    const extractionInfo: ExtractionMetadataInfo = {
      totalPages: pageModels.length,
      nativeTextPages: pageModels.filter((p) => p.extractionMethod === 'NATIVE').length,
      ocrPages: pageModels.filter((p) => p.extractionMethod === 'OCR').length,
      hybridPages: pageModels.filter((p) => p.extractionMethod === 'HYBRID').length,
      failedPages: pageModels.filter((p) => p.lines.length === 0).length,
      averageOCRConfidence: 0,
      extractionWarnings: ledger.parseWarnings,
      pagesProcessed: ledger.pagesProcessed,
      pagesWithText: pageModels.filter((p) => p.lines.length > 0).length,
      pagesWithOCR: pageModels.filter((p) => p.extractionMethod === 'OCR').length,
      transactionsExtracted: transactions.length,
      parseWarnings: ledger.parseWarnings,
    };

    logger.info({
      requestId,
      stage: 'EXTRACTION_COMPLETED',
      bank: account.bankName,
      maskedAccount: maskAccountNumber(account.accountNumber),
      transactionsCount: transactions.length,
      totalCredits,
      totalDebits,
      netCashFlow,
      openingBalance: ledger.openingBalance,
      closingBalance: ledger.closingBalance,
    });

    return {
      account,
      transactions,
      openingBalance: ledger.openingBalance,
      closingBalance: ledger.closingBalance,
      totalCredits,
      totalDebits,
      netCashFlow,
      extractionInfo,
      reconciliation: ledger.reconciliation,
      diagnostics: ledger.reconciliation,
    };
  }
}
