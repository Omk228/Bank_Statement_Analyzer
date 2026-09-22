import { ExtractedAccountInfo, NormalizedPageModel } from '../../types/statement';
import { BankProfileRegistry } from './BankProfileRegistry';
import {
  ParseStatementLedgerResult,
  TransactionStateMachineParser,
} from './TransactionStateMachineParser';
import { LayoutAwareRegionExtractor } from './LayoutAwareRegionExtractor';
import { CoordinateTableReconstructor } from './CoordinateTableReconstructor';
import { logger } from '../../utils/logger';

export class GenericIndianBankParser {
  public static extractMetadata(
    fullText: string,
    pages: NormalizedPageModel[],
    requestId: string
  ): ExtractedAccountInfo {
    const profile = BankProfileRegistry.resolveProfile(fullText);

    // 1. Layout-Aware Region-based metadata extraction
    const regionResult = LayoutAwareRegionExtractor.extractRegions(pages, profile, requestId);
    const metadata = regionResult.accountInfo;

    // 2. Bank Name detection fallback
    if (!metadata.bankName || metadata.bankName === 'Bank Statement') {
      const headerSlice = fullText.substring(0, 1500);
      for (const p of [
        { name: 'State Bank of India', regex: /\b(state\s+bank\s+of\s+india|sbi\b)\b/i },
        { name: 'HDFC Bank', regex: /\b(hdfc\s+bank|hdfc\b)\b/i },
        { name: 'ICICI Bank', regex: /\b(icici\s+bank|icici\b)\b/i },
        { name: 'Axis Bank', regex: /\b(axis\s+bank|uti\s+bank|axis\b)\b/i },
        { name: 'Kotak Mahindra Bank', regex: /\b(kotak\s+mahindra\s+bank|kotak\s+bank|kotak\b)\b/i },
        { name: 'Punjab National Bank', regex: /\b(punjab\s+national\s+bank|pnb\b)\b/i },
        { name: 'Bank of Baroda', regex: /\b(bank\s+of\s+baroda|bob\b)\b/i },
        { name: 'Canara Bank', regex: /\b(canara\s+bank|canara\b)\b/i },
        { name: 'Union Bank of India', regex: /\b(union\s+bank\s+of\s+india|union\s+bank)\b/i },
        { name: 'IndusInd Bank', regex: /\b(indusind\s+bank|indusind\b)\b/i },
        { name: 'IDFC FIRST Bank', regex: /\b(idfc\s+first\s+bank|idfc\s+bank|idfc\b)\b/i },
        { name: 'Yes Bank', regex: /\b(yes\s+bank|yesbank)\b/i },
        { name: 'Federal Bank', regex: /\b(federal\s+bank)\b/i },
        { name: 'RBL Bank', regex: /\b(rbl\s+bank|ratnakar\s+bank)\b/i },
        { name: 'AU Small Finance Bank', regex: /\b(au\s+small\s+finance\s+bank|au\s+bank)\b/i },
      ]) {
        if (p.regex.test(headerSlice) || p.regex.test(fullText)) {
          metadata.bankName = p.name;
          break;
        }
      }
    }

    // 3. Fallback account number patterns if not captured
    if (!metadata.accountNumber) {
      for (const pat of profile.accountNoPatterns) {
        const match = fullText.match(pat);
        if (match && match[1]) {
          metadata.accountNumber = match[1].trim();
          break;
        }
      }
    }

    // 4. Fallback IFSC
    if (!metadata.ifsc) {
      const ifscMatch = fullText.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
      if (ifscMatch) {
        metadata.ifsc = ifscMatch[1].toUpperCase();
      }
    }

    // 5. Fallback Account Holder Name
    if (!metadata.accountHolderName) {
      for (const pat of profile.namePatterns) {
        const match = fullText.match(pat);
        if (match && match[1]) {
          let rawName = match[1].trim();
          rawName = rawName.replace(/\s*(?:IFSC|Account|Cust|Joint|Branch|CRN).*/i, '').trim();
          if (rawName.length >= 3 && !LayoutAwareRegionExtractor.isInvalidCustomerName(rawName)) {
            metadata.accountHolderName = rawName;
            break;
          }
        }
      }
    }

    if (regionResult.detectedOpeningBalance !== undefined) {
      metadata.openingBalance = regionResult.detectedOpeningBalance;
    }
    if (regionResult.detectedClosingBalance !== undefined) {
      metadata.closingBalance = regionResult.detectedClosingBalance;
    }

    return metadata;
  }

  public static parseStatement(
    fullText: string,
    pages: NormalizedPageModel[],
    requestId: string
  ): { account: ExtractedAccountInfo; ledger: ParseStatementLedgerResult } {
    const metadata = this.extractMetadata(fullText, pages, requestId);

    // Check if 2D spatial coordinate table reconstruction can be applied
    let ledger: ParseStatementLedgerResult;

    if (CoordinateTableReconstructor.hasValidGeometry(pages)) {
      logger.info({
        requestId,
        stage: 'PARSER_COORDINATE_TABLE',
        message: 'Spatial geometry detected on pages. Executing CoordinateTableReconstructor.',
      });

      const coordResult = CoordinateTableReconstructor.reconstruct(
        pages,
        metadata.openingBalance,
        metadata.closingBalance,
        requestId
      );

      if (coordResult.transactions.length > 0) {
        ledger = {
          transactions: coordResult.transactions,
          openingBalance: coordResult.openingBalance,
          closingBalance: coordResult.closingBalance,
          totalCredits: coordResult.totalCredits,
          totalDebits: coordResult.totalDebits,
          pagesProcessed: coordResult.pagesProcessed,
          parseWarnings: [],
          detectedColumns: null,
          reconciliation: coordResult.reconciliation,
        };
      } else {
        // Fallback to state machine parser if coordinate reconstruction yielded 0 rows
        logger.info({
          requestId,
          stage: 'PARSER_FALLBACK',
          message: 'Coordinate reconstruction returned 0 rows. Falling back to state machine line parser.',
        });
        ledger = TransactionStateMachineParser.parsePages(pages, requestId);
      }
    } else {
      ledger = TransactionStateMachineParser.parsePages(pages, requestId);
    }

    if (ledger.openingBalance !== undefined) {
      metadata.openingBalance = ledger.openingBalance;
    } else if (metadata.openingBalance !== undefined) {
      ledger.openingBalance = metadata.openingBalance;
    }

    if (ledger.closingBalance !== undefined) {
      metadata.closingBalance = ledger.closingBalance;
    } else if (metadata.closingBalance !== undefined) {
      ledger.closingBalance = metadata.closingBalance;
    }

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

