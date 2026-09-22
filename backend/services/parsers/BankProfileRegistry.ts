export interface BankProfile {
  bankName: string;
  aliases: string[];
  ifscPrefixes: string[];
  accountNoPatterns: RegExp[];
  namePatterns: RegExp[];
  periodPatterns: RegExp[];
  openingBalancePatterns: RegExp[];
  closingBalancePatterns: RegExp[];
  tableHeaders?: string[];
  debitKeywords?: string[];
  creditKeywords?: string[];
  balanceKeywords?: string[];
}

export const KotakBankProfile: BankProfile = {
  bankName: 'Kotak Mahindra Bank',
  aliases: ['Kotak', 'Kotak Mahindra Bank', 'Kotak Mahindra', 'KKBK'],
  ifscPrefixes: ['KKBK'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|crn\s*no|account)\s*[:\-]?\s*([X\d]{9,20})/i,
    /\b(69\d{8})\b/, // Common 10-digit Kotak account number
    /\b(\d{10,16})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|account\s*holder|name\s*of\s*account\s*holder|account\s*title|holder\s*name)\s*[:\-]?\s*([A-Za-z\s\.]{3,40}?)(?=\s{2,}|IFSC|Account|Cust|Joint|Branch|CRN|\n|\r|$)/i,
    /(?:m\/s|mr\.|mrs\.|ms\.)\s+([A-Za-z\s\.]{3,35})/i,
  ],
  periodPatterns: [
    /(?:statement\s+(?:period|for\s+the\s+period)|period\s+from|from\s+date|txn\s+period|period|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
    /(?:statement\s+period|period)\s*[:\-]?\s*(\d{1,2}\s+[a-zA-Z]{3,9}\s+\d{4})\s*(?:to|-)\s*(\d{1,2}\s+[a-zA-Z]{3,9}\s+\d{4})/i,
    /(\d{1,2}[\/\-\.\s][a-zA-Z]{3,9}[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s][a-zA-Z]{3,9}[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal|balance\s+b\/f)\s*[:=\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal|balance\s+c\/f|effective\s+available\s+balance)\s*[:=\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  tableHeaders: [
    '# Date Description Chq/Ref. No. Withdrawal (Dr.) Deposit (Cr.) Balance',
    'Date Description Chq/Ref. No. Withdrawal Deposit Balance',
    'Date Narration Withdrawal Deposit Balance',
  ],
  debitKeywords: ['Withdrawal', 'Withdrawal (Dr.)', 'Dr.', 'Debit'],
  creditKeywords: ['Deposit', 'Deposit (Cr.)', 'Cr.', 'Credit'],
  balanceKeywords: ['Balance', 'Closing Balance', 'Running Balance'],
};

export const AxisBankProfile: BankProfile = {
  bankName: 'Axis Bank',
  aliases: ['Axis Bank', 'UTI Bank', 'Axis', 'UTIB'],
  ifscPrefixes: ['UTIB'],
  accountNoPatterns: [
    /(?:statement\s+of\s+axis\s+account\s*no|axis\s+account\s*no|account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i,
    /\b(9\d{14})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder)\s*[:\-]\s*([A-Za-z\s\.]{3,40}?)(?=\s{2,}|IFSC|Account|Cust|Joint|Branch|\n|\r|$)/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|txn\s+period|period)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal|balance\s+b\/f)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal|balance\s+c\/f)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  tableHeaders: ['Tran Date Chq No Particulars Debit Credit Balance Init. Br'],
};

export const HDFCBankProfile: BankProfile = {
  bankName: 'HDFC Bank',
  aliases: ['HDFC Bank', 'HDFC'],
  ifscPrefixes: ['HDFC'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i,
    /\b(50\d{12})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const ICICIBankProfile: BankProfile = {
  bankName: 'ICICI Bank',
  aliases: ['ICICI Bank', 'ICICI'],
  ifscPrefixes: ['ICIC'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i,
    /\b(\d{12})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const SBIBankProfile: BankProfile = {
  bankName: 'State Bank of India',
  aliases: ['State Bank of India', 'SBI'],
  ifscPrefixes: ['SBIN'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i,
    /\b(\d{11})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const PNBBankProfile: BankProfile = {
  bankName: 'Punjab National Bank',
  aliases: ['Punjab National Bank', 'PNB'],
  ifscPrefixes: ['PUNB'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{13,18})/i,
    /\b(\d{16})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const BOBBankProfile: BankProfile = {
  bankName: 'Bank of Baroda',
  aliases: ['Bank of Baroda', 'BOB', 'Baroda Bank'],
  ifscPrefixes: ['BARB'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i,
    /\b(\d{14})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const CanaraBankProfile: BankProfile = {
  bankName: 'Canara Bank',
  aliases: ['Canara Bank', 'Canara'],
  ifscPrefixes: ['CNRB'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i,
    /\b(\d{13})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const UnionBankProfile: BankProfile = {
  bankName: 'Union Bank of India',
  aliases: ['Union Bank of India', 'Union Bank', 'UBI'],
  ifscPrefixes: ['UBIN'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i,
    /\b(\d{15})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const IDFCBankProfile: BankProfile = {
  bankName: 'IDFC FIRST Bank',
  aliases: ['IDFC FIRST Bank', 'IDFC Bank', 'IDFC'],
  ifscPrefixes: ['IDFB'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i,
    /\b(\d{10,12})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const IndusIndBankProfile: BankProfile = {
  bankName: 'IndusInd Bank',
  aliases: ['IndusInd Bank', 'IndusInd'],
  ifscPrefixes: ['INDB'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i,
    /\b(\d{12})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const YesBankProfile: BankProfile = {
  bankName: 'Yes Bank',
  aliases: ['Yes Bank', 'Yes Bank Ltd', 'YesBank', 'YESB'],
  ifscPrefixes: ['YESB'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i,
    /\b(\d{15})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const FederalBankProfile: BankProfile = {
  bankName: 'Federal Bank',
  aliases: ['Federal Bank', 'Federal'],
  ifscPrefixes: ['FDRL'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i,
    /\b(\d{14})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const RBLBankProfile: BankProfile = {
  bankName: 'RBL Bank',
  aliases: ['RBL Bank', 'Ratnakar Bank', 'RBL'],
  ifscPrefixes: ['RATN'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i,
    /\b(\d{12,16})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const AUBankProfile: BankProfile = {
  bankName: 'AU Small Finance Bank',
  aliases: ['AU Small Finance Bank', 'AU Bank', 'AUBANK'],
  ifscPrefixes: ['AUBL'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no)\s*[:\-]?\s*([X\d]{10,20})/i,
    /\b(\d{16})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|brought\s+forward|b\/f|open\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|carried\s+forward|c\/f|close\s+bal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const InternationalBankProfile: BankProfile = {
  bankName: 'International Bank',
  aliases: [
    'Chase',
    'JPMorgan Chase',
    'Bank of America',
    'Wells Fargo',
    'Barclays',
    'HSBC',
    'Citibank',
    'DBS Bank',
    'Standard Chartered',
  ],
  ifscPrefixes: ['SCBL', 'CITI', 'HSBC', 'BARC', 'DBSS', 'CHAS', 'BOFA'],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no|iban|account\s*id)\s*[:\-]?\s*([A-Z0-9]{6,34})/i,
    /\b([A-Z]{2}\d{2}[A-Z0-9]{11,30})\b/, // IBAN
    /\b(\d{8,18})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|account\s*title|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
    /(?:mr\.|mrs\.|ms\.|dr\.)\s+([A-Za-z\s\.]{3,35})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|statement\s+dates|period|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
    /(?:from)\s+([a-zA-Z]{3,9}\s+\d{1,2},?\s+\d{4})\s+(?:to)\s+([a-zA-Z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|beginning\s+balance|previous\s+balance|b\/f|open\s+bal)\s*[:\-]?\s*(?:USD|\$|EUR|€|GBP|£|CAD|AUD|SGD|AED|INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|ending\s+balance|balance\s+at\s+end|c\/f|close\s+bal)\s*[:\-]?\s*(?:USD|\$|EUR|€|GBP|£|CAD|AUD|SGD|AED|INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export const GenericBankProfile: BankProfile = {
  bankName: 'Bank Statement',
  aliases: ['Bank Statement', 'Account Statement', 'Statement of Account'],
  ifscPrefixes: [],
  accountNoPatterns: [
    /(?:account\s*(?:number|no|#|\.)|a\/c\s*(?:no|number|\.)|acct\s*no|account\s*id|a\/c\s*#|iban)\s*[:\-]?\s*([X\dA-Z]{6,34})/i,
    /\b([A-Z]{2}\d{2}[A-Z0-9]{11,30})\b/,
    /\b(\d{9,18})\b/,
  ],
  namePatterns: [
    /(?:customer\s*name|name\s*of\s*account\s*holder|account\s*holder|account\s*title|name)\s*[:\-]\s*([A-Za-z\s\.]{3,40})/i,
    /(?:mr\.|mrs\.|ms\.|dr\.)\s+([A-Za-z\s\.]{3,35})/i,
  ],
  periodPatterns: [
    /(?:statement\s+period|period\s+from|from\s+date|txn\s+period|period|from)\s*[:\-]?\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.\s](?:[a-zA-Z]{3,9}|\d{1,2})[\/\-\.\s]\d{2,4})/i,
    /(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s*(?:to|-)\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
    /([a-zA-Z]{3,9}\s+\d{1,2},?\s+\d{4})\s*(?:to|-)\s*([a-zA-Z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
  ],
  openingBalancePatterns: [
    /(?:opening\s+balance|beginning\s+balance|previous\s+balance|brought\s+forward|b\/f|open\s+bal|balance\s+b\/f)\s*[:=\-]?\s*(?:USD|\$|EUR|€|GBP|£|CAD|AUD|SGD|AED|INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
  closingBalancePatterns: [
    /(?:closing\s+balance|ending\s+balance|balance\s+at\s+end|carried\s+forward|c\/f|close\s+bal|balance\s+c\/f|effective\s+available\s+balance)\s*[:=\-]?\s*(?:USD|\$|EUR|€|GBP|£|CAD|AUD|SGD|AED|INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)/i,
  ],
};

export class BankProfileRegistry {
  private static readonly PROFILES: BankProfile[] = [
    KotakBankProfile,
    AxisBankProfile,
    HDFCBankProfile,
    ICICIBankProfile,
    SBIBankProfile,
    PNBBankProfile,
    BOBBankProfile,
    CanaraBankProfile,
    UnionBankProfile,
    IDFCBankProfile,
    IndusIndBankProfile,
    YesBankProfile,
    FederalBankProfile,
    RBLBankProfile,
    AUBankProfile,
    InternationalBankProfile,
  ];

  public static resolveProfile(text: string): BankProfile {
    const lower = text.toLowerCase();

    for (const profile of this.PROFILES) {
      // Check aliases
      for (const alias of profile.aliases) {
        if (new RegExp(`\\b${alias}\\b`, 'i').test(lower)) {
          return profile;
        }
      }

      // Check IFSC prefix
      for (const ifscPrefix of profile.ifscPrefixes) {
        if (new RegExp(`\\b${ifscPrefix}[0-9A-Z]{7}\\b`, 'i').test(text)) {
          return profile;
        }
      }
    }

    return GenericBankProfile;
  }
}
