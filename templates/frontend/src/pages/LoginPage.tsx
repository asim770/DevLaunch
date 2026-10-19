import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Rocket, Mail, Lock, Info, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { authApi, ApiError } from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/common/Card';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_unconfigured: 'Google sign-in is not configured on this server.',
  oauth_denied: 'Google sign-in was cancelled or access was denied.',
  oauth_state_mismatch: 'Security verification failed. Please try signing in with Google again.',
  oauth_invalid_code: 'Invalid Google authorization code. Please try again.',
  oauth_verification_failed: 'Failed to verify Google identity token. Please try again.',
  oauth_email_unverified: 'Your Google email address is not verified by Google. Please verify it or sign in locally.',
  account_exists_local: 'An account already exists with this email address. Please sign in using your password.',
  oauth_failed: 'Google sign-in failed. Please try again.',
};

export const LoginPage: React.FC = () => {
  const { isAuthenticated, login, setDemoAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fromLocation = location.state as { from?: { pathname: string } } | undefined;
  const redirectTarget = fromLocation?.from?.pathname || '/dashboard';

  // Read and sanitize OAuth errors from query parameters
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const friendlyMessage =
        OAUTH_ERROR_MESSAGES[errorParam] || 'Authentication failed. Please try signing in again.';
      setErrorMessage(friendlyMessage);

      // Clean query parameter from visible URL bar without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
    }
  }, [searchParams]);

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTarget, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTarget]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login({ email: email.trim(), password });
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unable to sign in. Please verify your connection and credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    setErrorMessage(null);
    window.location.href = authApi.getGoogleAuthUrl();
  };

  const handleToggleDemoAuth = () => {
    if (!setDemoAuthenticated) return;

    if (!isAuthenticated) {
      setDemoAuthenticated(true);
      navigate(redirectTarget, { replace: true });
    } else {
      setDemoAuthenticated(false);
      setErrorMessage(null);
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

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 space-y-4">
        {/* Redirect Notice if user was redirected from a protected route */}
        {fromLocation?.from?.pathname && !isAuthenticated && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800"
          >
            <Info className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-semibold">Protected Route:</span> You must be signed in to access{' '}
              <code className="font-mono bg-sky-100 px-1 py-0.5 rounded text-sky-900">
                {fromLocation.from.pathname}
              </code>
              .
            </div>
          </div>
        )}

        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle as="h1" className="text-xl">
              Sign in to your account
            </CardTitle>
            <CardDescription>Enter your credentials to access your dashboard</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error Notice */}
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>{errorMessage}</div>
              </div>
            )}

            {/* Google Sign In Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </Button>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-2.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Or with email
              </span>
              <div className="border-t border-slate-200 w-full" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                id="login-email"
                placeholder="developer@example.com"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                icon={<Mail className="h-4 w-4" aria-hidden="true" />}
              />

              <Input
                label="Password"
                type="password"
                id="login-password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                icon={<Lock className="h-4 w-4" aria-hidden="true" />}
              />

              <div className="flex items-center justify-between text-xs">
                <span />
                <Link
                  to="/forgot-password"
                  className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isSubmitting}
                disabled={isSubmitting}
              >
                Sign In
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center border-t border-slate-100 pt-4 text-xs text-slate-600">
            Don&apos;t have an account?{' '}
            <Link
              to="/signup"
              className="ml-1 font-semibold text-brand-600 hover:text-brand-700 hover:underline"
            >
              Sign up
            </Link>
          </CardFooter>
        </Card>

        {/* Explicit Development Demo Helper (Visible only in development mode) */}
        {import.meta.env.DEV && setDemoAuthenticated && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-600 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
                Development Demo Helper
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                Dev Only
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Use this explicit in-memory toggle to test client-side route guards without authenticating against the live backend API.
            </p>

            <Button
              type="button"
              variant={isAuthenticated ? 'outline' : 'secondary'}
              size="sm"
              className="w-full text-xs"
              onClick={handleToggleDemoAuth}
            >
              {isAuthenticated
                ? 'Clear Demo Session (Sign Out)'
                : 'Enable Demo Session & Preview Protected Routes'}
            </Button>
          </div>
        )}

        {/* Back to Home Link */}
        <div className="text-center pt-2">
          <Link to="/" className="text-xs text-slate-500 hover:text-slate-800">
            ← Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
};
