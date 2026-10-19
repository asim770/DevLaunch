import { Response, CookieOptions } from 'express';
import { env } from '../config/env.js';

export const AUTH_COOKIE_NAME = 'devlaunch_token';

/**
 * Parses a duration string (e.g. '7d', '24h', '60m', '3600s', '3600') into milliseconds.
 * Throws an Error if the format cannot be safely parsed.
 */
export function parseDurationToMs(duration: string): number {
  const trimmed = duration.trim();
  const match = trimmed.match(/^(\d+)([smhd])?$/);

  if (!match) {
    throw new Error(
      `Cannot convert duration "${duration}" to milliseconds. Expected number with unit: s, m, h, d, or raw seconds.`
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (isNaN(value) || value <= 0) {
    throw new Error(`Invalid duration value in "${duration}". Must be a positive integer.`);
  }

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      // If no unit provided, assume seconds
      return value * 1000;
  }
}

/**
 * Generates consistent, secure cookie options for authentication.
 */
export function getAuthCookieOptions(customMaxAgeMs?: number): CookieOptions {
  const isProduction = env.NODE_ENV === 'production';
  const maxAge = customMaxAgeMs ?? parseDurationToMs(env.JWT_EXPIRES_IN);

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

/**
 * Sets the secure HTTP-only authentication cookie on an Express response.
 */
export function setAuthCookie(res: Response, token: string): void {
  const options = getAuthCookieOptions();
  res.cookie(AUTH_COOKIE_NAME, token, options);
}

/**
 * Clears the authentication cookie using matching path and security options.
 */
export function clearAuthCookie(res: Response): void {
  const isProduction = env.NODE_ENV === 'production';
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
}
