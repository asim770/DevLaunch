import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Validates request Origin against configured CLIENT_URL on state-changing requests.
 * Provides defense-in-depth CSRF protection alongside SameSite cookies and JSON payloads.
 */
export function validateOrigin(req: Request, _res: Response, next: NextFunction): void {
  // Only inspect state-changing mutation requests
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return next();
  }

  const originHeader = req.headers.origin;
  // If no Origin header is present (e.g. same-origin server requests, non-browser clients, or unit tests)
  if (!originHeader) {
    return next();
  }

  try {
    const clientOrigin = new URL(env.CLIENT_URL).origin;
    const requestOrigin = new URL(originHeader).origin;

    if (requestOrigin !== clientOrigin) {
      return next(new AppError('Cross-origin request blocked: unauthorized origin.', 403));
    }
  } catch {
    return next(new AppError('Invalid request origin.', 403));
  }

  next();
}
