import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Handle JSON syntax errors from body-parser
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      status: 'fail',
      error: 'Malformed JSON payload in request body.',
    });
    return;
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const status = err instanceof AppError ? err.status : 'error';
  const isOperational = err instanceof AppError ? err.isOperational : false;

  // Operational error: send message to client
  if (isOperational) {
    res.status(statusCode).json({
      success: false,
      status,
      error: err.message,
    });
    return;
  }

  // Programmer or unexpected error: suppress stack trace in production
  console.error('[Unhandled Error]', err);

  if (env.NODE_ENV === 'production') {
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'An internal server error occurred.',
    });
  } else {
    res.status(500).json({
      success: false,
      status: 'error',
      error: err.message,
      stack: err.stack,
    });
  }
};
