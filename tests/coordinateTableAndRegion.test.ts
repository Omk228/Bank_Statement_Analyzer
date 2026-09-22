import { describe, it, expect } from 'vitest';
import { LayoutAwareRegionExtractor } from '../backend/services/parsers/LayoutAwareRegionExtractor';
import { CoordinateTableReconstructor } from '../backend/services/parsers/CoordinateTableReconstructor';
import { KotakBankProfile, GenericBankProfile } from '../backend/services/parsers/BankProfileRegistry';
import { NormalizedPageModel } from '../backend/types/statement';
import { PageGeometry, SpatialWordToken, SpatialLineToken } from '../backend/types/geometry';

describe('Layout-Aware Region Extractor & Coordinate Table Reconstructor', () => {
  it('should extract spatial key-value pairs from HEADER_REGION using horizontal word proximity', () => {
    const pageWords: SpatialWordToken[] = [
      // Bank Logo / Title
      { text: 'Kotak', bbox: { x0: 50, y0: 30, x1: 90, y1: 45 }, confidence: 95, pageNumber: 1 },
      { text: 'Mahindra', bbox: { x0: 95, y0: 30, x1: 155, y1: 45 }, confidence: 95, pageNumber: 1 },
      { text: 'Bank', bbox: { x0: 160, y0: 30, x1: 195, y1: 45 }, confidence: 95, pageNumber: 1 },

      // Account Holder Name Row
      { text: 'Customer', bbox: { x0: 50, y0: 70, x1: 110, y1: 82 }, confidence: 90, pageNumber: 1 },
      { text: 'Name:', bbox: { x0: 115, y0: 70, x1: 150, y1: 82 }, confidence: 90, pageNumber: 1 },
      { text: 'Rani', bbox: { x0: 160, y0: 70, x1: 190, y1: 82 }, confidence: 95, pageNumber: 1 },
      { text: 'Devi', bbox: { x0: 195, y0: 70, x1: 225, y1: 82 }, confidence: 95, pageNumber: 1 },

      // Account Number Row
      { text: 'Account', bbox: { x0: 50, y0: 95, x1: 100, y1: 107 }, confidence: 90, pageNumber: 1 },
      { text: 'Number:', bbox: { x0: 105, y0: 95, x1: 155, y1: 107 }, confidence: 90, pageNumber: 1 },
      { text: '6947759513', bbox: { x0: 165, y0: 95, x1: 245, y1: 107 }, confidence: 98, pageNumber: 1 },

      // IFSC Row
      { text: 'IFSC', bbox: { x0: 50, y0: 120, x1: 80, y1: 132 }, confidence: 90, pageNumber: 1 },
      { text: 'Code:', bbox: { x0: 85, y0: 120, x1: 120, y1: 132 }, confidence: 90, pageNumber: 1 },
      { text: 'KKBK0004587', bbox: { x0: 130, y0: 120, x1: 220, y1: 132 }, confidence: 98, pageNumber: 1 },

      // Opening Balance
      { text: 'Opening', bbox: { x0: 50, y0: 145, x1: 100, y1: 157 }, confidence: 90, pageNumber: 1 },
      { text: 'Balance:', bbox: { x0: 105, y0: 145, x1: 155, y1: 157 }, confidence: 90, pageNumber: 1 },
      { text: '50.64', bbox: { x0: 165, y0: 145, x1: 205, y1: 157 }, confidence: 98, pageNumber: 1 },
    ];

    const geometry: PageGeometry = {
      pageNumber: 1,
      width: 600,
      height: 800,
      words: pageWords,
      lines: [],
    };

    const mockPage: NormalizedPageModel = {
      pageNumber: 1,
      rawText: 'Kotak Mahindra Bank\nCustomer Name: Rani Devi\nAccount Number: 6947759513\nIFSC Code: KKBK0004587\nOpening Balance: 50.64',
      lines: [
        'Kotak Mahindra Bank',
        'Customer Name: Rani Devi',
        'Account Number: 6947759513',
        'IFSC Code: KKBK0004587',
        'Opening Balance: 50.64',
      ],
      normalizedLines: [],
      detectedTransactions: [],
      geometry,
    };

    const result = LayoutAwareRegionExtractor.extractRegions([mockPage], KotakBankProfile, 'TEST-REQ-01');

    expect(result.accountInfo.bankName).toBe('Kotak Mahindra Bank');
    expect(result.accountInfo.accountHolderName).toBe('Rani Devi');
    expect(result.accountInfo.accountNumber).toBe('6947759513');
    expect(result.accountInfo.ifsc).toBe('KKBK0004587');
    expect(result.detectedOpeningBalance).toBe(50.64);
  });

  it('should correctly reject branch names (e.g. Molar Band Badarpur Border) and extract Rani Devi from address block', () => {
    const mockPage: NormalizedPageModel = {
      pageNumber: 1,
      rawText: [
        'Kotak Mahindra Bank',
        'Molar Band Badarpur Border',
        'IFSC: KKBK0004587',
        'Rani Devi',
        'House No 45, Molar Band Extn',
        'Badarpur New Delhi 110044',
        'Account Number: 6947759513',
        'Period: 01 Aug 2026 to 31 Aug 2026',
        'Opening Balance: 50.64',
      ].join('\n'),
      lines: [
        'Kotak Mahindra Bank',
        'Molar Band Badarpur Border',
        'IFSC: KKBK0004587',
        'Rani Devi',
        'House No 45, Molar Band Extn',
        'Badarpur New Delhi 110044',
        'Account Number: 6947759513',
        'Period: 01 Aug 2026 to 31 Aug 2026',
        'Opening Balance: 50.64',
      ],
      normalizedLines: [],
      detectedTransactions: [],
      geometry: {
        pageNumber: 1,
        width: 600,
        height: 800,
        words: [],
        lines: [],
      },
    };

    const result = LayoutAwareRegionExtractor.extractRegions([mockPage], KotakBankProfile, 'TEST-REQ-03');

    expect(result.accountInfo.bankName).toBe('Kotak Mahindra Bank');
    expect(result.accountInfo.accountHolderName).toBe('Rani Devi');
    expect(result.accountInfo.accountNumber).toBe('6947759513');
    expect(result.accountInfo.ifsc).toBe('KKBK0004587');
    expect(result.accountInfo.startDate).toBe('01 Aug 2026');
    expect(result.accountInfo.endDate).toBe('31 Aug 2026');
  });

  it('should reconstruct multiline transactions using coordinate-aware column bins', () => {
    // Columns: Date (x: 50), Description (x: 150), Ref (x: 300), Withdrawal/Dr (x: 380), Deposit/Cr (x: 460), Balance (x: 540)
    const tableWords: SpatialWordToken[] = [
      // Table Header Row at Y: 200
      { text: 'Date', bbox: { x0: 50, y0: 200, x1: 80, y1: 212 }, confidence: 95, pageNumber: 1 },
      { text: 'Particulars', bbox: { x0: 150, y0: 200, x1: 210, y1: 212 }, confidence: 95, pageNumber: 1 },
      { text: 'Chq/Ref', bbox: { x0: 300, y0: 200, x1: 345, y1: 212 }, confidence: 95, pageNumber: 1 },
      { text: 'Withdrawal', bbox: { x0: 380, y0: 200, x1: 440, y1: 212 }, confidence: 95, pageNumber: 1 },
      { text: 'Deposit', bbox: { x0: 460, y0: 200, x1: 500, y1: 212 }, confidence: 95, pageNumber: 1 },
      { text: 'Balance', bbox: { x0: 540, y0: 200, x1: 580, y1: 212 }, confidence: 95, pageNumber: 1 },

      // Transaction 1 (Row 1): Date + Description + Ref + Deposit + Balance at Y: 240
      { text: '01/08/2026', bbox: { x0: 50, y0: 240, x1: 110, y1: 252 }, confidence: 98, pageNumber: 1 },
      { text: 'UPI/P2A/12345/SALARY', bbox: { x0: 150, y0: 240, x1: 270, y1: 252 }, confidence: 95, pageNumber: 1 },
      { text: 'REF9901', bbox: { x0: 300, y0: 240, x1: 345, y1: 252 }, confidence: 95, pageNumber: 1 },
      { text: '1,000.00', bbox: { x0: 460, y0: 240, x1: 510, y1: 252 }, confidence: 98, pageNumber: 1 },
      { text: '1,050.64', bbox: { x0: 540, y0: 240, x1: 585, y1: 252 }, confidence: 98, pageNumber: 1 },

      // Transaction 1 (Row 2): Wrapped Narration Line at Y: 255
      { text: 'MONTHLY SALARY CREDIT FROM CORP', bbox: { x0: 150, y0: 255, x1: 290, y1: 267 }, confidence: 95, pageNumber: 1 },

      // Transaction 2 (Row 1): Date + Description + Withdrawal + Balance at Y: 280
      { text: '05/08/2026', bbox: { x0: 50, y0: 280, x1: 110, y1: 292 }, confidence: 98, pageNumber: 1 },
      { text: 'UPI/STORE/MERCHANT', bbox: { x0: 150, y0: 280, x1: 260, y1: 292 }, confidence: 95, pageNumber: 1 },
      { text: '40.00', bbox: { x0: 380, y0: 280, x1: 415, y1: 292 }, confidence: 98, pageNumber: 1 },
      { text: '1,010.64', bbox: { x0: 540, y0: 280, x1: 585, y1: 292 }, confidence: 98, pageNumber: 1 },

      // Transaction 2 (Row 2): Wrapped Narration Line at Y: 295
      { text: 'GROCERY PURCHASE SECTOR 18', bbox: { x0: 150, y0: 295, x1: 280, y1: 307 }, confidence: 95, pageNumber: 1 },
    ];

    const geometry: PageGeometry = {
      pageNumber: 1,
      width: 600,
      height: 800,
      words: tableWords,
      lines: [],
    };

    const mockPage: NormalizedPageModel = {
      pageNumber: 1,
      rawText: 'Date Particulars Chq/Ref Withdrawal Deposit Balance\n01/08/2026 UPI/P2A/12345/SALARY REF9901 1000.00 1050.64\n05/08/2026 UPI/STORE/MERCHANT 40.00 1010.64',
      lines: [],
      normalizedLines: [],
      detectedTransactions: [],
      geometry,
    };

    const result = CoordinateTableReconstructor.reconstruct(
      [mockPage],
      50.64,
      1010.64,
      'TEST-REQ-02'
    );

    expect(result.transactions.length).toBe(2);

    // Transaction 1 check
    const txn1 = result.transactions[0];
    expect(txn1.date).toBe('01/08/2026');
    expect(txn1.type).toBe('CREDIT');
    expect(txn1.credit).toBe(1000.00);
    expect(txn1.balance).toBe(1050.64);
    expect(txn1.description).toContain('MONTHLY SALARY CREDIT FROM CORP');
    expect(txn1.balanceContinuity).toBe(true);

    // Transaction 2 check
    const txn2 = result.transactions[1];
    expect(txn2.date).toBe('05/08/2026');
    expect(txn2.type).toBe('DEBIT');
    expect(txn2.debit).toBe(40.00);
    expect(txn2.balance).toBe(1010.64);
    expect(txn2.description).toContain('GROCERY PURCHASE SECTOR 18');
    expect(txn2.balanceContinuity).toBe(true);

    // Reconciliation check
    expect(result.openingBalance).toBe(50.64);
    expect(result.closingBalance).toBe(1010.64);
    expect(result.totalCredits).toBe(1000.00);
    expect(result.totalDebits).toBe(40.00);
    expect(result.reconciliation.balanceContinuityVerified).toBe(true);
  });
});
