import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.header('x-correlation-id') || req.header('x-request-id');
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const shortId = uuidv4().slice(0, 8).toUpperCase();
  const correlationId = existingId || `STA-${datePrefix}-${shortId}`;

  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}
