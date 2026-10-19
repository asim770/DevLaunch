import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

// Configure test environment variables prior to module imports
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devlaunch_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devlaunch_test_jwt_secret_min_32_chars_long';

const { env } = await import('../src/config/env.js');
const {
  getGoogleAuthorizationUrl,
  exchangeCodeAndVerifyGoogleToken,
  setGoogleAuthServiceOverride,
  resetGoogleAuthService,
} = await import('../src/services/googleAuth.service.js');

describe('Google OAuth Service (googleAuth.service.ts)', () => {
  const originalGoogleConfig = {
    isConfigured: env.IS_GOOGLE_AUTH_CONFIGURED,
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL,
  };

  after(() => {
    resetGoogleAuthService();
    env.IS_GOOGLE_AUTH_CONFIGURED = originalGoogleConfig.isConfigured;
    env.GOOGLE_CLIENT_ID = originalGoogleConfig.clientId;
    env.GOOGLE_CLIENT_SECRET = originalGoogleConfig.clientSecret;
    env.GOOGLE_CALLBACK_URL = originalGoogleConfig.callbackUrl;
  });

  describe('Unconfigured behavior', () => {
    test('throws sanitized error when Google OAuth is not configured', async () => {
      resetGoogleAuthService();
      env.IS_GOOGLE_AUTH_CONFIGURED = false;

      assert.throws(
        () => getGoogleAuthorizationUrl('mock-state'),
        /Google OAuth is not configured/
      );

      await assert.rejects(
        () => exchangeCodeAndVerifyGoogleToken('mock-code'),
        /Google OAuth is not configured/
      );
    });
  });

  describe('Test seam overrides', () => {
    test('delegates to active service override when configured', async () => {
      setGoogleAuthServiceOverride({
        getGoogleAuthorizationUrl(state: string) {
          return `https://mock.google.auth/?state=${state}`;
        },
        async exchangeCodeAndVerifyGoogleToken(code: string) {
          return {
            sub: `sub-for-${code}`,
            email: 'seam@google-test.devlaunch',
            emailVerified: true,
            name: 'Seam User',
          };
        },
      });

      const url = getGoogleAuthorizationUrl('test-state-123');
      assert.equal(url, 'https://mock.google.auth/?state=test-state-123');

      const payload = await exchangeCodeAndVerifyGoogleToken('auth-code-456');
      assert.equal(payload.sub, 'sub-for-auth-code-456');
      assert.equal(payload.email, 'seam@google-test.devlaunch');
      assert.equal(payload.emailVerified, true);
      assert.equal(payload.name, 'Seam User');

      resetGoogleAuthService();
    });
  });
});
