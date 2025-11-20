import { type Request, type Response, type NextFunction } from 'express';
import logger from '../utils/logger.js';
import { env } from '../config/env.js';

interface ErrorResponse {
  error: string;
  message: string;
  code: number;
  stack?: string;
}

export const error_handler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const response: ErrorResponse = {
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred',
    code: 500,
  };

  // Expose stack trace only in development
  if (env.node_env === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(500).json(response);
};

export default error_handler;

