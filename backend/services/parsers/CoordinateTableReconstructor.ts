import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import {
  ExtractedTransaction,
  NormalizedPageModel,
  StatementReconciliationReport,
} from '../../types/statement';
import {
  PageGeometry,
  SpatialWordToken,
  TableColumnType,
  TableColumnRegion,
  SpatialRowSlice,
} from '../../types/geometry';
import { AmountResolver } from './AmountResolver';
import { TransactionNormalizer } from './TransactionNormalizer';

export interface CoordinateTableResult {
  transactions: ExtractedTransaction[];
  openingBalance: number;
  closingBalance: number;
  totalCredits: number;
  totalDebits: number;
  reconciliation: StatementReconciliationReport;
  pagesProcessed: number;
  columnsDetected: TableColumnRegion[];
}

export class CoordinateTableReconstructor {
  private static readonly DATE_REGEX =
    /^(?:\s*(?:#\s*)?\d{1,4}\s+)?(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|[a-zA-Z]{3,9}\s+\d{1,2},?\s+\d{4})/i;

  /**
   * Checks if geometry is sufficiently populated for coordinate table reconstruction
   */
  public static hasValidGeometry(pages: NormalizedPageModel[]): boolean {
    if (!pages || pages.length === 0) return false;
    let pagesWithWords = 0;
    for (const p of pages) {
      if (p.geometry && p.geometry.words && p.geometry.words.length >= 10) {
        pagesWithWords++;
      }
    }
    return pagesWithWords >= 1;
  }

  /**
   * Reconstructs transactions using 2D spatial coordinate bounding boxes
   */
  public static reconstruct(
    pages: NormalizedPageModel[],
    initialOpeningBalance: number | undefined,
    explicitClosingBalance: number | undefined,
    requestId: string
  ): CoordinateTableResult {
    logger.info({
      requestId,
      stage: 'COORDINATE_TABLE_START',
      message: `Starting coordinate-aware table reconstruction across ${pages.length} pages`,
    });

    const fullDocText = pages.map((p) => p.lines.join('\n')).join('\n');
    const documentCurrency = AmountResolver.detectCurrency(fullDocText);

    let runningBalance = initialOpeningBalance;
    let detectedOpeningBal = initialOpeningBalance;
    let detectedClosingBal = explicitClosingBalance;
    const rawTransactions: ExtractedTransaction[] = [];
    let globalColumns: TableColumnRegion[] = [];

    // In-flight transaction state is maintained continuously across all pages
    let inFlight: {
      date: string;
      narrationLines: string[];
      chequeNo?: string;
      debit?: number;
      credit?: number;
      amount?: number;
      balance?: number;
      pageNumber: number;
      rawSourceText: string[];
    } | null = null;

    for (const page of pages) {
      const geometry = page.geometry;
      if (!geometry || !geometry.words || geometry.words.length === 0) continue;

      const words = [...geometry.words];
      // Normalize sorting: top-to-bottom, left-to-right
      words.sort((a, b) =>
        Math.abs(a.bbox.y0 - b.bbox.y0) <= 3.5 ? a.bbox.x0 - b.bbox.x0 : a.bbox.y0 - b.bbox.y0
      );

      // 1. Detect Table Column Header Row & Regions on this page
      const pageColumns = this.detectColumnRegions(words, geometry.width);
      if (pageColumns.length >= 3) {
        globalColumns = pageColumns;
      }

      const activeColumns = pageColumns.length >= 3 ? pageColumns : globalColumns;
      if (activeColumns.length < 3) {
        // Fallback: If no clear columns on this page, continue
        continue;
      }

      // Find header bottom Y coordinate on this page
      let headerMaxY = 10;
      if (pageColumns.length >= 3) {
        headerMaxY = Math.max(...pageColumns.map((c) => c.bbox.y1));
      }

      // 2. Filter words belonging to the table ledger zone (below header)
      const tableWords = words.filter((w) => w.bbox.y0 >= headerMaxY - 2);

      // 3. Cluster table words into horizontal row slices
      const rowSlices = this.clusterIntoRowSlices(tableWords, activeColumns, geometry.width);

      // 4. State-machine row iteration with coordinate column binning
      for (const row of rowSlices) {
        const dateCell = row.cells.DATE?.trim() || '';
        const descCell = row.cells.DESCRIPTION?.trim() || '';
        const refCell = row.cells.REFERENCE?.trim() || '';
        const debitCell = row.cells.DEBIT?.trim() || '';
        const creditCell = row.cells.CREDIT?.trim() || '';
        const balCell = row.cells.BALANCE?.trim() || '';

        // Check if row has a new transaction date
        const dateMatch = dateCell.match(this.DATE_REGEX) || descCell.match(this.DATE_REGEX);

        if (dateMatch) {
          // Finalize existing in-flight transaction
          if (inFlight) {
            this.finalizeTransaction(
              inFlight,
              runningBalance,
              rawTransactions,
              documentCurrency,
              requestId
            );
            if (rawTransactions.length > 0) {
              const lastTxn = rawTransactions[rawTransactions.length - 1];
              if (lastTxn.balance !== undefined) runningBalance = lastTxn.balance;
            }
          }

          const txnDate = dateMatch[1] ? dateMatch[1].trim() : dateMatch[0].trim();
          let narration = '';
          if (dateCell) narration += dateCell.replace(dateMatch[0], '').trim();
          if (descCell) narration += (narration ? ' ' : '') + descCell.replace(dateMatch[0], '').trim();

          const debitAmt = debitCell ? AmountResolver.normalizeAmount(debitCell) : undefined;
          const creditAmt = creditCell ? AmountResolver.normalizeAmount(creditCell) : undefined;
          const balAmt = balCell ? AmountResolver.normalizeAmount(balCell) : undefined;

          inFlight = {
            date: txnDate,
            narrationLines: narration.length > 0 ? [narration] : [],
            chequeNo: refCell.length > 0 ? refCell : undefined,
            debit: debitAmt,
            credit: creditAmt,
            balance: balAmt,
            pageNumber: page.pageNumber,
            rawSourceText: row.tokens.map((t) => t.text),
          };
        } else if (inFlight) {
          // Continuation row (wrapped multiline narration or trailing amounts)
          if (descCell.length > 0 && !TransactionNormalizer.isHeaderOrFooterLine(descCell)) {
            inFlight.narrationLines.push(descCell);
          }
          if (refCell.length > 0 && !inFlight.chequeNo) {
            inFlight.chequeNo = refCell;
          }
          if (debitCell.length > 0 && inFlight.debit === undefined) {
            inFlight.debit = AmountResolver.normalizeAmount(debitCell);
          }
          if (creditCell.length > 0 && inFlight.credit === undefined) {
            inFlight.credit = AmountResolver.normalizeAmount(creditCell);
          }
          if (balCell.length > 0 && inFlight.balance === undefined) {
            inFlight.balance = AmountResolver.normalizeAmount(balCell);
          }
          inFlight.rawSourceText.push(...row.tokens.map((t) => t.text));
        }
      }
    }

    // Finalize pending in-flight transaction at document end
    if (inFlight) {
      this.finalizeTransaction(
        inFlight,
        runningBalance,
        rawTransactions,
        documentCurrency,
        requestId
      );
    }

    // Deduplicate exact consecutive duplicate entries
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
          continue;
        }
      }
      transactions.push(curr);
    }

    // Totals calculation
    let totalCredits = 0;
    let totalDebits = 0;
    for (const t of transactions) {
      if (t.type === 'CREDIT') {
        totalCredits += t.credit;
      } else {
        totalDebits += t.debit;
      }
    }
    totalCredits = Math.round(totalCredits * 100) / 100;
    totalDebits = Math.round(totalDebits * 100) / 100;

    const openingBalance =
      detectedOpeningBal !== undefined
        ? detectedOpeningBal
        : transactions.length > 0 && transactions[0].balance !== undefined
        ? transactions[0].type === 'CREDIT'
          ? Math.round((transactions[0].balance - transactions[0].amount) * 100) / 100
          : Math.round((transactions[0].balance + transactions[0].amount) * 100) / 100
        : 0;

    const statedClosingBalance =
      detectedClosingBal !== undefined
        ? detectedClosingBal
        : transactions.length > 0 && transactions[transactions.length - 1].balance !== undefined
        ? transactions[transactions.length - 1].balance!
        : Math.round((openingBalance + totalCredits - totalDebits) * 100) / 100;

    const calculatedClosingBalance = Math.round((openingBalance + totalCredits - totalDebits) * 100) / 100;
    const balanceDifference = Math.round(Math.abs(calculatedClosingBalance - statedClosingBalance) * 100) / 100;
    const balanceContinuityVerified = balanceDifference <= 0.01;

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
      balanceContinuity: balanceContinuityVerified,
      transactionCount: transactions.length,
      creditTransactionCount: transactions.filter((t) => t.type === 'CREDIT').length,
      debitTransactionCount: transactions.filter((t) => t.type === 'DEBIT').length,
      transactionsWithBothDebitAndCredit: 0,
      transactionsWithNeitherDebitNorCredit: 0,
      duplicateTransactions: rawTransactions.length - transactions.length,
      suspiciousTransactions: 0,
      balanceContinuityPassed: transactions.filter((t) => t.balanceContinuity === true).length,
      balanceContinuityFailed: transactions.filter((t) => t.balanceContinuity === false).length,
    };

    logger.info({
      requestId,
      stage: 'COORDINATE_TABLE_COMPLETED',
      transactionsCount: transactions.length,
      openingBalance,
      closingBalance: statedClosingBalance,
      totalCredits,
      totalDebits,
      balanceContinuityVerified,
    });

    return {
      transactions,
      openingBalance,
      closingBalance: statedClosingBalance,
      totalCredits,
      totalDebits,
      reconciliation,
      pagesProcessed: pages.length,
      columnsDetected: globalColumns,
    };
  }

  /**
   * Identifies column regions by scanning header tokens
   */
  private static detectColumnRegions(words: SpatialWordToken[], pageWidth: number): TableColumnRegion[] {
    const columns: TableColumnRegion[] = [];
    const dateWords = words.filter((w) => /^(date|tran\s*date|txn\s*date|value\s*date)$/i.test(w.text));
    const descWords = words.filter((w) => /^(particulars|narration|description|details)$/i.test(w.text));
    const refWords = words.filter((w) => /^(chq|ref|chq\/ref|cheque|reference|chq\s*no)$/i.test(w.text));
    const drWords = words.filter((w) => /^(withdrawal|withdrawals|debit|dr|dr\.|withdrawal\s*\(dr\))$/i.test(w.text));
    const crWords = words.filter((w) => /^(deposit|deposits|credit|cr|cr\.|deposit\s*\(cr\))$/i.test(w.text));
    const balWords = words.filter((w) => /^(balance|running\s*balance|bal)$/i.test(w.text));

    // Must find at least Date and one financial column on same horizontal band
    if (dateWords.length === 0 || (drWords.length === 0 && crWords.length === 0 && balWords.length === 0)) {
      return [];
    }

    const headerDate = dateWords[0];
    const headerY = headerDate.bbox.y0;

    const isNearHeader = (w: SpatialWordToken) => Math.abs(w.bbox.y0 - headerY) <= 15;

    const findBestCol = (list: SpatialWordToken[], type: TableColumnType): TableColumnRegion | null => {
      const match = list.find(isNearHeader);
      if (!match) return null;
      return {
        type,
        headerText: match.text,
        bbox: match.bbox,
        x0: match.bbox.x0,
        x1: match.bbox.x1,
        center: (match.bbox.x0 + match.bbox.x1) / 2,
      };
    };

    const dateCol = findBestCol(dateWords, 'DATE');
    const descCol = findBestCol(descWords, 'DESCRIPTION');
    const refCol = findBestCol(refWords, 'REFERENCE');
    const drCol = findBestCol(drWords, 'DEBIT');
    const crCol = findBestCol(crWords, 'CREDIT');
    const balCol = findBestCol(balWords, 'BALANCE');

    if (dateCol) columns.push(dateCol);
    if (descCol) columns.push(descCol);
    if (refCol) columns.push(refCol);
    if (drCol) columns.push(drCol);
    if (crCol) columns.push(crCol);
    if (balCol) columns.push(balCol);

    columns.sort((a, b) => a.center - b.center);
    return columns;
  }

  /**
   * Groups spatial words into horizontal row slices and bins tokens into columns by X-coordinates
   */
  private static clusterIntoRowSlices(
    words: SpatialWordToken[],
    columns: TableColumnRegion[],
    pageWidth: number
  ): SpatialRowSlice[] {
    if (words.length === 0 || columns.length === 0) return [];

    // Compute column separation midpoints
    const colBounds: { type: TableColumnType; minX: number; maxX: number }[] = [];
    for (let i = 0; i < columns.length; i++) {
      const curr = columns[i];
      const minX = i === 0 ? 0 : (columns[i - 1].center + curr.center) / 2;
      const maxX = i === columns.length - 1 ? pageWidth || 1000 : (curr.center + columns[i + 1].center) / 2;
      colBounds.push({ type: curr.type, minX, maxX });
    }

    // Cluster words into rows by vertical proximity (Y tolerance <= 5pt)
    const rows: { y0: number; y1: number; words: SpatialWordToken[] }[] = [];
    for (const w of words) {
      let matchedRow = rows.find((r) => Math.abs(r.y0 - w.bbox.y0) <= 5.0);
      if (!matchedRow) {
        matchedRow = { y0: w.bbox.y0, y1: w.bbox.y1, words: [] };
        rows.push(matchedRow);
      }
      matchedRow.words.push(w);
      matchedRow.y0 = Math.min(matchedRow.y0, w.bbox.y0);
      matchedRow.y1 = Math.max(matchedRow.y1, w.bbox.y1);
    }

    rows.sort((a, b) => a.y0 - b.y0);

    // Build SpatialRowSlice with cells binned by column X-ranges
    const slices: SpatialRowSlice[] = [];
    for (const r of rows) {
      r.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      const cells: { [key in TableColumnType]?: string } = {};

      for (const w of r.words) {
        const wCenter = (w.bbox.x0 + w.bbox.x1) / 2;
        const matchedCol = colBounds.find((c) => wCenter >= c.minX && wCenter <= c.maxX);
        if (matchedCol) {
          const prev = cells[matchedCol.type] || '';
          cells[matchedCol.type] = prev ? `${prev} ${w.text}` : w.text;
        }
      }

      slices.push({
        y0: r.y0,
        y1: r.y1,
        yCenter: (r.y0 + r.y1) / 2,
        tokens: r.words,
        cells,
      });
    }

    return slices;
  }

  /**
   * Finalizes an in-flight transaction using resolved coordinates & financials
   */
  private static finalizeTransaction(
    inFlight: {
      date: string;
      narrationLines: string[];
      chequeNo?: string;
      debit?: number;
      credit?: number;
      amount?: number;
      balance?: number;
      pageNumber: number;
      rawSourceText: string[];
    },
    runningBalance: number | undefined,
    transactions: ExtractedTransaction[],
    documentCurrency: string,
    requestId: string
  ): void {
    const narration = TransactionNormalizer.mergeNarrationLines(inFlight.narrationLines);
    let debit = inFlight.debit ?? 0;
    let credit = inFlight.credit ?? 0;
    let type: 'DEBIT' | 'CREDIT' = credit > 0 ? 'CREDIT' : 'DEBIT';
    let amount = credit > 0 ? credit : debit;
    let balance = inFlight.balance;

    if (debit > 0 && credit === 0) {
      type = 'DEBIT';
      amount = debit;
    } else if (credit > 0 && debit === 0) {
      type = 'CREDIT';
      amount = credit;
    } else if (balance !== undefined && runningBalance !== undefined) {
      const delta = Math.round((balance - runningBalance) * 100) / 100;
      if (delta > 0) {
        type = 'CREDIT';
        credit = delta;
        debit = 0;
        amount = delta;
      } else if (delta < 0) {
        type = 'DEBIT';
        debit = Math.abs(delta);
        credit = 0;
        amount = Math.abs(delta);
      }
    }

    let balanceContinuity = true;
    if (balance !== undefined && runningBalance !== undefined) {
      const expected =
        type === 'CREDIT'
          ? Math.round((runningBalance + amount) * 100) / 100
          : Math.round((runningBalance - amount) * 100) / 100;
      balanceContinuity = Math.abs(expected - balance) <= 0.01;
    }

    const mode = TransactionNormalizer.detectPaymentMode(narration);
    const reference = inFlight.chequeNo || TransactionNormalizer.extractReferenceNumber(narration);
    const txnId = uuidv4();

    const transaction: ExtractedTransaction = {
      transactionId: txnId,
      id: txnId,
      date: inFlight.date,
      bookingDate: inFlight.date,
      valueDate: inFlight.date,
      description: narration,
      narration,
      type,
      debit,
      credit,
      amount,
      balance,
      currency: documentCurrency || 'INR',
      balanceContinuity,
      chequeNumber: inFlight.chequeNo,
      reference,
      referenceNumber: reference,
      sourcePage: inFlight.pageNumber,
      pageNumber: inFlight.pageNumber,
      rawSourceText: inFlight.rawSourceText.join('\n'),
      confidence: balanceContinuity ? 0.98 : 0.85,
      mode,
    };

    transactions.push(transaction);
  }
}
