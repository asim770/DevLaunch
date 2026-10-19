import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

// Configure test environment variables prior to app initialization
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devlaunch_test';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';

const { app } = await import('../src/app.js');

describe('CORS Middleware', () => {
  test('attaches allow-origin and allow-credentials headers for configured CLIENT_URL', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:3000');

    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:3000');
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });

  test('does not grant access-control-allow-origin to unapproved origins', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://unauthorized-domain.com');

    assert.notEqual(res.headers['access-control-allow-origin'], 'http://unauthorized-domain.com');
  });

  test('responds to pre-flight OPTIONS request with allowed methods and headers', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

    assert.equal(res.status, 204);
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:3000');
    assert.ok(res.headers['access-control-allow-methods']?.includes('GET'));
    assert.ok(res.headers['access-control-allow-methods']?.includes('POST'));
    assert.ok(res.headers['access-control-allow-headers']?.includes('Content-Type'));
  });

  describe('CSRF Origin Validation (validateOrigin)', () => {
    test('permits state-changing POST request with matching Origin header', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Origin', 'http://localhost:3000');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    test('permits state-changing POST request without Origin header (non-browser client or same-origin)', async () => {
      const res = await request(app)
        .post('/api/auth/logout');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    test('rejects state-changing POST request with unauthorized Origin header (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Origin', 'http://evil-attacker-site.com');

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('Cross-origin request blocked'));
    });

    test('permits non-mutating GET request even if Origin is different', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://unauthorized-domain.com');

      // GET is non-mutating; allowed through (CORS simply omits allow-origin header)
      assert.notEqual(res.status, 403);
    });
  });
});
