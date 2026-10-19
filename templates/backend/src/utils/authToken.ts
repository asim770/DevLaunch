import jwt, { SignOptions, VerifyOptions, JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

export interface AuthTokenPayload {
  userId: string;
  tokenVersion: number;
}

export interface DecodedAuthToken extends JwtPayload, AuthTokenPayload {
  iat: number;
  exp: number;
}

const JWT_ALGORITHM = 'HS256';

/**
 * Signs an authentication JWT containing userId and tokenVersion.
 * Uses HS256 algorithm with configured secret and expiry.
 */
export function generateAuthToken(payload: AuthTokenPayload): string {
  if (!payload.userId || typeof payload.userId !== 'string') {
    throw new AppError('Cannot sign authentication token: invalid or missing userId.', 500);
  }

  if (typeof payload.tokenVersion !== 'number' || isNaN(payload.tokenVersion)) {
    throw new AppError('Cannot sign authentication token: invalid or missing tokenVersion.', 500);
  }

  const signOptions: SignOptions = {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };

  return jwt.sign(
    {
      userId: payload.userId,
      tokenVersion: payload.tokenVersion,
    },
    env.JWT_SECRET,
    signOptions
  );
}

/**
 * Verifies an authentication JWT and extracts the strongly-typed payload.
 * Enforces algorithm constraint (HS256) and validates presence of userId and tokenVersion.
 * Throws AppError with status 401 on expired, malformed, or invalid tokens.
 */
export function verifyAuthToken(token: string): DecodedAuthToken {
  if (!token || typeof token !== 'string') {
    throw new AppError('Authentication token must be a non-empty string.', 401);
  }

  const verifyOptions: VerifyOptions = {
    algorithms: [JWT_ALGORITHM],
  };

  let decoded: string | JwtPayload;

  try {
    decoded = jwt.verify(token, env.JWT_SECRET, verifyOptions);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Authentication token has expired. Please sign in again.', 401);
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid authentication token signature or payload.', 401);
    }
    throw new AppError('Authentication token verification failed.', 401);
  }

  if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
    throw new AppError('Invalid token payload structure.', 401);
  }

  const { userId, tokenVersion, iat, exp } = decoded as Partial<DecodedAuthToken>;

  if (!userId || typeof userId !== 'string') {
    throw new AppError('Token payload missing valid userId claim.', 401);
  }

  if (typeof tokenVersion !== 'number' || isNaN(tokenVersion)) {
    throw new AppError('Token payload missing valid tokenVersion claim.', 401);
  }

  return {
    userId,
    tokenVersion,
    iat: iat || 0,
    exp: exp || 0,
    ...decoded,
  };
}
