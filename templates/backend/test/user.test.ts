import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, userSchema, IUser, UserModel } from '../src/models/User.js';

describe('User Schema & Validation (Unit Tests - In-Memory)', () => {
  test('constructs a valid user with expected default values', () => {
    const user = new User({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'Password123!',
    });

    const validationError = user.validateSync();
    assert.equal(validationError, undefined);
    assert.equal(user.name, 'Ada Lovelace');
    assert.equal(user.email, 'ada@example.com');
    assert.equal(user.role, 'user');
    assert.deepEqual(user.providers, ['local']);
    assert.equal(user.isEmailVerified, false);
    assert.equal(user.tokenVersion, 0);
  });

  test('requires name and email fields', () => {
    const emptyUser = new User({});
    const validationError = emptyUser.validateSync();

    assert.ok(validationError);
    assert.ok(validationError.errors.name, 'Expected error for missing name');
    assert.ok(validationError.errors.email, 'Expected error for missing email');
  });

  test('normalizes email address by trimming whitespace and converting to lowercase', () => {
    const user = new User({
      name: 'Ada Lovelace',
      email: '   ADA.LOVELACE@Example.COM   ',
      password: 'Password123!',
    });

    assert.equal(user.email, 'ada.lovelace@example.com');
  });

  test('rejects invalid email formats', () => {
    const user = new User({
      name: 'Ada Lovelace',
      email: 'not-a-valid-email',
      password: 'Password123!',
    });

    const validationError = user.validateSync();
    assert.ok(validationError?.errors.email, 'Expected validation error for invalid email format');
  });

  test('enforces name length bounds (minimum 2, maximum 50 characters)', () => {
    const tooShort = new User({
      name: 'A',
      email: 'short@example.com',
      password: 'Password123!',
    });
    const shortErr = tooShort.validateSync();
    assert.ok(shortErr?.errors.name, 'Expected error for name < 2 characters');

    const tooLong = new User({
      name: 'A'.repeat(51),
      email: 'long@example.com',
      password: 'Password123!',
    });
    const longErr = tooLong.validateSync();
    assert.ok(longErr?.errors.name, 'Expected error for name > 50 characters');
  });

  test('enforces password minimum length of 8 characters when provided', () => {
    const shortPass = new User({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'short',
    });

    const validationError = shortPass.validateSync();
    assert.ok(validationError?.errors.password, 'Expected error for password < 8 characters');
  });

  test('allows Google OAuth user construction without a password', () => {
    const googleUser = new User({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      providers: ['google'],
      googleId: 'google-oauth2-108234891',
      isEmailVerified: true,
    });

    const validationError = googleUser.validateSync();
    assert.equal(validationError, undefined);
    assert.equal(googleUser.password, undefined);
    assert.deepEqual(googleUser.providers, ['google']);
  });

  test('toJSON strips sensitive fields (password, googleId, tokenVersion, __v) and maps _id to id', () => {
    const user = new User({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'SuperSecretPassword123!',
      googleId: 'google-id-12345',
      tokenVersion: 3,
    });

    const json = user.toJSON();

    assert.equal(json.name, 'Ada Lovelace');
    assert.equal(json.email, 'ada@example.com');
    assert.equal(json.password, undefined, 'password must not be exposed in toJSON');
    assert.equal(json.googleId, undefined, 'googleId must not be exposed in toJSON');
    assert.equal(json.tokenVersion, undefined, 'tokenVersion must not be exposed in toJSON');
    assert.equal(json.__v, undefined, '__v must not be exposed in toJSON');
    assert.ok(json.id, 'id property should be present');
    assert.equal(json._id, undefined, '_id should be mapped to id');
  });

  test('comparePassword returns false when no password hash is loaded on document', async () => {
    const userWithoutPass = new User({
      name: 'No Password User',
      email: 'nopass@example.com',
    });

    const match = await userWithoutPass.comparePassword('anyPassword');
    assert.equal(match, false);
  });

  test('comparePassword correctly verifies matching and non-matching passwords against a hash', async () => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('CorrectPassword123!', salt);

    const user = new User({
      name: 'Hashed User',
      email: 'hashed@example.com',
      password: hash,
    });

    const isMatch = await user.comparePassword('CorrectPassword123!');
    assert.equal(isMatch, true, 'comparePassword should return true for correct password');

    const isWrong = await user.comparePassword('WrongPassword123!');
    assert.equal(isWrong, false, 'comparePassword should return false for incorrect password');
  });
});

describe('User Persistence & Middleware (Integration Tests - MongoDB)', () => {
  const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/devlaunch_test_user_isolated';
  let isolatedConn: mongoose.Connection | null = null;
  let IsolatedUser: UserModel | null = null;
  let isMongoConnected = false;

  before(async () => {
    try {
      // Use an isolated connection to prevent mutating the global default mongoose connection state
      isolatedConn = await mongoose
        .createConnection(TEST_DB_URI, {
          serverSelectionTimeoutMS: 2000,
          autoIndex: true,
        })
        .asPromise();

      IsolatedUser = isolatedConn.model<IUser, UserModel>('User', userSchema);
      isMongoConnected = true;

      // Ensure test collection is clean before running tests
      await IsolatedUser.deleteMany({ email: { $regex: /@integration-test\.devlaunch$/ } });
    } catch {
      console.info('[Notice] Local MongoDB server not reachable. Skipping live integration tests.');
      isMongoConnected = false;
    }
  });

  after(async () => {
    if (isolatedConn && isMongoConnected && IsolatedUser) {
      await IsolatedUser.deleteMany({ email: { $regex: /@integration-test\.devlaunch$/ } });
      await isolatedConn.close();
    }
  });

  test('pre-save hook hashes password before saving to database', async (t) => {
    if (!isMongoConnected || !IsolatedUser) {
      t.skip('MongoDB not reachable');
      return;
    }

    const testEmail = 'hash-test@integration-test.devlaunch';
    const user = new IsolatedUser({
      name: 'Hash Test User',
      email: testEmail,
      password: 'PlaintextPassword123!',
    });

    await user.save();

    assert.notEqual(user.password, 'PlaintextPassword123!');
    assert.ok(user.password?.startsWith('$2'), 'Password should be a bcrypt hash');
  });

  test('ordinary queries exclude password hash by default', async (t) => {
    if (!isMongoConnected || !IsolatedUser) {
      t.skip('MongoDB not reachable');
      return;
    }

    const testEmail = 'projection-test@integration-test.devlaunch';
    const user = new IsolatedUser({
      name: 'Projection Test User',
      email: testEmail,
      password: 'SecurePassword123!',
    });
    await user.save();

    const fetchedUser = await IsolatedUser.findById(user._id);
    assert.ok(fetchedUser);
    assert.equal(fetchedUser.password, undefined, 'Ordinary query should omit password by default');
  });

  test('queries with select(+password) retrieve password for comparison', async (t) => {
    if (!isMongoConnected || !IsolatedUser) {
      t.skip('MongoDB not reachable');
      return;
    }

    const testEmail = 'auth-query-test@integration-test.devlaunch';
    const user = new IsolatedUser({
      name: 'Auth Query User',
      email: testEmail,
      password: 'MySecretPassword123!',
    });
    await user.save();

    const authUser = await IsolatedUser.findById(user._id).select('+password');
    assert.ok(authUser);
    assert.ok(authUser.password);

    const isValid = await authUser.comparePassword('MySecretPassword123!');
    assert.equal(isValid, true);
  });

  test('unmodified password hash is not rehashed on subsequent saves', async (t) => {
    if (!isMongoConnected || !IsolatedUser) {
      t.skip('MongoDB not reachable');
      return;
    }

    const testEmail = 'rehash-test@integration-test.devlaunch';
    const user = new IsolatedUser({
      name: 'Rehash Test User',
      email: testEmail,
      password: 'StablePassword123!',
    });
    await user.save();

    const loadedUser = await IsolatedUser.findById(user._id).select('+password');
    assert.ok(loadedUser);
    const originalHash = loadedUser.password;

    // Update an unrelated field and save
    loadedUser.name = 'Updated Rehash Test User';
    await loadedUser.save();

    const reloadedUser = await IsolatedUser.findById(user._id).select('+password');
    assert.ok(reloadedUser);
    assert.equal(reloadedUser.password, originalHash, 'Password hash should remain unchanged when password is not modified');
  });

  test('enforces database-level unique email constraint', async (t) => {
    if (!isMongoConnected || !IsolatedUser) {
      t.skip('MongoDB not reachable');
      return;
    }

    const duplicateEmail = 'duplicate@integration-test.devlaunch';
    const firstUser = new IsolatedUser({
      name: 'First User',
      email: duplicateEmail,
      password: 'Password123!',
    });
    await firstUser.save();

    const secondUser = new IsolatedUser({
      name: 'Second User',
      email: duplicateEmail,
      password: 'AnotherPassword123!',
    });

    await assert.rejects(
      async () => {
        await secondUser.save();
      },
      (err: unknown) => {
        const mongoErr = err as { code?: number };
        return mongoErr.code === 11000;
      },
      'Expected duplicate key error (code: 11000) on duplicate email'
    );
  });
});
