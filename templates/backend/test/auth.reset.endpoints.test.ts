import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

// Configure test environment variables prior to app initialization
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devlaunch_test_password_reset';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devlaunch_test_jwt_secret_min_32_chars_long';

const { app } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');
const { sentEmailsLog } = await import('../src/services/email.service.js');
const { generateAuthToken } = await import('../src/utils/authToken.js');
const { AUTH_COOKIE_NAME } = await import('../src/utils/authCookie.js');

describe('Password Reset Endpoints (/api/auth) - Integration Tests', () => {
  const TEST_DB_URI = process.env.MONGODB_URI;
  let isMongoAvailable = false;

  before(async () => {
    try {
      await mongoose.connect(TEST_DB_URI!, {
        serverSelectionTimeoutMS: 2000,
        autoIndex: true,
      });
      isMongoAvailable = true;
      await User.deleteMany({ email: { $regex: /@reset-test\.devlaunch$/ } });
    } catch {
      console.info('[Notice] Local MongoDB not reachable. Skipping reset integration tests.');
      isMongoAvailable = false;
    }
  });

  after(async () => {
    if (isMongoAvailable && mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: { $regex: /@reset-test\.devlaunch$/ } });
      await mongoose.connection.close();
    }
  });

  beforeEach(() => {
    // Clear in-memory email log between tests
    sentEmailsLog.length = 0;
  });

  describe('POST /api/auth/forgot-password', () => {
    test('returns identical generic HTTP 200 for known and unknown email addresses', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      // 1. Unknown email
      const resUnknown = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'unknown-account@reset-test.devlaunch' });

      assert.equal(resUnknown.status, 200);
      assert.equal(resUnknown.body.success, true);
      assert.ok(resUnknown.body.message.includes('If an account exists with this email address'));
      assert.equal(sentEmailsLog.length, 0, 'Should not send email for unknown user');

      // 2. Known user
      const knownEmail = 'known-user@reset-test.devlaunch';
      await User.deleteMany({ email: knownEmail });
      const user = new User({
        name: 'Known User',
        email: knownEmail,
        password: 'Password123!',
      });
      await user.save();

      const resKnown = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: knownEmail });

      assert.equal(resKnown.status, 200);
      assert.equal(resKnown.body.success, true);
      assert.equal(resKnown.body.message, resUnknown.body.message, 'Message must be identical to prevent enumeration');
      assert.equal(sentEmailsLog.length, 1, 'Should deliver email to registered user');
    });

    test('stores OTP as a secure SHA-256 hash in database, never plaintext', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const email = 'hash-check@reset-test.devlaunch';
      await User.deleteMany({ email });
      const user = new User({
        name: 'Hash Checker',
        email,
        password: 'Password123!',
      });
      await user.save();

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email });

      assert.equal(sentEmailsLog.length, 1);
      const deliveredOtp = sentEmailsLog[0].otp;
      assert.match(deliveredOtp, /^\d{6}$/);

      const userInDb = await User.findOne({ email }).select('+passwordResetOtpHash +passwordResetOtpExpires');
      assert.ok(userInDb?.passwordResetOtpHash);
      assert.notEqual(userInDb.passwordResetOtpHash, deliveredOtp, 'OTP must not be stored in plaintext');
      assert.equal(userInDb.passwordResetOtpHash.length, 64, 'Stored OTP must be a 64-char SHA-256 hex string');
    });

    test('enforces 60-second cooldown on resend requests without revealing account status', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const email = 'cooldown-user@reset-test.devlaunch';
      await User.deleteMany({ email });
      const user = new User({
        name: 'Cooldown User',
        email,
        password: 'Password123!',
      });
      await user.save();

      // First request: delivers email
      const res1 = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email });
      assert.equal(res1.status, 200);
      assert.equal(sentEmailsLog.length, 1);

      // Immediate second request within 60s cooldown: still returns 200, but suppresses second email
      const res2 = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email });
      assert.equal(res2.status, 200);
      assert.equal(sentEmailsLog.length, 1, 'Second email should not be sent within cooldown window');
    });

    test('prevents resend cooldown bypass when concurrent forgot-password requests arrive', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const email = 'concurrent-cooldown@reset-test.devlaunch';
      await User.deleteMany({ email });
      const user = new User({
        name: 'Concurrent Cooldown User',
        email,
        password: 'Password123!',
      });
      await user.save();

      // Clear email log
      sentEmailsLog.length = 0;

      // Send two concurrent forgot-password requests simultaneously
      const [res1, res2] = await Promise.all([
        request(app).post('/api/auth/forgot-password').send({ email }),
        request(app).post('/api/auth/forgot-password').send({ email }),
      ]);

      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);
      assert.equal(res1.body.success, true);
      assert.equal(res2.body.success, true);
      assert.equal(sentEmailsLog.length, 1, 'Only one email should be sent for concurrent forgot-password requests');
    });
  });

  describe('POST /api/auth/verify-reset-otp', () => {
    const verifyEmail = 'verify-otp@reset-test.devlaunch';
    let userOtp = '';

    beforeEach(async () => {
      if (isMongoAvailable) {
        await User.deleteMany({ email: verifyEmail });
        const user = new User({
          name: 'Verify User',
          email: verifyEmail,
          password: 'Password123!',
        });
        await user.save();

        await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: verifyEmail });

        userOtp = sentEmailsLog[0].otp;
      }
    });

    test('successfully verifies correct OTP and returns single-use resetToken', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: verifyEmail, otp: userOtp });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.resetToken);
      assert.equal(typeof res.body.resetToken, 'string');
      assert.equal(res.body.resetToken.length, 64);

      // Verify that the resetToken is stored only as a hash in MongoDB
      const userInDb = await User.findOne({ email: verifyEmail }).select(
        '+passwordResetOtpHash +passwordResetTokenHash +passwordResetTokenExpires'
      );
      assert.equal(userInDb?.passwordResetOtpHash, undefined, 'OTP hash must be cleared after verification');
      assert.ok(userInDb?.passwordResetTokenHash);
      assert.notEqual(userInDb.passwordResetTokenHash, res.body.resetToken, 'Reset credential must not be stored in plaintext');
    });

    test('rejects incorrect OTP and increments failed attempt counter', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: verifyEmail, otp: '000000' });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('Invalid or expired'));

      const userInDb = await User.findOne({ email: verifyEmail }).select('+passwordResetOtpAttempts');
      assert.equal(userInDb?.passwordResetOtpAttempts, 1);
    });

    test('enforces max 5 failed attempts limit and invalidates OTP', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      // Fail 4 times
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/api/auth/verify-reset-otp')
          .send({ email: verifyEmail, otp: '111111' });
        assert.equal(res.status, 400);
      }

      // 5th failed attempt: reaches threshold
      const res5 = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: verifyEmail, otp: '111111' });
      assert.equal(res5.status, 400);

      // Even if user now submits the correct OTP, it is locked/invalidated
      const resAfterLockout = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: verifyEmail, otp: userOtp });
      assert.equal(resAfterLockout.status, 400);
      assert.ok(resAfterLockout.body.error.includes('Invalid or expired') || resAfterLockout.body.error.includes('Too many failed'));
    });

    test('rejects expired OTP', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      // Artificially expire the OTP
      await User.updateOne(
        { email: verifyEmail },
        { passwordResetOtpExpires: new Date(Date.now() - 1000) }
      );

      const res = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: verifyEmail, otp: userOtp });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('Invalid or expired'));
    });

    test('prevents OTP reuse after successful verification', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      // First verification succeeds
      const res1 = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: verifyEmail, otp: userOtp });
      assert.equal(res1.status, 200);

      // Second attempt with same OTP fails
      const res2 = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: verifyEmail, otp: userOtp });
      assert.equal(res2.status, 400);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    const resetEmail = 'reset-pwd@reset-test.devlaunch';
    let validResetToken = '';
    let initialPasswordHash = '';

    beforeEach(async () => {
      if (isMongoAvailable) {
        await User.deleteMany({ email: resetEmail });
        const user = new User({
          name: 'Reset Pwd User',
          email: resetEmail,
          password: 'OriginalPassword123!',
          tokenVersion: 0,
        });
        await user.save();

        const savedUser = await User.findOne({ email: resetEmail }).select('+password');
        initialPasswordHash = savedUser!.password!;

        // Request and verify OTP to get resetToken
        await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: resetEmail });

        const otp = sentEmailsLog[0].otp;
        const verifyRes = await request(app)
          .post('/api/auth/verify-reset-otp')
          .send({ email: resetEmail, otp });

        validResetToken = verifyRes.body.resetToken;
      }
    });

    test('successfully updates password and clears reset fields', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          resetToken: validResetToken,
          newPassword: 'BrandNewPassword123!',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.message.includes('Password reset successfully'));

      // Check database state
      const userInDb = await User.findOne({ email: resetEmail }).select(
        '+password +passwordResetTokenHash +passwordResetTokenExpires +tokenVersion'
      );
      assert.ok(userInDb);
      assert.notEqual(userInDb.password, initialPasswordHash, 'Password hash must change');
      assert.equal(userInDb.passwordResetTokenHash, undefined, 'Reset token hash must be cleared');
      assert.equal(userInDb.passwordResetTokenExpires, undefined, 'Reset token expiry must be cleared');
      assert.equal(userInDb.tokenVersion, 1, 'tokenVersion must increment to invalidate active sessions');

      // Verify that user can now log in with new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: resetEmail, password: 'BrandNewPassword123!' });
      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.body.success, true);

      // Verify that old password fails
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: resetEmail, password: 'OriginalPassword123!' });
      assert.equal(oldLoginRes.status, 401);
    });

    test('invalidates active JWTs when password is reset', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      // Get user ID and create JWT with tokenVersion 0
      const user = await User.findOne({ email: resetEmail }).select('+tokenVersion');
      const activeJwt = generateAuthToken({
        userId: user!._id.toString(),
        tokenVersion: user!.tokenVersion,
      });

      // Verify JWT works on /me before reset
      const meBefore = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${activeJwt}`]);
      assert.equal(meBefore.status, 200);

      // Perform password reset
      await request(app)
        .post('/api/auth/reset-password')
        .send({
          resetToken: validResetToken,
          newPassword: 'AnotherPassword123!',
        });

      // Old JWT must now be rejected on /me because tokenVersion changed
      const meAfter = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${activeJwt}`]);
      assert.equal(meAfter.status, 401);
      assert.ok(meAfter.body.error.includes('revoked'));
    });

    test('prevents reuse of consumed resetToken', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      // First reset succeeds
      const res1 = await request(app)
        .post('/api/auth/reset-password')
        .send({
          resetToken: validResetToken,
          newPassword: 'FirstResetPassword123!',
        });
      assert.equal(res1.status, 200);

      // Second reset with same token fails
      const res2 = await request(app)
        .post('/api/auth/reset-password')
        .send({
          resetToken: validResetToken,
          newPassword: 'SecondResetPassword123!',
        });
      assert.equal(res2.status, 400);
      assert.ok(res2.body.error.includes('Invalid, expired, or previously used'));
    });

    test('prevents concurrent reset-token reuse and ensures exactly one request succeeds', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      // Submit two simultaneous reset requests with the same valid token and different passwords
      const [res1, res2] = await Promise.all([
        request(app).post('/api/auth/reset-password').send({
          resetToken: validResetToken,
          newPassword: 'ConcurrentPasswordAlpha1!',
        }),
        request(app).post('/api/auth/reset-password').send({
          resetToken: validResetToken,
          newPassword: 'ConcurrentPasswordBeta2!',
        }),
      ]);

      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      assert.deepEqual(statuses, [200, 400], 'Exactly one concurrent request must succeed and one must fail');

      const winningRes = res1.status === 200 ? res1 : res2;
      const losingRes = res1.status === 400 ? res1 : res2;

      assert.equal(winningRes.body.success, true);
      assert.ok(losingRes.body.error.includes('Invalid, expired, or previously used'));

      // Check MongoDB state
      const userInDb = await User.findOne({ email: resetEmail }).select(
        '+passwordResetTokenHash +passwordResetTokenExpires +tokenVersion'
      );
      assert.ok(userInDb);
      assert.equal(userInDb.tokenVersion, 1, 'tokenVersion must be incremented exactly once');
      assert.equal(userInDb.passwordResetTokenHash, undefined, 'Reset token must be cleared');
      assert.equal(userInDb.passwordResetTokenExpires, undefined, 'Reset token expiry must be cleared');

      // Determine which password won and verify login behavior
      const winningPassword = res1.status === 200 ? 'ConcurrentPasswordAlpha1!' : 'ConcurrentPasswordBeta2!';
      const losingPassword = res1.status === 200 ? 'ConcurrentPasswordBeta2!' : 'ConcurrentPasswordAlpha1!';

      const loginWinning = await request(app)
        .post('/api/auth/login')
        .send({ email: resetEmail, password: winningPassword });
      assert.equal(loginWinning.status, 200, 'Winning password must be valid for login');

      const loginLosing = await request(app)
        .post('/api/auth/login')
        .send({ email: resetEmail, password: losingPassword });
      assert.equal(loginLosing.status, 401, 'Losing password must be rejected');
    });

    test('rejects password shorter than 8 characters (400)', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          resetToken: validResetToken,
          newPassword: 'short',
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('at least 8 characters'));
    });

    test('allows Google-only accounts to establish a local password through verified reset', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      const googleEmail = 'google-reset@reset-test.devlaunch';
      await User.deleteMany({ email: googleEmail });
      const googleUser = new User({
        name: 'Google Reset User',
        email: googleEmail,
        providers: ['google'],
        googleId: 'google-sub-554433',
        isEmailVerified: true,
      });
      await googleUser.save();

      // Ensure client cannot hijack the Google-only account via direct /register endpoint
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Hijacker',
          email: googleEmail,
          password: 'HijackerPassword123!',
        });
      assert.equal(registerRes.status, 409, 'Direct registration must reject existing Google account');

      // Request reset via email
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: googleEmail });

      const otp = sentEmailsLog[sentEmailsLog.length - 1].otp;

      // Verify OTP (proves ownership of registered email)
      const verifyRes = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: googleEmail, otp });

      // Reset password
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          resetToken: verifyRes.body.resetToken,
          newPassword: 'EstablishedLocalPassword123!',
        });

      assert.equal(resetRes.status, 200);

      // User now has both 'google' and 'local' providers; googleId is safely preserved
      const updatedUser = await User.findOne({ email: googleEmail }).select('+googleId');
      assert.ok(updatedUser?.providers.includes('local'), 'Must have local provider');
      assert.ok(updatedUser?.providers.includes('google'), 'Must retain google provider');
      assert.equal(updatedUser?.googleId, 'google-sub-554433', 'googleId must remain intact');

      // User can now log in using email & established password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: googleEmail, password: 'EstablishedLocalPassword123!' });

      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.body.success, true);
    });
  });
});
