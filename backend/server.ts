import { app } from './app';
import { config } from './config';

const port = config.port;

// Process-level guards against unexpected crashes
process.on('unhandledRejection', (reason: any, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason?.message || reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('[Process] Uncaught Exception:', error.message, error.stack);
});

const server = app.listen(port, () => {
  console.log(`====================================================`);
  console.log(`🏦 Bank Statement Analyzer Service Running`);
  console.log(`📡 URL: http://localhost:${port}`);
  console.log(`⚙️  Environment: ${config.nodeEnv}`);
  console.log(`🔒 Max PDF Size: ${config.maxPdfSizeMb}MB`);
  console.log(`📊 Classification Threshold: >=${config.classification.statementThreshold}`);
  console.log(`====================================================`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${port} is already in use by another process.`);
    console.error(`👉 Solution: Please terminate the other running instance or change the PORT in .env\n`);
  } else {
    console.error(`Server error:`, err);
  }
});
