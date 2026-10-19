import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOtp,
  formatOtp,
  hashOtp,
  verifyOtpHash,
  generateResetToken,
  hashResetToken,
  verifyResetTokenHash,
  OTP_VALIDITY_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  RESET_TOKEN_VALIDITY_MS,
} from '../src/utils/passwordReset.js';

describe('Password Reset Utilities (passwordReset.ts)', () => {
  describe('formatOtp', () => {
    test('formats numbers as exactly six decimal digits with zero-padding', () => {
      assert.equal(formatOtp(0), '000000');
      assert.equal(formatOtp(1), '000001');
      assert.equal(formatOtp(4281), '004281');
      assert.equal(formatOtp(999999), '999999');
    });

    test('rejects values outside the 0 to 999999 range or non-integers', () => {
      assert.throws(() => formatOtp(-1), /integer between 0 and 999999/);
      assert.throws(() => formatOtp(1000000), /integer between 0 and 999999/);
      assert.throws(() => formatOtp(123.45), /integer between 0 and 999999/);
      assert.throws(() => formatOtp(NaN), /integer between 0 and 999999/);
    });
  });

  describe('generateOtp', () => {
    test('generates a 6-digit numeric string spanning 000000 to 999999', () => {
      const otp = generateOtp();
      assert.equal(typeof otp, 'string');
      assert.equal(otp.length, 6);
      assert.match(otp, /^\d{6}$/);

      const num = parseInt(otp, 10);
      assert.ok(num >= 0 && num <= 999999);
    });

    test('generates different random codes across multiple invocations', () => {
      const samples = new Set<string>();
      for (let i = 0; i < 20; i++) {
        samples.add(generateOtp());
      }
      assert.ok(samples.size > 1, 'Expected random distribution of OTPs');
    });
  });

  describe('hashOtp and verifyOtpHash', () => {
    test('produces a deterministic 64-character SHA-256 hex string', () => {
      const otp = '482910';
      const hash1 = hashOtp(otp);
      const hash2 = hashOtp(otp);

      assert.equal(hash1.length, 64);
      assert.equal(hash1, hash2, 'Same OTP must produce identical SHA-256 hash');
      assert.match(hash1, /^[0-9a-f]{64}$/);
    });

    test('different OTPs produce distinct hashes', () => {
      const hash1 = hashOtp('123456');
      const hash2 = hashOtp('654321');
      assert.notEqual(hash1, hash2);
    });

    test('verifyOtpHash returns true for matching OTP', () => {
      const otp = '951357';
      const hash = hashOtp(otp);
      assert.equal(verifyOtpHash(otp, hash), true);
    });

    test('verifyOtpHash returns false for incorrect OTP', () => {
      const otp = '951357';
      const hash = hashOtp(otp);
      assert.equal(verifyOtpHash('000000', hash), false);
    });

    test('verifyOtpHash safely handles empty or non-string inputs', () => {
      assert.equal(verifyOtpHash('', 'some-hash'), false);
      assert.equal(verifyOtpHash('123456', ''), false);
    });
  });

  describe('generateResetToken and verifyResetTokenHash', () => {
    test('generates high-entropy token and matching SHA-256 hash', () => {
      const { token, hash } = generateResetToken();

      assert.equal(typeof token, 'string');
      assert.equal(token.length, 64); // 32 bytes hex
      assert.equal(hash.length, 64);
      assert.equal(hash, hashResetToken(token));
      assert.equal(verifyResetTokenHash(token, hash), true);
    });

    test('verifyResetTokenHash rejects invalid or mismatched tokens', () => {
      const { hash } = generateResetToken();
      assert.equal(verifyResetTokenHash('invalid-token', hash), false);
      assert.equal(verifyResetTokenHash('', hash), false);
    });
  });

  describe('Lifecycle Constants', () => {
    test('defines required lifetime bounds and attempt limits', () => {
      assert.equal(OTP_VALIDITY_MS, 10 * 60 * 1000); // 10 minutes
      assert.equal(OTP_MAX_ATTEMPTS, 5); // 5 failed attempts
      assert.equal(OTP_RESEND_COOLDOWN_MS, 60 * 1000); // 60s cooldown
      assert.equal(RESET_TOKEN_VALIDITY_MS, 10 * 60 * 1000); // 10 minutes
    });
  });
});
