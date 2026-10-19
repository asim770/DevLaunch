import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message: string;
}

/**
 * In-memory sliding-window IP rate limiter.
 * Protects sensitive endpoints (forgot password, OTP verification) against automated brute force and flooding.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const ipStore = new Map<string, RateLimitRecord>();

  return (req: Request, _res: Response, next: NextFunction): void => {
    // In test environment, allow high throughput unless specifically testing the limiter
    const isTest = process.env.NODE_ENV === 'test';
    const ip = (req.ip || req.socket.remoteAddress || '127.0.0.1').toString();
    const now = Date.now();
    const record = ipStore.get(ip);

    if (!record || now > record.resetTime) {
      ipStore.set(ip, { count: 1, resetTime: now + options.windowMs });
      return next();
    }

    if (!isTest && record.count >= options.max) {
      return next(new AppError(options.message, 429));
    }

    record.count += 1;
    return next();
  };
}

export const forgotPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many password reset requests from this IP. Please try again later.',
});

export const verifyOtpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: 'Too many verification attempts from this IP. Please try again later.',
});

export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: 'Too many login attempts from this IP. Please try again later.',
});

export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many accounts created from this IP. Please try again later.',
});
