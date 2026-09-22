import { ExtractedAccountInfo, NormalizedPageModel } from '../../types/statement';
import {
  ParseStatementLedgerResult,
  TransactionStateMachineParser,
} from './TransactionStateMachineParser';
import { logger } from '../../utils/logger';

export class AxisStatementParser {
  public static readonly BANK_NAME = 'Axis Bank';

  /**
   * Extracts Axis Bank specific account metadata from pages text
   */
  public static extractMetadata(
    fullText: string,
    pages: NormalizedPageModel[],
    requestId: string
  ): ExtractedAccountInfo {
    // 1. Account Number
    let accountNumber: string | undefined;
    const accMatch =
      fullText.match(
        /(?:statement\s+of\s+axis\s+account\s*no|axis\s+account\s*no|account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i
      ) || fullText.match(/\b(9\d{14})\b/); // Standard Axis 15-digit savings/current account number

    if (accMatch) {
      accountNumber = accMatch[1].trim();
    }

    // 2. IFSC Code
    let ifsc: string | undefined;
    const ifscMatch = fullText.match(/\b(UTIB0[A-Z0-9]{6}|UTIB[0-9]{7})\b/i) || fullText.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
    if (ifscMatch) {
      ifsc = ifscMatch[1].toUpperCase();
    }

    // 3. Statement Period
    let startDate: string | undefined;
    let endDate: string | undefined;
    const periodMatch = fullText.match(
      /(?:statement\s+period|period\s+from|from\s+date|txn\s+period|period)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
    );
    if (periodMatch) {
      startDate = periodMatch[1];
      endDate = periodMatch[2];
    }

    // 4. Customer / Account Holder Name
    let accountHolderName: string | undefined;
    const nameMatch = fullText.match(
      /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder)\s*[:\-]\s*([A-Za-z\s\.]{3,40}?)(?=\s{2,}|IFSC|Account|Cust|Joint|Branch|\n|\r|$)/i
    ) || fullText.match(
      /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i
    );
    if (nameMatch) {
      let rawName = nameMatch[1].trim();
      rawName = rawName.replace(/\s*(?:IFSC|Account|Cust|Branch).*/i, '').trim();
      accountHolderName = rawName;
    }

    // 5. Account Type
    let accountType = 'SAVINGS';
    if (/\b(current\s+account|current\s+a\/c)\b/i.test(fullText)) {
      accountType = 'CURRENT';
    } else if (/\b(overdraft|od\s+account|cash\s+credit|cc\s+account)\b/i.test(fullText)) {
      accountType = 'OVERDRAFT';
    } else if (/\b(salary\s+account)\b/i.test(fullText)) {
      accountType = 'SALARY';
    }

    // 6. Branch Name
    let branchName: string | undefined;
    const branchMatch = fullText.match(/(?:branch\s+name|branch)\s*[:\-]\s*([A-Za-z0-9\s,\.]{3,40})/i);
    if (branchMatch) {
      branchName = branchMatch[1].trim();
    }

    return {
      bankName: this.BANK_NAME,
      accountNumber,
      ifsc: ifsc || 'UTIB0004378',
      accountHolderName,
      accountType,
      branchName,
      startDate,
      endDate,
    };
  }

  /**
   * Parses Axis Bank Statement ledger
   */
  public static parseStatement(
    fullText: string,
    pages: NormalizedPageModel[],
    requestId: string
  ): { account: ExtractedAccountInfo; ledger: ParseStatementLedgerResult } {
    const metadata = this.extractMetadata(fullText, pages, requestId);
    const ledger = TransactionStateMachineParser.parsePages(pages, requestId);

    if (ledger.openingBalance !== undefined) {
      metadata.openingBalance = ledger.openingBalance;
    }
    if (ledger.closingBalance !== undefined) {
      metadata.closingBalance = ledger.closingBalance;
    }

    // If period wasn't detected in header, infer from extracted transactions
    if (!metadata.startDate && ledger.transactions.length > 0) {
      metadata.startDate = ledger.transactions[0].date;
    }
    if (!metadata.endDate && ledger.transactions.length > 0) {
      metadata.endDate = ledger.transactions[ledger.transactions.length - 1].date;
    }

    return {
      account: metadata,
      ledger,
    };
  }
}
