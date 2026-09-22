import { v4 as uuidv4 } from 'uuid';
import {
  ExtractedTransaction,
  NormalizedPageModel,
  StatementReconciliationReport,
} from '../../types/statement';
import { AmountResolver } from './AmountResolver';
import { ColumnDetector, DetectedTableColumns } from './ColumnDetector';
import { TransactionNormalizer } from './TransactionNormalizer';
import { logger } from '../../utils/logger';

export enum ParserState {
  WAITING_FOR_DATE = 'WAITING_FOR_DATE',
  READING_NARRATION = 'READING_NARRATION',
  READING_AMOUNTS = 'READING_AMOUNTS',
  FINALIZE_TRANSACTION = 'FINALIZE_TRANSACTION',
}

interface InFlightTransaction {
  date: string;
  chequeNo?: string;
  narrationLines: string[];
  amounts: number[];
  initBr?: string;
  pageNumber: number;
  rawSourceText: string[];
}

export interface ParseStatementLedgerResult {
  transactions: ExtractedTransaction[];
  openingBalance?: number;
  closingBalance?: number;
  totalCredits: number;
  totalDebits: number;
  pagesProcessed: number;
  parseWarnings: string[];
  detectedColumns?: DetectedTableColumns | null;
  reconciliation: StatementReconciliationReport;
}

export class TransactionStateMachineParser {
  // Regex to detect date at start of line
  // Supports DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD, DD-MMM-YYYY, DD MMM YYYY, MMM DD, YYYY, with optional row number '# 1', '1', '2' or OCR merged '101 Aug 2026'
  public static readonly DATE_REGEX =
    /^(?:\s*(?:#\s*)?\d{1,4}\s+)?(?:(\d{1,4})[\/\-\.\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\/\-\.\s](\d{2,4})|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{2,4})|(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}))/i;

  public static readonly OPENING_BAL_REGEX =
    /(?:opening\s+balance|beginning\s+balance|previous\s+balance|brought\s+forward|b\/f|open\s+bal|balance\s+b\/f)\s*[:=\-]?\s*(?:USD|\$|EUR|€|GBP|£|CAD|AUD|SGD|AED|INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i;

  public static readonly CLOSING_BAL_REGEX =
    /(?:closing\s+balance|ending\s+balance|balance\s+at\s+end|carried\s+forward|c\/f|close\s+bal|balance\s+c\/f|effective\s+available\s+balance)\s*[:=\-]?\s*(?:USD|\$|EUR|€|GBP|£|CAD|AUD|SGD|AED|INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i;

  /**
   * Parses transactions from an array of normalized pages using a 4-state state-machine
   */
  public static parsePages(
    pages: NormalizedPageModel[],
    requestId: string
  ): ParseStatementLedgerResult {
    const rawTransactions: ExtractedTransaction[] = [];
    const parseWarnings: string[] = [];

    let inFlight: InFlightTransaction | null = null;
    let runningBalance: number | undefined;
    let initialOpeningBalance: number | undefined;
    let explicitClosingBalance: number | undefined;
    let detectedColumns: DetectedTableColumns | null = null;

    const fullDocText = pages.map((p) => p.lines.join('\n')).join('\n');
    const documentCurrency = AmountResolver.detectCurrency(fullDocText);

    let totalRawRows = 0;
    let ambiguousTransactionCount = 0;
    let droppedTransactionCount = 0;
    let duplicateTransactionCount = 0;

    logger.info({
      requestId,
      stage: 'PARSER_START',
      message: `Starting state-machine parser across ${pages.length} pages`,
    });

    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const page = pages[pIdx];
      const lines = page.lines;

      for (let lIdx = 0; lIdx < lines.length; lIdx++) {
        const rawLine = lines[lIdx];
        totalRawRows++;
        if (!rawLine || rawLine.trim().length === 0) continue;
        const line = rawLine.trim();

        // 1. Detect and record opening balance if encountered
        if (initialOpeningBalance === undefined) {
          const openMatch = line.match(this.OPENING_BAL_REGEX);
          if (openMatch) {
            initialOpeningBalance = AmountResolver.normalizeAmount(openMatch[1]);
            runningBalance = initialOpeningBalance;
            logger.info({
              requestId,
              stage: 'HEADER_DETECTION',
              message: `Detected Opening Balance: ${initialOpeningBalance}`,
              page: page.pageNumber,
            });
            continue;
          }
        }

        // Detect explicit closing balance if present in text
        if (explicitClosingBalance === undefined) {
          const closeMatch = line.match(this.CLOSING_BAL_REGEX);
          if (closeMatch) {
            explicitClosingBalance = AmountResolver.normalizeAmount(closeMatch[1]);
            logger.info({
              requestId,
              stage: 'HEADER_DETECTION',
              message: `Detected Explicit Closing Balance: ${explicitClosingBalance}`,
              page: page.pageNumber,
            });
          }
        }

        // 2. Detect table header columns
        const potentialHeader = ColumnDetector.detectColumnsFromHeader(line);
        if (potentialHeader) {
          detectedColumns = potentialHeader;
          page.detectedHeader = line;
          logger.debug({
            requestId,
            stage: 'COLUMN_DETECTION',
            message: 'Detected transaction table columns',
            header: line,
            page: page.pageNumber,
          });
          continue;
        }

        // 3. Skip repeated page headers / footers / bank info banners / summary totals
        if (TransactionNormalizer.isHeaderOrFooterLine(line)) {
          continue;
        }

        // 4. Check if line starts with a new transaction date
        const dateMatch = line.match(this.DATE_REGEX);

        if (dateMatch) {
          // If we had an in-flight transaction with amounts, finalize it first
          if (inFlight && inFlight.amounts.length > 0) {
            const isAmbiguous = this.finalizeTransaction(
              inFlight,
              runningBalance,
              detectedColumns,
              rawTransactions,
              requestId
            );
            if (isAmbiguous) ambiguousTransactionCount++;

            if (rawTransactions.length > 0) {
              const lastTxn = rawTransactions[rawTransactions.length - 1];
              if (lastTxn.balance !== undefined) {
                runningBalance = lastTxn.balance;
              }
            }
            inFlight = null;
          } else if (inFlight && inFlight.amounts.length === 0 && inFlight.narrationLines.length > 0) {
            droppedTransactionCount++;
            parseWarnings.push(
              `Dropped incomplete transaction fragment on date ${inFlight.date} on page ${inFlight.pageNumber}`
            );
            inFlight = null;
          }

          // Format clean date string
          let dateStr: string;
          if (dateMatch[1] && dateMatch[2] && dateMatch[3]) {
            const rawDay = dateMatch[1];
            const day = rawDay.length > 2 ? rawDay.substring(rawDay.length - 2) : rawDay;
            dateStr = `${day} ${dateMatch[2]} ${dateMatch[3]}`;
          } else if (dateMatch[4] && dateMatch[5] && dateMatch[6]) {
            dateStr = `${dateMatch[5]} ${dateMatch[4]} ${dateMatch[6]}`;
          } else {
            dateStr = dateMatch[7] || dateMatch[0].trim();
          }

          const remainingLine = line.substring(dateMatch[0].length).trim();

          inFlight = {
            date: dateStr,
            narrationLines: [],
            amounts: [],
            pageNumber: page.pageNumber,
            rawSourceText: [line],
          };

          if (remainingLine.length > 0) {
            // Check if amounts are present on the same line as the date (single-line transaction)
            const amountTokens = AmountResolver.extractAmountsFromLine(remainingLine);
            if (amountTokens.hasAmounts && amountTokens.isDedicatedAmountLine) {
              let narrationPart = remainingLine;
              for (const rawAmt of amountTokens.rawAmounts) {
                narrationPart = narrationPart.replace(rawAmt, '');
              }
              if (amountTokens.initBr) {
                narrationPart = narrationPart.replace(new RegExp(`\\b${amountTokens.initBr}\\b`), '');
              }
              narrationPart = narrationPart.trim();

              if (narrationPart.length > 0) {
                inFlight.narrationLines.push(narrationPart);
              }
              inFlight.amounts = amountTokens.amounts;
              inFlight.initBr = amountTokens.initBr;
              inFlight.chequeNo = amountTokens.chequeNo;

              // Finalize single-line transaction immediately
              const isAmbiguous = this.finalizeTransaction(
                inFlight,
                runningBalance,
                detectedColumns,
                rawTransactions,
                requestId,
                documentCurrency
              );
              if (isAmbiguous) ambiguousTransactionCount++;

              if (rawTransactions.length > 0) {
                const lastTxn = rawTransactions[rawTransactions.length - 1];
                if (lastTxn.balance !== undefined) {
                  runningBalance = lastTxn.balance;
                }
              }
              inFlight = null;
            } else {
              inFlight.narrationLines.push(remainingLine);
            }
          }
          continue;
        }

        // If not a date line:
        // Only process if we have an active in-flight transaction
        if (inFlight) {
          inFlight.rawSourceText.push(line);

          // Check if this line is a dedicated amount line
          const amountTokens = AmountResolver.extractAmountsFromLine(line);

          if (amountTokens.hasAmounts && amountTokens.isDedicatedAmountLine) {
            let narrationPart = line;
            for (const rawAmt of amountTokens.rawAmounts) {
              narrationPart = narrationPart.replace(rawAmt, '');
            }
            if (amountTokens.initBr) {
              narrationPart = narrationPart.replace(new RegExp(`\\b${amountTokens.initBr}\\b`), '');
            }
            narrationPart = narrationPart.trim();

            if (narrationPart.length > 0) {
              inFlight.narrationLines.push(narrationPart);
            }

            inFlight.amounts = amountTokens.amounts;
            inFlight.initBr = amountTokens.initBr;
            inFlight.chequeNo = amountTokens.chequeNo;

            const isAmbiguous = this.finalizeTransaction(
              inFlight,
              runningBalance,
              detectedColumns,
              rawTransactions,
              requestId,
              documentCurrency
            );
            if (isAmbiguous) ambiguousTransactionCount++;

            if (rawTransactions.length > 0) {
              const lastTxn = rawTransactions[rawTransactions.length - 1];
              if (lastTxn.balance !== undefined) {
                runningBalance = lastTxn.balance;
              }
            }
            inFlight = null;
          } else {
            // Narration continuation line
            inFlight.narrationLines.push(line);
          }
        }
      }

      // Record detected transactions for this page model
      page.detectedTransactions = rawTransactions.filter((t) => (t as any).sourcePage === page.pageNumber);
    }

    // If an in-flight transaction remains at EOF with amounts, finalize it
    if (inFlight && inFlight.amounts.length > 0) {
      const isAmbiguous = this.finalizeTransaction(
        inFlight,
        runningBalance,
        detectedColumns,
        rawTransactions,
        requestId,
        documentCurrency
      );
      if (isAmbiguous) ambiguousTransactionCount++;
    }

    // Deduplicate exact consecutive header-induced duplicate transactions
    const transactions: ExtractedTransaction[] = [];
    for (let i = 0; i < rawTransactions.length; i++) {
      const curr = rawTransactions[i];
      if (i > 0) {
        const prev = rawTransactions[i - 1];
        if (
          curr.date === prev.date &&
          curr.amount === prev.amount &&
          curr.balance === prev.balance &&
          curr.description === prev.description &&
          curr.type === prev.type
        ) {
          duplicateTransactionCount++;
          continue;
        }
      }
      transactions.push(curr);
    }

    // Totals calculation
    let totalCredits = 0;
    let totalDebits = 0;

    for (const txn of transactions) {
      if (txn.type === 'CREDIT') {
        totalCredits += txn.credit;
      } else {
        totalDebits += txn.debit;
      }
    }

    totalCredits = Math.round(totalCredits * 100) / 100;
    totalDebits = Math.round(totalDebits * 100) / 100;

    // Opening balance calculation
    const openingBalance =
      initialOpeningBalance !== undefined
        ? initialOpeningBalance
        : transactions.length > 0 && transactions[0].balance !== undefined
        ? transactions[0].type === 'CREDIT'
          ? Math.round((transactions[0].balance - transactions[0].amount) * 100) / 100
          : Math.round((transactions[0].balance + transactions[0].amount) * 100) / 100
        : 0;

    // Closing balance
    const statedClosingBalance =
      explicitClosingBalance !== undefined
        ? explicitClosingBalance
        : transactions.length > 0 && transactions[transactions.length - 1].balance !== undefined
        ? transactions[transactions.length - 1].balance!
        : Math.round((openingBalance + totalCredits - totalDebits) * 100) / 100;

    const calculatedClosingBalance = Math.round((openingBalance + totalCredits - totalDebits) * 100) / 100;
    const balanceDifference = Math.round(Math.abs(calculatedClosingBalance - statedClosingBalance) * 100) / 100;
    const balanceContinuityVerified = balanceDifference <= 0.01;

    const debitTransactionCount = transactions.filter((t) => t.type === 'DEBIT').length;
    const creditTransactionCount = transactions.filter((t) => t.type === 'CREDIT').length;
    const balanceContinuityPassed = transactions.filter((t) => t.balanceContinuity === true).length;
    const balanceContinuityFailed = transactions.filter((t) => t.balanceContinuity === false).length;

    const reconciliation: StatementReconciliationReport = {
      openingBalance,
      calculatedCredits: totalCredits,
      calculatedDebits: totalDebits,
      calculatedClosingBalance,
      statedClosingBalance,
      balanceDifference,
      balanceContinuityVerified,
      totalCredits,
      totalDebits,
      closingBalance: statedClosingBalance,
      transactionCount: transactions.length,
      creditTransactionCount,
      debitTransactionCount,
      transactionsWithBothDebitAndCredit: 0,
      transactionsWithNeitherDebitNorCredit: transactions.filter((t) => t.debit === 0 && t.credit === 0).length,
      duplicateTransactions: duplicateTransactionCount,
      suspiciousTransactions: ambiguousTransactionCount + balanceContinuityFailed,
      balanceContinuityPassed,
      balanceContinuityFailed,
      balanceContinuity: balanceContinuityVerified,
    };

    logger.info({
      requestId,
      stage: 'PARSER_COMPLETED',
      transactionsCount: transactions.length,
      openingBalance,
      closingBalance: statedClosingBalance,
      totalCredits,
      totalDebits,
      balanceContinuityPassed,
      balanceContinuityFailed,
      pagesProcessed: pages.length,
    });

    return {
      transactions,
      openingBalance,
      closingBalance: statedClosingBalance,
      totalCredits,
      totalDebits,
      pagesProcessed: pages.length,
      parseWarnings,
      detectedColumns,
      reconciliation,
    };
  }

  /**
   * Finalizes an in-flight transaction into the structured ExtractedTransaction format
   */
  private static finalizeTransaction(
    inFlight: InFlightTransaction,
    runningBalance: number | undefined,
    detectedColumns: DetectedTableColumns | null,
    transactions: ExtractedTransaction[],
    requestId: string,
    documentCurrency: string = 'INR'
  ): boolean {
    const narration = TransactionNormalizer.mergeNarrationLines(inFlight.narrationLines);

    // Resolve column hint if available
    let columnHint: 'DEBIT' | 'CREDIT' | undefined;
    if (detectedColumns && inFlight.amounts.length > 0) {
      const hint = ColumnDetector.classifyAmountColumn(
        inFlight.narrationLines.join(' '),
        inFlight.amounts[0].toFixed(2),
        detectedColumns
      );
      if (hint === 'DEBIT' || hint === 'CREDIT') {
        columnHint = hint;
      }
    }

    const financials = AmountResolver.resolveFinancials(
      inFlight.amounts,
      runningBalance,
      columnHint,
      narration,
      inFlight.initBr
    );

    const mode = TransactionNormalizer.detectPaymentMode(narration);
    const referenceNumber = inFlight.chequeNo || TransactionNormalizer.extractReferenceNumber(narration);
    const rawTxnText = inFlight.rawSourceText.join(' ');
    const lineCurrency = AmountResolver.detectCurrency(rawTxnText);
    const currency = lineCurrency !== 'INR' ? lineCurrency : (documentCurrency || 'INR');
    const txnId = uuidv4();

    const transaction: ExtractedTransaction = {
      transactionId: txnId,
      id: txnId,
      date: inFlight.date,
      bookingDate: inFlight.date,
      valueDate: inFlight.date,
      description: narration,
      narration,
      type: financials.type,
      debit: financials.debit,
      credit: financials.credit,
      amount: financials.amount,
      balance: financials.balance,
      currency,
      balanceContinuity: financials.balanceContinuity,
      initBr: financials.initBr,
      chequeNumber: inFlight.chequeNo,
      reference: referenceNumber,
      referenceNumber,
      sourcePage: inFlight.pageNumber,
      rawSourceText: inFlight.rawSourceText.join('\n'),
      confidence: financials.balanceContinuity ? 0.98 : 0.85,
      mode,
      rawNarrationLines: inFlight.narrationLines,
    };

    (transaction as any).sourcePage = inFlight.pageNumber;
    transactions.push(transaction);

    logger.debug({
      requestId,
      stage: 'TRANSACTION_FINALIZED',
      page: inFlight.pageNumber,
      date: transaction.date,
      type: transaction.type,
      debit: transaction.debit,
      credit: transaction.credit,
      amount: transaction.amount,
      balance: transaction.balance,
      initBr: transaction.initBr,
      balanceContinuity: transaction.balanceContinuity,
    });

    return financials.isAmbiguous;
  }
}
