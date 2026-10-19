import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

describe('Environment Configuration Validation', () => {
  test('rejects missing MONGODB_URI with sanitized error message', () => {
    // Run an isolated process with an empty environment (no MONGODB_URI)
    const result = spawnSync(
      'node',
      ['--import', 'tsx', '--input-type=module', '-e', "import('./src/config/env.js');"],
      {
        cwd: backendRoot,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'test',
          // MONGODB_URI is intentionally omitted
        },
        encoding: 'utf8',
      }
    );

    assert.notEqual(result.status, 0);
    const combinedOutput = (result.stdout || '') + (result.stderr || '');
    assert.ok(combinedOutput.includes('[DevLaunch Config Error] Configuration validation failed:'));
    assert.ok(combinedOutput.includes('Missing required environment variable: MONGODB_URI.'));
  });

  test('rejects invalid PORT numbers exceeding valid TCP range', () => {
    const result = spawnSync(
      'node',
      ['--import', 'tsx', '--input-type=module', '-e', "import('./src/config/env.js');"],
      {
        cwd: backendRoot,
        env: {
          PATH: process.env.PATH,
          PORT: '99999',
          MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
        },
        encoding: 'utf8',
      }
    );

    assert.notEqual(result.status, 0);
    const combinedOutput = (result.stdout || '') + (result.stderr || '');
    assert.ok(combinedOutput.includes('Invalid PORT "99999". Must be a valid TCP port number between 1 and 65535.'));
  });

  test('rejects non-numeric PORT strings', () => {
    const result = spawnSync(
      'node',
      ['--import', 'tsx', '--input-type=module', '-e', "import('./src/config/env.js');"],
      {
        cwd: backendRoot,
        env: {
          PATH: process.env.PATH,
          PORT: 'invalid-port',
          MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
        },
        encoding: 'utf8',
      }
    );

    assert.notEqual(result.status, 0);
    const combinedOutput = (result.stdout || '') + (result.stderr || '');
    assert.ok(combinedOutput.includes('Invalid PORT "invalid-port". Must be a valid TCP port number between 1 and 65535.'));
  });

  test('rejects missing JWT_SECRET in development/production mode', () => {
    const result = spawnSync(
      'node',
      ['--import', 'tsx', '--input-type=module', '-e', "import('./src/config/env.js');"],
      {
        cwd: backendRoot,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'development',
          MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
          // JWT_SECRET is intentionally omitted
        },
        encoding: 'utf8',
      }
    );

    assert.notEqual(result.status, 0);
    const combinedOutput = (result.stdout || '') + (result.stderr || '');
    assert.ok(combinedOutput.includes('Missing required environment variable: JWT_SECRET.'));
  });

  test('rejects weak JWT_SECRET containing fewer than 32 characters', () => {
    const result = spawnSync(
      'node',
      ['--import', 'tsx', '--input-type=module', '-e', "import('./src/config/env.js');"],
      {
        cwd: backendRoot,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'development',
          MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
          JWT_SECRET: 'too-short-secret',
        },
        encoding: 'utf8',
      }
    );

    assert.notEqual(result.status, 0);
    const combinedOutput = (result.stdout || '') + (result.stderr || '');
    assert.ok(combinedOutput.includes('Invalid JWT_SECRET. Secret must be at least 32 characters long.'));
  });

  test('rejects invalid JWT_EXPIRES_IN format', () => {
    const result = spawnSync(
      'node',
      ['--import', 'tsx', '--input-type=module', '-e', "import('./src/config/env.js');"],
      {
        cwd: backendRoot,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'development',
          MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
          JWT_SECRET: 'super_secret_devlaunch_jwt_key_at_least_32_chars',
          JWT_EXPIRES_IN: 'invalid-expiry-format',
        },
        encoding: 'utf8',
      }
    );

    assert.notEqual(result.status, 0);
    const combinedOutput = (result.stdout || '') + (result.stderr || '');
    assert.ok(combinedOutput.includes('Invalid JWT_EXPIRES_IN "invalid-expiry-format".'));
  });

  test('successfully validates when required variables are present and correct', () => {
    const result = spawnSync(
      'node',
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        "import('./src/config/env.js').then(({ env }) => console.log('VALID_PORT:' + env.PORT + ' VALID_EXPIRY:' + env.JWT_EXPIRES_IN));",
      ],
      {
        cwd: backendRoot,
        env: {
          PATH: process.env.PATH,
          PORT: '5002',
          MONGODB_URI: 'mongodb://127.0.0.1:27017/devlaunch_test',
          CLIENT_URL: 'http://localhost:3000',
          JWT_SECRET: 'super_secret_devlaunch_jwt_key_at_least_32_chars',
        },
        encoding: 'utf8',
      }
    );

    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes('VALID_PORT:5002'));
    assert.ok(result.stdout.includes('VALID_EXPIRY:7d'));
  });

  test('rejects incomplete Google OAuth configuration when only partial variables are set', () => {
    const result = spawnSync(
      'node',
      ['--import', 'tsx', '--input-type=module', '-e', "import('./src/config/env.js');"],
      {
        cwd: backendRoot,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'test',
          MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
          GOOGLE_CLIENT_ID: 'only-client-id-provided.apps.googleusercontent.com',
          // GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL are intentionally omitted
        },
        encoding: 'utf8',
      }
    );

    assert.notEqual(result.status, 0);
    const combinedOutput = (result.stdout || '') + (result.stderr || '');
    assert.ok(combinedOutput.includes('Incomplete Google OAuth configuration'));
    assert.ok(combinedOutput.includes('missing GOOGLE_CLIENT_SECRET'));
    assert.ok(combinedOutput.includes('missing GOOGLE_CALLBACK_URL'));
  });

  test('rejects invalid GOOGLE_CALLBACK_URL format', () => {
    const result = spawnSync(
      'node',
      ['--import', 'tsx', '--input-type=module', '-e', "import('./src/config/env.js');"],
      {
        cwd: backendRoot,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'test',
          MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
          GOOGLE_CLIENT_ID: 'valid-client-id.apps.googleusercontent.com',
          GOOGLE_CLIENT_SECRET: 'valid-secret',
          GOOGLE_CALLBACK_URL: 'not-a-valid-url',
        },
        encoding: 'utf8',
      }
    );

    assert.notEqual(result.status, 0);
    const combinedOutput = (result.stdout || '') + (result.stderr || '');
    assert.ok(combinedOutput.includes('Invalid GOOGLE_CALLBACK_URL "not-a-valid-url"'));
  });

  test('validates and activates IS_GOOGLE_AUTH_CONFIGURED when all variables are valid', () => {
    const result = spawnSync(
      'node',
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        "import('./src/config/env.js').then(({ env }) => console.log('GOOGLE_CONFIGURED:' + env.IS_GOOGLE_AUTH_CONFIGURED));",
      ],
      {
        cwd: backendRoot,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'test',
          MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
          GOOGLE_CLIENT_ID: 'valid-client-id.apps.googleusercontent.com',
          GOOGLE_CLIENT_SECRET: 'valid-secret',
          GOOGLE_CALLBACK_URL: 'http://localhost:5000/api/auth/google/callback',
        },
        encoding: 'utf8',
      }
    );

    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes('GOOGLE_CONFIGURED:true'));
  });
});
