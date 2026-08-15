/**
 * GET /api/liveness — in-process route test. CI-isolated: no live network
 * (the SSRF-safe safeGet is stubbed via _setSafeGet) and no parent project
 * (CAREER_OPS_ROOT points at an empty mktemp dir). Never binds port 4317.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server; let baseUrl;
let _setSafeGet;
let stub; // mutable per-test fake safeGet

before(async () => {
  process.env.CAREER_OPS_ROOT = mkdtempSync(join(tmpdir(), 'liveness-root-'));
  ({ _setSafeGet } = await import('../server/lib/liveness-api.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
after(() => {
  _setSafeGet(null);
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});
beforeEach(() => {
  // Default stub: echoes finalUrl = requested apiUrl (same origin) so the
  // cross-origin guard passes; each test overrides `.impl`.
  stub = { calls: 0, impl: async (url) => ({ status: 200, text: '{}', finalUrl: url }) };
  _setSafeGet(async (url, opts) => { stub.calls++; return stub.impl(url, opts); });
});

async function liveness(url) {
  const r = await fetch(`${baseUrl}/api/liveness?url=${encodeURIComponent(url)}`);
  return { status: r.status, body: await r.json() };
}

test('rejects a loopback/private URL with 400 before any fetch (SSRF gate 1)', async () => {
  const { status } = await liveness('http://localhost/acme/jobs/1');
  assert.equal(status, 400);
  assert.equal(stub.calls, 0, 'must not fetch when isValidJobUrl rejects the input');
});

test('a valid but non-ATS URL → uncertain, and never fetches', async () => {
  const { status, body } = await liveness('https://example.com/jobs/1');
  assert.equal(status, 200);
  assert.equal(body.result, 'uncertain');
  assert.equal(body.code, 'inconclusive');
  assert.equal(body.provider, null);
  assert.equal(stub.calls, 0, 'non-ATS URL is resolved to null without a network call');
});

test('Greenhouse 200 → live (provider greenhouse)', async () => {
  stub.impl = async (url) => ({ status: 200, text: '{"id":123}', finalUrl: url });
  const { body } = await liveness('https://boards.greenhouse.io/acme/jobs/123');
  assert.equal(body.result, 'live');
  assert.equal(body.provider, 'greenhouse');
  assert.equal(stub.calls, 1);
});

test('Greenhouse 404 → expired', async () => {
  stub.impl = async (url) => ({ status: 404, text: '', finalUrl: url });
  const { body } = await liveness('https://boards.greenhouse.io/acme/jobs/123');
  assert.equal(body.result, 'expired');
  assert.equal(body.provider, 'greenhouse');
});

test('Greenhouse 503 → uncertain (transient, never a false expired)', async () => {
  stub.impl = async (url) => ({ status: 503, text: '', finalUrl: url });
  const { body } = await liveness('https://boards.greenhouse.io/acme/jobs/123');
  assert.equal(body.result, 'uncertain');
});

test('Lever 404 → uncertain (api404 non-authoritative, not expired)', async () => {
  stub.impl = async (url) => ({ status: 404, text: '', finalUrl: url });
  const { body } = await liveness('https://jobs.lever.co/acme/abc-123');
  assert.equal(body.result, 'uncertain');
});

test('Ashby org board: posting listed → live, unlisted → expired', async () => {
  stub.impl = async (url) => ({ status: 200, text: JSON.stringify({ jobs: [{ id: 'uuid-1', isListed: true }] }), finalUrl: url });
  const live = await liveness('https://jobs.ashbyhq.com/acme/uuid-1');
  assert.equal(live.body.result, 'live');
  assert.equal(live.body.provider, 'ashby');

  stub.impl = async (url) => ({ status: 200, text: JSON.stringify({ jobs: [{ id: 'other', isListed: true }] }), finalUrl: url });
  const gone = await liveness('https://jobs.ashbyhq.com/acme/uuid-1');
  assert.equal(gone.body.result, 'expired');
});

test('a cross-origin redirect landing → uncertain (redirect-refusal preserved)', async () => {
  // safeGet followed a redirect that landed off the fixed API host.
  stub.impl = async () => ({ status: 200, text: '{"id":1}', finalUrl: 'https://login.example.com/sso' });
  const { body } = await liveness('https://boards.greenhouse.io/acme/jobs/123');
  assert.equal(body.result, 'uncertain');
});
