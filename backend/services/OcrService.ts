import { PDFDocument, PDFRawStream, PDFName, PDFDict } from 'pdf-lib';
import zlib from 'zlib';
import { createCanvas, Canvas } from '@napi-rs/canvas';
import { logger } from '../utils/logger';
import { PageGeometry, SpatialWordToken, SpatialLineToken } from '../types/geometry';

export interface OcrResult {
  success: boolean;
  text: string;
  confidence: number;
  lines: string[];
  error?: string;
}

export interface OcrPageResult {
  success: boolean;
  pageNumber: number;
  text: string;
  lines: string[];
  confidence: number;
  attemptCount: number;
  geometry?: PageGeometry;
  error?: string;
}

export class OcrService {
  /**
   * Preprocesses a canvas buffer with image enhancements for optimal OCR
   */
  private static preprocessCanvas(canvas: Canvas, mode: 'contrast' | 'binarize'): Buffer {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;

    if (mode === 'contrast') {
      // Grayscale + 1.3x Contrast Enhancement
      const contrast = 1.3;
      const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const enhanced = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
        d[i] = enhanced;
        d[i + 1] = enhanced;
        d[i + 2] = enhanced;
      }
    } else if (mode === 'binarize') {
      // Grayscale + Adaptive Threshold Binarization
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      }
      const avg = sum / (d.length / 4);
      const threshold = Math.max(120, Math.min(210, avg * 0.92));
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const val = gray < threshold ? 0 : 255;
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toBuffer('image/png');
  }

  /**
   * Renders a specific PDF page to an image buffer and runs OCR with retry strategies
   */
  public static async renderAndOcrPage(
    pdfBuffer: Buffer,
    pageNumber: number,
    requestId: string
  ): Promise<OcrPageResult> {
    logger.info({
      requestId,
      stage: 'OCR_STARTED',
      page: pageNumber,
      message: `Rasterizing and executing OCR on page ${pageNumber}`,
    });

    try {
      // Dynamically import pdfjs-dist and tesseract
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const Tesseract = await import('tesseract.js');

      // Load PDF via pdfjs-dist
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(pdfBuffer),
        disableFontFace: true,
        useSystemFonts: true,
      });
      const pdfDoc = await loadingTask.promise;

      if (pageNumber > pdfDoc.numPages || pageNumber < 1) {
        return {
          success: false,
          pageNumber,
          text: '',
          lines: [],
          confidence: 0,
          attemptCount: 0,
          error: `Page number ${pageNumber} out of range (1..${pdfDoc.numPages})`,
        };
      }

      const page = await pdfDoc.getPage(pageNumber);
      const scale = 2.2; // ~160-200 DPI for high fidelity table recognition
      const viewport = page.getViewport({ scale });

      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d');

      // Render page onto canvas
      await (page.render as any)({
        canvasContext: ctx,
        canvas,
        viewport,
      }).promise;

      // Initialize Tesseract worker with local lang data
      const worker = await Tesseract.createWorker('eng', 1, {
        langPath: '.',
        logger: () => {},
        errorHandler: () => {},
      });

      // Attempt 1: Grayscale + contrast enhancement
      const imgBufferAttempt1 = this.preprocessCanvas(canvas, 'contrast');
      const res1 = await worker.recognize(imgBufferAttempt1);
      const text1 = res1.data.text ? res1.data.text.trim() : '';
      const conf1 = res1.data.confidence || 0;

      let bestRes: any = res1;
      let bestText = text1;
      let bestConfidence = conf1;
      let attemptCount = 1;

      // Evaluate whether Attempt 2 (Binarization) is needed
      const hasBankKeywords = /\b(bank|account|statement|balance|credit|debit|deposit|withdrawal|kotak|axis|hdfc|icici|sbi)\b/i.test(
        text1
      );

      if (conf1 < 65 || text1.length < 50 || !hasBankKeywords) {
        logger.info({
          requestId,
          stage: 'OCR_RETRY',
          page: pageNumber,
          message: `Attempt 1 yielded low confidence (${conf1}) or sparse text (${text1.length} chars). Running Attempt 2 with binarization.`,
        });

        // Re-render and binarize
        const canvas2 = createCanvas(viewport.width, viewport.height);
        const ctx2 = canvas2.getContext('2d');
        await (page.render as any)({ canvasContext: ctx2, canvas: canvas2, viewport }).promise;

        const imgBufferAttempt2 = this.preprocessCanvas(canvas2, 'binarize');
        const res2 = await worker.recognize(imgBufferAttempt2);
        const text2 = res2.data.text ? res2.data.text.trim() : '';
        const conf2 = res2.data.confidence || 0;
        attemptCount = 2;

        if (conf2 > conf1 || text2.length > text1.length) {
          bestRes = res2;
          bestText = text2;
          bestConfidence = conf2;
        }
      }

      await worker.terminate();

      // Build Spatial tokens and PageGeometry
      const rawWords = (bestRes?.data?.words || []) as any[];
      const spatialWords: SpatialWordToken[] = rawWords
        .filter((w: any) => w.text && w.text.trim().length > 0)
        .map((w: any) => ({
          text: w.text.trim(),
          confidence: w.confidence || 0,
          pageNumber,
          bbox: {
            x0: w.bbox?.x0 ?? 0,
            y0: w.bbox?.y0 ?? 0,
            x1: w.bbox?.x1 ?? 0,
            y1: w.bbox?.y1 ?? 0,
          },
        }));

      const rawLines = (bestRes?.data?.lines || []) as any[];
      const spatialLines: SpatialLineToken[] = rawLines
        .filter((l: any) => l.text && l.text.trim().length > 0)
        .map((l: any) => ({
          text: l.text.trim(),
          pageNumber,
          bbox: {
            x0: l.bbox?.x0 ?? 0,
            y0: l.bbox?.y0 ?? 0,
            x1: l.bbox?.x1 ?? 0,
            y1: l.bbox?.y1 ?? 0,
          },
          words: (l.words || [])
            .filter((w: any) => w.text && w.text.trim().length > 0)
            .map((w: any) => ({
              text: w.text.trim(),
              confidence: w.confidence || 0,
              pageNumber,
              bbox: {
                x0: w.bbox?.x0 ?? 0,
                y0: w.bbox?.y0 ?? 0,
                x1: w.bbox?.x1 ?? 0,
                y1: w.bbox?.y1 ?? 0,
              },
            })),
        }));

      const geometry: PageGeometry = {
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        words: spatialWords,
        lines: spatialLines,
      };

      const lines = bestText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      logger.info({
        requestId,
        stage: 'OCR_COMPLETED',
        page: pageNumber,
        confidence: Math.round(bestConfidence * 10) / 10,
        textLength: bestText.length,
        linesCount: lines.length,
        wordsCount: spatialWords.length,
        attemptCount,
      });

      return {
        success: bestText.length > 0,
        pageNumber,
        text: bestText,
        lines,
        confidence: Math.round(bestConfidence * 10) / 10,
        attemptCount,
        geometry,
      };
    } catch (err: any) {
      logger.error({
        requestId,
        stage: 'OCR_FAILED',
        page: pageNumber,
        message: `OCR page rendering error: ${err.message}`,
      });

      return {
        success: false,
        pageNumber,
        text: '',
        lines: [],
        confidence: 0,
        attemptCount: 1,
        error: err.message,
      };
    }
  }

  /**
   * Legacy / Fallback OCR extraction for standalone image buffers
   */
  public static async extractTextFromBuffer(
    pdfOrImageBuffer: Buffer,
    requestId: string
  ): Promise<OcrResult> {
    const isPdf = pdfOrImageBuffer.subarray(0, 5).toString('ascii') === '%PDF-';
    if (isPdf) {
      const pageRes = await this.renderAndOcrPage(pdfOrImageBuffer, 1, requestId);
      return {
        success: pageRes.success,
        text: pageRes.text,
        confidence: pageRes.confidence,
        lines: pageRes.lines,
        error: pageRes.error,
      };
    }

    try {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng', 1, {
        langPath: '.',
        logger: () => {},
        errorHandler: () => {},
      });

      const ret = await worker.recognize(pdfOrImageBuffer);
      await worker.terminate();

      const text = ret.data.text ? ret.data.text.trim() : '';
      const confidence = ret.data.confidence || 0;
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

      return {
        success: text.length > 0,
        text,
        confidence,
        lines,
      };
    } catch (err: any) {
      return {
        success: false,
        text: '',
        confidence: 0,
        lines: [],
        error: err.message,
      };
    }
  }
}

