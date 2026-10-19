import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRateLimiter,
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  verifyOtpLimiter,
} from '../src/middleware/rateLimiter.js';
import { AppError } from '../src/utils/AppError.js';

describe('Rate Limiter Middleware (rateLimiter.ts)', () => {
  test('exports standard configured limiters with expected policies', () => {
    assert.ok(typeof loginLimiter === 'function', 'loginLimiter must be an Express middleware function');
    assert.ok(typeof registerLimiter === 'function', 'registerLimiter must be an Express middleware function');
    assert.ok(typeof forgotPasswordLimiter === 'function', 'forgotPasswordLimiter must be an Express middleware function');
    assert.ok(typeof verifyOtpLimiter === 'function', 'verifyOtpLimiter must be an Express middleware function');
  });

  test('createRateLimiter tracks request counts and triggers HTTP 429 when max is exceeded outside test mode', () => {
    // Temporarily switch NODE_ENV to production to verify enforcement
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 3,
        message: 'Rate limit exceeded for testing.',
      });

      const mockReq = {
        ip: '192.168.1.100',
        socket: {},
      } as any;
      const mockRes = {} as any;

      const results: (Error | undefined)[] = [];

      for (let i = 0; i < 4; i++) {
        limiter(mockReq, mockRes, (err?: any) => {
          results.push(err);
        });
      }

      assert.equal(results.length, 4);
      assert.equal(results[0], undefined, 'Request 1 should pass');
      assert.equal(results[1], undefined, 'Request 2 should pass');
      assert.equal(results[2], undefined, 'Request 3 should pass');
      assert.ok(results[3] instanceof AppError, 'Request 4 should trigger AppError');
      assert.equal((results[3] as AppError).statusCode, 429);
      assert.equal((results[3] as AppError).message, 'Rate limit exceeded for testing.');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  test('differentiates IP addresses independently', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 2,
        message: 'Rate limit exceeded.',
      });

      const mockReq1 = { ip: '10.0.0.1', socket: {} } as any;
      const mockReq2 = { ip: '10.0.0.2', socket: {} } as any;
      const mockRes = {} as any;

      let err1: any;
      let err2: any;

      // Exhaust IP 1
      limiter(mockReq1, mockRes, () => {});
      limiter(mockReq1, mockRes, () => {});
      limiter(mockReq1, mockRes, (e) => { err1 = e; });

      // First request from IP 2 should still succeed
      limiter(mockReq2, mockRes, (e) => { err2 = e; });

      assert.ok(err1 instanceof AppError && err1.statusCode === 429, 'IP 1 should be rate limited');
      assert.equal(err2, undefined, 'IP 2 should not be affected by IP 1 limit');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
