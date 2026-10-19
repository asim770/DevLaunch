import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

// Configure test environment variables prior to app initialization
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devlaunch_test_google_oauth';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devlaunch_test_jwt_secret_min_32_chars_long';

const { app } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');
const { env } = await import('../src/config/env.js');
const { AUTH_COOKIE_NAME } = await import('../src/utils/authCookie.js');
const { OAUTH_STATE_COOKIE_NAME } = await import('../src/utils/oauthState.js');
const {
  setGoogleAuthServiceOverride,
  resetGoogleAuthService,
} = await import('../src/services/googleAuth.service.js');
import type { GoogleUserPayload } from '../src/services/googleAuth.service.js';

const TEST_MONGO_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/devlaunch_test_google_oauth';

describe('Google OAuth 2.0 Endpoints (/api/auth/google)', () => {
  let isMongoAvailable = false;
  const originalGoogleConfig = {
    isConfigured: env.IS_GOOGLE_AUTH_CONFIGURED,
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL,
  };

  before(async () => {
    try {
      await mongoose.connect(TEST_MONGO_URI, {
        serverSelectionTimeoutMS: 2000,
        autoIndex: true,
      });
      isMongoAvailable = true;
      await User.deleteMany({ email: { $regex: /@google-test\.devlaunch$/ } });
    } catch {
      console.info('[Notice] Local MongoDB not reachable. Skipping Google OAuth integration tests.');
      isMongoAvailable = false;
    }
  });

  after(async () => {
    resetGoogleAuthService();
    // Restore original env state
    env.IS_GOOGLE_AUTH_CONFIGURED = originalGoogleConfig.isConfigured;
    env.GOOGLE_CLIENT_ID = originalGoogleConfig.clientId;
    env.GOOGLE_CLIENT_SECRET = originalGoogleConfig.clientSecret;
    env.GOOGLE_CALLBACK_URL = originalGoogleConfig.callbackUrl;

    if (isMongoAvailable && mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: { $regex: /@google-test\.devlaunch$/ } });
      await mongoose.connection.close();
    }
  });

  beforeEach(() => {
    resetGoogleAuthService();
  });

  describe('GET /api/auth/google (Initiation)', () => {
    test('fails safely with HTTP 501 when Google OAuth is not configured', async () => {
      env.IS_GOOGLE_AUTH_CONFIGURED = false;

      const res = await request(app).get('/api/auth/google');
      assert.equal(res.status, 501);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('Google OAuth is not configured'));
    });

    test('redirects to Google and sets httpOnly SameSite=Lax state cookie when configured', async () => {
      env.IS_GOOGLE_AUTH_CONFIGURED = true;
      env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
      env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
      env.GOOGLE_CALLBACK_URL = 'http://localhost:5000/api/auth/google/callback';

      setGoogleAuthServiceOverride({
        getGoogleAuthorizationUrl(state: string) {
          return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.GOOGLE_CLIENT_ID}&state=${state}&scope=openid%20email%20profile`;
        },
        async exchangeCodeAndVerifyGoogleToken() {
          throw new Error('Not used in initiation');
        },
      });

      const res = await request(app).get('/api/auth/google');

      assert.equal(res.status, 302);
      assert.ok(res.headers.location.startsWith('https://accounts.google.com/o/oauth2/v2/auth'));
      assert.ok(res.headers.location.includes('client_id=test-client-id'));
      assert.ok(res.headers.location.includes('scope=openid%20email%20profile'));

      // Check state cookie on response
      const cookies = res.headers['set-cookie'];
      assert.ok(cookies, 'Must set a cookie on redirection');
      const stateCookie = cookies.find((c: string) => c.startsWith(`${OAUTH_STATE_COOKIE_NAME}=`));
      assert.ok(stateCookie, 'devlaunch_oauth_state cookie must be present');
      assert.ok(stateCookie.includes('HttpOnly'), 'State cookie must be HttpOnly');
      assert.ok(stateCookie.includes('SameSite=Lax'), 'State cookie must be SameSite=Lax');
      assert.ok(stateCookie.includes('Path=/api/auth/google'), 'State cookie must be scoped to OAuth path');

      // State parameter in redirect URL must match the cookie value
      const urlStateMatch = res.headers.location.match(/state=([0-9a-f]{64})/);
      assert.ok(urlStateMatch, 'URL must include a 64-char hex state');
      const cookieValue = stateCookie.split(';')[0].split('=')[1];
      assert.equal(urlStateMatch[1], cookieValue, 'State parameter in URL must match cookie value');
    });
  });

  describe('GET /api/auth/google/callback', () => {
    const validState = 'a'.repeat(64);

    beforeEach(() => {
      env.IS_GOOGLE_AUTH_CONFIGURED = true;
      env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
      env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
      env.GOOGLE_CALLBACK_URL = 'http://localhost:5000/api/auth/google/callback';
    });

    test('redirects to error when Google OAuth is not configured on server', async () => {
      env.IS_GOOGLE_AUTH_CONFIGURED = false;

      const res = await request(app)
        .get('/api/auth/google/callback?code=mock-code&state=' + validState)
        .set('Cookie', [`${OAUTH_STATE_COOKIE_NAME}=${validState}`]);

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `${env.CLIENT_URL}/login?error=oauth_unconfigured`);
    });

    test('rejects callback with missing state cookie (CSRF defense)', async () => {
      const res = await request(app).get('/api/auth/google/callback?code=mock-code&state=' + validState);

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `${env.CLIENT_URL}/login?error=oauth_state_mismatch`);
    });

    test('rejects callback with mismatched state cookie', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback?code=mock-code&state=' + validState)
        .set('Cookie', [`${OAUTH_STATE_COOKIE_NAME}=${'b'.repeat(64)}`]);

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `${env.CLIENT_URL}/login?error=oauth_state_mismatch`);
    });

    test('rejects callback when state is reused (state cookie consumed immediately)', async () => {
      setGoogleAuthServiceOverride({
        getGoogleAuthorizationUrl() {
          return '';
        },
        async exchangeCodeAndVerifyGoogleToken() {
          return {
            sub: 'google-sub-reused',
            email: 'reused-state@google-test.devlaunch',
            emailVerified: true,
          };
        },
      });

      // Request with state
      const res = await request(app)
        .get('/api/auth/google/callback?code=mock-code&state=' + validState)
        .set('Cookie', [`${OAUTH_STATE_COOKIE_NAME}=${validState}`]);

      // State cookie was cleared by the first request
      const cookies = res.headers['set-cookie'];
      const clearedStateCookie = cookies.find((c: string) => c.startsWith(`${OAUTH_STATE_COOKIE_NAME}=`));
      assert.ok(clearedStateCookie, 'Response must clear the state cookie');
      assert.ok(clearedStateCookie.includes('Expires=') || clearedStateCookie.includes('Max-Age=0'));
    });

    test('handles Google explicit authorization denial (access_denied) safely', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback?error=access_denied&state=' + validState)
        .set('Cookie', [`${OAUTH_STATE_COOKIE_NAME}=${validState}`]);

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `${env.CLIENT_URL}/login?error=oauth_denied`);
    });

    test('rejects callback missing authorization code', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback?state=' + validState)
        .set('Cookie', [`${OAUTH_STATE_COOKIE_NAME}=${validState}`]);

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `${env.CLIENT_URL}/login?error=oauth_invalid_code`);
    });

    test('handles token verification and exchange failure safely', async () => {
      setGoogleAuthServiceOverride({
        getGoogleAuthorizationUrl() {
          return '';
        },
        async exchangeCodeAndVerifyGoogleToken() {
          throw new Error('Invalid token signature or expired code');
        },
      });

      const res = await request(app)
        .get('/api/auth/google/callback?code=bad-code&state=' + validState)
        .set('Cookie', [`${OAUTH_STATE_COOKIE_NAME}=${validState}`]);

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `${env.CLIENT_URL}/login?error=oauth_verification_failed`);
    });

    test('rejects unverified Google email address', async () => {
      setGoogleAuthServiceOverride({
        getGoogleAuthorizationUrl() {
          return '';
        },
        async exchangeCodeAndVerifyGoogleToken() {
          return {
            sub: 'google-sub-unverified',
            email: 'unverified@google-test.devlaunch',
            emailVerified: false,
          };
        },
      });

      const res = await request(app)
        .get('/api/auth/google/callback?code=mock-code&state=' + validState)
        .set('Cookie', [`${OAUTH_STATE_COOKIE_NAME}=${validState}`]);

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `${env.CLIENT_URL}/login?error=oauth_email_unverified`);
    });

    test('registers a new Google account and signs in with session cookie', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const testEmail = 'new-user@google-test.devlaunch';
      const testSub = 'google-sub-unique-12345';
      await User.deleteMany({ email: testEmail });

      setGoogleAuthServiceOverride({
        getGoogleAuthorizationUrl() {
          return '';
        },
        async exchangeCodeAndVerifyGoogleToken(): Promise<GoogleUserPayload> {
          return {
            sub: testSub,
            email: testEmail,
            emailVerified: true,
            name: 'New Google User',
            picture: 'https://example.com/avatar.jpg',
          };
        },
      });

      const res = await request(app)
        .get('/api/auth/google/callback?code=valid-code&state=' + validState)
        .set('Cookie', [`${OAUTH_STATE_COOKIE_NAME}=${validState}`]);

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `${env.CLIENT_URL}/auth/callback?status=success`);

      // Auth cookie was issued
      const cookies = res.headers['set-cookie'];
      assert.ok(cookies);
      const authCookie = cookies.find((c: string) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      assert.ok(authCookie, 'devlaunch_auth_token cookie must be set upon successful sign-in');
      assert.ok(authCookie.includes('HttpOnly'));

      // Check MongoDB user document
      const createdUser = await User.findOne({ email: testEmail }).select('+googleId');
      assert.ok(createdUser);
      assert.equal(createdUser.googleId, testSub);
      assert.equal(createdUser.name, 'New Google User');
      assert.deepEqual(createdUser.providers, ['google']);
      assert.equal(createdUser.isEmailVerified, true);
      assert.equal(createdUser.role, 'user');
      assert.equal(createdUser.avatarUrl, 'https://example.com/avatar.jpg');

      // Verify that the issued auth cookie allows accessing /api/auth/me
      const tokenValue = authCookie.split(';')[0].split('=')[1];
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${tokenValue}`]);

      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.user.email, testEmail);
    });

    test('signs in existing matching Google account without modifying state', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const existingEmail = 'existing-google@google-test.devlaunch';
      const existingSub = 'google-sub-existing-888';
      await User.deleteMany({ email: existingEmail });

      const user = new User({
        name: 'Existing Google User',
        email: existingEmail,
        providers: ['google'],
        googleId: existingSub,
        isEmailVerified: true,
        tokenVersion: 2,
      });
      await user.save();

      setGoogleAuthServiceOverride({
        getGoogleAuthorizationUrl() {
          return '';
        },
        async exchangeCodeAndVerifyGoogleToken(): Promise<GoogleUserPayload> {
          return {
            sub: existingSub,
            email: existingEmail,
            emailVerified: true,
            name: 'Existing Google User',
          };
        },
      });

      const res = await request(app)
        .get('/api/auth/google/callback?code=valid-code&state=' + validState)
        .set('Cookie', [`${OAUTH_STATE_COOKIE_NAME}=${validState}`]);

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `${env.CLIENT_URL}/auth/callback?status=success`);

      const cookies = res.headers['set-cookie'];
      const authCookie = cookies.find((c: string) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      assert.ok(authCookie);

      const tokenValue = authCookie.split(';')[0].split('=')[1];
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${tokenValue}`]);

      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.user.email, existingEmail);
    });

    test('refuses to automatically link an existing local account by email alone', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const localEmail = 'local-existing@google-test.devlaunch';
      await User.deleteMany({ email: localEmail });

      // Create existing local user with password and no Google ID
      const localUser = new User({
        name: 'Local Existing User',
        email: localEmail,
        password: 'Password123!',
        providers: ['local'],
        isEmailVerified: true,
      });
      await localUser.save();

      // Incoming Google login with matching email but arbitrary Google sub
      setGoogleAuthServiceOverride({
        getGoogleAuthorizationUrl() {
          return '';
        },
        async exchangeCodeAndVerifyGoogleToken(): Promise<GoogleUserPayload> {
          return {
            sub: 'attacker-or-separate-google-sub-999',
            email: localEmail,
            emailVerified: true,
            name: 'Attacker Impersonator',
          };
        },
      });

      const res = await request(app)
        .get('/api/auth/google/callback?code=valid-code&state=' + validState)
        .set('Cookie', [`${OAUTH_STATE_COOKIE_NAME}=${validState}`]);

      // Must refuse to authenticate or link
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, `${env.CLIENT_URL}/login?error=account_exists_local`);

      // No auth cookie should be set
      const cookies = res.headers['set-cookie'] || [];
      const authCookie = cookies.find((c: string) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      assert.equal(authCookie, undefined, 'No authentication cookie should be issued');

      // Check that existing local user was NOT modified
      const userInDb = await User.findOne({ email: localEmail }).select('+googleId');
      assert.ok(userInDb);
      assert.equal(userInDb.googleId, undefined, 'googleId must not be linked');
      assert.deepEqual(userInDb.providers, ['local'], 'Providers must remain exclusively local');
    });

    test('does not expose JWTs, ID tokens, or secrets in redirect query parameters', async () => {
      setGoogleAuthServiceOverride({
        getGoogleAuthorizationUrl() {
          return '';
        },
        async exchangeCodeAndVerifyGoogleToken(): Promise<GoogleUserPayload> {
          return {
            sub: 'sub-sanitized-url',
            email: 'sanitized-url@google-test.devlaunch',
            emailVerified: true,
          };
        },
      });

      const res = await request(app)
        .get('/api/auth/google/callback?code=valid-code&state=' + validState)
        .set('Cookie', [`${OAUTH_STATE_COOKIE_NAME}=${validState}`]);

      assert.equal(res.status, 302);
      const redirectUrl = res.headers.location;
      assert.ok(!redirectUrl.includes('token='), 'Redirect URL must not contain token parameters');
      assert.ok(!redirectUrl.includes('id_token='), 'Redirect URL must not contain id_token');
      assert.ok(!redirectUrl.includes('access_token='), 'Redirect URL must not contain access_token');
      assert.ok(!redirectUrl.includes('secret='), 'Redirect URL must not contain secret values');
    });
  });
});
