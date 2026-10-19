import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User, AuthContextType } from '../types/auth';
import { authApi, ApiError } from '../api/client';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider manages the authenticated user session.
 *
 * Security & Session Architecture:
 * - Session state is initialized by calling GET /api/auth/me with HTTP-only credentials.
 * - HTTP-only session cookies are never read or stored by client-side JavaScript.
 * - On 401 Unauthorized, the session cleanly transitions to unauthenticated without application error.
 * - After logout or session expiration, client state is cleared immediately.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Refreshes the session by querying GET /api/auth/me with credentials.
   * Returns the authenticated User or null if unauthenticated.
   */
  const refreshSession = useCallback(async (): Promise<User | null> => {
    try {
      const activeUser = await authApi.getMe();
      setUser(activeUser);
      return activeUser;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Expected for unauthenticated visitors; do not log as application error
        setUser(null);
      } else {
        // Network or server failure
        console.warn('[AuthContext] Session hydration notice:', err instanceof Error ? err.message : err);
        setUser(null);
      }
      return null;
    }
  }, []);

  // Hydrate session once on initial mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await refreshSession();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refreshSession]);

  /**
   * Logs in using email and password.
   */
  const login = useCallback(async (credentials: { email: string; password: string }): Promise<void> => {
    setIsLoading(true);
    try {
      const authenticatedUser = await authApi.login(credentials);
      setUser(authenticatedUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Registers a new user account using name, email, and password.
   */
  const register = useCallback(
    async (payload: { name: string; email: string; password: string }): Promise<void> => {
      setIsLoading(true);
      try {
        const newUser = await authApi.register(payload);
        setUser(newUser);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Logs out the user session.
   * Always clears local user state, even if the backend request encounters an error.
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('[AuthContext] Error communicating with logout endpoint:', err);
    } finally {
      setUser(null);
    }
  }, []);

  /**
   * Development demo helper (disabled in production).
   */
  const setDemoAuthenticated = useCallback((authenticated: boolean): void => {
    if (!import.meta.env.DEV) {
      console.warn('[DevLaunch Auth] Demo authentication helper is disabled in production.');
      return;
    }

    if (authenticated) {
      setUser({
        id: 'dev-user-001',
        name: 'DevLaunch Developer',
        email: 'developer@devlaunch.local',
        role: 'user',
        providers: ['local'],
        isEmailVerified: true,
      });
    } else {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
      refreshSession,
      setDemoAuthenticated,
    }),
    [user, isLoading, login, register, logout, refreshSession, setDemoAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
