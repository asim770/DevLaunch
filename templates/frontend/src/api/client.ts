import { User } from '../types/auth';

/**
 * Resolves the API base URL.
 * Defaults to '/api' so Vite proxy routes to http://localhost:5000 in development,
 * or uses VITE_API_BASE_URL when explicitly configured in production.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Generic JSON API request wrapper.
 * Always includes `credentials: 'include'` so HTTP-only session cookies
 * are transmitted and preserved across requests.
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Unable to connect to the server. Please check your network connection.', 0);
  }

  // Handle empty bodies (e.g. 204 No Content)
  const text = await response.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const errorMessage =
      typeof data.error === 'string'
        ? data.error
        : typeof data.message === 'string'
          ? data.message
          : `Request failed with status ${response.status}`;

    throw new ApiError(errorMessage, response.status, data);
  }

  return data as unknown as T;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user: User;
}

export interface SimpleMessageResponse {
  success: boolean;
  message: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  resetToken: string;
}

/**
 * Authentication API Client.
 */
export const authApi = {
  /**
   * Fetches the profile of the currently authenticated user session.
   * Calls GET /auth/me with credentials.
   */
  async getMe(): Promise<User> {
    const res = await request<AuthResponse>('/auth/me', { method: 'GET' });
    return res.user;
  },

  /**
   * Logs in with email and password.
   * Calls POST /auth/login.
   */
  async login(credentials: { email: string; password: string }): Promise<User> {
    const res = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    return res.user;
  },

  /**
   * Registers a new account.
   * Calls POST /auth/register.
   */
  async register(payload: { name: string; email: string; password: string }): Promise<User> {
    const res = await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.user;
  },

  /**
   * Logs out the current user session by clearing the server HTTP-only cookie.
   * Calls POST /auth/logout.
   */
  async logout(): Promise<void> {
    await request<SimpleMessageResponse>('/auth/logout', { method: 'POST' });
  },

  /**
   * Requests a 6-digit password reset OTP email.
   * Calls POST /auth/forgot-password.
   */
  async forgotPassword(email: string): Promise<string> {
    const res = await request<SimpleMessageResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return res.message;
  },

  /**
   * Submits email and 6-digit OTP to verify and obtain a single-use resetToken.
   * Calls POST /auth/verify-reset-otp.
   */
  async verifyResetOtp(email: string, otp: string): Promise<string> {
    const res = await request<VerifyOtpResponse>('/auth/verify-reset-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
    return res.resetToken;
  },

  /**
   * Resets password using the single-use resetToken.
   * Calls POST /auth/reset-password.
   */
  async resetPassword(payload: { resetToken: string; newPassword: string }): Promise<string> {
    const res = await request<SimpleMessageResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.message;
  },

  /**
   * Returns the full URL to initiate Google OAuth 2.0 authorization-code flow.
   */
  getGoogleAuthUrl(): string {
    return `${API_BASE_URL}/auth/google`;
  },
};
