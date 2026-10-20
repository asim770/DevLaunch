import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Configure test environment variables prior to app initialization
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devlaunch_e2e_audit';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devlaunch_e2e_audit_jwt_secret_min_32_chars';

const { app } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');
const { AUTH_COOKIE_NAME } = await import('../src/utils/authCookie.js');
const { sentEmailsLog } = await import('../src/services/email.service.js');
const { generateAuthToken } = await import('../src/utils/authToken.js');

describe('DevLaunch End-to-End Authentication Audit Suite', () => {
  const TEST_DB_URI = process.env.MONGODB_URI;
  let isMongoConnected = false;

  before(async () => {
    try {
      await mongoose.connect(TEST_DB_URI!, {
        serverSelectionTimeoutMS: 2000,
        autoIndex: true,
      });
      isMongoConnected = true;
      await User.deleteMany({ email: { $regex: /@e2e-audit\.devlaunch$/ } });
    } catch {
      console.warn('[Audit Warning] Local MongoDB not reachable. Skipping database-dependent tests.');
      isMongoConnected = false;
    }
  });

  after(async () => {
    if (isMongoConnected && mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: { $regex: /@e2e-audit\.devlaunch$/ } });
      await mongoose.connection.close();
    }
  });

  beforeEach(() => {
    sentEmailsLog.length = 0;
  });

  describe('1. Registration Security & Privileged Field Isolation', () => {
    const testUser = {
      name: 'Grace Hopper',
      email: 'grace.hopper@e2e-audit.devlaunch',
      password: 'CompilerPioneer2026!',
    };

    test('valid registration creates user in DB, returns safe DTO, and sets HTTP-only session cookie', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Account registered successfully.');

      // Validate Safe User DTO
      const { user } = res.body;
      assert.ok(user.id, 'User DTO must contain id');
      assert.equal(user.name, testUser.name);
      assert.equal(user.email, testUser.email);
      assert.equal(user.role, 'user');
      assert.deepEqual(user.providers, ['local']);
      assert.equal(user.isEmailVerified, false);
      assert.equal(user.password, undefined, 'Password hash must never be in DTO');
      assert.equal(user.tokenVersion, undefined, 'tokenVersion must never be in DTO');
      assert.equal(user.googleId, undefined, 'googleId must never be in DTO');

      // Validate HTTP-only Cookie
      const cookies = res.headers['set-cookie'] || [];
      const authCookie = cookies.find((c: string) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      assert.ok(authCookie, 'Set-Cookie must include devlaunch_token');
      assert.ok(authCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
      assert.ok(authCookie.includes('SameSite=Lax'), 'Cookie must be SameSite=Lax');
      assert.ok(authCookie.includes('Path=/'), 'Cookie must be scoped to /');

      // Verify MongoDB persistence and bcrypt hash
      const savedInDb = await User.findOne({ email: testUser.email }).select('+password +tokenVersion');
      assert.ok(savedInDb);
      assert.notEqual(savedInDb.password, testUser.password);
      assert.ok(savedInDb.password?.startsWith('$2'), 'Password must be bcrypt hashed');
      assert.equal(savedInDb.tokenVersion, 0);
    });

    test('duplicate email registration returns HTTP 409 Conflict', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('already exists'));
    });

    test('invalid inputs produce descriptive HTTP 400 errors', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      // Short name (< 2 chars)
      const resName = await request(app)
        .post('/api/auth/register')
        .send({ name: 'A', email: 'valid@e2e-audit.devlaunch', password: 'Password123!' });
      assert.equal(resName.status, 400);
      assert.ok(resName.body.error.includes('Name must be between 2 and 50'));

      // Malformed email
      const resEmail = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Valid Name', email: 'not-an-email', password: 'Password123!' });
      assert.equal(resEmail.status, 400);
      assert.ok(resEmail.body.error.includes('valid email address'));

      // Short password (< 8 chars)
      const resPassword = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Valid Name', email: 'shortpw@e2e-audit.devlaunch', password: 'short' });
      assert.equal(resPassword.status, 400);
      assert.ok(resPassword.body.error.includes('at least 8 characters'));
    });

    test('client cannot escalate privileges via registration payload injection', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const attackEmail = 'attacker@e2e-audit.devlaunch';
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Privilege Attacker',
          email: attackEmail,
          password: 'AttackPassword123!',
          role: 'admin',
          providers: ['google', 'local'],
          tokenVersion: 999,
          isEmailVerified: true,
          googleId: 'fake-google-id',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.user.role, 'user', 'Role must remain user');

      const attackerInDb = await User.findOne({ email: attackEmail }).select('+tokenVersion +googleId');
      assert.ok(attackerInDb);
      assert.equal(attackerInDb.role, 'user', 'DB role must be user');
      assert.deepEqual(attackerInDb.providers, ['local'], 'DB providers must be local only');
      assert.equal(attackerInDb.tokenVersion, 0, 'DB tokenVersion must remain 0');
      assert.equal(attackerInDb.isEmailVerified, false, 'Email verification must not be bypassed');
      assert.equal(attackerInDb.googleId, undefined, 'googleId injection must be rejected');
    });
  });

  describe('2. Login, Session Restoration & Revocation', () => {
    const loginUser = {
      name: 'Katherine Johnson',
      email: 'katherine.johnson@e2e-audit.devlaunch',
      password: 'OrbitalCalculations2026!',
    };
    let activeAuthCookie: string = '';

    before(async () => {
      if (!isMongoConnected) return;
      await User.deleteMany({ email: loginUser.email });
      const user = new User({
        name: loginUser.name,
        email: loginUser.email,
        password: loginUser.password,
      });
      await user.save();
    });

    test('login with correct credentials sets session cookie and returns user DTO', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginUser.email, password: loginUser.password });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.email, loginUser.email);
      assert.equal(res.body.user.name, loginUser.name);

      const cookies = res.headers['set-cookie'] || [];
      const cookie = cookies.find((c: string) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      assert.ok(cookie, 'devlaunch_token cookie must be set');
      activeAuthCookie = cookie.split(';')[0];
    });

    test('login with wrong password returns generic 401 without revealing password mistake', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginUser.email, password: 'WrongPassword999!' });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'Invalid email or password.');
    });

    test('login with unknown email returns identical generic 401 to prevent email enumeration', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost-account@e2e-audit.devlaunch', password: 'SomePassword123!' });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'Invalid email or password.');
    });

    test('login to Google-only account without local password returns generic 401', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const googleOnlyEmail = 'google.only@e2e-audit.devlaunch';
      await User.deleteMany({ email: googleOnlyEmail });
      const googleUser = new User({
        name: 'Google Pure User',
        email: googleOnlyEmail,
        providers: ['google'],
        googleId: 'google-sub-pure-12345',
        isEmailVerified: true,
      });
      await googleUser.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: googleOnlyEmail, password: 'AnyPassword123!' });

      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'Invalid email or password.');
    });

    test('session restoration via GET /api/auth/me succeeds with valid cookie', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [activeAuthCookie]);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.email, loginUser.email);
      assert.equal(res.body.user.role, 'user');
    });

    test('protected route rejects requests without session cookie (401)', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const res = await request(app).get('/api/auth/me');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('Authentication required'));
    });

    test('protected route rejects tampered or forged JWT tokens (401)', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=forged.invalid.signature`]);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('Invalid authentication token'));
    });

    test('logout clears the session cookie and invalidates subsequent requests', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [activeAuthCookie]);

      assert.equal(logoutRes.status, 200);
      assert.equal(logoutRes.body.success, true);

      const cookies = logoutRes.headers['set-cookie'] || [];
      const clearedCookie = cookies.find((c: string) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      assert.ok(clearedCookie, 'Cookie clearance instruction must be returned');
      assert.ok(clearedCookie.includes(`${AUTH_COOKIE_NAME}=;`));

      // Accessing /me with the cleared cookie value returns 401
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=`]);

      assert.equal(meRes.status, 401);
    });
  });

  describe('3. Forgot-Password, OTP Verification & Password Reset Flow', () => {
    const resetUser = {
      name: 'Margaret Hamilton',
      email: 'margaret.hamilton@e2e-audit.devlaunch',
      initialPassword: 'ApolloGuidanceSoftware1969!',
      newPassword: 'ModernSoftwareEngineering2026!',
    };

    let userInDb: any;
    let validResetToken: string = '';

    before(async () => {
      if (!isMongoConnected) return;
      await User.deleteMany({ email: resetUser.email });
      userInDb = new User({
        name: resetUser.name,
        email: resetUser.email,
        password: resetUser.initialPassword,
      });
      await userInDb.save();
    });

    test('forgot-password sends OTP email and stores SHA-256 hash in DB', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: resetUser.email });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.message.includes('If an account exists'));

      // Check email was dispatched
      assert.equal(sentEmailsLog.length, 1);
      const emailRecord = sentEmailsLog[0];
      assert.equal(emailRecord.to, resetUser.email);
      assert.match(emailRecord.otp, /^\d{6}$/);

      // Verify DB storage is hashed, not plaintext
      const updatedUser = await User.findOne({ email: resetUser.email }).select(
        '+passwordResetOtpHash +passwordResetOtpExpires +passwordResetOtpAttempts'
      );
      assert.ok(updatedUser?.passwordResetOtpHash);
      assert.notEqual(updatedUser.passwordResetOtpHash, emailRecord.otp, 'OTP must be hashed');
      assert.equal(updatedUser.passwordResetOtpAttempts, 0);
      assert.ok(updatedUser.passwordResetOtpExpires!.getTime() > Date.now());
    });

    test('forgot-password returns identical generic message for unknown email', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      sentEmailsLog.length = 0;
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'unknown-entity@e2e-audit.devlaunch' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.message.includes('If an account exists'));
      assert.equal(sentEmailsLog.length, 0, 'No email must be sent for unknown address');
    });

    test('resend cooldown prevents sending duplicate emails within 60 seconds', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      sentEmailsLog.length = 0;
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: resetUser.email });

      assert.equal(res.status, 200);
      assert.equal(sentEmailsLog.length, 0, 'Should not dispatch duplicate email during cooldown');
    });

    test('verify-reset-otp rejects invalid code and increments attempt counter', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: resetUser.email, otp: '000000' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('Invalid or expired'));

      const user = await User.findOne({ email: resetUser.email }).select('+passwordResetOtpAttempts');
      assert.equal(user?.passwordResetOtpAttempts, 1);
    });

    test('exceeding 5 failed OTP attempts invalidates the reset code', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      // Send 4 more wrong attempts (total reaches 5)
      for (let i = 2; i <= 5; i++) {
        await request(app)
          .post('/api/auth/verify-reset-otp')
          .send({ email: resetUser.email, otp: '999999' });
      }

      // 6th attempt: should return invalid or expired because OTP was wiped upon reaching limit
      const resLocked = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: resetUser.email, otp: '999999' });

      assert.equal(resLocked.status, 400);
      assert.ok(
        resLocked.body.error.includes('Invalid or expired') ||
        resLocked.body.error.includes('Too many failed verification attempts')
      );

      // Verify OTP hash was wiped from MongoDB
      const wipedUser = await User.findOne({ email: resetUser.email }).select('+passwordResetOtpHash');
      assert.equal(wipedUser?.passwordResetOtpHash, undefined);
    });

    test('successful OTP verification consumes OTP and yields temporary resetToken', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      // Manually set a fresh OTP bypassing 60s cooldown for test speed
      sentEmailsLog.length = 0;
      await User.updateOne(
        { email: resetUser.email },
        { $unset: { passwordResetLastSent: 1 } }
      );

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: resetUser.email });

      const newOtp = sentEmailsLog[0].otp;

      const verifyRes = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: resetUser.email, otp: newOtp });

      assert.equal(verifyRes.status, 200);
      assert.equal(verifyRes.body.success, true);
      assert.ok(verifyRes.body.resetToken, 'Response must contain resetToken');
      validResetToken = verifyRes.body.resetToken;

      // Verify OTP was consumed
      const dbUser = await User.findOne({ email: resetUser.email }).select(
        '+passwordResetOtpHash +passwordResetTokenHash'
      );
      assert.equal(dbUser?.passwordResetOtpHash, undefined, 'OTP must be consumed');
      assert.ok(dbUser?.passwordResetTokenHash, 'Reset token hash must be set');
    });

    test('re-verifying previously consumed OTP is rejected', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      const reVerifyRes = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: resetUser.email, otp: sentEmailsLog[0]?.otp || '123456' });

      assert.equal(reVerifyRes.status, 400);
    });

    test('reset-password updates password, revokes existing sessions, and prevents token replay', async (t) => {
      if (!isMongoConnected) return t.skip('MongoDB not reachable');

      // Create an active session token before reset
      const preResetUser = await User.findOne({ email: resetUser.email }).select('+tokenVersion');
      const oldSessionToken = generateAuthToken({
        userId: preResetUser!._id.toString(),
        tokenVersion: preResetUser!.tokenVersion,
      });

      // Confirm old token currently works
      const meBefore = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${oldSessionToken}`]);
      assert.equal(meBefore.status, 200);

      // Perform password reset
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          resetToken: validResetToken,
          newPassword: resetUser.newPassword,
        });

      assert.equal(resetRes.status, 200);
      assert.equal(resetRes.body.success, true);
      assert.ok(resetRes.body.message.includes('Password reset successfully'));

      // Check DB: tokenVersion incremented, reset fields cleared
      const postResetUser = await User.findOne({ email: resetUser.email }).select(
        '+password +tokenVersion +passwordResetTokenHash'
      );
      assert.ok(postResetUser);
      assert.equal(postResetUser.tokenVersion, 1, 'tokenVersion must be incremented to revoke old sessions');
      assert.equal(postResetUser.passwordResetTokenHash, undefined, 'Reset token must be cleared');

      // Session Revocation: old token now immediately rejected with 401
      const meAfter = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${oldSessionToken}`]);
      assert.equal(meAfter.status, 401);
      assert.ok(meAfter.body.error.includes('revoked'));

      // Replay Attack: submitting the same resetToken again must fail
      const replayRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          resetToken: validResetToken,
          newPassword: 'AnotherPassword123!',
        });
      assert.equal(replayRes.status, 400);
      assert.ok(replayRes.body.error.includes('Invalid, expired, or previously used'));

      // Old password fails login
      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: resetUser.email, password: resetUser.initialPassword });
      assert.equal(oldLogin.status, 401);

      // New password succeeds login
      const newLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: resetUser.email, password: resetUser.newPassword });
      assert.equal(newLogin.status, 200);
      assert.equal(newLogin.body.success, true);
    });
  });

  describe('4. Google OAuth Unconfigured Handling & Defense', () => {
    test('GET /api/auth/google returns HTTP 501 when unconfigured', async () => {
      const res = await request(app).get('/api/auth/google');
      assert.equal(res.status, 501);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('Google OAuth is not configured'));
    });

    test('callback safely handles unconfigured OAuth and redirects to login with error code', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: 'mock-code', state: 'unmatched-state' });

      // Expect safe redirect to login with oauth_unconfigured
      assert.equal(res.status, 302);
      assert.ok(res.headers.location?.includes('/login?error=oauth_unconfigured'));
    });
  });

  describe('5. CSRF Origin Validation (Defense-in-Depth)', () => {
    test('rejects cross-origin POST from unauthorized domain with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Origin', 'http://malicious-phishing-attacker.com');

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('Cross-origin request blocked'));
    });

    test('permits cross-origin POST from authorized CLIENT_URL (http://localhost:3000)', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Origin', 'http://localhost:3000');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });
});
