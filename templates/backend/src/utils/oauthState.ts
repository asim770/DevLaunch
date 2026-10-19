import crypto from 'node:crypto';
import { Request, Response, CookieOptions } from 'express';
import { env } from '../config/env.js';

export const OAUTH_STATE_COOKIE_NAME = 'devlaunch_oauth_state';
export const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Returns hardened cookie options for the OAuth state cookie.
 *
 * Security Considerations:
 * - httpOnly: Prevents client-side scripts from reading the state value (mitigating XSS theft).
 * - sameSite: 'lax' ensures the cookie is sent during the top-level GET redirection from Google.
 * - secure: Enforced in production mode. When operating behind a reverse proxy (e.g. AWS ALB,
 *   NGINX, Cloudflare), ensure Express has `app.set('trust proxy', 1)` configured so HTTPS is recognized.
 * - path: Scoped narrowly to '/api/auth/google' so the state cookie is only sent to the initiation
 *   and callback routes, preventing leakage to other API endpoints.
 */
export function getOAuthStateCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: OAUTH_STATE_MAX_AGE_MS,
    path: '/api/auth/google',
  };
}

/**
 * Generates an unpredictable, cryptographically random OAuth state string with 256 bits of entropy.
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Sets the short-lived OAuth state cookie on the outgoing response.
 */
export function setOAuthStateCookie(res: Response, state: string): void {
  res.cookie(OAUTH_STATE_COOKIE_NAME, state, getOAuthStateCookieOptions());
}

/**
 * Clears the OAuth state cookie with matching path and security flags.
 */
export function clearOAuthStateCookie(res: Response): void {
  const options = getOAuthStateCookieOptions();
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  });
}

/**
 * Compares two OAuth state strings in constant time to prevent timing side-channel attacks.
 */
export function verifyOAuthState(candidateState: string, expectedState: string): boolean {
  if (
    !candidateState ||
    typeof candidateState !== 'string' ||
    !expectedState ||
    typeof expectedState !== 'string'
  ) {
    return false;
  }

  const candidateBuf = Buffer.from(candidateState, 'utf-8');
  const expectedBuf = Buffer.from(expectedState, 'utf-8');

  if (candidateBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
}

/**
 * Validates the OAuth state from query parameters against the state stored in the HTTP-only cookie.
 * Immediately clears the cookie from the response to guarantee that a state value cannot be reused.
 */
export function verifyAndConsumeOAuthState(req: Request, res: Response): boolean {
  const candidateState = typeof req.query.state === 'string' ? req.query.state : '';
  const storedState = typeof req.cookies?.[OAUTH_STATE_COOKIE_NAME] === 'string'
    ? req.cookies[OAUTH_STATE_COOKIE_NAME]
    : '';

  // Always consume and clear the state cookie immediately, regardless of outcome
  clearOAuthStateCookie(res);

  if (!candidateState || !storedState) {
    return false;
  }

  return verifyOAuthState(candidateState, storedState);
}
