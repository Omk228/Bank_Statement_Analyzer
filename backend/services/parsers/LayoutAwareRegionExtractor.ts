import { logger } from '../../utils/logger';
import { NormalizedPageModel, ExtractedAccountInfo } from '../../types/statement';
import { BankProfile } from './BankProfileRegistry';
import { AmountResolver } from './AmountResolver';
import { PageGeometry, SpatialWordToken, SpatialLineToken } from '../../types/geometry';

export interface LayoutExtractedRegions {
  accountInfo: ExtractedAccountInfo;
  detectedOpeningBalance?: number;
  detectedClosingBalance?: number;
  headerConfidence: number;
}

export class LayoutAwareRegionExtractor {
  // Common banking label regex patterns
  private static readonly ACCT_LABEL_REGEX = /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no|iban|account\s*id)\b/i;
  private static readonly NAME_LABEL_REGEX = /(?:customer\s*name|account\s*holder|account\s*title|name\s*of\s*account\s*holder|name\s*of\s*customer|holder\s*name)\b/i;
  private static readonly IFSC_LABEL_REGEX = /\b(ifsc(?:\s*code)?|rtgs\s*\/\s*neft\s*ifsc)\b/i;
  private static readonly MICR_LABEL_REGEX = /\b(micr(?:\s*code)?)\b/i;
  private static readonly TYPE_LABEL_REGEX = /(?:account\s*type|a\/c\s*type|type\s*of\s*account|product)\b/i;
  private static readonly PERIOD_LABEL_REGEX = /(?:statement\s+period|period\s+from|from\s+date|statement\s+dates|period|from)\b/i;
  private static readonly OPEN_BAL_LABEL_REGEX = /(?:opening\s+balance|beginning\s+balance|previous\s+balance|brought\s+forward|b\/f|open\s+bal)\b/i;
  private static readonly CLOSE_BAL_LABEL_REGEX = /(?:closing\s+balance|ending\s+balance|balance\s+at\s+end|carried\s+forward|c\/f|close\s+bal)\b/i;

  public static isInvalidCustomerName(name: string): boolean {
    if (!name || name.trim().length < 3) return true;
    const clean = name.trim().toLowerCase();

    // Check exact strings or substrings
    const blacklistedPhrases = [
      'goods and services tax',
      'goods & services tax',
      'gst',
      'tax',
      'tax invoice',
      'kotak',
      'kotak mahindra',
      'axis bank',
      'hdfc bank',
      'icici bank',
      'state bank',
      'bank',
      'statement',
      'statement of account',
      'account statement',
      'savings account',
      'current account',
      'overdraft',
      'crn',
      'ifsc',
      'micr',
      'rtgs',
      'neft',
      'imps',
      'nomination',
      'registered office',
      'head office',
      'branch office',
      'zonal office',
      'terms and conditions',
      'banking ombudsman',
      'customer id',
      'customer care',
      'account number',
      'opening balance',
      'closing balance',
      'available balance',
      'particulars',
      'description',
      'withdrawal',
      'deposit',
      'transaction',
      'badarpur',
      'badarpur border',
      'molar band',
      'molarband',
    ];

    for (const b of blacklistedPhrases) {
      if (clean === b || clean.includes(b)) return true;
    }

    // Check individual word tokens for address, branch, or corporate identifiers
    const blacklistedWords = new Set([
      'branch', 'br', 'bo', 'border', 'road', 'rd', 'street', 'st', 'marg', 'lane', 'gali',
      'nagar', 'vihar', 'pur', 'pura', 'puri', 'enclave', 'block', 'sector', 'sec', 'phase', 'pocket',
      'delhi', 'mumbai', 'bangalore', 'bengaluru', 'kolkata', 'chennai', 'hyderabad', 'noida', 'gurgaon',
      'gurugram', 'faridabad', 'ghaziabad', 'pune', 'ahmedabad', 'jaipur', 'chandigarh', 'lucknow',
      'floor', 'flr', 'bldg', 'building', 'tower', 'house', 'plot', 'flat', 'apartment', 'apt',
      'complex', 'plaza', 'chambers', 'arcade', 'centre', 'center', 'residency', 'villas', 'society',
      'colony', 'extn', 'extension', 'bazaar', 'market', 'mandi', 'chowk', 'junction', 'circle',
      'bridge', 'flyover', 'station', 'depot', 'terminal', 'airport', 'cantt', 'post', 'po', 'pin',
      'pincode', 'dist', 'district', 'state', 'india', 'opp', 'opposite', 'near', 'nr', 'behind',
      'ltd', 'limited', 'pvt', 'private', 'inc', 'corp', 'corporation', 'services', 'solutions',
      'enterprises', 'holdings', 'ventures', 'technologies', 'industries', 'trading', 'agency',
      'associates', 'consultancy', 'management', 'finance', 'financial', 'insurance', 'capital',
      'trust', 'foundation', 'association', 'club', 'board', 'council', 'authority', 'commission',
      'ministry', 'department', 'govt', 'government', 'office', 'gstin', 'cin', 'pan', 'tan'
    ]);

    const words = clean.split(/[\s,.\-_/\\()]+/);
    for (const w of words) {
      if (blacklistedWords.has(w)) return true;
    }

    // Must not contain any digits
    if (/\d/.test(clean)) return true;

    return false;
  }

  /**
   * Extracts account information, bank metadata, and boundary balances using spatial regions
   */
  public static extractRegions(
    pages: NormalizedPageModel[],
    profile: BankProfile,
    requestId: string
  ): LayoutExtractedRegions {
    const accountInfo: ExtractedAccountInfo = {
      bankName: profile.bankName,
    };

    let detectedOpeningBalance: number | undefined;
    let detectedClosingBalance: number | undefined;
    let headerConfidence = 0.8;

    if (!pages || pages.length === 0) {
      return { accountInfo, headerConfidence: 0.5 };
    }

    // Process page 1 (primary header page) and account info pages
    const headerPages = pages.filter(
      (p, idx) => idx === 0 || p.pageType === 'ACCOUNT_INFO_PAGE' || p.pageType === 'SUMMARY_PAGE'
    );

    for (const page of headerPages) {
      const geometry = page.geometry;

      if (geometry && geometry.words.length > 0 && geometry.height > 0) {
        // 1. Spatial Region-Based Extraction
        const height = geometry.height;
        const headerRegionWords = geometry.words.filter((w) => w.bbox.y0 <= height * 0.40);
        const footerRegionWords = geometry.words.filter((w) => w.bbox.y0 >= height * 0.70);

        this.extractSpatialHeaderFields(headerRegionWords, accountInfo, profile);
        
        if (detectedOpeningBalance === undefined) {
          detectedOpeningBalance = this.extractSpatialOpeningBalance(headerRegionWords);
        }
        if (detectedClosingBalance === undefined) {
          detectedClosingBalance = this.extractSpatialClosingBalance(footerRegionWords.length > 0 ? footerRegionWords : geometry.words);
        }
      }

      // 2. Line-based Header Extraction fallback/reinforcement
      const headerLines = page.lines.slice(0, Math.min(page.lines.length, 35));
      const headerText = headerLines.join('\n');

      if (!accountInfo.accountNumber) {
        for (const pattern of profile.accountNoPatterns) {
          const match = headerText.match(pattern);
          if (match && match[1]) {
            accountInfo.accountNumber = match[1].replace(/[\s\-]/g, '');
            break;
          }
        }
      }

      if (!accountInfo.accountHolderName) {
        for (const pattern of profile.namePatterns) {
          const match = headerText.match(pattern);
          if (match && match[1]) {
            const cleanName = match[1].replace(/[\r\n]/g, ' ').trim();
            if (!this.isInvalidCustomerName(cleanName)) {
              accountInfo.accountHolderName = cleanName;
              break;
            }
          }
        }
      }

      // 3. Fallback: Search top address lines on Page 1 for customer name
      if (!accountInfo.accountHolderName && page.pageNumber === 1) {
        for (let i = 0; i < Math.min(headerLines.length, 25); i++) {
          const line = headerLines[i].trim();
          // Remove prefixes like "To:", "Name:", "Customer:", "M/s", "Mr.", "Mrs.", "Smt.", "Ms.", "Shri"
          const cleanLine = line
            .replace(/^(?:to\s*:?|customer\s*:?|customer\s+name\s*:?|name\s*:?|holder\s*:?|account\s+holder\s*:?|a\/c\s+holder\s*:?)\s*/i, '')
            .replace(/^(?:mr\.|mrs\.|ms\.|smt\.|sh\.|shri|dr\.|md\.|m\/s\.?)\s+/i, '')
            .trim();

          if (
            /^[A-Z][a-zA-Z\.]+(?:\s+[A-Z][a-zA-Z\.]+){1,4}$/.test(cleanLine) ||
            /^[A-Z\.]+(?:\s+[A-Z\.]+){1,4}$/.test(cleanLine)
          ) {
            if (!this.isInvalidCustomerName(cleanLine)) {
              accountInfo.accountHolderName = cleanLine;
              break;
            }
          }
        }
      }

      if (!accountInfo.ifsc) {
        const ifscMatch = headerText.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/i);
        if (ifscMatch) {
          accountInfo.ifsc = ifscMatch[1].toUpperCase();
        }
      }

      if (!accountInfo.micr) {
        const micrMatch = headerText.match(/(?:micr(?:\s*code)?|micr)\s*[:\-]?\s*(\d{9})\b/i);
        if (micrMatch) {
          accountInfo.micr = micrMatch[1];
        }
      }

      if (!accountInfo.accountType) {
        if (/\b(savings|saving\s+account|sb\s+a\/c)\b/i.test(headerText)) {
          accountInfo.accountType = 'SAVINGS';
        } else if (/\b(current\s+account|ca\s+a\/c)\b/i.test(headerText)) {
          accountInfo.accountType = 'CURRENT';
        } else if (/\b(checking|checking\s+account)\b/i.test(headerText)) {
          accountInfo.accountType = 'CHECKING';
        } else if (/\b(overdraft|od\s+a\/c)\b/i.test(headerText)) {
          accountInfo.accountType = 'OVERDRAFT';
        }
      }

      if (!accountInfo.startDate || !accountInfo.endDate) {
        for (const pattern of profile.periodPatterns) {
          const match = headerText.match(pattern);
          if (match && match[1] && match[2]) {
            accountInfo.startDate = match[1].trim();
            accountInfo.endDate = match[2].trim();
            break;
          }
        }
      }

      if (detectedOpeningBalance === undefined) {
        for (const pattern of profile.openingBalancePatterns) {
          const match = headerText.match(pattern);
          if (match && match[1]) {
            detectedOpeningBalance = AmountResolver.normalizeAmount(match[1]);
            break;
          }
        }
      }
    }

    // Check last page footer for explicit closing balance if not yet found
    if (detectedClosingBalance === undefined && pages.length > 0) {
      const lastPage = pages[pages.length - 1];
      const footerLines = lastPage.lines.slice(Math.max(0, lastPage.lines.length - 30));
      const footerText = footerLines.join('\n');

      for (const pattern of profile.closingBalancePatterns) {
        const match = footerText.match(pattern);
        if (match && match[1]) {
          detectedClosingBalance = AmountResolver.normalizeAmount(match[1]);
          break;
        }
      }
    }

    if (accountInfo.accountNumber) headerConfidence += 0.05;
    if (accountInfo.accountHolderName) headerConfidence += 0.05;
    if (accountInfo.ifsc) headerConfidence += 0.05;

    logger.info({
      requestId,
      stage: 'LAYOUT_REGION_EXTRACTION_COMPLETED',
      bankName: accountInfo.bankName,
      accountNumber: accountInfo.accountNumber ? 'XXXX' + accountInfo.accountNumber.slice(-4) : undefined,
      holder: accountInfo.accountHolderName,
      ifsc: accountInfo.ifsc,
      openingBalance: detectedOpeningBalance,
      closingBalance: detectedClosingBalance,
    });

    return {
      accountInfo,
      detectedOpeningBalance,
      detectedClosingBalance,
      headerConfidence: Math.min(1.0, headerConfidence),
    };
  }

  /**
   * Spatial field extraction using word bounding boxes in the header zone
   */
  private static extractSpatialHeaderFields(
    words: SpatialWordToken[],
    accountInfo: ExtractedAccountInfo,
    profile: BankProfile
  ): void {
    if (words.length === 0) return;

    // Sort words by Y (top to bottom), then X (left to right)
    words.sort((a, b) => a.bbox.y0 === b.bbox.y0 ? a.bbox.x0 - b.bbox.x0 : a.bbox.y0 - b.bbox.y0);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // 1. Account Number Label
      if (!accountInfo.accountNumber && this.ACCT_LABEL_REGEX.test(word.text)) {
        const valueWords = this.findHorizontalValueWords(words, i, 4);
        const candidate = valueWords.map((w) => w.text).join('').replace(/[:\-]/g, '').trim();
        const acctMatch = candidate.match(/([A-Z0-9]{6,34})/i);
        if (acctMatch && !/statement|account|customer|period/i.test(acctMatch[1])) {
          accountInfo.accountNumber = acctMatch[1];
        }
      }

      // 2. IFSC Label
      if (!accountInfo.ifsc && this.IFSC_LABEL_REGEX.test(word.text)) {
        const valueWords = this.findHorizontalValueWords(words, i, 2);
        const candidate = valueWords.map((w) => w.text).join(' ').replace(/[:\-]/g, '').trim();
        const ifscMatch = candidate.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/i);
        if (ifscMatch) {
          accountInfo.ifsc = ifscMatch[1].toUpperCase();
        }
      }

      // 3. Customer Name Label
      if (!accountInfo.accountHolderName && this.NAME_LABEL_REGEX.test(word.text)) {
        const valueWords = this.findHorizontalValueWords(words, i, 4);
        const candidate = valueWords
          .map((w) => w.text)
          .join(' ')
          .replace(/[:\-]/g, '')
          .trim();
        if (
          candidate.length >= 3 &&
          !this.isInvalidCustomerName(candidate)
        ) {
          accountInfo.accountHolderName = candidate;
        }
      }
    }
  }

  /**
   * Finds words located on the same horizontal line immediately to the right of target word
   */
  private static findHorizontalValueWords(
    words: SpatialWordToken[],
    targetIndex: number,
    maxCount: number = 4
  ): SpatialWordToken[] {
    const target = words[targetIndex];
    const results: SpatialWordToken[] = [];
    const targetYCenter = (target.bbox.y0 + target.bbox.y1) / 2;
    const targetHeight = Math.max(8, target.bbox.y1 - target.bbox.y0);

    for (let j = 0; j < words.length; j++) {
      if (j === targetIndex) continue;
      const w = words[j];

      // Must be to the right of the target word
      if (w.bbox.x0 >= target.bbox.x1 - 2 && w.bbox.x0 <= target.bbox.x1 + 350) {
        const wYCenter = (w.bbox.y0 + w.bbox.y1) / 2;
        // Check vertical alignment tolerance (within ~8-12pt)
        if (Math.abs(wYCenter - targetYCenter) <= targetHeight * 0.85) {
          results.push(w);
          if (results.length >= maxCount) break;
        }
      }
    }

    results.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    return results;
  }

  /**
   * Extracts opening balance from spatial header words
   */
  private static extractSpatialOpeningBalance(words: SpatialWordToken[]): number | undefined {
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (this.OPEN_BAL_LABEL_REGEX.test(w.text)) {
        const valueWords = this.findHorizontalValueWords(words, i, 3);
        const valStr = valueWords.map((v) => v.text).join(' ');
        const amt = AmountResolver.normalizeAmount(valStr);
        if (amt > 0) return amt;
      }
    }
    return undefined;
  }

  /**
   * Extracts closing balance from spatial footer words
   */
  private static extractSpatialClosingBalance(words: SpatialWordToken[]): number | undefined {
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (this.CLOSE_BAL_LABEL_REGEX.test(w.text)) {
        const valueWords = this.findHorizontalValueWords(words, i, 3);
        const valStr = valueWords.map((v) => v.text).join(' ');
        const amt = AmountResolver.normalizeAmount(valStr);
        if (amt > 0) return amt;
      }
    }
    return undefined;
  }
}
