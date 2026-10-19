import crypto from 'node:crypto';

export const OTP_VALIDITY_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
export const RESET_TOKEN_VALIDITY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Formats an integer in the range 0 to 999999 as exactly six decimal digits with leading zeros.
 */
export function formatOtp(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 999999) {
    throw new Error('OTP value must be an integer between 0 and 999999');
  }
  return value.toString().padStart(6, '0');
}

/**
 * Generates an unbiased, cryptographically secure 6-digit numeric OTP in the range 000000 to 999999.
 * Uses crypto.randomInt(0, 1000000) and formats with zero-padding.
 */
export function generateOtp(): string {
  const num = crypto.randomInt(0, 1000000);
  return formatOtp(num);
}

/**
 * Computes a deterministic SHA-256 hash of a plain OTP string.
 */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp.trim()).digest('hex');
}

/**
 * Performs a timing-safe equality check between candidate OTP and stored SHA-256 hash.
 */
export function verifyOtpHash(candidateOtp: string, storedHash: string): boolean {
  if (!candidateOtp || typeof candidateOtp !== 'string' || !storedHash || typeof storedHash !== 'string') {
    return false;
  }
  const candidateHash = hashOtp(candidateOtp);
  const candidateBuf = Buffer.from(candidateHash, 'hex');
  const storedBuf = Buffer.from(storedHash, 'hex');

  if (candidateBuf.length !== storedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuf, storedBuf);
}

/**
 * Generates a high-entropy, cryptographically random single-use reset credential
 * and its corresponding SHA-256 hash for database storage.
 */
export function generateResetToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = hashResetToken(token);
  return { token, hash };
}

/**
 * Computes a deterministic SHA-256 hash of a reset credential string.
 */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Performs a timing-safe equality check between candidate reset token and stored SHA-256 hash.
 */
export function verifyResetTokenHash(candidateToken: string, storedHash: string): boolean {
  if (
    !candidateToken ||
    typeof candidateToken !== 'string' ||
    !storedHash ||
    typeof storedHash !== 'string'
  ) {
    return false;
  }
  const candidateHash = hashResetToken(candidateToken);
  const candidateBuf = Buffer.from(candidateHash, 'hex');
  const storedBuf = Buffer.from(storedHash, 'hex');

  if (candidateBuf.length !== storedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuf, storedBuf);
}
