import { describe, it, expect } from 'vitest';
import { StatementAnalyzerService } from '../backend/services/StatementAnalyzerService';
import { ClassificationResult } from '../backend/types/statement';

describe('StatementAnalyzerService Resilience', () => {
  const sampleClassification: ClassificationResult = {
    type: 'BANK_STATEMENT',
    confidence: 0.95,
    totalScore: 95,
    detectedBank: 'Axis Bank',
    detectedAccountNumber: 'XXXXXXXXXXX9843',
    detectedIfsc: 'UTIB0002491',
    detectedPeriod: { startDate: '2025-09-21', endDate: '2026-09-20' },
    matchedSignals: ['Bank Identity', 'Account Number', 'Ledger'],
    negativeMatches: [],
    reasons: [],
    breakdown: {
      bankIdentity: 20,
      accountInfo: 20,
      statementPeriod: 15,
      transactionTable: 25,
      financialColumns: 15,
      bankingKeywords: 5,
      negativePenalties: 0,
    },
  };

  const sampleExtraction = {
    account: {
      bankName: 'Axis Bank',
      accountHolderName: 'MR. RAJAT KUMAR SHARMA',
      accountNumber: 'XXXXXXXXXXX9843',
      ifsc: 'UTIB0002491',
    },
    transactions: [],
    openingBalance: 12749.56,
    closingBalance: 14846.77,
    totalCredits: 16643101.27,
    totalDebits: 16629309.75,
    netCashFlow: 13791.52,
  };

  it('should run built-in statement analyzer and return rich analytical response', async () => {
    const result = await StatementAnalyzerService.analyzeStatement(
      sampleExtraction,
      sampleClassification,
      'REQ-ANL-01'
    );

    expect(result.document.type).toBe('BANK_STATEMENT');
    expect(result.document.bankName).toBe('Axis Bank');
    expect(result.summary.closingBalance).toBe(14846.77);
    expect(result.analytics).toBeDefined();
    expect(result.analytics.consumer.base.subject.kpi).toBeDefined();
    expect(result.analytics.consumer.fraudIndicators.length).toBeGreaterThan(0);
    expect(result.analytics.consumer.cashFlow.monthlyAnalysis.length).toBeGreaterThan(0);
  });
});
