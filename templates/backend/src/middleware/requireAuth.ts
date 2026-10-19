import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.js';
import { AUTH_COOKIE_NAME } from '../utils/authCookie.js';
import { verifyAuthToken } from '../utils/authToken.js';
import { AppError } from '../utils/AppError.js';
import { SafeUser } from '../types/auth.js';

/**
 * Authentication guard middleware for protected API endpoints.
 *
 * Security Requirements:
 * - Reads JWT exclusively from the secure HTTP-only devlaunch_token cookie.
 * - Rejects missing, malformed, or expired tokens with HTTP 401.
 * - Queries the database by userId to verify the user account still exists.
 * - Explicitly verifies tokenVersion to enforce instantaneous token revocation
 *   upon password reset or global logout.
 * - Attaches only the sanitized user DTO to req.user; never exposes password hashes,
 *   internal tokens, or Google IDs.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token || typeof token !== 'string') {
    throw new AppError('Authentication required. Please sign in.', 401);
  }

  // verifyAuthToken enforces HS256 algorithm and verifies token integrity/expiration
  const payload = verifyAuthToken(token);

  // Load the user from database, explicitly selecting +tokenVersion (which is select: false by default)
  const user = await User.findById(payload.userId).select('+tokenVersion');

  if (!user) {
    throw new AppError('User account associated with this session no longer exists.', 401);
  }

  // Reject sessions whose tokenVersion does not match current database value
  if (user.tokenVersion !== payload.tokenVersion) {
    throw new AppError('Session has expired or been revoked. Please sign in again.', 401);
  }

  // Attach safe user representation to request (toJSON strips sensitive fields)
  req.user = user.toJSON() as unknown as SafeUser;

  next();
}
