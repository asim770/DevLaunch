import { Request, Response } from 'express';
import { User } from '../models/User.js';
import { generateAuthToken } from '../utils/authToken.js';
import { setAuthCookie, clearAuthCookie } from '../utils/authCookie.js';
import { AppError } from '../utils/AppError.js';
import {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  generateResetToken,
  hashResetToken,
  OTP_VALIDITY_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  RESET_TOKEN_VALIDITY_MS,
} from '../utils/passwordReset.js';
import { sendPasswordResetOtp } from '../services/email.service.js';
import { env } from '../config/env.js';
import {
  generateOAuthState,
  setOAuthStateCookie,
  verifyAndConsumeOAuthState,
} from '../utils/oauthState.js';
import {
  getGoogleAuthorizationUrl,
  exchangeCodeAndVerifyGoogleToken,
  GoogleUserPayload,
} from '../services/googleAuth.service.js';

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

/**
 * Controller: Handles new user registration via email and password.
 *
 * Security Controls:
 * - Validates input fields on the server before database operations.
 * - Enforces name (2-50 chars), email format, and password (8-128 chars).
 * - Ignores client-supplied privileged attributes (role, providers, tokenVersion).
 * - Relies on User model pre-save hook for password hashing (never hashes twice).
 * - Maps duplicate email collisions (including MongoDB error 11000) to clean HTTP 409.
 * - Issues a secure HTTP-only cookie upon successful registration.
 */
export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body || {};

  // Validate name
  if (!name || typeof name !== 'string') {
    throw new AppError('Name is required and must be a string.', 400);
  }
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 50) {
    throw new AppError('Name must be between 2 and 50 characters long.', 400);
  }

  // Validate email
  if (!email || typeof email !== 'string') {
    throw new AppError('Email is required and must be a string.', 400);
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new AppError('Please provide a valid email address.', 400);
  }

  // Validate password
  if (!password || typeof password !== 'string') {
    throw new AppError('Password is required and must be a string.', 400);
  }
  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters long.', 400);
  }
  if (password.length > 128) {
    throw new AppError('Password cannot exceed 128 characters long.', 400);
  }

  // Check for existing account
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    if (existingUser.providers.includes('google') && !existingUser.providers.includes('local')) {
      throw new AppError(
        'An account with this email already exists via Google sign-in. Please sign in with Google.',
        409
      );
    }
    throw new AppError('An account with this email address already exists.', 409);
  }

  // Create new user (privileged fields are strictly hardcoded, ignoring request payload overrides)
  const user = new User({
    name: trimmedName,
    email: normalizedEmail,
    password,
    role: 'user',
    providers: ['local'],
    isEmailVerified: false,
    tokenVersion: 0,
  });

  try {
    await user.save();
  } catch (err: unknown) {
    // Map concurrent race condition duplicate key errors to clean HTTP 409
    const mongoErr = err as { code?: number };
    if (mongoErr.code === 11000) {
      throw new AppError('An account with this email address already exists.', 409);
    }
    throw err;
  }

  // Issue session token and set HTTP-only cookie
  const token = generateAuthToken({
    userId: user._id.toString(),
    tokenVersion: user.tokenVersion,
  });
  setAuthCookie(res, token);

  res.status(201).json({
    success: true,
    message: 'Account registered successfully.',
    user: user.toJSON(),
  });
}

/**
 * Controller: Handles user login with email and password.
 *
 * Security Controls:
 * - Returns identical generic HTTP 401 error for unknown email, wrong password,
 *   or Google-only accounts to prevent email enumeration.
 * - Queries with +password and +tokenVersion for secure credential verification.
 * - Sets a fresh session cookie upon successful authentication.
 * - Never logs passwords, raw tokens, or secrets.
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    throw new AppError('Please provide both email and password.', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Find user by normalized email, explicitly selecting password and tokenVersion
  const user = await User.findOne({ email: normalizedEmail }).select('+password +tokenVersion');

  // Generic 401 response helper to prevent email enumeration
  const invalidCredentialsError = new AppError('Invalid email or password.', 401);

  if (!user) {
    throw invalidCredentialsError;
  }

  // Account has no local password (e.g. registered exclusively through Google OAuth)
  if (!user.password) {
    throw invalidCredentialsError;
  }

  // Verify password using User model's constant-time comparePassword method
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw invalidCredentialsError;
  }

  // Issue session token and set HTTP-only cookie
  const token = generateAuthToken({
    userId: user._id.toString(),
    tokenVersion: user.tokenVersion,
  });
  setAuthCookie(res, token);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully.',
    user: user.toJSON(),
  });
}

/**
 * Controller: Handles user logout.
 *
 * Security Controls:
 * - Clears the HTTP-only cookie with matching options (path, secure, sameSite).
 * - Succeeds idempotently even if the cookie was missing or expired.
 */
export function logout(_req: Request, res: Response): void {
  clearAuthCookie(res);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
}

/**
 * Controller: Returns currently authenticated user profile.
 *
 * Security Controls:
 * - Guarded by requireAuth middleware.
 * - Returns only the safe user representation attached to req.user.
 */
export function getMe(req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    user: req.user,
  });
}

/**
 * Controller: Initiates password reset by issuing a 6-digit OTP via email.
 *
 * Security Controls:
 * - Always returns identical generic response whether email exists or not (prevent enumeration).
 * - Hashes OTP with SHA-256 before saving to MongoDB (never stores plaintext OTP).
 * - Enforces 60-second cooldown between resend requests.
 * - 10-minute expiration timestamp.
 * - Invalidates any previous pending reset credential.
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body || {};

  if (!email || typeof email !== 'string') {
    throw new AppError('Please provide a valid email address.', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new AppError('Please provide a valid email address.', 400);
  }

  const genericResponse = {
    success: true,
    message: 'If an account exists with this email address, a password reset code has been sent.',
  };

  const now = new Date();
  const cooldownThreshold = new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS);

  const plainOtp = generateOtp();
  const otpHashed = hashOtp(plainOtp);

  // Atomically enforce 60s cooldown and update OTP; guarantees concurrent requests cannot send duplicate emails
  const updatedUser = await User.findOneAndUpdate(
    {
      email: normalizedEmail,
      $or: [
        { passwordResetLastSent: { $exists: false } },
        { passwordResetLastSent: null },
        { passwordResetLastSent: { $lte: cooldownThreshold } },
      ],
    },
    {
      $set: {
        passwordResetOtpHash: otpHashed,
        passwordResetOtpExpires: new Date(now.getTime() + OTP_VALIDITY_MS),
        passwordResetOtpAttempts: 0,
        passwordResetLastSent: now,
      },
      $unset: {
        passwordResetTokenHash: 1,
        passwordResetTokenExpires: 1,
      },
    },
    { new: true }
  );

  // If user does not exist or resend cooldown is active, return generic response without sending email
  if (!updatedUser) {
    res.status(200).json(genericResponse);
    return;
  }

  try {
    await sendPasswordResetOtp({
      to: updatedUser.email,
      name: updatedUser.name,
      otp: plainOtp,
    });
  } catch (emailErr) {
    console.error(
      '[Email Error] Failed to deliver password reset email:',
      emailErr instanceof Error ? emailErr.message : emailErr
    );
  }

  res.status(200).json(genericResponse);
}

/**
 * Controller: Verifies the 6-digit OTP and issues a short-lived reset credential.
 *
 * Security Controls:
 * - Timing-safe comparison of candidate OTP hash against stored SHA-256 hash.
 * - Atomic increment of failed attempts ($inc) to prevent concurrent brute-force bypass.
 * - Enforces max 5 failed attempts limit before invalidating the OTP.
 * - Checks 10-minute expiration window.
 * - Atomically consumes OTP upon successful verification to prevent concurrent reuse.
 * - Issues a cryptographically random resetToken, storing only its SHA-256 hash in DB.
 * - Does NOT authenticate or issue session cookies.
 */
export async function verifyResetOtp(req: Request, res: Response): Promise<void> {
  const { email, otp } = req.body || {};

  if (!email || typeof email !== 'string') {
    throw new AppError('Email is required.', 400);
  }

  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    throw new AppError('A valid 6-digit verification code is required.', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const candidateOtp = otp.trim();

  const user = await User.findOne({ email: normalizedEmail }).select(
    '+passwordResetOtpHash +passwordResetOtpExpires +passwordResetOtpAttempts'
  );

  const invalidOtpError = new AppError('Invalid or expired password reset code.', 400);

  if (!user || !user.passwordResetOtpHash || !user.passwordResetOtpExpires) {
    throw invalidOtpError;
  }

  // Check expiration
  if (user.passwordResetOtpExpires.getTime() < Date.now()) {
    await User.updateOne(
      { email: normalizedEmail },
      {
        $unset: {
          passwordResetOtpHash: 1,
          passwordResetOtpExpires: 1,
        },
      }
    );
    throw invalidOtpError;
  }

  // Check attempt limit
  const currentAttempts = user.passwordResetOtpAttempts ?? 0;
  if (currentAttempts >= OTP_MAX_ATTEMPTS) {
    await User.updateOne(
      { email: normalizedEmail },
      {
        $unset: {
          passwordResetOtpHash: 1,
          passwordResetOtpExpires: 1,
        },
      }
    );
    throw new AppError('Too many failed verification attempts. Please request a new code.', 400);
  }

  // Verify hash with timing-safe comparison
  const isMatch = verifyOtpHash(candidateOtp, user.passwordResetOtpHash);

  if (!isMatch) {
    // Atomically increment attempt counter in MongoDB to prevent concurrent bypass
    const failedUpdate = await User.findOneAndUpdate(
      {
        email: normalizedEmail,
        passwordResetOtpHash: { $exists: true, $ne: null },
        passwordResetOtpExpires: { $gt: new Date() },
      },
      {
        $inc: { passwordResetOtpAttempts: 1 },
      },
      { new: true }
    ).select('+passwordResetOtpAttempts');

    // Invalidate OTP immediately if attempts reached the maximum allowed limit
    if (failedUpdate && (failedUpdate.passwordResetOtpAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      await User.updateOne(
        { email: normalizedEmail },
        {
          $unset: {
            passwordResetOtpHash: 1,
            passwordResetOtpExpires: 1,
          },
        }
      );
    }

    throw invalidOtpError;
  }

  // On valid verification, atomically consume OTP and transition to reset token
  const { token, hash: resetTokenHash } = generateResetToken();
  const verifiedUser = await User.findOneAndUpdate(
    {
      email: normalizedEmail,
      passwordResetOtpHash: user.passwordResetOtpHash,
      passwordResetOtpExpires: { $gt: new Date() },
      passwordResetOtpAttempts: { $lt: OTP_MAX_ATTEMPTS },
    },
    {
      $set: {
        passwordResetTokenHash: resetTokenHash,
        passwordResetTokenExpires: new Date(Date.now() + RESET_TOKEN_VALIDITY_MS),
      },
      $unset: {
        passwordResetOtpHash: 1,
        passwordResetOtpExpires: 1,
        passwordResetOtpAttempts: 1,
      },
    },
    { new: true }
  );

  if (!verifiedUser) {
    // Concurrent request already consumed the OTP or exhausted attempt limit
    throw invalidOtpError;
  }

  res.status(200).json({
    success: true,
    message: 'Verification code confirmed successfully.',
    resetToken: token,
  });
}

/**
 * Controller: Sets a new password using a verified reset credential.
 *
 * Security & Concurrency Controls:
 * - Atomically claims and consumes the reset credential via findOneAndUpdate, preventing concurrent token reuse.
 * - Validates new password length (8-128 characters).
 * - Delegates password hashing to User model pre-save hook (bcrypt 12 rounds); never double-hashes.
 * - Increments tokenVersion exactly once to revoke all active sessions.
 * - Clears all reset fields to prevent reuse.
 * - For Google-only accounts, establishes local password while preserving Google identity and googleId.
 * - Never returns or sets an authentication cookie after password reset.
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { resetToken, newPassword } = req.body || {};

  if (!resetToken || typeof resetToken !== 'string') {
    throw new AppError('Reset token is required.', 400);
  }

  if (!newPassword || typeof newPassword !== 'string') {
    throw new AppError('New password is required.', 400);
  }

  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters long.', 400);
  }

  if (newPassword.length > 128) {
    throw new AppError('New password cannot exceed 128 characters long.', 400);
  }

  const tokenHash = hashResetToken(resetToken);

  // Atomically claim the reset token by unsetting it; guarantees that at most one concurrent request succeeds
  const user = await User.findOneAndUpdate(
    {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpires: { $gt: new Date() },
    },
    {
      $unset: {
        passwordResetTokenHash: 1,
        passwordResetTokenExpires: 1,
      },
    },
    { new: true }
  ).select('+tokenVersion +providers +password +googleId');

  if (!user) {
    throw new AppError('Invalid, expired, or previously used reset token.', 400);
  }

  // Update password (triggers User model pre-save bcrypt hook exactly once)
  user.password = newPassword;

  // Invalidate all previously issued sessions and JWTs
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;

  // If user was a Google-only account, retain 'google' and add 'local'
  if (!user.providers.includes('local')) {
    user.providers.push('local');
  }

  // Clear all reset state to prevent any stale state
  user.passwordResetOtpHash = undefined;
  user.passwordResetOtpExpires = undefined;
  user.passwordResetOtpAttempts = 0;
  user.passwordResetLastSent = undefined;
  user.passwordResetTokenHash = undefined;
  user.passwordResetTokenExpires = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successfully. Please sign in with your new password.',
  });
}

/**
 * Controller: Initiates Google OAuth2 authorization-code flow.
 *
 * Security Controls:
 * - Fails safely with HTTP 501 if Google OAuth is unconfigured.
 * - Generates cryptographically secure 256-bit random state.
 * - Sets short-lived, HTTP-only, SameSite=Lax state cookie to prevent login CSRF.
 * - Redirects user to Google's official authorization endpoint with minimal scopes ('openid', 'email', 'profile').
 * - Never exposes secrets or client credentials in URL parameters.
 */
export function googleAuthInitiate(_req: Request, res: Response): void {
  if (!env.IS_GOOGLE_AUTH_CONFIGURED) {
    throw new AppError('Google OAuth is not configured on this server.', 501);
  }

  const state = generateOAuthState();
  setOAuthStateCookie(res, state);

  const authorizationUrl = getGoogleAuthorizationUrl(state);
  res.redirect(authorizationUrl);
}

/**
 * Controller: Handles the Google OAuth2 callback.
 *
 * Security & Account Resolution Controls:
 * - Validates and immediately consumes the OAuth state cookie to prevent CSRF and state reuse.
 * - Handles Google authorization denial ('access_denied') safely.
 * - Exchanges authorization code server-side via Google's maintained SDK.
 * - Cryptographically verifies ID token signature, issuer, audience, subject, and expiry.
 * - Requires verified email address (`email_verified === true`).
 * - Matches existing Google account by stable Google subject (`googleId`).
 * - Prohibits automatic account linking with existing local accounts by email alone.
 * - Handles MongoDB duplicate-key race conditions (error 11000) safely.
 * - Sets secure DevLaunch session cookie and redirects to fixed frontend URL (derived from CLIENT_URL).
 * - Never returns tokens or secrets in URLs or API responses.
 */
export async function googleAuthCallback(req: Request, res: Response): Promise<void> {
  const errorRedirect = (code: string) => {
    res.redirect(`${env.CLIENT_URL}/login?error=${encodeURIComponent(code)}`);
  };

  if (!env.IS_GOOGLE_AUTH_CONFIGURED) {
    return errorRedirect('oauth_unconfigured');
  }

  // Handle Google explicit error response (e.g. user cancelled)
  if (req.query.error) {
    const isDenied = req.query.error === 'access_denied';
    return errorRedirect(isDenied ? 'oauth_denied' : 'oauth_failed');
  }

  // Validate and consume the state cookie (cleared on both success and failure)
  const isStateValid = verifyAndConsumeOAuthState(req, res);
  if (!isStateValid) {
    return errorRedirect('oauth_state_mismatch');
  }

  const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
  if (!code) {
    return errorRedirect('oauth_invalid_code');
  }

  let googlePayload: GoogleUserPayload;
  try {
    googlePayload = await exchangeCodeAndVerifyGoogleToken(code);
  } catch (err) {
    console.error(
      '[Google Auth] Code exchange and verification failed:',
      err instanceof Error ? err.message : err
    );
    return errorRedirect('oauth_verification_failed');
  }

  if (!googlePayload.emailVerified) {
    return errorRedirect('oauth_email_unverified');
  }

  // 1. Check if user already exists with this verified Google subject
  let user = await User.findOne({ googleId: googlePayload.sub }).select(
    '+googleId +tokenVersion'
  );

  if (user) {
    // Existing Google user: issue session cookie and redirect
    const token = generateAuthToken({
      userId: user._id.toString(),
      tokenVersion: user.tokenVersion,
    });
    setAuthCookie(res, token);
    res.redirect(`${env.CLIENT_URL}/auth/callback?status=success`);
    return;
  }

  // 2. No user with this googleId. Check if an account already exists with this email.
  const existingEmailUser = await User.findOne({ email: googlePayload.email }).select('+googleId');
  if (existingEmailUser) {
    // Security Policy: Never automatically link accounts based on email match alone.
    // Direct user to authenticate via their established method.
    return errorRedirect('account_exists_local');
  }

  // 3. New user registration via Google OAuth
  const newUser = new User({
    name: googlePayload.name?.trim() || 'Google User',
    email: googlePayload.email,
    providers: ['google'],
    googleId: googlePayload.sub,
    avatarUrl: googlePayload.picture,
    isEmailVerified: true,
    role: 'user',
    tokenVersion: 0,
  });

  try {
    await newUser.save();
    user = newUser;
  } catch (err: unknown) {
    const mongoErr = err as { code?: number };
    if (mongoErr.code === 11000) {
      // Handle concurrent duplicate-key race condition
      const raceUser = await User.findOne({ googleId: googlePayload.sub }).select(
        '+googleId +tokenVersion'
      );
      if (raceUser) {
        user = raceUser;
      } else {
        return errorRedirect('account_exists_local');
      }
    } else {
      throw err;
    }
  }

  const token = generateAuthToken({
    userId: user._id.toString(),
    tokenVersion: user.tokenVersion,
  });
  setAuthCookie(res, token);
  res.redirect(`${env.CLIENT_URL}/auth/callback?status=success`);
}

