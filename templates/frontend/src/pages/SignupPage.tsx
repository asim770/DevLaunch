import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Rocket, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { authApi, ApiError } from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/common/Card';

export const SignupPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);

    // Client-side validations
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      setErrorMessage('Name must be between 2 and 50 characters long.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        name: trimmedName,
        email: email.trim().toLowerCase(),
        password,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unable to create account. Please check your network connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = () => {
    setErrorMessage(null);
    window.location.href = authApi.getGoogleAuthUrl();
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
              Create your account
            </CardTitle>
            <CardDescription>Start building your application with DevLaunch</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error Message */}
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>{errorMessage}</div>
              </div>
            )}

            {/* Google Sign Up Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={handleGoogleSignUp}
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
                label="Full Name"
                type="text"
                id="signup-name"
                placeholder="Ada Lovelace"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                icon={<User className="h-4 w-4" aria-hidden="true" />}
              />

              <Input
                label="Email address"
                type="email"
                id="signup-email"
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
                id="signup-password"
                placeholder="••••••••"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                helperText="Must be at least 8 characters long"
                icon={<Lock className="h-4 w-4" aria-hidden="true" />}
              />

              <Input
                label="Confirm Password"
                type="password"
                id="signup-confirm-password"
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
                Create Account
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center border-t border-slate-100 pt-4 text-xs text-slate-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="ml-1 font-semibold text-brand-600 hover:text-brand-700 hover:underline"
            >
              Sign in
            </Link>
          </CardFooter>
        </Card>

        {/* Back to Home Link */}
        <div className="text-center mt-4">
          <Link to="/" className="text-xs text-slate-500 hover:text-slate-800">
            ← Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
};
