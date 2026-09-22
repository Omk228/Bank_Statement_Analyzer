export interface ColumnSpan {
  name: string;
  startIndex: number;
  endIndex: number;
}

export interface DetectedTableColumns {
  dateCol?: ColumnSpan;
  chqCol?: ColumnSpan;
  particularsCol?: ColumnSpan;
  debitCol?: ColumnSpan;
  creditCol?: ColumnSpan;
  balanceCol?: ColumnSpan;
  initBrCol?: ColumnSpan;
  headerLine?: string;
  hasDebitAndCredit: boolean;
}

export class ColumnDetector {
  /**
   * Detects and parses table header line to extract column boundaries
   */
  public static detectColumnsFromHeader(headerLine: string): DetectedTableColumns | null {
    if (!headerLine || headerLine.trim().length === 0) return null;

    const lower = headerLine.toLowerCase();

    // Check if line contains essential banking table keywords
    const hasDate = /\b(tran\s*date|value\s*date|date|post\s*date)\b/.test(lower);
    const hasParticulars = /\b(particulars|narration|description|details)\b/.test(lower);
    const hasAmount = /\b(debit|withdrawal|credit|deposit|amount)\b/.test(lower);
    const hasBalance = /\b(balance|bal|closing\s*bal)\b/.test(lower);

    if (!hasDate || (!hasParticulars && !hasAmount && !hasBalance)) {
      return null;
    }

    const columns: DetectedTableColumns = {
      headerLine,
      hasDebitAndCredit: false,
    };

    // Find token positions in header line
    const dateMatch = lower.match(/\b(tran\s*date|value\s*date|date)\b/);
    if (dateMatch && dateMatch.index !== undefined) {
      columns.dateCol = {
        name: 'date',
        startIndex: dateMatch.index,
        endIndex: dateMatch.index + dateMatch[0].length,
      };
    }

    const chqMatch = lower.match(/\b(chq\s*no|cheque\s*no|ref\s*no|chq)\b/);
    if (chqMatch && chqMatch.index !== undefined) {
      columns.chqCol = {
        name: 'chq',
        startIndex: chqMatch.index,
        endIndex: chqMatch.index + chqMatch[0].length,
      };
    }

    const partMatch = lower.match(/\b(particulars|narration|description|transaction\s*details)\b/);
    if (partMatch && partMatch.index !== undefined) {
      columns.particularsCol = {
        name: 'particulars',
        startIndex: partMatch.index,
        endIndex: partMatch.index + partMatch[0].length,
      };
    }

    const debitMatch = lower.match(/\b(debit|dr|withdrawal|withdrawals)\b/);
    if (debitMatch && debitMatch.index !== undefined) {
      columns.debitCol = {
        name: 'debit',
        startIndex: debitMatch.index,
        endIndex: debitMatch.index + debitMatch[0].length,
      };
    }

    const creditMatch = lower.match(/\b(credit|cr|deposit|deposits)\b/);
    if (creditMatch && creditMatch.index !== undefined) {
      columns.creditCol = {
        name: 'credit',
        startIndex: creditMatch.index,
        endIndex: creditMatch.index + creditMatch[0].length,
      };
    }

    const balMatch = lower.match(/\b(balance|running\s*balance|bal)\b/);
    if (balMatch && balMatch.index !== undefined) {
      columns.balanceCol = {
        name: 'balance',
        startIndex: balMatch.index,
        endIndex: balMatch.index + balMatch[0].length,
      };
    }

    const branchMatch = lower.match(/\b(init\.\s*br|init\s*br|branch|br\s*code)\b/);
    if (branchMatch && branchMatch.index !== undefined) {
      columns.initBrCol = {
        name: 'initBr',
        startIndex: branchMatch.index,
        endIndex: branchMatch.index + branchMatch[0].length,
      };
    }

    columns.hasDebitAndCredit = !!(columns.debitCol && columns.creditCol);

    return columns;
  }

  /**
   * Classifies an amount's column location based on its character position in the line
   */
  public static classifyAmountColumn(
    line: string,
    amountStr: string,
    detectedColumns?: DetectedTableColumns | null
  ): 'DEBIT' | 'CREDIT' | 'BALANCE' | 'UNKNOWN' {
    if (!detectedColumns || !amountStr || !line) return 'UNKNOWN';

    const index = line.indexOf(amountStr);
    if (index === -1) return 'UNKNOWN';

    const { debitCol, creditCol, balanceCol } = detectedColumns;

    if (debitCol && creditCol) {
      // Calculate midpoint between Debit and Credit column markers
      const debitCenter = (debitCol.startIndex + debitCol.endIndex) / 2;
      const creditCenter = (creditCol.startIndex + creditCol.endIndex) / 2;
      const balCenter = balanceCol ? (balanceCol.startIndex + balanceCol.endIndex) / 2 : Infinity;

      const distDebit = Math.abs(index - debitCenter);
      const distCredit = Math.abs(index - creditCenter);
      const distBal = Math.abs(index - balCenter);

      if (distBal < distDebit && distBal < distCredit) {
        return 'BALANCE';
      }
      if (distDebit < distCredit) {
        return 'DEBIT';
      }
      return 'CREDIT';
    }

    return 'UNKNOWN';
  }
}
