import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home, LayoutDashboard } from 'lucide-react';
import { Button } from '../components/common/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-800">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12 space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Compass className="h-8 w-8 animate-pulse" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-600">404 Error</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            The route you navigated to doesn&apos;t exist or has been moved. Check the URL or return to a valid page below.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link to="/" className="w-full sm:w-auto">
            <Button variant="primary" leftIcon={<Home className="h-4 w-4" />} className="w-full">
              Back to Home
            </Button>
          </Link>
          <Link to="/dashboard" className="w-full sm:w-auto">
            <Button variant="outline" leftIcon={<LayoutDashboard className="h-4 w-4" />} className="w-full">
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
