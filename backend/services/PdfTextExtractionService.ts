import pdfParse from 'pdf-parse';
import { PDFDocument, PDFRawStream, PDFName, PDFDict } from 'pdf-lib';
import zlib from 'zlib';
import { config } from '../config';
import { logger } from '../utils/logger';
import { OcrService } from './OcrService';
import { ExtractionMetadataInfo, NormalizedPageModel } from '../types/statement';
import { PageGeometry, SpatialWordToken, SpatialLineToken } from '../types/geometry';

export interface ExtractedPdfContent {
  text: string;
  pagesCount: number;
  lines: string[];
  pages: NormalizedPageModel[];
  isScanned: boolean;
  isUnreadable: boolean;
  ocrApplied: boolean;
  charCount: number;
  info?: any;
  extractionMetadata?: ExtractionMetadataInfo;
}

function decodePdfLiteralString(str: string): string {
  return str
    .replace(/\\([0-7]{1,3})/g, (_, oct) => {
      try {
        return String.fromCharCode(parseInt(oct, 8));
      } catch {
        return '';
      }
    })
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '')
    .replace(/\\f/g, '')
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\\r?\n/g, '');
}

function decodePdfHexString(hex: string): string {
  if (!hex || hex.length === 0) return '';
  const cleanHex = hex.replace(/\s+/g, '');

  // 1. Check for UTF-16BE (common in bank statement generators like Jasper, Crystal, Finacle)
  if (cleanHex.length >= 4 && cleanHex.length % 4 === 0 && cleanHex.startsWith('00')) {
    try {
      const buf = Buffer.from(cleanHex, 'hex');
      let result = '';
      for (let i = 0; i < buf.length; i += 2) {
        const charCode = buf.readUInt16BE(i);
        if (charCode >= 32 && charCode <= 126) {
          result += String.fromCharCode(charCode);
        } else if (charCode === 10 || charCode === 13 || charCode === 9) {
          result += ' ';
        }
      }
      if (result.trim().length > 0) return result;
    } catch {}
  }

  // 2. Standard ASCII / UTF-8
  try {
    const raw = Buffer.from(cleanHex, 'hex').toString('utf-8');
    const cleaned = raw.replace(/\0/g, '');
    if (/[a-zA-Z0-9]/.test(cleaned)) return cleaned;
  } catch {}

  return '';
}

function parseStreamText(streamContent: string): string {
  let result = '';

  // Extract from BT ... ET blocks
  const btBlocks = streamContent.match(/BT[\s\S]*?ET/g) || [streamContent];

  for (const block of btBlocks) {
    // 1. Literal strings with Tj, ', "
    const litMatches = block.matchAll(/\(([^)]*)\)\s*(?:Tj|'|")/g);
    for (const m of litMatches) {
      result += ' ' + decodePdfLiteralString(m[1]);
    }

    // 2. Hex strings with Tj, ', "
    const hexMatches = block.matchAll(/<([0-9a-fA-F]+)>\s*(?:Tj|'|")/g);
    for (const m of hexMatches) {
      result += ' ' + decodePdfHexString(m[1]);
    }

    // 3. TJ array operators: [(text) 10 <hex>] TJ
    const tjMatches = block.matchAll(/\[([\s\S]*?)\]\s*TJ/g);
    for (const m of tjMatches) {
      const arrayContent = m[1];
      const itemRegex = /\(([^)]*)\)|<([0-9a-fA-F]+)>/g;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemRegex.exec(arrayContent)) !== null) {
        if (itemMatch[1] !== undefined) {
          result += decodePdfLiteralString(itemMatch[1]);
        } else if (itemMatch[2] !== undefined) {
          result += decodePdfHexString(itemMatch[2]);
        }
      }
      result += ' ';
    }

    // Line breaks
    if (/(?:T\*|Td|TD|\n)/.test(block)) {
      result += '\n';
    }
  }

  return result;
}

export class PdfTextExtractionService {
  /**
   * Scans all decompressed zlib streams inside the PDF
   */
  public static extractFromAllStreams(pdfBuffer: Buffer): string {
    let combinedText = '';
    const latinStr = pdfBuffer.toString('latin1');
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;

    let match: RegExpExecArray | null;
    while ((match = streamRegex.exec(latinStr)) !== null) {
      const rawStream = Buffer.from(match[1], 'latin1');
      let decompressed = '';

      try {
        decompressed = zlib.inflateSync(rawStream).toString('latin1');
      } catch {
        try {
          decompressed = zlib.inflateRawSync(rawStream).toString('latin1');
        } catch {
          decompressed = rawStream.toString('latin1');
        }
      }

      const streamParsed = parseStreamText(decompressed);
      if (streamParsed.trim().length > 0) {
        combinedText += streamParsed + '\n';
      }

      // Also grab visible word patterns if uncompressed ASCII
      const wordMatches = decompressed.match(/\b[A-Za-z0-9_\-\.\/]{3,}\b/g);
      if (wordMatches && wordMatches.length > 8) {
        combinedText += ' ' + wordMatches.join(' ') + ' ';
      }
    }

    return combinedText.replace(/\s+/g, ' ').trim();
  }

  /**
   * Decodes text directly from PDFDocument page contents and Form XObjects
   */
  public static extractFromContentStreams(loadedDoc: PDFDocument): string {
    let fullText = '';
    const pages = loadedDoc.getPages();

    // 1. Extract from page contents
    for (const p of pages) {
      const contents = p.node.Contents();
      if (!contents) continue;

      const refs = (contents as any).array ? (contents as any).array : [contents];
      for (const r of refs) {
        const stream = loadedDoc.context.lookup(r);
        if (!stream || !(stream as any).contents) continue;

        const rawBytes = (stream as any).contents;
        let decompressed = '';

        try {
          decompressed = zlib.inflateSync(Buffer.from(rawBytes)).toString('latin1');
        } catch {
          try {
            decompressed = zlib.inflateRawSync(Buffer.from(rawBytes)).toString('latin1');
          } catch {
            decompressed = Buffer.from(rawBytes).toString('latin1');
          }
        }

        fullText += parseStreamText(decompressed) + '\n';
      }
    }

    // 2. Extract from Form XObjects (used for tables/templates in statements)
    try {
      const objects = loadedDoc.context.enumerateIndirectObjects();
      for (const [, obj] of objects) {
        if (obj instanceof PDFRawStream || (obj && (obj as any).contents && (obj as any).dict)) {
          const dict = (obj as any).dict as PDFDict;
          const subtype = dict?.get(PDFName.of('Subtype'));
          if (subtype === PDFName.of('Form')) {
            const rawBytes = Buffer.from((obj as any).contents);
            let decompressed = '';
            try {
              decompressed = zlib.inflateSync(rawBytes).toString('latin1');
            } catch {
              try {
                decompressed = zlib.inflateRawSync(rawBytes).toString('latin1');
              } catch {
                decompressed = rawBytes.toString('latin1');
              }
            }
            fullText += parseStreamText(decompressed) + '\n';
          }
        }
      }
    } catch {}

    return fullText.trim();
  }

  /**
   * Universal Page Classification helper
   */
  public static classifyPageType(pageText: string): 'TRANSACTION_PAGE' | 'ACCOUNT_INFO_PAGE' | 'SUMMARY_PAGE' | 'INFORMATION_PAGE' | 'ADVERTISEMENT_PAGE' | 'UNKNOWN' {
    const lower = pageText.toLowerCase();

    // 1. Marketing / Advertisement Page
    if (
      /\b(rewards\s+program|credit\s+card\s+offers|exclusive\s+deals|apply\s+now\s+for|download\s+our\s+app|explore\s+our\s+products|personal\s+loan\s+offers)\b/i.test(
        lower
      ) &&
      !/\b(tran\s*date|particulars|withdrawal|deposit|balance|opening\s+balance|closing\s+balance)\b/i.test(lower)
    ) {
      return 'ADVERTISEMENT_PAGE';
    }

    // 2. Information / Legal / Notice Page
    if (
      /\b(important\s+information|terms\s*(&|\s+and\s+)\s*conditions|grievance\s+redressal|banking\s+ombudsman|statutory\s+notice|legend\s*:\s*upi)\b/i.test(
        lower
      ) &&
      !/\b(tran\s*date|withdrawal|deposit|opening\s+balance|closing\s+balance)\b/i.test(lower)
    ) {
      return 'INFORMATION_PAGE';
    }

    // 3. Account Summary Page
    if (
      /\b(account\s+summary|statement\s+summary|total\s+withdrawals|total\s+deposits|closing\s+balance\s*[:=]|summary\s+of\s+accounts)\b/i.test(
        lower
      ) &&
      !/\b(tran\s*date|chq\s*no|ref\s*no|upi\/|neft\/|imps\/)\b/i.test(lower)
    ) {
      return 'SUMMARY_PAGE';
    }

    // 4. Transaction Page
    if (
      /\b(tran\s*date|value\s*date|date)\b/i.test(lower) &&
      /\b(particulars|narration|description|details|withdrawal|deposit|debit|credit|balance)\b/i.test(lower)
    ) {
      return 'TRANSACTION_PAGE';
    }

    // 5. Account Info Page
    if (
      /\b(account\s*(number|no)|customer\s*(id|name)|ifsc|branch|account\s+type|micr)\b/i.test(lower)
    ) {
      return 'ACCOUNT_INFO_PAGE';
    }

    return 'UNKNOWN';
  }

  public static async extractText(
    pdfBuffer: Buffer,
    requestId: string
  ): Promise<ExtractedPdfContent> {
    try {
      logger.info({
        requestId,
        stage: 'TEXT_EXTRACTION',
        message: 'Starting universal multi-engine (Native + Spatial + OCR) ingestion pipeline',
      });

      let text = '';
      let pagesCount = 1;
      let isScanned = false;
      let ocrApplied = false;
      const pageModels: NormalizedPageModel[] = [];

      // Step 1: Extract Native PDF Text per page using modern pdfjs-dist with 2D spatial clustering
      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(pdfBuffer),
          useSystemFonts: true,
          disableFontFace: true,
        });
        const pdfDoc = await loadingTask.promise;
        pagesCount = pdfDoc.numPages;

        for (let p = 1; p <= pagesCount; p++) {
          const page = await pdfDoc.getPage(p);
          const viewport = page.getViewport({ scale: 1.0 });
          const textContent = await page.getTextContent({
            disableCombineTextItems: false,
          } as any);

          interface TextPosItem {
            str: string;
            x: number;
            y: number;
            width: number;
            height: number;
          }

          const rawItems: TextPosItem[] = (textContent.items || [])
            .map((it: any) => ({
              str: it.str || '',
              x: it.transform ? it.transform[4] : 0,
              y: it.transform ? it.transform[5] : 0,
              width: it.width || (it.str ? it.str.length * 5.5 : 0),
              height: it.height || 10,
            }))
            .filter((it: TextPosItem) => it.str.trim().length > 0);

          // Group items into visual lines by Y coordinate with a 3.5pt tolerance
          interface VisualLine {
            y: number;
            items: TextPosItem[];
          }

          const visualLines: VisualLine[] = [];
          for (const item of rawItems) {
            let line = visualLines.find((vl) => Math.abs(vl.y - item.y) <= 3.5);
            if (!line) {
              line = { y: item.y, items: [] };
              visualLines.push(line);
            }
            line.items.push(item);
          }

          // Sort visual lines top-to-bottom (Y descending in PDF coordinate space)
          visualLines.sort((a, b) => b.y - a.y);

          // For each visual line, sort items strictly left-to-right (X ascending)
          const pageLines: string[] = [];
          const spatialLines: SpatialLineToken[] = [];

          for (const vl of visualLines) {
            vl.items.sort((a, b) => a.x - b.x);
            const lineText = vl.items
              .map((it) => it.str.trim())
              .filter((s) => s.length > 0)
              .join(' ')
              .trim();
            if (lineText.length > 0) {
              pageLines.push(lineText);

              const minX = Math.min(...vl.items.map((it) => it.x));
              const maxX = Math.max(...vl.items.map((it) => it.x + it.width));
              const topY = Math.max(0, viewport.height - vl.y - 10);

              spatialLines.push({
                text: lineText,
                pageNumber: p,
                bbox: {
                  x0: minX,
                  y0: topY,
                  x1: maxX,
                  y1: topY + 12,
                },
                words: vl.items.map((it) => ({
                  text: it.str.trim(),
                  confidence: 100,
                  pageNumber: p,
                  bbox: {
                    x0: it.x,
                    y0: topY,
                    x1: it.x + it.width,
                    y1: topY + 12,
                  },
                })),
              });
            }
          }

          const spatialWords: SpatialWordToken[] = rawItems.map((it) => {
            const topY = Math.max(0, viewport.height - it.y - it.height);
            return {
              text: it.str.trim(),
              confidence: 100,
              pageNumber: p,
              bbox: {
                x0: it.x,
                y0: topY,
                x1: it.x + it.width,
                y1: topY + it.height,
              },
            };
          });

          const geometry: PageGeometry = {
            pageNumber: p,
            width: viewport.width,
            height: viewport.height,
            words: spatialWords,
            lines: spatialLines,
          };

          const pageStr = pageLines.join('\n');

          pageModels.push({
            pageNumber: p,
            rawText: pageStr,
            lines: pageLines,
            normalizedLines: pageLines,
            detectedTransactions: [],
            extractionMethod: 'NATIVE',
            geometry,
          });
        }
      } catch (parseErr: any) {
        logger.debug({
          requestId,
          stage: 'TEXT_EXTRACTION',
          message: `pdfjs-dist primary renderer: ${parseErr.message}, trying stream extraction fallback`,
        });
      }

      // If page count wasn't found from pdfjs-dist, determine from pdf-lib
      if (pagesCount <= 1 && pageModels.length === 0) {
        try {
          const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
          pagesCount = Math.max(pagesCount, pdfDoc.getPageCount());
          const streamText = this.extractFromContentStreams(pdfDoc) || this.extractFromAllStreams(pdfBuffer);
          if (streamText.length > 0) {
            const streamLines = streamText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
            pageModels.push({
              pageNumber: 1,
              rawText: streamText,
              lines: streamLines,
              normalizedLines: streamLines,
              detectedTransactions: [],
              extractionMethod: 'NATIVE',
            });
          }
        } catch {}
      }

      // Ensure pageModels array has slots for all pages
      if (pageModels.length < pagesCount) {
        for (let p = pageModels.length + 1; p <= pagesCount; p++) {
          pageModels.push({
            pageNumber: p,
            rawText: '',
            lines: [],
            normalizedLines: [],
            detectedTransactions: [],
            extractionMethod: 'NATIVE',
          });
        }
      }

      // Step 2: Per-page text quality evaluation and automatic OCR fallback
      let nativeTextPages = 0;
      let ocrPages = 0;
      let totalOcrConfidenceSum = 0;
      const extractionWarnings: string[] = [];

      for (let pIdx = 0; pIdx < pageModels.length; pIdx++) {
        const page = pageModels[pIdx];
        const pageNum = page.pageNumber;
        const rawText = (page.rawText || '').trim();

        // Check if native text is sufficient (at least 50 characters and multiple words)
        const wordCount = rawText.split(/\s+/).filter((w) => w.length > 1).length;
        const isNativeSufficient = rawText.length >= 50 && wordCount >= 6;

        if (isNativeSufficient) {
          nativeTextPages++;
          page.extractionMethod = 'NATIVE';
          page.pageType = this.classifyPageType(rawText);
        } else {
          // Trigger OCR on this page
          logger.info({
            requestId,
            stage: 'OCR_TRIGGERED',
            page: pageNum,
            message: `Page ${pageNum} has insufficient native text (${rawText.length} chars, ${wordCount} words). Triggering rasterization OCR pipeline.`,
          });

          isScanned = true;
          ocrApplied = true;

          const ocrResult = await OcrService.renderAndOcrPage(pdfBuffer, pageNum, requestId);

          if (ocrResult.success && ocrResult.text.length > 0) {
            ocrPages++;
            totalOcrConfidenceSum += ocrResult.confidence;

            page.rawText = ocrResult.text;
            page.lines = ocrResult.lines;
            page.normalizedLines = ocrResult.lines;
            page.extractionMethod = 'OCR';
            page.ocrConfidence = ocrResult.confidence;
            page.pageType = this.classifyPageType(ocrResult.text);
            page.geometry = ocrResult.geometry;
          } else {
            extractionWarnings.push(`Page ${pageNum} OCR failed or yielded empty text.`);
          }
        }
      }

      // Step 3: Combine all page texts
      const combinedLines: string[] = [];
      for (const p of pageModels) {
        if (p.lines && p.lines.length > 0) {
          combinedLines.push(...p.lines);
        }
      }

      text = pageModels.map((p) => p.rawText).filter((t) => t.length > 0).join('\n\n').trim();

      const hybridPages = nativeTextPages > 0 && ocrPages > 0 ? pagesCount : 0;
      const failedPages = pagesCount - (nativeTextPages + ocrPages);
      const averageOCRConfidence = ocrPages > 0 ? Math.round((totalOcrConfidenceSum / ocrPages) * 10) / 10 : 0;

      const isUnreadable = text.length < config.classification.minTextLength;

      logger.info({
        requestId,
        stage: 'TEXT_EXTRACTION_COMPLETED',
        message: `Extracted ${text.length} characters, ${combinedLines.length} lines across ${pagesCount} pages. (Native Pages: ${nativeTextPages}, OCR Pages: ${ocrPages}, Avg OCR Conf: ${averageOCRConfidence}%, Scanned: ${isScanned})`,
      });

      const extractionMetadata: ExtractionMetadataInfo = {
        totalPages: pagesCount,
        nativeTextPages,
        ocrPages,
        hybridPages,
        failedPages,
        averageOCRConfidence,
        extractionWarnings,
        pagesProcessed: pagesCount,
        pagesWithText: nativeTextPages,
        pagesWithOCR: ocrPages,
      };

      return {
        text,
        pagesCount,
        lines: combinedLines,
        pages: pageModels,
        isScanned,
        isUnreadable,
        ocrApplied,
        charCount: text.length,
        extractionMetadata,
      };
    } catch (err: any) {
      logger.error({
        requestId,
        stage: 'TEXT_EXTRACTION_FAILED',
        message: `PDF text extraction fatal error: ${err.message}`,
      });

      return {
        text: '',
        pagesCount: 0,
        lines: [],
        pages: [],
        isScanned: false,
        isUnreadable: true,
        ocrApplied: false,
        charCount: 0,
      };
    }
  }
}

