/**
 * Safe user profile representation for UI presentation.
 * Maps to the backend User model serialization; never stores passwords or server secrets.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  providers?: string[];
  avatarUrl?: string;
  isEmailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Authentication context interface.
 * Defines the contract for real session management and routing guards.
 */
export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<User | null>;
  /**
   * Explicit development/demo helper to test protected views in development mode only.
   */
  setDemoAuthenticated?: (authenticated: boolean) => void;
}
