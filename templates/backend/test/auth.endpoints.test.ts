import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

// Configure test environment variables prior to app initialization
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devlaunch_test_auth_endpoints';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devlaunch_test_jwt_secret_min_32_chars_long';

const { app } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');
const { AUTH_COOKIE_NAME } = await import('../src/utils/authCookie.js');
const { generateAuthToken } = await import('../src/utils/authToken.js');

describe('Authentication Endpoints (/api/auth) - Integration Tests', () => {
  const TEST_DB_URI = process.env.MONGODB_URI;
  let isMongoAvailable = false;

  before(async () => {
    try {
      await mongoose.connect(TEST_DB_URI!, {
        serverSelectionTimeoutMS: 2000,
        autoIndex: true,
      });
      isMongoAvailable = true;
      await User.deleteMany({ email: { $regex: /@endpoint-test\.devlaunch$/ } });
    } catch {
      console.info('[Notice] Local MongoDB not reachable. Skipping auth endpoint integration tests.');
      isMongoAvailable = false;
    }
  });

  after(async () => {
    if (isMongoAvailable && mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: { $regex: /@endpoint-test\.devlaunch$/ } });
      await mongoose.connection.close();
    }
  });

  describe('POST /api/auth/register', () => {
    test('successfully registers a user, returns safe DTO, and sets HTTP-only cookie', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const email = 'ada.new@endpoint-test.devlaunch';
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Ada Lovelace',
          email,
          password: 'SecurePassword123!',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.user);
      assert.equal(res.body.user.name, 'Ada Lovelace');
      assert.equal(res.body.user.email, email);
      assert.equal(res.body.user.role, 'user');
      assert.deepEqual(res.body.user.providers, ['local']);
      assert.equal(res.body.user.password, undefined);
      assert.equal(res.body.user.googleId, undefined);
      assert.equal(res.body.user.tokenVersion, undefined);

      // Verify Set-Cookie header
      const cookies = res.headers['set-cookie'];
      assert.ok(Array.isArray(cookies));
      const authCookie = cookies.find((c: string) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      assert.ok(authCookie, 'Expected devlaunch_token cookie in response');
      assert.ok(authCookie.includes('HttpOnly'));
      assert.ok(authCookie.includes('SameSite=Lax'));
      assert.ok(authCookie.includes('Path=/'));
    });

    test('stores password as a secure bcrypt hash in the database, never plaintext', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const email = 'hash.check@endpoint-test.devlaunch';
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Hash Checker',
          email,
          password: 'PlaintextPassword123!',
        });

      const userInDb = await User.findOne({ email }).select('+password');
      assert.ok(userInDb);
      assert.notEqual(userInDb.password, 'PlaintextPassword123!');
      assert.ok(userInDb.password?.startsWith('$2'), 'Password should be a bcrypt hash');
    });

    test('rejects registration with missing required fields (400)', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      // Missing name
      let res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'noname@endpoint-test.devlaunch', password: 'Password123!' });
      assert.equal(res.status, 400);

      // Missing email
      res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'No Email', password: 'Password123!' });
      assert.equal(res.status, 400);

      // Missing password
      res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'No Password', email: 'nopass@endpoint-test.devlaunch' });
      assert.equal(res.status, 400);
    });

    test('rejects registration with invalid name bounds or malformed email (400)', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      // Name too short
      let res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'A', email: 'short@endpoint-test.devlaunch', password: 'Password123!' });
      assert.equal(res.status, 400);

      // Malformed email
      res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Valid Name', email: 'invalid-email-format', password: 'Password123!' });
      assert.equal(res.status, 400);

      // Password too short (< 8 chars)
      res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Valid Name', email: 'shortpass@endpoint-test.devlaunch', password: 'short' });
      assert.equal(res.status, 400);
    });

    test('rejects duplicate email registration with HTTP 409 Conflict', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const email = 'duplicate@endpoint-test.devlaunch';
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'First User', email, password: 'Password123!' });

      // Second registration with same email
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Second User', email, password: 'Password123!' });

      assert.equal(res.status, 409);
      assert.ok(res.body.error.includes('already exists'));
    });

    test('ignores client-supplied privileged attributes (role, providers, tokenVersion, isEmailVerified)', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const email = 'exploit@endpoint-test.devlaunch';
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Privilege Attempter',
          email,
          password: 'Password123!',
          role: 'admin',
          providers: ['google'],
          tokenVersion: 99,
          isEmailVerified: true,
        });

      assert.equal(res.status, 201);

      const userInDb = await User.findOne({ email }).select('+tokenVersion');
      assert.ok(userInDb);
      assert.equal(userInDb.role, 'user', 'Client should not be able to elevate role to admin');
      assert.deepEqual(userInDb.providers, ['local'], 'Providers should remain local');
      assert.equal(userInDb.isEmailVerified, false);
      assert.equal(userInDb.tokenVersion, 0);
    });

    test('rejects local registration when account was already created via Google (409)', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const email = 'google-conflict@endpoint-test.devlaunch';
      // Pre-seed a Google-only user
      const googleUser = new User({
        name: 'Google Only User',
        email,
        providers: ['google'],
        googleId: 'google-sub-998877',
        isEmailVerified: true,
      });
      await googleUser.save();

      // Attempt to register locally with same email
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Attempted Local Register',
          email,
          password: 'Password123!',
        });

      assert.equal(res.status, 409);
      assert.ok(res.body.error.includes('Google sign-in'));
    });
  });

  describe('POST /api/auth/login', () => {
    const loginEmail = 'login.user@endpoint-test.devlaunch';
    const loginPassword = 'CorrectPassword123!';

    before(async () => {
      if (isMongoAvailable) {
        await User.deleteMany({ email: loginEmail });
        const user = new User({
          name: 'Login Test User',
          email: loginEmail,
          password: loginPassword,
        });
        await user.save();
      }
    });

    test('successfully logs in with valid credentials and sets auth cookie', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginEmail, password: loginPassword });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.user);
      assert.equal(res.body.user.email, loginEmail);
      assert.equal(res.body.user.password, undefined);

      const cookies = res.headers['set-cookie'];
      assert.ok(Array.isArray(cookies));
      const authCookie = cookies.find((c: string) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      assert.ok(authCookie);
    });

    test('returns generic 401 for unknown email', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'unknown@endpoint-test.devlaunch', password: loginPassword });

      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'Invalid email or password.');
    });

    test('returns identical generic 401 for wrong password to prevent email enumeration', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginEmail, password: 'WrongPassword999!' });

      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'Invalid email or password.');
    });

    test('rejects local password login for Google-only accounts with generic 401', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const googleEmail = 'google.login@endpoint-test.devlaunch';
      const googleUser = new User({
        name: 'Google User',
        email: googleEmail,
        providers: ['google'],
        googleId: 'google-sub-login-123',
      });
      await googleUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: googleEmail, password: 'AnyPassword123!' });

      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'Invalid email or password.');
    });

    test('rejects login with missing email or password (400)', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginEmail });

      assert.equal(res.status, 400);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('clears the auth cookie and returns HTTP 200', async () => {
      const res = await request(app).post('/api/auth/logout');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Logged out successfully.');

      const cookies = res.headers['set-cookie'];
      assert.ok(Array.isArray(cookies));
      const clearedCookie = cookies.find((c: string) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      assert.ok(clearedCookie);
      assert.ok(clearedCookie.includes('devlaunch_token=;'));
    });

    test('succeeds idempotently even if session was missing or invalid', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=invalid-token-string`]);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });

  describe('GET /api/auth/me & requireAuth Middleware', () => {
    let authCookieHeader: string;
    let seededUser: InstanceType<typeof User>;

    before(async () => {
      if (isMongoAvailable) {
        const email = 'me.user@endpoint-test.devlaunch';
        await User.deleteMany({ email });
        seededUser = new User({
          name: 'Me Endpoint User',
          email,
          password: 'Password123!',
          tokenVersion: 0,
        });
        await seededUser.save();

        const token = generateAuthToken({
          userId: seededUser._id.toString(),
          tokenVersion: seededUser.tokenVersion,
        });
        authCookieHeader = `${AUTH_COOKIE_NAME}=${token}`;
      }
    });

    test('returns safe profile for authenticated user with valid cookie (200)', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [authCookieHeader]);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.user);
      assert.equal(res.body.user.email, seededUser.email);
      assert.equal(res.body.user.name, seededUser.name);
      assert.equal(res.body.user.password, undefined);
      assert.equal(res.body.user.tokenVersion, undefined);
    });

    test('rejects unauthenticated request when auth cookie is missing (401)', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const res = await request(app).get('/api/auth/me');

      assert.equal(res.status, 401);
      assert.ok(res.body.error.includes('Authentication required'));
    });

    test('rejects request with malformed or tampered auth cookie (401)', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=tampered.token.value`]);

      assert.equal(res.status, 401);
    });

    test('rejects request when user has been deleted from database (401)', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const nonExistentUserId = new mongoose.Types.ObjectId().toString();
      const ghostToken = generateAuthToken({
        userId: nonExistentUserId,
        tokenVersion: 0,
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${ghostToken}`]);

      assert.equal(res.status, 401);
      assert.ok(res.body.error.includes('no longer exists'));
    });

    test('rejects request when tokenVersion in cookie is stale / mismatched (401)', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      // Seed a user whose session was revoked by incrementing tokenVersion
      const revokedEmail = 'revoked.user@endpoint-test.devlaunch';
      await User.deleteMany({ email: revokedEmail });
      const user = new User({
        name: 'Revoked User',
        email: revokedEmail,
        password: 'Password123!',
        tokenVersion: 0,
      });
      await user.save();

      // Issue token with tokenVersion 0
      const oldToken = generateAuthToken({
        userId: user._id.toString(),
        tokenVersion: 0,
      });

      // Revoke session in database by incrementing tokenVersion
      user.tokenVersion = 1;
      await user.save();

      // Attempt to access /api/auth/me with old token
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${oldToken}`]);

      assert.equal(res.status, 401);
      assert.ok(res.body.error.includes('revoked'));
    });
  });
});
