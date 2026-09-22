import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import {
  ApiErrorResponse,
  ApiSuccessResponse,
  StatementErrorCode,
  StatementMetadata,
} from '../types/statement';
import { FileValidationService } from '../services/FileValidationService';
import { PdfValidationService } from '../services/PdfValidationService';
import { PdfTextExtractionService } from '../services/PdfTextExtractionService';
import { BankStatementClassifier } from '../services/BankStatementClassifier';
import { StatementExtractionService } from '../services/StatementExtractionService';
import { StatementResultValidator } from '../services/StatementResultValidator';
import { StatementAnalyzerService } from '../services/StatementAnalyzerService';
import { StatementRepository } from '../services/StatementRepository';
import { logger, maskAccountNumber } from '../utils/logger';

export class StatementUploadController {
  public static async analyzeUpload(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = (req.headers['x-correlation-id'] as string) || `STA-${Date.now()}`;
    const documentId = uuidv4();
    let tempFilePath: string | undefined;

    try {
      logger.info({
        requestId,
        stage: 'REQUEST_RECEIVED',
        message: 'New bank statement analysis upload received',
      });

      // Support single file or array of files from multer upload.any()
      let file: Express.Multer.File | undefined = req.file;
      if (!file && req.files && Array.isArray(req.files) && req.files.length > 0) {
        file = req.files[0];
      }

      // 1. File existence validation
      if (!file) {
        res.status(400).json({
          success: false,
          requestId,
          error: {
            code: StatementErrorCode.EMPTY_FILE,
            message: 'No file was uploaded. Please select a bank statement PDF.',
          },
        } as ApiErrorResponse);
        return;
      }

      // 2. File Security & Magic Bytes Validation
      const fileValidation = FileValidationService.validateBuffer(
        file.buffer,
        file.originalname,
        requestId
      );
      tempFilePath = fileValidation.tempFilePath;

      if (!fileValidation.isValid) {
        const statusCode =
          fileValidation.errorCode === StatementErrorCode.FILE_TOO_LARGE
            ? 413
            : fileValidation.errorCode === StatementErrorCode.INVALID_FILE_TYPE
              ? 415
              : 400;

        res.status(statusCode).json({
          success: false,
          requestId,
          error: {
            code: fileValidation.errorCode || StatementErrorCode.INVALID_PDF,
            message: fileValidation.errorMessage || 'Invalid file uploaded.',
          },
        } as ApiErrorResponse);
        return;
      }

      // 3. PDF Integrity & Password-Protection Validation
      const pdfValidation = await PdfValidationService.validatePdf(file.buffer, requestId);
      if (!pdfValidation.isValid) {
        const statusCode = 422;
        res.status(statusCode).json({
          success: false,
          requestId,
          error: {
            code: pdfValidation.errorCode || StatementErrorCode.CORRUPTED_PDF,
            message:
              pdfValidation.errorMessage ||
              'Unable to parse PDF. Please upload a valid bank statement PDF.',
          },
        } as ApiErrorResponse);
        return;
      }

      // 4. PDF Text Extraction (with Scanned / OCR Fallback)
      const extractedContent = await PdfTextExtractionService.extractText(file.buffer, requestId);
      if (extractedContent.isUnreadable) {
        logger.warn({
          requestId,
          stage: 'TEXT_EXTRACTION_UNREADABLE',
          message: 'Extracted PDF text is insufficient and OCR did not yield readable text',
        });

        res.status(422).json({
          success: false,
          requestId,
          error: {
            code: StatementErrorCode.NO_READABLE_CONTENT,
            message: 'We couldn\'t read the contents of this PDF. Please upload a clear bank statement PDF.',
          },
        } as ApiErrorResponse);
        return;
      }

      // 5. Bank Statement Classification
      const classification = BankStatementClassifier.classifyDocument(
        extractedContent.text,
        requestId
      );

      const nativePages = extractedContent.pages.filter((p) => p.extractionMethod === 'NATIVE');
      const ocrPages = extractedContent.pages.filter((p) => p.extractionMethod === 'OCR');
      const nativeTextLength = nativePages.reduce((sum, p) => sum + p.rawText.length, 0);
      const ocrTextLength = ocrPages.reduce((sum, p) => sum + p.rawText.length, 0);

      logger.info({
        requestId,
        stage: 'STATEMENT_ANALYSIS_PROGRESS',
        pdfValid: pdfValidation.isValid,
        pageCount: extractedContent.pagesCount,
        nativeTextLength,
        ocrTriggered: extractedContent.ocrApplied,
        ocrPages: ocrPages.length,
        ocrTextLength,
        combinedTextLength: extractedContent.text.length,
        detectedBank: classification.detectedBank || 'Unknown Bank',
        classifierScore: classification.totalScore,
        tableScore: classification.breakdown.transactionTable,
        negativePenalty: classification.breakdown.negativePenalties,
        documentType: classification.type,
      });

      if (classification.type === 'NOT_BANK_STATEMENT') {
        const rejectionReason = classification.reasons.join('; ') || 'Document lacks critical bank identification or transaction ledger.';
        logger.warn({
          requestId,
          stage: 'STATEMENT_REJECTED',
          documentType: classification.type,
          rejectionReason,
          classifierScore: classification.totalScore,
          negativePenalty: classification.breakdown.negativePenalties,
          matchedSignals: classification.matchedSignals,
          negativeMatches: classification.negativeMatches,
        });

        const metadata: StatementMetadata = {
          documentId,
          requestId,
          originalFilename: fileValidation.sanitizedFilename,
          fileSizeBytes: file.size,
          classification: classification.type,
          confidence: classification.confidence,
          processingStatus: 'REJECTED',
          errorCode: StatementErrorCode.NOT_BANK_STATEMENT,
          createdAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          processingDurationMs: Date.now() - startTime,
        };
        await StatementRepository.save(metadata);

        res.status(422).json({
          success: false,
          requestId,
          error: {
            code: StatementErrorCode.NOT_BANK_STATEMENT,
            message:
              'This PDF does not appear to be a bank statement. Please upload a valid bank statement PDF.',
          },
        } as ApiErrorResponse);
        return;
      }

      if (classification.type === 'UNCERTAIN') {
        const rejectionReason = classification.reasons.join('; ') || 'Document contains ambiguous signals.';
        logger.warn({
          requestId,
          stage: 'STATEMENT_REJECTED',
          documentType: classification.type,
          rejectionReason,
          classifierScore: classification.totalScore,
        });

        const metadata: StatementMetadata = {
          documentId,
          requestId,
          originalFilename: fileValidation.sanitizedFilename,
          fileSizeBytes: file.size,
          classification: classification.type,
          confidence: classification.confidence,
          processingStatus: 'REJECTED',
          errorCode: StatementErrorCode.UNCERTAIN_DOCUMENT,
          createdAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          processingDurationMs: Date.now() - startTime,
        };
        await StatementRepository.save(metadata);

        res.status(422).json({
          success: false,
          requestId,
          error: {
            code: StatementErrorCode.UNCERTAIN_DOCUMENT,
            message:
              'We couldn\'t confidently identify this document as a bank statement. Please upload a clear bank statement PDF.',
          },
        } as ApiErrorResponse);
        return;
      }

      if (classification.type === 'UNREADABLE') {
        res.status(422).json({
          success: false,
          requestId,
          error: {
            code: StatementErrorCode.NO_READABLE_CONTENT,
            message: 'We couldn\'t read the contents of this PDF. Please upload a clear bank statement PDF.',
          },
        } as ApiErrorResponse);
        return;
      }

      // 6. Statement Extraction & Result Validation
      const extraction = StatementExtractionService.extractStatementData(
        extractedContent.text,
        extractedContent.lines,
        requestId,
        extractedContent.pages
      );

      const validation = StatementResultValidator.validate(extraction, requestId);
      if (!validation.isValid) {
        logger.warn({
          requestId,
          stage: 'EXTRACTION_VALIDATION_FAILED',
          errors: validation.errors,
        });
        res.status(422).json({
          success: false,
          requestId,
          error: {
            code: StatementErrorCode.BANK_STATEMENT_PARSE_FAILED,
            message:
              'We couldn\'t extract valid statement transactions. Please upload a clearer bank statement PDF.',
          },
        } as ApiErrorResponse);
        return;
      }

      // 7. Statement Analysis Execution
      const analysisResult = await StatementAnalyzerService.analyzeStatement(
        extraction,
        classification,
        requestId
      );

      // 8. Save Metadata
      const metadata: StatementMetadata = {
        documentId,
        requestId,
        originalFilename: fileValidation.sanitizedFilename,
        fileSizeBytes: file.size,
        classification: classification.type,
        confidence: classification.confidence,
        detectedBank: classification.detectedBank || extraction.account.bankName,
        maskedAccountNumber: maskAccountNumber(
          classification.detectedAccountNumber || extraction.account.accountNumber
        ),
        statementPeriod:
          classification.detectedPeriod?.startDate && classification.detectedPeriod?.endDate
            ? `${classification.detectedPeriod.startDate} to ${classification.detectedPeriod.endDate}`
            : undefined,
        processingStatus: 'SUCCESS',
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        processingDurationMs: Date.now() - startTime,
      };

      await StatementRepository.save(metadata);

      // 9. Response
      const response: ApiSuccessResponse<any> = {
        success: true,
        message: 'Bank statement analyzed successfully',
        requestId,
        data: {
          documentType: 'BANK_STATEMENT',
          confidence: classification.confidence,
          bank: {
            name: extraction.account.bankName || classification.detectedBank || 'Bank Statement',
            confidence: classification.confidence,
            ifsc: extraction.account.ifsc || classification.detectedIfsc,
            branch: extraction.account.branchName,
          },
          account: {
            number: extraction.account.accountNumber || classification.detectedAccountNumber,
            holderName: extraction.account.accountHolderName,
            type: extraction.account.accountType,
            maskedNumber: maskAccountNumber(
              extraction.account.accountNumber || classification.detectedAccountNumber
            ),
            ifsc: extraction.account.ifsc || classification.detectedIfsc,
            micr: extraction.account.micr,
            iban: extraction.account.iban,
            routingNumber: extraction.account.routingNumber,
          },
          statementPeriod: {
            startDate: extraction.account.startDate || classification.detectedPeriod?.startDate,
            endDate: extraction.account.endDate || classification.detectedPeriod?.endDate,
          },
          summary: {
            openingBalance: extraction.openingBalance,
            closingBalance: extraction.closingBalance,
            statedClosingBalance: extraction.closingBalance,
            calculatedClosingBalance:
              extraction.reconciliation?.calculatedClosingBalance ??
              validation.balanceIntegrity.calculatedClosingBalance,
            balanceDifference:
              extraction.reconciliation?.balanceDifference ??
              validation.balanceIntegrity.balanceDifference,
            balanceContinuityVerified:
              extraction.reconciliation?.balanceContinuityVerified ??
              validation.balanceIntegrity.balanceContinuityVerified,
            totalCredits: extraction.totalCredits,
            totalDebits: extraction.totalDebits,
            totalTransactions: extraction.transactions.length,
            netCashFlow: extraction.netCashFlow,
          },
          transactions: extraction.transactions,
          monthlyCashFlow:
            analysisResult.analytics?.consumer?.cashFlow?.monthlyAnalysis ||
            analysisResult.analytics?.monthlyCashFlow ||
            [],
          categories:
            analysisResult.analytics?.consumer?.cashFlow?.periodAnalysis?.expensesByCategory ||
            analysisResult.analytics?.categories ||
            [],
          fraudRules:
            analysisResult.analytics?.consumer?.fraudIndicators?.[0]?.rules ||
            analysisResult.analytics?.fraudRules ||
            [],
          riskProfile:
            analysisResult.analytics?.consumer?.risk ||
            analysisResult.analytics?.riskProfile ||
            {},
          extraction: {
            totalPages: extractedContent.pagesCount,
            nativeTextPages: extractedContent.extractionMetadata?.nativeTextPages ?? extractedContent.pages.filter((p) => p.extractionMethod === 'NATIVE').length,
            structuralTextPages: 0,
            ocrPages: extractedContent.extractionMetadata?.ocrPages ?? extractedContent.pages.filter((p) => p.extractionMethod === 'OCR').length,
            hybridPages: extractedContent.extractionMetadata?.hybridPages ?? (extractedContent.isScanned && extractedContent.pages.some((p) => p.extractionMethod === 'NATIVE') ? extractedContent.pagesCount : 0),
            failedPages: extractedContent.extractionMetadata?.failedPages ?? 0,
            extractionConfidence: classification.confidence,
            averageOCRConfidence: extractedContent.extractionMetadata?.averageOCRConfidence ?? 0,
            extractionWarnings: extractedContent.extractionMetadata?.extractionWarnings ?? extraction.extractionInfo?.parseWarnings ?? [],
            pagesProcessed: extractedContent.pagesCount,
            pagesWithText: extractedContent.extractionMetadata?.pagesWithText ?? extractedContent.pagesCount,
            pagesWithOCR: extractedContent.extractionMetadata?.pagesWithOCR ?? (extractedContent.ocrApplied ? 1 : 0),
            transactionsExtracted: extraction.transactions.length,
            parseWarnings: extraction.extractionInfo?.parseWarnings || [],
          },
          reconciliation: extraction.reconciliation || extraction.diagnostics,
          diagnostics: extraction.reconciliation || extraction.diagnostics,
          classification: {
            type: classification.type,
            confidence: classification.confidence,
            detectedBank: classification.detectedBank,
            breakdown: classification.breakdown,
            matchedSignals: classification.matchedSignals,
          },
          metadata,
          validation: validation.balanceIntegrity,
          analysis: analysisResult,
        },
      };

      res.status(200).json(response);
    } catch (err: any) {
      next(err);
    } finally {
      // 10. Guaranteed cleanup in finally block
      await FileValidationService.cleanupTempFile(tempFilePath);
    }
  }

  public static async getHistory(req: Request, res: Response): Promise<void> {
    const list = await StatementRepository.list(30);
    res.json({
      success: true,
      data: list,
    });
  }
}
