import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Configure test environment variables prior to app initialization
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devlaunch_test';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devlaunch_test_jwt_secret_min_32_chars_long';

const { app } = await import('../src/app.js');
const { AppError } = await import('../src/utils/AppError.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

describe('Error Handling Middleware', () => {
  test('returns HTTP 404 with JSON structure for unknown routes', async () => {
    const res = await request(app).get('/api/unmapped-endpoint');

    assert.equal(res.status, 404);
    assert.equal(res.headers['content-type']?.includes('application/json'), true);
    assert.equal(res.body.success, false);
    assert.equal(res.body.status, 'fail');
    assert.ok(res.body.error.includes('/api/unmapped-endpoint'));
  });

  test('returns HTTP 400 with structured JSON for malformed request payloads', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"badJson":');

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.status, 'fail');
    assert.equal(res.body.error, 'Malformed JSON payload in request body.');
  });

  test('formats operational AppError correctly with custom status code', async () => {
    const testApp = express();
    testApp.get('/test-operational', () => {
      throw new AppError('Custom operational failure message', 422);
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/test-operational');

    assert.equal(res.status, 422);
    assert.equal(res.body.success, false);
    assert.equal(res.body.status, 'fail');
    assert.equal(res.body.error, 'Custom operational failure message');
  });

  test('hides internal error details and stack traces when running in production mode', async () => {
    // Execute an isolated test process with NODE_ENV=production to verify stack suppression
    const testScript = `
      import express from 'express';
      import request from 'supertest';
      import assert from 'node:assert/strict';
      import { errorHandler } from './src/middleware/errorHandler.js';

      const app = express();
      app.get('/test-internal-error', () => {
        throw new Error('Sensitive database internal failure');
      });
      app.use(errorHandler);

      const res = await request(app).get('/test-internal-error');
      assert.equal(res.status, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.status, 'error');
      assert.equal(res.body.error, 'An internal server error occurred.');
      assert.equal(res.body.stack, undefined);
      console.log('PRODUCTION_ERROR_OK');
    `;

    const output = execFileSync(
      'node',
      ['--import', 'tsx', '--input-type=module', '-e', testScript],
      {
        cwd: backendRoot,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          MONGODB_URI: 'mongodb://127.0.0.1:27017/devlaunch_test',
          SMTP_HOST: 'smtp.test.local',
          SMTP_PORT: '587',
          SMTP_USER: 'test_user',
          SMTP_PASS: 'test_pass',
        },
        encoding: 'utf8',
      }
    );

    assert.ok(output.includes('PRODUCTION_ERROR_OK'));
  });
});
