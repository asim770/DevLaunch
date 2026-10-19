import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';

// Configure test environment variables prior to module imports
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devlaunch_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devlaunch_test_jwt_secret_min_32_chars_long';

const {
  generateOAuthState,
  getOAuthStateCookieOptions,
  verifyOAuthState,
  verifyAndConsumeOAuthState,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_MAX_AGE_MS,
} = await import('../src/utils/oauthState.js');

describe('OAuth State Security Utilities (oauthState.ts)', () => {
  describe('generateOAuthState', () => {
    test('generates a 64-character hex string with 256 bits of entropy', () => {
      const state = generateOAuthState();
      assert.equal(typeof state, 'string');
      assert.equal(state.length, 64);
      assert.match(state, /^[0-9a-f]{64}$/);
    });

    test('generates unique random states on successive calls', () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();
      assert.notEqual(state1, state2);
    });
  });

  describe('getOAuthStateCookieOptions', () => {
    test('enforces httpOnly, sameSite=lax, short maxAge, and narrow /api/auth/google path', () => {
      const options = getOAuthStateCookieOptions();
      assert.equal(options.httpOnly, true, 'State cookie must be httpOnly');
      assert.equal(options.sameSite, 'lax', 'State cookie must use SameSite=Lax for OAuth redirects');
      assert.equal(options.maxAge, OAUTH_STATE_MAX_AGE_MS);
      assert.equal(options.path, '/api/auth/google', 'State cookie must be scoped to OAuth endpoints');
    });
  });

  describe('verifyOAuthState', () => {
    test('returns true for matching state values', () => {
      const state = generateOAuthState();
      assert.equal(verifyOAuthState(state, state), true);
    });

    test('returns false for mismatched state values', () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();
      assert.equal(verifyOAuthState(state1, state2), false);
    });

    test('returns false for mismatched lengths without throwing timingSafeEqual error', () => {
      const state = generateOAuthState();
      assert.equal(verifyOAuthState(state, 'short'), false);
      assert.equal(verifyOAuthState('short', state), false);
    });

    test('returns false for empty or non-string inputs', () => {
      const state = generateOAuthState();
      assert.equal(verifyOAuthState('', state), false);
      assert.equal(verifyOAuthState(state, ''), false);
      // @ts-expect-error test invalid inputs
      assert.equal(verifyOAuthState(null, state), false);
      // @ts-expect-error test invalid inputs
      assert.equal(verifyOAuthState(state, undefined), false);
    });
  });

  describe('verifyAndConsumeOAuthState', () => {
    function createMockRes() {
      const clearedCookies: Array<{ name: string; options: unknown }> = [];
      const res = {
        clearCookie(name: string, options: unknown) {
          clearedCookies.push({ name, options });
          return res;
        },
      } as unknown as Response;
      return { res, clearedCookies };
    }

    test('clears the state cookie and returns true when query.state matches cookie', () => {
      const state = generateOAuthState();
      const req = {
        query: { state },
        cookies: { [OAUTH_STATE_COOKIE_NAME]: state },
      } as unknown as Request;

      const { res, clearedCookies } = createMockRes();
      const isValid = verifyAndConsumeOAuthState(req, res);

      assert.equal(isValid, true);
      assert.equal(clearedCookies.length, 1);
      assert.equal(clearedCookies[0].name, OAUTH_STATE_COOKIE_NAME);
    });

    test('clears the state cookie and returns false when state values mismatch', () => {
      const req = {
        query: { state: 'attacker-supplied-state' },
        cookies: { [OAUTH_STATE_COOKIE_NAME]: generateOAuthState() },
      } as unknown as Request;

      const { res, clearedCookies } = createMockRes();
      const isValid = verifyAndConsumeOAuthState(req, res);

      assert.equal(isValid, false);
      assert.equal(clearedCookies.length, 1, 'Must clear cookie even on mismatch to prevent reuse');
    });

    test('clears the state cookie and returns false when cookie is missing', () => {
      const req = {
        query: { state: generateOAuthState() },
        cookies: {},
      } as unknown as Request;

      const { res, clearedCookies } = createMockRes();
      const isValid = verifyAndConsumeOAuthState(req, res);

      assert.equal(isValid, false);
      assert.equal(clearedCookies.length, 1);
    });

    test('clears the state cookie and returns false when query param is missing', () => {
      const req = {
        query: {},
        cookies: { [OAUTH_STATE_COOKIE_NAME]: generateOAuthState() },
      } as unknown as Request;

      const { res, clearedCookies } = createMockRes();
      const isValid = verifyAndConsumeOAuthState(req, res);

      assert.equal(isValid, false);
      assert.equal(clearedCookies.length, 1);
    });
  });
});
