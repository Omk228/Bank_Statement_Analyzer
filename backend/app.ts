import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { correlationIdMiddleware } from './middleware/correlationId';
import { errorHandler } from './middleware/errorHandler';
import { StatementUploadController } from './controllers/StatementUploadController';
import { config } from './config';

// Configure Multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (config.maxPdfSizeMb + 2) * 1024 * 1024,
  },
});

export const app = express();

// Security and utility middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(correlationIdMiddleware);

// Health check & favicon routes
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/api/favicon.ico', (req, res) => res.status(204).end());
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Bank Statement Analyzer API',
  });
});

// Upload and Analysis Routes - using upload.any() to handle any multipart field name
app.post(
  '/api/statement/analyze',
  upload.any(),
  StatementUploadController.analyzeUpload
);

// Alias routes
app.post(
  '/statement/analyze',
  upload.any(),
  StatementUploadController.analyzeUpload
);

app.post(
  '/api/statement/upload',
  upload.any(),
  StatementUploadController.analyzeUpload
);

app.get('/api/statement/history', StatementUploadController.getHistory);

// Serve static frontend in production if built
const candidateDistPaths = [
  path.resolve(__dirname, '../dist/client'),
  path.resolve(__dirname, '../../dist/client'),
  path.resolve(process.cwd(), 'dist/client'),
];

for (const clientDist of candidateDistPaths) {
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
    break;
  }
}

// Global Error Handler
app.use(errorHandler);
