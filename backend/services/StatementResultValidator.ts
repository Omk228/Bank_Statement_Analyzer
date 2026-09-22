import { config } from '../config';
import { ExtractionValidationResult } from '../types/statement';
import { ExtractionResult } from './StatementExtractionService';
import { logger } from '../utils/logger';

export class StatementResultValidator {
  public static validate(
    extraction: ExtractionResult,
    requestId: string
  ): ExtractionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Transaction count check
    if (extraction.transactions.length === 0) {
      warnings.push('No individual transaction lines were identified from the statement.');
    }

    // 2. Validate transaction fields (dates, amounts)
    for (let i = 0; i < extraction.transactions.length; i++) {
      const txn = extraction.transactions[i];

      // Check amount validity
      if (isNaN(txn.amount) || !isFinite(txn.amount) || txn.amount < 0) {
        errors.push(`Transaction #${i + 1} has invalid amount: ${txn.amount}`);
      }

      // Check balance validity if present
      if (txn.balance !== undefined && (isNaN(txn.balance) || !isFinite(txn.balance))) {
        errors.push(`Transaction #${i + 1} has invalid balance value`);
      }
    }

    // 3. Balance mathematical consistency check
    const { openingBalance, closingBalance, totalCredits, totalDebits } = extraction;

    const statedClosingBalance = closingBalance ?? 0;
    const calculatedClosingBalance =
      openingBalance !== undefined
        ? Math.round((openingBalance + totalCredits - totalDebits) * 100) / 100
        : statedClosingBalance;

    const balanceDifference = Math.round(Math.abs(calculatedClosingBalance - statedClosingBalance) * 100) / 100;
    const balanceContinuityVerified = balanceDifference <= 0.01;
    const isConsistent = balanceContinuityVerified;

    if (openingBalance !== undefined && closingBalance !== undefined && !balanceContinuityVerified) {
      warnings.push(
        `Balance discrepancy detected: Stated closing balance is ${statedClosingBalance}, calculated closing balance is ${calculatedClosingBalance} (Difference: ${balanceDifference.toFixed(
          2
        )}). Tolerance is 0.01.`
      );
    }

    const isValid = errors.length === 0;

    logger.info({
      requestId,
      stage: 'VALIDATION_COMPLETED',
      isValid,
      errorsCount: errors.length,
      warningsCount: warnings.length,
      isConsistent,
      discrepancy: balanceDifference,
      balanceDifference,
      balanceContinuityVerified,
    });

    return {
      isValid,
      errors,
      warnings,
      balanceIntegrity: {
        isConsistent,
        balanceContinuityVerified,
        calculatedClosingBalance,
        statedClosingBalance,
        balanceDifference,
        discrepancy: balanceDifference,
      },
    };
  }
}
