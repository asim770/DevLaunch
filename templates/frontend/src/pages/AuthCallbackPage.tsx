import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Rocket, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Loader } from '../components/common/Loader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/common/Card';
import { Button } from '../components/common/Button';

export const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const verifyCallbackSession = async () => {
      const status = searchParams.get('status');

      // Clear query parameters from URL immediately without reloading
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, document.title, url.pathname);

      if (status !== 'success') {
        if (!isCancelled) {
          setErrorMessage('Google authentication could not be completed. Please try signing in again.');
        }
        return;
      }

      // Do NOT treat ?status=success by itself as proof of authentication.
      // Explicitly verify the session by calling GET /api/auth/me with HTTP-only credentials.
      try {
        const authenticatedUser = await refreshSession();
        if (authenticatedUser && !isCancelled) {
          navigate('/dashboard', { replace: true });
        } else if (!isCancelled) {
          setErrorMessage('Failed to verify active session. Please sign in again.');
        }
      } catch {
        if (!isCancelled) {
          setErrorMessage('Unable to verify Google authentication session. Please try again.');
        }
      }
    };

    verifyCallbackSession();

    return () => {
      isCancelled = true;
    };
  }, [searchParams, refreshSession, navigate]);

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
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
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-2">
                <AlertCircle className="h-6 w-6" aria-hidden="true" />
              </div>
              <CardTitle as="h1" className="text-xl">Authentication Notice</CardTitle>
              <CardDescription>We could not complete your sign in</CardDescription>
            </CardHeader>

            <CardContent>
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                {errorMessage}
              </div>
            </CardContent>

            <CardFooter className="justify-center border-t border-slate-100 pt-4">
              <Link to="/login" className="w-full">
                <Button variant="primary" className="w-full flex items-center justify-center gap-2">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Return to Sign In
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return <Loader fullScreen text="Verifying your Google session..." />;
};
