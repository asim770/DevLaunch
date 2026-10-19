import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';

// Configure test environment variables prior to app initialization
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devlaunch_test';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devlaunch_test_jwt_secret_min_32_chars_long';

const { generateAuthToken, verifyAuthToken } = await import('../src/utils/authToken.js');
const {
  AUTH_COOKIE_NAME,
  parseDurationToMs,
  getAuthCookieOptions,
  setAuthCookie,
  clearAuthCookie,
} = await import('../src/utils/authCookie.js');
const { createApp } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
const { AppError } = await import('../src/utils/AppError.js');

describe('Auth Token Utility (generateAuthToken & verifyAuthToken)', () => {
  const samplePayload = {
    userId: 'user-uuid-12345',
    tokenVersion: 1,
  };

  test('successfully signs and verifies a valid authentication token', () => {
    const token = generateAuthToken(samplePayload);
    assert.equal(typeof token, 'string');
    assert.ok(token.length > 20);

    const decoded = verifyAuthToken(token);
    assert.equal(decoded.userId, samplePayload.userId);
    assert.equal(decoded.tokenVersion, samplePayload.tokenVersion);
    assert.equal(typeof decoded.iat, 'number');
    assert.equal(typeof decoded.exp, 'number');
    assert.ok(decoded.exp > decoded.iat);
  });

  test('rejects tokens signed with an incorrect secret', () => {
    const wrongSecret = 'another_unauthorized_secret_at_least_32_characters';
    const fakeToken = jwt.sign(samplePayload, wrongSecret, { algorithm: 'HS256' });

    assert.throws(
      () => verifyAuthToken(fakeToken),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 401);
        assert.ok(err.message.includes('Invalid authentication token signature or payload'));
        return true;
      }
    );
  });

  test('rejects tampered or malformed tokens', () => {
    const validToken = generateAuthToken(samplePayload);
    const tamperedToken = validToken.slice(0, -6) + 'abcdef';

    assert.throws(
      () => verifyAuthToken(tamperedToken),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 401);
        return true;
      }
    );

    assert.throws(
      () => verifyAuthToken('not.a.valid.jwt'),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 401);
        return true;
      }
    );
  });

  test('rejects empty or non-string token inputs', () => {
    assert.throws(
      () => verifyAuthToken(''),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 401);
        assert.ok(err.message.includes('non-empty string'));
        return true;
      }
    );
  });

  test('rejects expired tokens with a clear descriptive message', () => {
    // Generate an already expired token (expiresIn: -1s)
    const expiredToken = jwt.sign(samplePayload, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '-1s',
    });

    assert.throws(
      () => verifyAuthToken(expiredToken),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 401);
        assert.ok(err.message.includes('has expired'));
        return true;
      }
    );
  });

  test('rejects signing when required payload attributes are missing or invalid', () => {
    assert.throws(
      () => generateAuthToken({ userId: '', tokenVersion: 1 }),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.ok(err.message.includes('invalid or missing userId'));
        return true;
      }
    );

    assert.throws(
      () => generateAuthToken({ userId: 'user-123', tokenVersion: NaN }),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.ok(err.message.includes('invalid or missing tokenVersion'));
        return true;
      }
    );
  });

  test('rejects verified token payloads that lack userId or tokenVersion claims', () => {
    const invalidPayloadToken = jwt.sign({ foo: 'bar' }, env.JWT_SECRET, {
      algorithm: 'HS256',
    });

    assert.throws(
      () => verifyAuthToken(invalidPayloadToken),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 401);
        assert.ok(err.message.includes('missing valid userId'));
        return true;
      }
    );
  });
});

describe('Auth Cookie Utility (authCookie)', () => {
  describe('parseDurationToMs', () => {
    test('parses standard day, hour, minute, second durations correctly', () => {
      assert.equal(parseDurationToMs('7d'), 7 * 24 * 60 * 60 * 1000);
      assert.equal(parseDurationToMs('1d'), 24 * 60 * 60 * 1000);
      assert.equal(parseDurationToMs('24h'), 24 * 60 * 60 * 1000);
      assert.equal(parseDurationToMs('60m'), 60 * 60 * 1000);
      assert.equal(parseDurationToMs('3600s'), 3600 * 1000);
      assert.equal(parseDurationToMs('3600'), 3600 * 1000); // Raw seconds fallback
    });

    test('rejects invalid or unsupported duration strings', () => {
      assert.throws(() => parseDurationToMs('invalid'));
      assert.throws(() => parseDurationToMs(''));
      assert.throws(() => parseDurationToMs('-5m'));
      assert.throws(() => parseDurationToMs('0d'));
    });
  });

  describe('getAuthCookieOptions', () => {
    test('produces secure, HTTP-only, SameSite=Lax cookie options with matching lifetime', () => {
      const options = getAuthCookieOptions();

      assert.equal(options.httpOnly, true);
      assert.equal(options.sameSite, 'lax');
      assert.equal(options.path, '/');
      assert.equal(typeof options.maxAge, 'number');
      assert.ok(options.maxAge! > 0);

      // In test/dev environment, secure must be false to allow local HTTP development
      assert.equal(options.secure, env.NODE_ENV === 'production');
    });
  });

  describe('setAuthCookie & clearAuthCookie via mock Express response', () => {
    test('setAuthCookie calls res.cookie with cookie name, token, and options', () => {
      let capturedName = '';
      let capturedVal = '';
      let capturedOptions: Record<string, unknown> = {};

      const mockRes = {
        cookie(name: string, val: string, options: Record<string, unknown>) {
          capturedName = name;
          capturedVal = val;
          capturedOptions = options;
        },
      };

      setAuthCookie(mockRes as unknown as import('express').Response, 'test-jwt-token');

      assert.equal(capturedName, AUTH_COOKIE_NAME);
      assert.equal(capturedVal, 'test-jwt-token');
      assert.equal(capturedOptions.httpOnly, true);
      assert.equal(capturedOptions.sameSite, 'lax');
      assert.equal(capturedOptions.path, '/');
      assert.ok(typeof capturedOptions.maxAge === 'number');
    });

    test('clearAuthCookie calls res.clearCookie with matching path and security options', () => {
      let clearedName = '';
      let clearedOptions: Record<string, unknown> = {};

      const mockRes = {
        clearCookie(name: string, options: Record<string, unknown>) {
          clearedName = name;
          clearedOptions = options;
        },
      };

      clearAuthCookie(mockRes as unknown as import('express').Response);

      assert.equal(clearedName, AUTH_COOKIE_NAME);
      assert.equal(clearedOptions.httpOnly, true);
      assert.equal(clearedOptions.sameSite, 'lax');
      assert.equal(clearedOptions.path, '/');
    });
  });
});

describe('Cookie Parser Middleware Integration (app.ts)', () => {
  test('parses incoming cookies from request headers', async () => {
    const express = (await import('express')).default;
    const cookieParser = (await import('cookie-parser')).default;
    const testApp = express();
    testApp.use(cookieParser());

    testApp.get('/test-cookies', (req, res) => {
      res.json({
        cookies: req.cookies,
        hasAuthCookie: Boolean(req.cookies[AUTH_COOKIE_NAME]),
      });
    });

    const res = await request(testApp)
      .get('/test-cookies')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=sample-token-value; other_cookie=123`]);

    assert.equal(res.status, 200);
    assert.equal(res.body.cookies[AUTH_COOKIE_NAME], 'sample-token-value');
    assert.equal(res.body.cookies.other_cookie, '123');
    assert.equal(res.body.hasAuthCookie, true);
  });

  test('existing health endpoint continues to operate with cookie-parser installed', async () => {
    const testApp = createApp();
    const res = await request(testApp)
      .get('/api/health')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=sample-token-value`]);

    // 503 is expected in unit test environment when database is disconnected
    assert.equal(res.status, 503);
    assert.equal(res.body.status, 'degraded');
  });
});
