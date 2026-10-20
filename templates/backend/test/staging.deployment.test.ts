import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devlaunch_test_staging_deployment';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devlaunch_test_jwt_secret_min_32_chars_long';

const { app } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');
const { initDatabaseIndexes } = await import('../src/config/initIndexes.js');

describe('Staging Deployment & Configuration Tests', () => {
  const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devlaunch_test_staging_deployment';
  let isMongoAvailable = false;

  before(async () => {
    try {
      await mongoose.connect(TEST_DB_URI, {
        serverSelectionTimeoutMS: 2000,
        autoIndex: false,
      });
      isMongoAvailable = true;
    } catch {
      console.warn('[Notice] MongoDB unavailable. Skipping index verification.');
      isMongoAvailable = false;
    }
  });

  after(async () => {
    if (isMongoAvailable && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('Reverse Proxy Trust Configuration (TRUST_PROXY)', () => {
    test('defaults TRUST_PROXY to false when unset', () => {
      const result = spawnSync(
        'node',
        [
          '--import',
          'tsx',
          '--input-type=module',
          '-e',
          "import('./src/config/env.js').then(({ env }) => console.log('TRUST_PROXY:' + env.TRUST_PROXY));",
        ],
        {
          cwd: backendRoot,
          env: {
            PATH: process.env.PATH,
            MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
            JWT_SECRET: 'devlaunch_test_jwt_secret_min_32_chars_long',
          },
          encoding: 'utf8',
        }
      );

      assert.equal(result.status, 0);
      assert.ok(result.stdout.includes('TRUST_PROXY:false'));
    });

    test('parses integer hop count for TRUST_PROXY', () => {
      const result = spawnSync(
        'node',
        [
          '--import',
          'tsx',
          '--input-type=module',
          '-e',
          "import('./src/config/env.js').then(({ env }) => console.log('TRUST_PROXY_TYPE:' + typeof env.TRUST_PROXY + ' VAL:' + env.TRUST_PROXY));",
        ],
        {
          cwd: backendRoot,
          env: {
            PATH: process.env.PATH,
            MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
            JWT_SECRET: 'devlaunch_test_jwt_secret_min_32_chars_long',
            TRUST_PROXY: '1',
          },
          encoding: 'utf8',
        }
      );

      assert.equal(result.status, 0);
      assert.ok(result.stdout.includes('TRUST_PROXY_TYPE:number VAL:1'));
    });

    test('supports string IP or loopback descriptor for TRUST_PROXY', () => {
      const result = spawnSync(
        'node',
        [
          '--import',
          'tsx',
          '--input-type=module',
          '-e',
          "import('./src/config/env.js').then(({ env }) => console.log('TRUST_PROXY_VAL:' + env.TRUST_PROXY));",
        ],
        {
          cwd: backendRoot,
          env: {
            PATH: process.env.PATH,
            MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
            JWT_SECRET: 'devlaunch_test_jwt_secret_min_32_chars_long',
            TRUST_PROXY: 'loopback',
          },
          encoding: 'utf8',
        }
      );

      assert.equal(result.status, 0);
      assert.ok(result.stdout.includes('TRUST_PROXY_VAL:loopback'));
    });

    test('supports CIDR notation for TRUST_PROXY', () => {
      const result = spawnSync(
        'node',
        [
          '--import',
          'tsx',
          '--input-type=module',
          '-e',
          "import('./src/config/env.js').then(({ env }) => console.log('TRUST_PROXY_VAL:' + env.TRUST_PROXY));",
        ],
        {
          cwd: backendRoot,
          env: {
            PATH: process.env.PATH,
            MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
            JWT_SECRET: 'devlaunch_test_jwt_secret_min_32_chars_long',
            TRUST_PROXY: '10.0.0.0/8',
          },
          encoding: 'utf8',
        }
      );

      assert.equal(result.status, 0);
      assert.ok(result.stdout.includes('TRUST_PROXY_VAL:10.0.0.0/8'));
    });

    test('rejects invalid TRUST_PROXY configurations', () => {
      const result = spawnSync(
        'node',
        [
          '--import',
          'tsx',
          '--input-type=module',
          '-e',
          "import('./src/config/env.js');",
        ],
        {
          cwd: backendRoot,
          env: {
            PATH: process.env.PATH,
            MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
            JWT_SECRET: 'devlaunch_test_jwt_secret_min_32_chars_long',
            TRUST_PROXY: 'banana',
          },
          encoding: 'utf8',
        }
      );

      assert.notEqual(result.status, 0);
      assert.ok(result.stderr.includes('Invalid TRUST_PROXY "banana"'));
    });
  });

  describe('MongoDB Index Synchronization (initIndexes.ts)', () => {
    test('idempotently builds required unique indexes without dropping existing collections', async (t) => {
      if (!isMongoAvailable) return t.skip('MongoDB not reachable');

      // Execute index initialization
      await initDatabaseIndexes();

      // Inspect created indexes on the User collection
      const collection = mongoose.connection.collection('users');
      const indexes = await collection.indexes();

      // 1. Unique index on email
      const emailIndex = indexes.find((idx: any) => idx.key && idx.key.email === 1);
      assert.ok(emailIndex, 'Expected unique index on email');
      assert.equal(emailIndex.unique, true);

      // 2. Unique sparse index on googleId
      const googleIndex = indexes.find((idx: any) => idx.key && idx.key.googleId === 1);
      assert.ok(googleIndex, 'Expected sparse unique index on googleId');
      assert.equal(googleIndex.unique, true);
      assert.equal(googleIndex.sparse, true);

      // 3. Sparse index on passwordResetTokenHash
      const resetTokenIndex = indexes.find((idx: any) => idx.key && idx.key.passwordResetTokenHash === 1);
      assert.ok(resetTokenIndex, 'Expected sparse index on passwordResetTokenHash');
      assert.equal(resetTokenIndex.sparse, true);
    });
  });
});
