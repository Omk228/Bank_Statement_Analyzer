import { describe, it, expect } from 'vitest';
import { NormalizedPageModel } from '../backend/types/statement';
import { AmountResolver } from '../backend/services/parsers/AmountResolver';
import { TransactionNormalizer } from '../backend/services/parsers/TransactionNormalizer';
import { TransactionStateMachineParser } from '../backend/services/parsers/TransactionStateMachineParser';
import { AxisStatementParser } from '../backend/services/parsers/AxisStatementParser';
import { BankStatementClassifier } from '../backend/services/BankStatementClassifier';
import { StatementExtractionService } from '../backend/services/StatementExtractionService';

describe('Axis Bank Multi-Line Statement Extraction & Parser Suite', () => {
  it('AmountResolver correctly extracts monetary tokens and excludes Init. Br branch codes', () => {
    // Test branch code exclusion
    const res1 = AmountResolver.extractAmountsFromLine('16758.00 16807.13 4378');
    expect(res1.amounts).toEqual([16758.0, 16807.13]);
    expect(res1.initBr).toBe('4378');

    const res2 = AmountResolver.extractAmountsFromLine('40007.00 40162.69 248');
    expect(res2.amounts).toEqual([40007.0, 40162.69]);
    expect(res2.initBr).toBe('248');

    const res3 = AmountResolver.extractAmountsFromLine('15500.00 15500.57 100');
    expect(res3.amounts).toEqual([15500.0, 15500.57]);
    expect(res3.initBr).toBe('100');

    // Test mathematical continuity resolution
    // Starting balance 49.13 + deposit 16758.00 = 16807.13
    const finCredit = AmountResolver.resolveFinancials([16758.0, 16807.13], 49.13);
    expect(finCredit.type).toBe('CREDIT');
    expect(finCredit.balanceContinuity).toBe(true);
    expect(finCredit.amount).toBe(16758.0);
    expect(finCredit.balance).toBe(16807.13);

    // Starting balance 11801.23 - payment 25.00 = 11776.23
    const finDebit = AmountResolver.resolveFinancials([25.0, 11776.23], 11801.23);
    expect(finDebit.type).toBe('DEBIT');
    expect(finDebit.balanceContinuity).toBe(true);
    expect(finDebit.amount).toBe(25.0);
    expect(finDebit.balance).toBe(11776.23);
  });

  it('TransactionNormalizer merges broken words and multiline narrations cleanly', () => {
    const lines = [
      'IMPS/P2A/607717366683/IdfFinan/IDFCBank/Pa',
      'ymentd/9198452472199751001',
    ];
    const merged = TransactionNormalizer.mergeNarrationLines(lines);
    expect(merged).toBe('IMPS/P2A/607717366683/IdfFinan/IDFCBank/Paymentd/9198452472199751001');

    const neftLines = [
      'NEFT/YESIG60970213984/KALIMATA',
      'VYAPAAR/YES BANK/KVPL070426-3',
      'SALARY MAR 26 YE',
    ];
    const mergedNeft = TransactionNormalizer.mergeNarrationLines(neftLines);
    expect(mergedNeft).toContain('KALIMATA VYAPAAR/YES BANK/KVPL070426-3 SALARY MAR 26 YE');
  });

  it('Parses full multiline Axis Bank statement with IMPS, UPI, CASH DEP, and SALARY', () => {
    const rawLines = [
      'Statement of Axis Account No: 925010049111575',
      'Customer Name: MR. RAJAT KUMAR SHARMA',
      'IFSC Code: UTIB0004378',
      'Statement Period: 18-03-2026 to 17-09-2026',
      'OPENING BALANCE: 49.13',
      'Tran Date Chq No Particulars Debit Credit Balance Init. Br',
      '',
      '18-03-2026',
      'IMPS/P2A/607717366683/IdfFinan/IDFCBank/Pa',
      'ymentd/9198452472199751001',
      '',
      '16758.00 16807.13 4378',
      '',
      '18-03-2026',
      'UPI/P2M/644329448132/REKHA SHAW',
      '/UPI/YES BANK LIMITED YBS 25.00 16782.13 4378',
      '',
      '27-03-2026',
      'SELF CASH DEP',
      'BNA/DPRH487201/6809/270326/NARAYAN',
      '',
      '15500.00 32282.13 4378',
      '',
      '07-04-2026',
      'NEFT/YESIG60970213984/KALIMATA',
      'VYAPAAR/YES BANK/KVPL070426-3',
      'SALARY MAR 26 YE',
      '',
      '40007.00 72289.13 248',
    ];

    const fullText = rawLines.join('\n');
    const pageModel: NormalizedPageModel = {
      pageNumber: 1,
      rawText: fullText,
      lines: rawLines,
      normalizedLines: rawLines,
      detectedTransactions: [],
    };

    const extraction = StatementExtractionService.extractStatementData(
      fullText,
      rawLines,
      'TEST-AXIS-01',
      [pageModel]
    );

    expect(extraction.account.bankName).toBe('Axis Bank');
    expect(extraction.account.accountNumber).toBe('925010049111575');
    expect(extraction.account.ifsc).toBe('UTIB0004378');
    expect(extraction.account.openingBalance).toBe(49.13);
    expect(extraction.openingBalance).toBe(49.13);
    expect(extraction.closingBalance).toBe(72289.13);

    expect(extraction.transactions.length).toBe(4);

    // Transaction 1: IMPS Credit
    const txn1 = extraction.transactions[0];
    expect(txn1.date).toBe('18-03-2026');
    expect(txn1.type).toBe('CREDIT');
    expect(txn1.amount).toBe(16758.0);
    expect(txn1.balance).toBe(16807.13);
    expect(txn1.initBr).toBe('4378');
    expect(txn1.mode).toBe('IMPS');
    expect(txn1.balanceContinuity).toBe(true);
    expect(txn1.description).toContain('Paymentd');

    // Transaction 2: UPI Debit
    const txn2 = extraction.transactions[1];
    expect(txn2.date).toBe('18-03-2026');
    expect(txn2.type).toBe('DEBIT');
    expect(txn2.amount).toBe(25.0);
    expect(txn2.balance).toBe(16782.13);
    expect(txn2.mode).toBe('UPI');
    expect(txn2.balanceContinuity).toBe(true);

    // Transaction 3: Cash Deposit Credit
    const txn3 = extraction.transactions[2];
    expect(txn3.date).toBe('27-03-2026');
    expect(txn3.type).toBe('CREDIT');
    expect(txn3.amount).toBe(15500.0);
    expect(txn3.balance).toBe(32282.13);
    expect(txn3.balanceContinuity).toBe(true);

    // Transaction 4: Salary NEFT Credit
    const txn4 = extraction.transactions[3];
    expect(txn4.date).toBe('07-04-2026');
    expect(txn4.type).toBe('CREDIT');
    expect(txn4.amount).toBe(40007.0);
    expect(txn4.balance).toBe(72289.13);
    expect(txn4.initBr).toBe('248');
    expect(txn4.mode).toBe('NEFT');
    expect(txn4.balanceContinuity).toBe(true);
  });

  it('Maintains transaction state across 32 pages and handles page boundary continuation', () => {
    // Simulate 32 pages
    const pages: NormalizedPageModel[] = [];

    // Page 1: Header + Txn 1 (starts and ends on Page 1) + Txn 2 (starts on Page 1, ends on Page 2)
    pages.push({
      pageNumber: 1,
      rawText: '',
      lines: [
        'Statement of Axis Account No: 925010049111575',
        'Customer Name: MR. RAJAT KUMAR SHARMA',
        'IFSC Code: UTIB0004378',
        'OPENING BALANCE: 1000.00',
        'Tran Date Chq No Particulars Debit Credit Balance Init. Br',
        '18-03-2026',
        'UPI/P2M/644329448132/STORE PURCHASE',
        '500.00 500.00 4378',
        '19-03-2026',
        'IMPS/P2A/607717366683/MULTILINE PAGE',
        'CONTINUATION PART 1',
      ],
      normalizedLines: [],
      detectedTransactions: [],
    });

    // Page 2: Continuation of Txn 2 + Txn 3
    pages.push({
      pageNumber: 2,
      rawText: '',
      lines: [
        'Page 2 of 32',
        'Statement of Axis Account No: 925010049111575',
        'Tran Date Chq No Particulars Debit Credit Balance Init. Br',
        'CONTINUATION PART 2 FINAL',
        '1500.00 2000.00 4378',
        '20-03-2026',
        'ATM CASH WITHDRAWAL 500.00 1500.00 4378',
      ],
      normalizedLines: [],
      detectedTransactions: [],
    });

    // Pages 3 to 32
    for (let p = 3; p <= 32; p++) {
      pages.push({
        pageNumber: p,
        rawText: '',
        lines: [
          `Page ${p} of 32`,
          'Statement of Axis Account No: 925010049111575',
          'Tran Date Chq No Particulars Debit Credit Balance Init. Br',
          `21-03-2026`,
          `MONTHLY EXPENSE TXN PAGE ${p}`,
          `10.00 ${1500 - (p - 2) * 10}.00 4378`,
        ],
        normalizedLines: [],
        detectedTransactions: [],
      });
    }

    const fullText = pages.map((p) => p.lines.join('\n')).join('\n');
    const result = AxisStatementParser.parseStatement(fullText, pages, 'TEST-32-PAGES');

    expect(result.ledger.pagesProcessed).toBe(32);
    // 1 (p1) + 1 (cont p1-p2) + 1 (p2) + 30 (p3..p32) = 33 transactions
    expect(result.ledger.transactions.length).toBe(33);

    // Verify page boundary continuation transaction
    const contTxn = result.ledger.transactions[1];
    expect(contTxn.date).toBe('19-03-2026');
    expect(contTxn.description).toContain('CONTINUATION PART 1');
    expect(contTxn.description).toContain('CONTINUATION PART 2 FINAL');
    expect(contTxn.type).toBe('CREDIT');
    expect(contTxn.amount).toBe(1500.0);
    expect(contTxn.balance).toBe(2000.0);

    // Verify classification
    const classification = BankStatementClassifier.classifyDocument(fullText, 'TEST-CLASSIFY');
    expect(classification.type).toBe('BANK_STATEMENT');
    expect(classification.detectedBank).toBe('Axis Bank');
    expect(classification.confidence).toBeGreaterThanOrEqual(0.8);
  });
});
