import { logger } from '../../utils/logger';

export interface ExtractedAmountTokens {
  amounts: number[];
  rawAmounts: string[];
  initBr?: string;
  chequeNo?: string;
  isDedicatedAmountLine: boolean;
  hasAmounts: boolean;
}

export interface ResolvedTransactionFinancials {
  type: 'DEBIT' | 'CREDIT';
  debit: number;
  credit: number;
  amount: number;
  balance?: number;
  balanceContinuity: boolean;
  initBr?: string;
  isAmbiguous: boolean;
}

export class AmountResolver {
  // Universal monetary regex: matches numbers with 2 decimal places in Indian format (e.g. 1,00,000.00, 47,40,214.86),
  // Western format (e.g. 1,000,000.00, 16,758.00), and unformatted decimal numbers (e.g. 1500000.00, 834.00, 25.00)
  public static readonly STRICT_MONEY_REGEX = /(?<![\d.])(?:\d+(?:,\d+)*)\.\d{2}(?![\d.])/g;
  public static readonly DECIMAL_MONEY_REGEX = /(?<![\d.])(?:\d+(?:,\d+)*)\.\d{2}(?![\d.])/g;

  // Branch code patterns: Trailing 1-6 digit integers preceded by whitespace at end of amount line
  public static readonly BRANCH_CODE_REGEX = /\s+(\d{1,6})\s*$/;

  // Cheque number pattern at start of amount line
  public static readonly CHEQUE_PREFIX_REGEX = /^\s*(\d{5,8})\s+/;

  /**
   * Detects document currency from text / symbols
   */
  public static detectCurrency(text: string): string {
    if (!text) return 'INR';
    if (/(?:\bUSD\b|\bUS\s+DOLLAR\b|\$)/i.test(text) && !/(?:\bINR\b|₹|\bRs\.?)/i.test(text)) return 'USD';
    if (/(?:\bEUR\b|\bEURO\b|€)/i.test(text)) return 'EUR';
    if (/(?:\bGBP\b|\bPOUND\b|£)/i.test(text)) return 'GBP';
    if (/(?:\bAED\b|\bDIRHAM\b)/i.test(text)) return 'AED';
    if (/(?:\bCAD\b|\bCANADIAN\s+DOLLAR\b)/i.test(text)) return 'CAD';
    if (/(?:\bAUD\b|\bAUSTRALIAN\s+DOLLAR\b)/i.test(text)) return 'AUD';
    if (/(?:\bSGD\b|\bSINGAPORE\s+DOLLAR\b)/i.test(text)) return 'SGD';
    return 'INR';
  }

  /**
   * Normalizes a currency string e.g. "16,758.00" -> 16758.00, "1,00,000.00" -> 100000.00, "$1,234.56" -> 1234.56
   */
  public static normalizeAmount(str: string): number {
    if (!str) return 0;
    // Strip currency symbols and letters
    let clean = str.replace(/[,\s₹RsINR$€£AEDCADAUD]/gi, '').trim();

    // Check European decimal notation e.g. 1.234,56
    if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(clean)) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    }

    const val = parseFloat(clean);
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }

  /**
   * Extracts monetary tokens, cheque numbers, and branch codes from a line of text
   */
  public static extractAmountsFromLine(line: string): ExtractedAmountTokens {
    if (!line || line.trim().length === 0) {
      return { amounts: [], rawAmounts: [], isDedicatedAmountLine: false, hasAmounts: false };
    }

    const trimmed = line.trim();

    // Ignore summary total lines like "TRANSACTION TOTAL" or "GRAND TOTAL" as transaction rows
    if (/\b(transaction\s+total|grand\s+total|total\s+debit|total\s+credit|closing\s+balance)\b/i.test(trimmed)) {
      return { amounts: [], rawAmounts: [], isDedicatedAmountLine: false, hasAmounts: false };
    }

    // 1. Extract optional Cheque Number at start of amount line
    let chequeNo: string | undefined;
    let lineWithoutChq = trimmed;
    const chqMatch = trimmed.match(this.CHEQUE_PREFIX_REGEX);
    if (chqMatch) {
      chequeNo = chqMatch[1];
      lineWithoutChq = trimmed.substring(chqMatch[0].length).trim();
    }

    // 2. Identify and extract trailing Init. Br (Branch Code) if present
    let initBr: string | undefined;
    let lineForMoney = lineWithoutChq;

    const branchMatch = lineWithoutChq.match(this.BRANCH_CODE_REGEX);
    if (branchMatch) {
      const candidateBranch = branchMatch[1];
      const branchIndex = lineWithoutChq.lastIndexOf(candidateBranch);
      const lastDotIndex = lineWithoutChq.lastIndexOf('.');
      if (lastDotIndex === -1 || branchIndex > lastDotIndex + 2) {
        initBr = candidateBranch;
        lineForMoney = lineWithoutChq.substring(0, branchIndex).trim();
      }
    }

    // 3. Extract monetary amounts using strict regex
    const matches = lineForMoney.match(this.STRICT_MONEY_REGEX);
    if (!matches || matches.length === 0) {
      return { amounts: [], rawAmounts: [], initBr, chequeNo, isDedicatedAmountLine: false, hasAmounts: false };
    }

    const amounts = matches.map((m) => this.normalizeAmount(m)).filter((v) => !isNaN(v) && isFinite(v));
    const rawAmounts = matches.map((m) => m.trim());

    // 4. Determine if this is a dedicated amount line or narration containing numbers
    // A dedicated amount line contains predominantly numeric/amount tokens at the end
    const remainingTextAfterAmounts = lineForMoney.replace(this.STRICT_MONEY_REGEX, '').trim();
    const hasTrailingAmount = /(?:\d+(?:,\d+)*)\.\d{2}\s*(?:cr|dr)?$/i.test(lineForMoney);
    const isDedicatedAmountLine =
      amounts.length >= 2 ||
      (amounts.length >= 1 && (remainingTextAfterAmounts.length === 0 || !!initBr || !!chequeNo || hasTrailingAmount));

    return {
      amounts,
      rawAmounts,
      initBr,
      chequeNo,
      isDedicatedAmountLine,
      hasAmounts: amounts.length > 0,
    };
  }

  /**
   * Resolves transaction type (DEBIT / CREDIT), transaction amount, and running balance
   * using exact mathematical delta against running balance, column hints, and narration indicators.
   */
  public static resolveFinancials(
    amounts: number[],
    previousBalance: number | undefined,
    columnHint?: 'DEBIT' | 'CREDIT',
    narration?: string,
    initBr?: string
  ): ResolvedTransactionFinancials {
    if (amounts.length === 0) {
      return {
        type: 'DEBIT',
        debit: 0,
        credit: 0,
        amount: 0,
        balance: previousBalance,
        balanceContinuity: false,
        initBr,
        isAmbiguous: true,
      };
    }

    const tolerance = 0.05;

    // Case 1: Standard Bank format with [Transaction Amount, Running Balance]
    if (amounts.length === 2) {
      const txnAmount = amounts[0];
      const statedBalance = amounts[1];

      // If previous balance is known, compute exact mathematical continuity
      if (previousBalance !== undefined && !isNaN(previousBalance)) {
        const expectedCredit = Math.round((previousBalance + txnAmount) * 100) / 100;
        const expectedDebit = Math.round((previousBalance - txnAmount) * 100) / 100;

        const creditDelta = Math.abs(expectedCredit - statedBalance);
        const debitDelta = Math.abs(expectedDebit - statedBalance);

        if (creditDelta <= tolerance) {
          return {
            type: 'CREDIT',
            debit: 0,
            credit: txnAmount,
            amount: txnAmount,
            balance: statedBalance,
            balanceContinuity: true,
            initBr,
            isAmbiguous: false,
          };
        }

        if (debitDelta <= tolerance) {
          return {
            type: 'DEBIT',
            debit: txnAmount,
            credit: 0,
            amount: txnAmount,
            balance: statedBalance,
            balanceContinuity: true,
            initBr,
            isAmbiguous: false,
          };
        }

        // Direct mathematical balance comparison for type determination
        const balanceDifference = Math.round((statedBalance - previousBalance) * 100) / 100;
        if (balanceDifference > 0) {
          // Balance went up -> definitely CREDIT
          return {
            type: 'CREDIT',
            debit: 0,
            credit: txnAmount,
            amount: txnAmount,
            balance: statedBalance,
            balanceContinuity: false,
            initBr,
            isAmbiguous: false,
          };
        } else if (balanceDifference < 0) {
          // Balance went down -> definitely DEBIT
          return {
            type: 'DEBIT',
            debit: txnAmount,
            credit: 0,
            amount: txnAmount,
            balance: statedBalance,
            balanceContinuity: false,
            initBr,
            isAmbiguous: false,
          };
        }

        // Balance unchanged -> resolve via column hint / narration
        const type = this.inferTypeFromNarration(narration, columnHint);
        return {
          type,
          debit: type === 'DEBIT' ? txnAmount : 0,
          credit: type === 'CREDIT' ? txnAmount : 0,
          amount: txnAmount,
          balance: statedBalance,
          balanceContinuity: false,
          initBr,
          isAmbiguous: true,
        };
      }

      // No previous balance available -> baseline initial transaction
      const type = this.inferTypeFromNarration(narration, columnHint);
      return {
        type,
        debit: type === 'DEBIT' ? txnAmount : 0,
        credit: type === 'CREDIT' ? txnAmount : 0,
        amount: txnAmount,
        balance: statedBalance,
        balanceContinuity: true,
        initBr,
        isAmbiguous: false,
      };
    }

    // Case 2: 3 or more amounts present: e.g. [Debit, Credit, Balance] or narration numbers + [Amount, Balance]
    if (amounts.length >= 3) {
      const statedBalance = amounts[amounts.length - 1];

      // If previous balance is known, find which preceding amount satisfies delta
      if (previousBalance !== undefined) {
        for (let i = amounts.length - 2; i >= 0; i--) {
          const candidateAmt = amounts[i];
          if (candidateAmt <= 0) continue;

          if (Math.abs(previousBalance + candidateAmt - statedBalance) <= tolerance) {
            return {
              type: 'CREDIT',
              debit: 0,
              credit: candidateAmt,
              amount: candidateAmt,
              balance: statedBalance,
              balanceContinuity: true,
              initBr,
              isAmbiguous: false,
            };
          }
          if (Math.abs(previousBalance - candidateAmt - statedBalance) <= tolerance) {
            return {
              type: 'DEBIT',
              debit: candidateAmt,
              credit: 0,
              amount: candidateAmt,
              balance: statedBalance,
              balanceContinuity: true,
              initBr,
              isAmbiguous: false,
            };
          }
        }

        // Fallback to the immediate preceding amount
        const txnAmount = amounts[amounts.length - 2];
        const balanceDifference = Math.round((statedBalance - previousBalance) * 100) / 100;
        if (balanceDifference > 0) {
          return {
            type: 'CREDIT',
            debit: 0,
            credit: txnAmount,
            amount: txnAmount,
            balance: statedBalance,
            balanceContinuity: false,
            initBr,
            isAmbiguous: false,
          };
        } else {
          return {
            type: 'DEBIT',
            debit: txnAmount,
            credit: 0,
            amount: txnAmount,
            balance: statedBalance,
            balanceContinuity: false,
            initBr,
            isAmbiguous: false,
          };
        }
      }

      const debitCandidate = amounts[0];
      const creditCandidate = amounts[1];
      if (debitCandidate > 0 && creditCandidate === 0) {
        return {
          type: 'DEBIT',
          debit: debitCandidate,
          credit: 0,
          amount: debitCandidate,
          balance: statedBalance,
          balanceContinuity: true,
          initBr,
          isAmbiguous: false,
        };
      }
      if (creditCandidate > 0 && debitCandidate === 0) {
        return {
          type: 'CREDIT',
          debit: 0,
          credit: creditCandidate,
          amount: creditCandidate,
          balance: statedBalance,
          balanceContinuity: true,
          initBr,
          isAmbiguous: false,
        };
      }

      const type = this.inferTypeFromNarration(narration, columnHint);
      const chosenAmount = type === 'CREDIT' ? creditCandidate || debitCandidate : debitCandidate || creditCandidate;
      return {
        type,
        debit: type === 'DEBIT' ? chosenAmount : 0,
        credit: type === 'CREDIT' ? chosenAmount : 0,
        amount: chosenAmount,
        balance: statedBalance,
        balanceContinuity: false,
        initBr,
        isAmbiguous: true,
      };
    }

    // Case 3: Only 1 amount present
    const singleAmount = amounts[0];
    if (previousBalance !== undefined) {
      const type = this.inferTypeFromNarration(narration, columnHint);
      const calcBalance = type === 'CREDIT'
        ? Math.round((previousBalance + singleAmount) * 100) / 100
        : Math.round((previousBalance - singleAmount) * 100) / 100;
      return {
        type,
        debit: type === 'DEBIT' ? singleAmount : 0,
        credit: type === 'CREDIT' ? singleAmount : 0,
        amount: singleAmount,
        balance: calcBalance,
        balanceContinuity: true,
        initBr,
        isAmbiguous: false,
      };
    }

    return {
      type: this.inferTypeFromNarration(narration, columnHint),
      debit: columnHint === 'CREDIT' ? 0 : singleAmount,
      credit: columnHint === 'CREDIT' ? singleAmount : 0,
      amount: singleAmount,
      balance: undefined,
      balanceContinuity: true,
      initBr,
      isAmbiguous: false,
    };
  }

  /**
   * Infers transaction type from narration keywords and column hints
   */
  public static inferTypeFromNarration(
    narration?: string,
    columnHint?: 'DEBIT' | 'CREDIT'
  ): 'DEBIT' | 'CREDIT' {
    if (columnHint) return columnHint;
    if (!narration) return 'DEBIT';

    const clean = narration.toUpperCase();

    // Strong Credit Markers
    if (
      /\b(SALARY|CREDITED|CREDIT|CR\b|BY\s+TRANSFER|INWARD|RECEIVED|REFUND|REVERSAL|CASH\s+DEP|SELF\s+CASH\s+DEP|BNA\/|INTEREST|INT\.PD|DEPOSIT|REV-UPI)\b/.test(
        clean
      )
    ) {
      return 'CREDIT';
    }

    // Strong Debit Markers
    if (
      /\b(DEBITED|DEBIT|DR\b|TO\s+TRANSFER|WITHDRAWAL|WDL|ATM|POS|PURCHASE|PAID|CHARGE|FEE|CHARGES|EMI|LOAN|BILL|TAX|OUTWARD)\b/.test(
        clean
      )
    ) {
      return 'DEBIT';
    }

    return 'DEBIT';
  }
}
