import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader } from '../components/common/Loader';

export interface ProtectedRouteProps {
  children?: React.ReactNode;
}

/**
 * Route guard component protecting private views.
 *
 * Behavior:
 * - If auth is resolving (isLoading): renders fullScreen Loader.
 * - If unauthenticated: redirects to /login with original location state for redirection.
 * - If authenticated: renders child components or nested Route Outlet.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Loader fullScreen text="Checking authentication status..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
