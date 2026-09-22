import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse, StatementErrorCode } from '../types/statement';
import { logger } from '../utils/logger';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req.headers['x-correlation-id'] as string) || 'UNKNOWN_REQ';
  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || StatementErrorCode.INTERNAL_ERROR;

  logger.error({
    requestId,
    stage: 'ERROR_HANDLER',
    message: err.message || 'Internal Server Error',
    errorCode,
    statusCode,
  });

  // Safe client-facing message
  let clientMessage = 'We couldn\'t process this document right now. Please try again.';

  if (err.message && (statusCode < 500 || err.isClientSafe)) {
    clientMessage = err.message;
  }

  const response: ApiErrorResponse = {
    success: false,
    requestId,
    error: {
      code: errorCode,
      message: clientMessage,
    },
  };

  res.status(statusCode).json(response);
}
