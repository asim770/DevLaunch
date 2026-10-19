import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  googleAuthInitiate,
  googleAuthCallback,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  forgotPasswordLimiter,
  verifyOtpLimiter,
  loginLimiter,
  registerLimiter,
} from '../middleware/rateLimiter.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authRouter = Router();

// Public Authentication Endpoints
authRouter.post('/register', registerLimiter, asyncHandler(register));
authRouter.post('/login', loginLimiter, asyncHandler(login));
authRouter.post('/logout', logout);

// Google OAuth 2.0 Endpoints
authRouter.get('/google', googleAuthInitiate);
authRouter.get('/google/callback', asyncHandler(googleAuthCallback));

// Password Reset & Recovery Endpoints
authRouter.post('/forgot-password', forgotPasswordLimiter, asyncHandler(forgotPassword));
authRouter.post('/verify-reset-otp', verifyOtpLimiter, asyncHandler(verifyResetOtp));
authRouter.post('/reset-password', asyncHandler(resetPassword));

// Protected Authentication Endpoints
authRouter.get('/me', asyncHandler(requireAuth), getMe);

