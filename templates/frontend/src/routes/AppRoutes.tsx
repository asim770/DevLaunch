import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { MainLayout } from '../components/layout';
import { ProtectedRoute } from './ProtectedRoute';
import {
  HomePage,
  LoginPage,
  SignupPage,
  ForgotPasswordPage,
  DashboardPage,
  ProfilePage,
  SettingsPage,
  NotFoundPage,
  AuthCallbackPage,
} from '../pages';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Marketing & Authentication pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Protected Application pages */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <MainLayout>
              <DashboardPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ProfilePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <MainLayout>
              <SettingsPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Catch-all 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
