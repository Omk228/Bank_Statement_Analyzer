import { ExtractedTransaction } from '../../types/statement';

export class TransactionNormalizer {
  /**
   * Header line patterns that repeat across pages and should be filtered out
   */
  private static readonly REPEATED_HEADER_PATTERNS = [
    /^statement\s+of\s+axis\s+account/i,
    /^axis\s+bank\s+(ltd|limited)/i,
    /^tran\s*date\s+(chq\s*no\s+)?particulars/i,
    /^date\s+(particulars|description|narration)/i,
    /^page\s*\d+\s*(of|\/)\s*\d+/i,
    /^page\s*no\.?\s*:\s*\d+/i,
    /^branch\s+name\s*:/i,
    /^branch\s+address\s*:/i,
    /^customer\s+id\s*:/i,
    /^account\s+no\s*:\s*\d+/i,
    /^ifsc\s+code\s*:/i,
    /^micr\s+code\s*:/i,
    /^nomination\s*:/i,
    /^joint\s+holder\s*:/i,
    /^clearing\s+charges\s*:/i,
    /^legend\s*:/i,
    /^\s*[-=_]{5,}\s*$/, // Horizontal divider lines
  ];

  /**
   * Checks if a line is a repeated page header, footer, or metadata banner
   */
  public static isHeaderOrFooterLine(line: string): boolean {
    if (!line || line.trim().length === 0) return true;
    const clean = line.trim();

    // Check against repeated header regexes
    for (const pattern of this.REPEATED_HEADER_PATTERNS) {
      if (pattern.test(clean)) {
        return true;
      }
    }

    // Check column header line: "Tran Date Chq No Particulars Debit Credit Balance Init. Br"
    if (
      /\b(tran\s*date|value\s*date)\b/i.test(clean) &&
      /\b(particulars|narration|description)\b/i.test(clean) &&
      /\b(debit|credit|balance)\b/i.test(clean)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Joins multiple raw narration lines into a clean, coherent description.
   * Cleans up PDF line-wrap artifacts (e.g. "Pa\nymentd" -> "Paymentd").
   */
  public static mergeNarrationLines(lines: string[]): string {
    if (!lines || lines.length === 0) return 'Bank Transaction';

    // Filter out empty lines
    const cleanLines = lines.map((l) => l.trim()).filter((l) => l.length > 0);
    if (cleanLines.length === 0) return 'Bank Transaction';
    if (cleanLines.length === 1) return this.cleanString(cleanLines[0]);

    let merged = cleanLines[0];

    for (let i = 1; i < cleanLines.length; i++) {
      const prev = merged;
      const curr = cleanLines[i];

      // Case 1: Previous ends with slash or current starts with slash -> connect directly or with slash
      if (prev.endsWith('/') || curr.startsWith('/')) {
        merged = prev.endsWith('/') && curr.startsWith('/')
          ? prev + curr.substring(1)
          : prev + curr;
      }
      // Case 2: Word split across lines (e.g. "Pa" + "ymentd" -> "Paymentd" or "REK" + "HA")
      else if (
        /[a-zA-Z]$/.test(prev) &&
        /^[a-z]/.test(curr) &&
        !prev.endsWith(' ') &&
        !curr.startsWith(' ')
      ) {
        merged = prev + curr;
      }
      // Case 3: Hyphen at end of line (e.g. "KVPL070426-" + "3")
      else if (prev.endsWith('-')) {
        merged = prev + curr;
      }
      // Case 4: Standard space separation
      else {
        merged = prev + ' ' + curr;
      }
    }

    return this.cleanString(merged);
  }

  /**
   * Cleans spaces, control characters, and redundant tokens
   */
  public static cleanString(str: string): string {
    return str
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Extracts payment mode (UPI, NEFT, IMPS, RTGS, ACH, ATM, POS, CARD, OTHER)
   */
  public static detectPaymentMode(
    narration: string
  ): ExtractedTransaction['mode'] {
    const clean = narration.toUpperCase();

    if (/\bUPI\b|REV-UPI|\/UPI\//.test(clean)) return 'UPI';
    if (/\bIMPS\b|\/IMPS\//.test(clean)) return 'IMPS';
    if (/\bNEFT\b|\/NEFT\//.test(clean)) return 'NEFT';
    if (/\bRTGS\b|\/RTGS\//.test(clean)) return 'RTGS';
    if (/\bATM\b|CASH\s+WDL|NFS\s+ATM|BNA\//.test(clean)) return 'ATM';
    if (/\bPOS\b|E-COMM|SWIPE|MERCHANT/.test(clean)) return 'POS';
    if (/\b(ACH|NACH|ECS|SALARY|DIVIDEND)\b/.test(clean)) return 'ACH';
    if (/\b(CARD|DEBIT\s+CARD|CREDIT\s+CARD|VISA|MASTERCARD|RUPAY)\b/.test(clean)) return 'CARD';

    return 'OTHER';
  }

  /**
   * Extracts transaction reference number or UTR from description
   */
  public static extractReferenceNumber(narration: string): string | undefined {
    // 1. UPI Reference (12 digits) e.g. UPI/P2M/644329448132/...
    const upiMatch = narration.match(/UPI\/(?:P2A|P2M|PAY)\/(\d{12})\b/i) || narration.match(/\b(\d{12})\b/);
    if (upiMatch) return upiMatch[1];

    // 2. IMPS Reference e.g. IMPS/P2A/607717366683/...
    const impsMatch = narration.match(/IMPS\/(?:P2A|P2M|INB|MOB)\/([A-Z0-9]{10,18})\b/i);
    if (impsMatch) return impsMatch[1];

    // 3. NEFT UTR e.g. NEFT/YESIG60970213984/...
    const neftMatch = narration.match(/NEFT\/([A-Z0-9]{10,22})\b/i);
    if (neftMatch) return neftMatch[1];

    // 4. BNA / Cash Deposit Ref e.g. BNA/DPRH487201/6809/...
    const bnaMatch = narration.match(/BNA\/([A-Z0-9]+)\/(\d+)/i);
    if (bnaMatch) return `${bnaMatch[1]}/${bnaMatch[2]}`;

    return undefined;
  }
}
