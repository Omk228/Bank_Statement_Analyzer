import { config } from '../config';
import {
  ClassificationResult,
  ClassificationSignalBreakdown,
  DocumentClassificationType,
} from '../types/statement';
import { logger } from '../utils/logger';

export class BankStatementClassifier {
  // Known Bank Names (Indian, Global, Regional & Digital)
  private static readonly BANK_PATTERNS: { name: string; regex: RegExp }[] = [
    // Major Indian Private & Public Banks
    { name: 'State Bank of India', regex: /\b(state\s+bank\s+of\s+india|sbi\b|sb\s+india|sbi\s+card)\b/i },
    { name: 'HDFC Bank', regex: /\b(hdfc\s+bank|hdfc\s+bank\s+ltd|hdfc\b)\b/i },
    { name: 'ICICI Bank', regex: /\b(icici\s+bank|icici\s+bank\s+limited|icici\b)\b/i },
    { name: 'Axis Bank', regex: /\b(axis\s+bank|axis\s+bank\s+ltd|uti\s+bank|axis\b)\b/i },
    { name: 'Kotak Mahindra Bank', regex: /\b(kotak\s+mahindra\s+bank|kotak\s+bank|kotak\b)\b/i },
    { name: 'Punjab National Bank', regex: /\b(punjab\s+national\s+bank|pnb\b)\b/i },
    { name: 'Bank of Baroda', regex: /\b(bank\s+of\s+baroda|bob\b|baroda\s+bank)\b/i },
    { name: 'Canara Bank', regex: /\b(canara\s+bank|canara\b)\b/i },
    { name: 'Union Bank of India', regex: /\b(union\s+bank\s+of\s+india|union\s+bank|ubi\b)\b/i },
    { name: 'IndusInd Bank', regex: /\b(indusind\s+bank|indusind\b)\b/i },
    { name: 'IDFC FIRST Bank', regex: /\b(idfc\s+first\s+bank|idfc\s+bank|idfc\b)\b/i },
    { name: 'Yes Bank', regex: /\b(yes\s+bank|yes\s+bank\s+ltd|yesbank)\b/i },
    { name: 'Bank of India', regex: /\b(bank\s+of\s+india|boi\b)\b/i },
    { name: 'Central Bank of India', regex: /\b(central\s+bank\s+of\s+india|cbi\b)\b/i },
    { name: 'Indian Overseas Bank', regex: /\b(indian\s+overseas\s+bank|iob\b)\b/i },
    { name: 'Indian Bank', regex: /\b(indian\s+bank)\b/i },
    { name: 'UCO Bank', regex: /\b(uco\s+bank|uco\b)\b/i },
    { name: 'Punjab & Sind Bank', regex: /\b(punjab\s*(&|\s+and\s+)\s*sind\s+bank|psb\b)\b/i },
    { name: 'Federal Bank', regex: /\b(federal\s+bank|federal\b)\b/i },
    { name: 'RBL Bank', regex: /\b(rbl\s+bank|ratnakar\s+bank|rbl\b)\b/i },
    { name: 'Bandhan Bank', regex: /\b(bandhan\s+bank|bandhan\b)\b/i },
    { name: 'AU Small Finance Bank', regex: /\b(au\s+small\s+finance\s+bank|au\s+bank|aubank)\b/i },
    { name: 'Equitas Small Finance Bank', regex: /\b(equitas\s+small\s+finance\s+bank|equitas\s+bank|equitas)\b/i },
    { name: 'Ujjivan Small Finance Bank', regex: /\b(ujjivan\s+small\s+finance\s+bank|ujjivan\s+bank|ujjivan)\b/i },
    { name: 'South Indian Bank', regex: /\b(south\s+indian\s+bank|sib\b)\b/i },
    { name: 'City Union Bank', regex: /\b(city\s+union\s+bank|cub\b)\b/i },
    { name: 'Karur Vysya Bank', regex: /\b(karur\s+vysya\s+bank|kvb\b)\b/i },
    { name: 'Karnataka Bank', regex: /\b(karnataka\s+bank)\b/i },
    { name: 'Jammu & Kashmir Bank', regex: /\b(jammu\s*(&|\s+and\s+)\s*kashmir\s+bank|j&k\s+bank|jk\s+bank)\b/i },
    { name: 'Paytm Payments Bank', regex: /\b(paytm\s+payments\s+bank|paytm\s+bank)\b/i },
    { name: 'Airtel Payments Bank', regex: /\b(airtel\s+payments\s+bank)\b/i },
    { name: 'India Post Payments Bank', regex: /\b(india\s+post\s+payments\s+bank|ippb\b)\b/i },
    { name: 'Saraswat Bank', regex: /\b(saraswat\s+co-operative\s+bank|saraswat\s+bank)\b/i },
    { name: 'Cosmos Bank', regex: /\b(cosmos\s+co-operative\s+bank|cosmos\s+bank)\b/i },
    { name: 'SVC Bank', regex: /\b(svc\s+co-operative\s+bank|svc\s+bank|shamrao\s+vithal)\b/i },
    { name: 'TJSB Bank', regex: /\b(tjsb\s+co-operative\s+bank|tjsb\s+bank)\b/i },
    { name: 'DBS Bank', regex: /\b(dbs\s+bank|dbs\b)\b/i },
    { name: 'Standard Chartered', regex: /\b(standard\s+chartered(\s+bank)?|stan\s+chart)\b/i },
    { name: 'HSBC Bank', regex: /\b(hsbc(\s+bank)?)\b/i },
    { name: 'Citibank', regex: /\b(citibank|citi\s+bank|citi\b)\b/i },
    { name: 'Barclays', regex: /\b(barclays(\s+bank)?)\b/i },
    { name: 'Chase Bank', regex: /\b(chase\s+bank|jpmorgan\s+chase|chase\b)\b/i },
    { name: 'Bank of America', regex: /\b(bank\s+of\s+america|bofa\b)\b/i },
    { name: 'Wells Fargo', regex: /\b(wells\s+fargo(\s+bank)?)\b/i },
  ];

  // Negative Indicators (Documents that are strictly NOT bank statements)
  private static readonly NEGATIVE_PATTERNS: { name: string; regex: RegExp; penalty: number }[] = [
    // Aadhaar Document
    {
      name: 'Aadhaar Card / UIDAI Document',
      regex: /(unique\s+identification\s+authority\s+of\s+india|uidai|mera\s+aadhaar|aadhaar\s+number|enrollment\s+no|vid\s*:\s*\d{4})/i,
      penalty: 70,
    },
    // PAN Card / Tax Document
    {
      name: 'PAN Card / Income Tax Filing',
      regex: /(income\s+tax\s+department|govt\.\s+of\s+india|permanent\s+account\s+number\s+card|form\s+26as|tax\s+deducted\s+at\s+source\s+certificate)/i,
      penalty: 65,
    },
    // Salary Slip / Payslip (Check for actual slip headers rather than simple word in transaction)
    {
      name: 'Salary Slip / Payslip',
      regex: /\b(payslip|pay\s+slip|salary\s+slip|earnings\s+and\s+deductions|basic\s+pay|provident\s+fund\s+deduction|gross\s+earnings|net\s+pay\s+in\s+words)\b/i,
      penalty: 60,
    },
    // Tax Invoice / Commercial Invoice
    {
      name: 'Tax Invoice / Commercial Bill',
      regex: /\b(tax\s+invoice|commercial\s+invoice|bill\s+to\s*:|ship\s+to\s*:|buyer\s*\(bill\s+to\)|invoice\s+value|proforma\s+invoice)\b/i,
      penalty: 60,
    },
    // Loan Sanction Letter / Loan Agreement
    {
      name: 'Loan Agreement / Sanction Letter',
      regex: /\b(sanction\s+letter|loan\s+sanction|facility\s+agreement|term\s+loan\s+agreement|borrower\s+details|disbursal\s+schedule|terms\s+of\s+sanction)\b/i,
      penalty: 55,
    },
    // Utility Bill
    {
      name: 'Utility Bill (Electricity/Water/Gas)',
      regex: /\b(electricity\s+bill|power\s+distribution|consumer\s+number|meter\s+reading|tariff\s+category|units\s+consumed|connected\s+load)\b/i,
      penalty: 60,
    },
    // Insurance Policy
    {
      name: 'Insurance Policy Document',
      regex: /\b(insurance\s+policy|policy\s+schedule|sum\s+insured|sum\s+assured|premium\s+receipt|period\s+of\s+insurance|proposer\s+name)\b/i,
      penalty: 60,
    },
    // Academic Marksheet / Certificate
    {
      name: 'Academic Document / Marksheet',
      regex: /\b(marksheet|semester\s+examination|roll\s+number|credits\s+earned|controller\s+of\s+examinations|degree\s+certificate)\b/i,
      penalty: 70,
    },
  ];

  public static classifyDocument(text: string, requestId: string): ClassificationResult {
    const cleanText = (text || '').trim();

    // 1. If text is unreadable or empty
    if (cleanText.length < config.classification.minTextLength) {
      logger.warn({
        requestId,
        stage: 'CLASSIFIER',
        message: `Extracted text length ${cleanText.length} is unreadable`,
      });
      return {
        type: 'UNREADABLE',
        confidence: 0,
        totalScore: 0,
        matchedSignals: [],
        negativeMatches: [],
        reasons: ['Extracted text is empty or insufficient to determine document identity.'],
        breakdown: {
          bankIdentity: 0,
          accountInfo: 0,
          statementPeriod: 0,
          transactionTable: 0,
          financialColumns: 0,
          bankingKeywords: 0,
          negativePenalties: 0,
        },
      };
    }

    const matchedSignals: string[] = [];
    const negativeMatches: string[] = [];
    const reasons: string[] = [];

    let detectedBank: string | undefined;
    let detectedAccountNumber: string | undefined;
    let detectedIfsc: string | undefined;
    let detectedPeriod: { startDate?: string; endDate?: string } | undefined;

    // Signal 1: Bank Identity (+20 max) - Earliest occurrence priority (Header priority)
    let bankScore = 0;
    let earliestPos = Infinity;

    for (const bank of this.BANK_PATTERNS) {
      const match = bank.regex.exec(cleanText);
      if (match && match.index < earliestPos) {
        earliestPos = match.index;
        detectedBank = bank.name;
      }
    }

    if (detectedBank) {
      bankScore = config.classification.weights.bankIdentity;
      matchedSignals.push(`Detected Bank: ${detectedBank}`);
    } else {
      if (/\b(bank|banking|branch|co-operative\s+bank|gramin\s+bank|financial\s+services)\b/i.test(cleanText)) {
        bankScore = Math.floor(config.classification.weights.bankIdentity * 0.6);
        matchedSignals.push('Generic Bank keyword present');
      } else if (/\b(account\s+statement|statement\s+of\s+account|e-statement|account\s+summary)\b/i.test(cleanText)) {
        bankScore = Math.floor(config.classification.weights.bankIdentity * 0.5);
        matchedSignals.push('Account Statement keyword present');
      }
    }

    // Signal 2: Account info / IFSC / Customer ID / Routing (+20 max)
    let accountScore = 0;
    const ifscMatch = cleanText.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
    if (ifscMatch) {
      detectedIfsc = ifscMatch[1];
      accountScore += 10;
      matchedSignals.push(`IFSC detected: ${detectedIfsc}`);
    } else if (/\b(ifsc|micr|branch\s*code|sort\s*code|routing\s*no|iban|swift|bsb)\b/i.test(cleanText)) {
      accountScore += 6;
      matchedSignals.push('Branch / Routing identifier present');
    }

    const accountNoMatch = cleanText.match(
      /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no|account\s*id)\s*[:\-]?\s*([X\d]{5,24})/i
    );
    if (accountNoMatch) {
      detectedAccountNumber = accountNoMatch[1];
      accountScore += 10;
      matchedSignals.push('Account number field detected');
    } else if (/\b(savings\s+account|current\s+account|cif\s+no|customer\s+id|account\s+holder|a\/c)\b/i.test(cleanText)) {
      accountScore += 7;
      matchedSignals.push('Account type / Customer ID keywords detected');
    }
    accountScore = Math.min(accountScore, config.classification.weights.accountInfo);

    // Signal 3: Statement Period & Dates (+15 max)
    let periodScore = 0;
    const periodMatch = cleanText.match(
      /(?:statement\s+period|period\s+from|from\s+date|txn\s+period|statement\s+from|period|date\s+range|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i
    );
    if (periodMatch) {
      detectedPeriod = { startDate: periodMatch[1].trim(), endDate: periodMatch[2].trim() };
      periodScore = config.classification.weights.statementPeriod;
      matchedSignals.push(`Statement Period detected: ${periodMatch[1]} to ${periodMatch[2]}`);
    } else if (
      /(?:statement|period|date|summary|transactions)\b/i.test(cleanText) &&
      /\b\d{1,2}[\/\-\.\s](?:\d{1,2}|[a-zA-Z]{3,9})[\/\-\.\s]\d{2,4}\b/.test(cleanText)
    ) {
      periodScore = Math.floor(config.classification.weights.statementPeriod * 0.8);
      matchedSignals.push('Statement date context present');
    }

    // Signal 4: Transaction table structure (+25 max)
    let tableScore = 0;
    // Count recurring date patterns followed by numerical values (ledger rows)
    const dateRowMatches = cleanText.match(
      /\b\d{1,2}[\/\-\.](?:\d{1,2}|[a-zA-Z]{3})[\/\-\.]\d{2,4}\b[^\n\r]{3,100}\b\d+(?:\.\d{2})?\b/g
    );
    const dateRowCount = dateRowMatches ? dateRowMatches.length : 0;

    // Robust token-based column header detection (supporting both single-line and multiline table layouts)
    const hasDateCol = /\b(date|txn\s*date|value\s*date|posting\s*date|booking\s*date)\b/i.test(cleanText);
    const hasDescCol = /\b(narration|particulars|description|details|remarks|transaction\s*details)\b/i.test(cleanText);
    const hasAmountCol = /\b(withdrawal|debit|deposit|credit|dr\b|cr\b|amount|chq\s*\/|ref\s*no)\b/i.test(cleanText);
    const hasBalanceCol = /\b(balance|bal\b|closing\s*bal|running\s*bal)\b/i.test(cleanText);

    const hasTableColumns = hasDateCol && hasDescCol && (hasAmountCol || hasBalanceCol);

    if (hasTableColumns && dateRowCount >= 3) {
      tableScore = config.classification.weights.transactionTable;
      matchedSignals.push(`Full Transaction Table structure verified (${dateRowCount} rows detected)`);
    } else if (hasTableColumns || dateRowCount >= 4) {
      tableScore = Math.floor(config.classification.weights.transactionTable * 0.8);
      matchedSignals.push(`Transaction ledger rows & columns detected (${dateRowCount} rows)`);
    } else if (dateRowCount >= 1 || (hasDateCol && hasBalanceCol)) {
      tableScore = Math.floor(config.classification.weights.transactionTable * 0.5);
      matchedSignals.push('Basic transaction ledger elements present');
    }

    // Signal 5: Financial columns: Debit/Credit/Balance (+15 max)
    let financialScore = 0;
    const hasOpeningClosing =
      /(?:opening\s+balance|closing\s+balance|clear\s+balance|book\s+balance|b\/f|c\/f|available\s+balance|total\s+balance)/i.test(cleanText);
    const hasDebitCredit =
      /(?:debit|withdrawal|dr\b)/i.test(cleanText) || /(?:credit|deposit|cr\b)/i.test(cleanText);
    const hasBalance = /(?:balance|bal\b)/i.test(cleanText);

    if (hasOpeningClosing) {
      financialScore += 6;
      matchedSignals.push('Opening/Closing balance detected');
    }
    if (hasDebitCredit) {
      financialScore += 6;
      matchedSignals.push('Debit and Credit transaction markers detected');
    }
    if (hasBalance) {
      financialScore += 3;
      matchedSignals.push('Running balance detected');
    }
    financialScore = Math.min(financialScore, config.classification.weights.financialColumns);

    // Signal 6: Banking payment keywords (+5 max)
    let bankingKeywordScore = 0;
    const bankingKeywords = [
      'UPI',
      'NEFT',
      'IMPS',
      'RTGS',
      'ACH',
      'NACH',
      'ECS',
      'ATM',
      'POS',
      'CHQ',
      'CHEQUE',
      'REV-UPI',
      'TRANSFER',
      'BBPS',
      'DEPOSIT',
      'WITHDRAWAL',
      'INTEREST',
    ];
    let matchedKwCount = 0;
    for (const kw of bankingKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(cleanText)) {
        matchedKwCount++;
      }
    }
    if (matchedKwCount >= 2) {
      bankingKeywordScore = config.classification.weights.bankingKeywords;
      matchedSignals.push(`Banking payment identifiers found (${matchedKwCount} modes: UPI/NEFT/IMPS/etc.)`);
    } else if (matchedKwCount >= 1) {
      bankingKeywordScore = Math.floor(config.classification.weights.bankingKeywords * 0.6);
      matchedSignals.push(`Banking payment identifier found (${matchedKwCount} mode)`);
    }

    // Negative Penalty Checks (Aadhaar, PAN, Payslips, Invoices, Loan Agreements)
    let totalNegativePenalty = 0;
    const hasStrongBankingLedger =
      tableScore >= 15 &&
      financialScore >= 9 &&
      (bankScore >= 10 || accountScore >= 7 || matchedKwCount >= 2);

    for (const neg of this.NEGATIVE_PATTERNS) {
      if (neg.regex.test(cleanText)) {
        // If document has verified banking ledger structure, ignore false positives from
        // transaction narrations / bank service fee line items (Salary credits, invoice payments, utility bills, insurance premiums, bank GST notices)
        if (hasStrongBankingLedger) {
          if (
            neg.name.includes('Salary') ||
            neg.name.includes('Invoice') ||
            neg.name.includes('Utility') ||
            neg.name.includes('Insurance') ||
            neg.name.includes('Loan') ||
            neg.name.includes('Academic')
          ) {
            continue;
          }
        }

        negativeMatches.push(neg.name);
        totalNegativePenalty += neg.penalty;
        reasons.push(`Detected characteristics of non-bank document: ${neg.name}`);
      }
    }

    // Total Score Calculation
    const positiveScore =
      bankScore + accountScore + periodScore + tableScore + financialScore + bankingKeywordScore;
    const rawTotalScore = positiveScore - totalNegativePenalty;
    const totalScore = Math.max(0, Math.min(100, Math.round(rawTotalScore)));
    const confidence = totalScore / 100;

    const breakdown: ClassificationSignalBreakdown = {
      bankIdentity: bankScore,
      accountInfo: accountScore,
      statementPeriod: periodScore,
      transactionTable: tableScore,
      financialColumns: financialScore,
      bankingKeywords: bankingKeywordScore,
      negativePenalties: totalNegativePenalty,
    };

    // Classification Decision Policy
    let type: DocumentClassificationType;

    if (totalNegativePenalty >= 50 || (totalNegativePenalty > 0 && totalScore < config.classification.uncertainThreshold)) {
      type = 'NOT_BANK_STATEMENT';
      reasons.push(
        'Document content does not match bank statement structure or contains conflicting document patterns.'
      );
    } else if (totalScore >= config.classification.statementThreshold || (totalNegativePenalty === 0 && tableScore >= 15 && (financialScore >= 6 || bankScore >= 10 || accountScore >= 7))) {
      type = 'BANK_STATEMENT';
      reasons.push('Verified bank statement structure with account details and ledger table.');
    } else if (totalScore >= config.classification.uncertainThreshold) {
      type = 'UNCERTAIN';
      reasons.push('Document contains some banking references but insufficient evidence for full verification.');
    } else {
      type = 'NOT_BANK_STATEMENT';
      reasons.push('Document lacks critical bank identification, account number, or transaction ledger.');
    }

    logger.info({
      requestId,
      stage: 'CLASSIFICATION_COMPLETED',
      classification: type,
      confidence,
      totalScore,
      detectedBank,
      signalsCount: matchedSignals.length,
      negativeCount: negativeMatches.length,
    });

    return {
      type,
      confidence,
      totalScore,
      detectedBank,
      detectedAccountNumber,
      detectedIfsc,
      detectedPeriod,
      matchedSignals,
      negativeMatches,
      reasons,
      breakdown,
    };
  }
}
