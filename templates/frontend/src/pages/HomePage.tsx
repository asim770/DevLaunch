import React from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Zap, Shield, Database, LayoutDashboard, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card, CardContent } from '../components/common/Card';

export const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
              <Rocket className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">DevLaunch</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button variant="primary" size="sm">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Status Notice Banner */}
        <div className="bg-sky-50 border-b border-sky-100 py-2.5 px-4 text-center">
          <p className="text-xs sm:text-sm text-sky-800 font-medium inline-flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
            DevLaunch Starter Template • Frontend scaffold ready for backend integration
          </p>
        </div>

        {/* Hero Section */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-200 px-3.5 py-1 text-xs font-semibold text-brand-700 mb-6">
            <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Modern Full-Stack Boilerplate</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Launch your full-stack app <br className="hidden sm:inline" />
            <span className="text-brand-600">in seconds, not days.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed">
            A production-ready React starter template featuring Vite, Tailwind CSS v3, modular layouts,
            accessible UI components, and pre-configured routing designed to connect seamlessly with Express and MongoDB.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Create an Account
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="outline" size="lg" leftIcon={<LayoutDashboard className="h-4 w-4" />}>
                Explore Dashboard
              </Button>
            </Link>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Engineered for developer productivity
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Clean architecture and modern tooling so you can focus on building features.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:border-slate-300 transition-colors">
              <CardContent className="p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                  <Zap className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Vite + React 18</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Blazing fast hot module replacement and optimized production builds.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-slate-300 transition-colors">
              <CardContent className="p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <Shield className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Tailwind CSS v3</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Utility-first design tokens with customized theme colors and responsive layouts.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-slate-300 transition-colors">
              <CardContent className="p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <Database className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Express + Mongo Ready</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Architected to integrate with a modular Express backend via a configurable API client.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-slate-300 transition-colors">
              <CardContent className="p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Accessible UI Kit</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Reusable Buttons, Inputs, Cards, Loaders, Empty States, and Toasts with ARIA compliance.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-brand-600" aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-800">DevLaunch</span>
            <span className="text-xs text-slate-400">© 2026 DevLaunch. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <Link to="/login" className="hover:text-slate-900">Login</Link>
            <Link to="/signup" className="hover:text-slate-900">Sign Up</Link>
            <Link to="/dashboard" className="hover:text-slate-900">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
