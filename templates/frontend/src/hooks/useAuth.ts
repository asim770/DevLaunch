import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { AuthContextType } from '../types/auth';

/**
 * Access the authentication context.
 * Must be used within an AuthProvider component tree.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
