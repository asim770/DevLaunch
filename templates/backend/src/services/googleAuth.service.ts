import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';

export interface GoogleUserPayload {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface GoogleAuthServiceContract {
  getGoogleAuthorizationUrl(state: string): string;
  exchangeCodeAndVerifyGoogleToken(code: string): Promise<GoogleUserPayload>;
}

const VALID_GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Creates and configures the official Google OAuth2 client.
 */
function createOAuth2Client(): OAuth2Client {
  return new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_CALLBACK_URL,
  });
}

/**
 * Default live Google OAuth service implementation using google-auth-library.
 */
class DefaultGoogleAuthService implements GoogleAuthServiceContract {
  getGoogleAuthorizationUrl(state: string): string {
    if (!env.IS_GOOGLE_AUTH_CONFIGURED || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CALLBACK_URL) {
      throw new Error('Google OAuth is not configured on this server.');
    }

    const client = createOAuth2Client();
    return client.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });
  }

  async exchangeCodeAndVerifyGoogleToken(code: string): Promise<GoogleUserPayload> {
    if (!env.IS_GOOGLE_AUTH_CONFIGURED || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth is not configured on this server.');
    }

    const client = createOAuth2Client();

    // Exchange authorization code for tokens server-side
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      throw new Error('Google authorization response did not include an ID token.');
    }

    // Cryptographically verify ID token signature, audience, expiry, and issuer
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Unable to parse verified Google ID token payload.');
    }

    // Verify issuer claim
    if (!payload.iss || !VALID_GOOGLE_ISSUERS.includes(payload.iss)) {
      throw new Error(`Invalid ID token issuer: ${payload.iss}`);
    }

    // Verify audience claim
    if (payload.aud !== env.GOOGLE_CLIENT_ID) {
      throw new Error(`ID token audience mismatch: expected ${env.GOOGLE_CLIENT_ID}, received ${payload.aud}`);
    }

    // Verify subject claim (stable Google user ID)
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('Missing or invalid subject claim (sub) in Google ID token.');
    }

    // Verify email claim
    if (!payload.email || typeof payload.email !== 'string') {
      throw new Error('Missing or invalid email claim in Google ID token.');
    }

    return {
      sub: payload.sub,
      email: payload.email.trim().toLowerCase(),
      emailVerified: Boolean(payload.email_verified),
      name: payload.name?.trim(),
      picture: payload.picture?.trim(),
    };
  }
}

// Active service instance, allowing test seams to inject mock verifiers without network dependencies
let activeService: GoogleAuthServiceContract = new DefaultGoogleAuthService();

export function getGoogleAuthorizationUrl(state: string): string {
  return activeService.getGoogleAuthorizationUrl(state);
}

export async function exchangeCodeAndVerifyGoogleToken(code: string): Promise<GoogleUserPayload> {
  return activeService.exchangeCodeAndVerifyGoogleToken(code);
}

/**
 * Test Seam: Overrides the GoogleAuthService implementation for automated testing.
 */
export function setGoogleAuthServiceOverride(override: GoogleAuthServiceContract | null): void {
  if (override) {
    activeService = override;
  } else {
    activeService = new DefaultGoogleAuthService();
  }
}

/**
 * Test Seam: Resets the GoogleAuthService back to the default implementation.
 */
export function resetGoogleAuthService(): void {
  activeService = new DefaultGoogleAuthService();
}
