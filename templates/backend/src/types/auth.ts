import { UserRole, AuthProvider } from '../models/User.js';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  providers: AuthProvider[];
  avatarUrl?: string;
  isEmailVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}
