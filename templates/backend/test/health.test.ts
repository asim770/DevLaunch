import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

// Configure test environment variables prior to app initialization
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devlaunch_test';
process.env.NODE_ENV = 'test';

const { app } = await import('../src/app.js');

describe('Health Endpoint (/api/health)', () => {
  test('returns valid JSON with expected health fields', async () => {
    const res = await request(app).get('/api/health');

    assert.equal(res.headers['content-type']?.includes('application/json'), true);
    assert.ok(res.body);
    assert.ok(typeof res.body.status === 'string');
    assert.ok(typeof res.body.timestamp === 'string');
    assert.ok(typeof res.body.uptime === 'number');
    assert.ok(typeof res.body.environment === 'string');
    assert.ok(res.body.database);
    assert.ok(typeof res.body.database.status === 'string');
  });

  test('reports degraded status and HTTP 503 when database is disconnected', async () => {
    // In test suite, connectDatabase() is deliberately NOT called
    const res = await request(app).get('/api/health');

    assert.equal(res.status, 503);
    assert.equal(res.body.status, 'degraded');
    assert.equal(res.body.database.status, 'disconnected');
  });

  test('does not expose database credentials or connection strings in response', async () => {
    const res = await request(app).get('/api/health');
    const rawResponse = JSON.stringify(res.body);

    assert.equal(rawResponse.includes('mongodb'), false);
    assert.equal(rawResponse.includes('27017'), false);
    assert.equal(rawResponse.includes('password'), false);
    assert.equal(rawResponse.includes('secret'), false);
  });
});
