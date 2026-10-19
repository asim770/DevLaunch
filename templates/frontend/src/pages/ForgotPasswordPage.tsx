import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Mail, Lock, KeyRound, ArrowLeft, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { authApi, ApiError } from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/common/Card';

type ResetStage = 'REQUEST_OTP' | 'VERIFY_OTP' | 'RESET_PASSWORD' | 'COMPLETED';

export const ForgotPasswordPage: React.FC = () => {
  const [stage, setStage] = useState<ResetStage>('REQUEST_OTP');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Stage 1: Request OTP
  const handleRequestOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const message = await authApi.forgotPassword(email.trim().toLowerCase());
      setStatusMessage(message);
      setCooldownSeconds(60);
      setStage('VERIFY_OTP');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to send verification code. Please check your network connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend OTP during verification stage
  const handleResendOtp = async () => {
    if (cooldownSeconds > 0 || isSubmitting) return;

    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const message = await authApi.forgotPassword(email.trim().toLowerCase());
      setStatusMessage(message);
      setCooldownSeconds(60);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to resend verification code. Please try again later.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stage 2: Verify OTP
  const handleVerifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedOtp = otp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      setErrorMessage('Please enter a valid 6-digit verification code.');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const token = await authApi.verifyResetOtp(email.trim().toLowerCase(), trimmedOtp);
      setResetToken(token);
      setStage('RESET_PASSWORD');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to verify code. Please verify your connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stage 3: Reset Password
  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !resetToken) return;

    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const message = await authApi.resetPassword({
        resetToken,
        newPassword,
      });
      // Clear memory credential immediately upon success
      setResetToken(null);
      setNewPassword('');
      setConfirmPassword('');
      setStatusMessage(message);
      setStage('COMPLETED');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to reset password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 p-1"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
            <Rocket className="h-6 w-6" aria-hidden="true" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">DevLaunch</span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle as="h1" className="text-xl">
              {stage === 'REQUEST_OTP' && 'Reset your password'}
              {stage === 'VERIFY_OTP' && 'Enter verification code'}
              {stage === 'RESET_PASSWORD' && 'Create new password'}
              {stage === 'COMPLETED' && 'Password updated'}
            </CardTitle>
            <CardDescription>
              {stage === 'REQUEST_OTP' && 'Enter your email address to receive a 6-digit recovery code.'}
              {stage === 'VERIFY_OTP' && `We sent a 6-digit code to ${email}.`}
              {stage === 'RESET_PASSWORD' && 'Choose a strong password with at least 8 characters.'}
              {stage === 'COMPLETED' && 'Your password has been reset successfully.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Status notice */}
            {statusMessage && stage !== 'COMPLETED' && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800"
              >
                <CheckCircle2 className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>{statusMessage}</div>
              </div>
            )}

            {/* Error notice */}
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>{errorMessage}</div>
              </div>
            )}

            {/* STAGE 1: Request OTP */}
            {stage === 'REQUEST_OTP' && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  id="reset-email"
                  placeholder="developer@example.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  icon={<Mail className="h-4 w-4" aria-hidden="true" />}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2"
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                >
                  Send Verification Code
                </Button>
              </form>
            )}

            {/* STAGE 2: Verify OTP */}
            {stage === 'VERIFY_OTP' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <Input
                  label="6-Digit Verification Code"
                  type="text"
                  id="reset-otp"
                  placeholder="123456"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={isSubmitting}
                  helperText="Enter the 6-digit numeric code sent to your inbox"
                  icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2"
                  isLoading={isSubmitting}
                  disabled={isSubmitting || otp.length !== 6}
                >
                  Verify Code
                </Button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStage('REQUEST_OTP');
                      setErrorMessage(null);
                    }}
                    className="text-slate-500 hover:text-slate-800 underline"
                  >
                    Change email
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={cooldownSeconds > 0 || isSubmitting}
                    className={`inline-flex items-center gap-1 font-medium ${
                      cooldownSeconds > 0 || isSubmitting
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-brand-600 hover:text-brand-700 hover:underline'
                    }`}
                  >
                    <RefreshCw className={`h-3 w-3 ${isSubmitting ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span>{cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend code'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* STAGE 3: Reset Password */}
            {stage === 'RESET_PASSWORD' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <Input
                  label="New Password"
                  type="password"
                  id="new-password"
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSubmitting}
                  helperText="Must be at least 8 characters long"
                  icon={<Lock className="h-4 w-4" aria-hidden="true" />}
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  id="confirm-new-password"
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  icon={<Lock className="h-4 w-4" aria-hidden="true" />}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2"
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                >
                  Update Password
                </Button>
              </form>
            )}

            {/* STAGE 4: Completed */}
            {stage === 'COMPLETED' && (
              <div className="text-center py-4 space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                </div>
                <p className="text-xs text-slate-600">
                  Your password has been changed. You can now sign in with your updated credentials.
                </p>
                <Link to="/login" className="block w-full">
                  <Button variant="primary" className="w-full">
                    Return to Sign In
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>

          <CardFooter className="justify-center border-t border-slate-100 pt-4 text-xs text-slate-600">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
