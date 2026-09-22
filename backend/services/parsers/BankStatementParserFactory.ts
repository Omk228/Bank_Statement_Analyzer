import { ExtractedAccountInfo, NormalizedPageModel } from '../../types/statement';
import { AxisStatementParser } from './AxisStatementParser';
import { GenericIndianBankParser } from './GenericIndianBankParser';
import { ParseStatementLedgerResult } from './TransactionStateMachineParser';
import { logger } from '../../utils/logger';

export class BankStatementParserFactory {
  public static parse(
    fullText: string,
    pages: NormalizedPageModel[],
    requestId: string
  ): { account: ExtractedAccountInfo; ledger: ParseStatementLedgerResult } {
    const isAxis = /\b(axis\s+bank|uti\s+bank|axis\b)/i.test(fullText.substring(0, 1500)) ||
      /\bUTIB[0-9]{7}\b/i.test(fullText) ||
      /statement\s+of\s+axis\s+account/i.test(fullText);

    if (isAxis) {
      logger.info({
        requestId,
        stage: 'PARSER_ROUTING',
        message: 'Routing statement extraction to AxisStatementParser',
      });
      return AxisStatementParser.parseStatement(fullText, pages, requestId);
    }

    logger.info({
      requestId,
      stage: 'PARSER_ROUTING',
      message: 'Routing statement extraction to GenericIndianBankParser',
    });
    return GenericIndianBankParser.parseStatement(fullText, pages, requestId);
  }
}
