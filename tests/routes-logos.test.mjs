/**
 * routes-2 — logos.mjs: a miss is negatively cached only briefly (minutes, not
 * 24h), and an oversized favicon that safeGet cut off at maxBytes is never
 * served as a 200 image. Handles both safeGet shapes (with or without a
 * `truncated` flag). CI-isolated: fetcher / safeGet injected, no network.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root, logos;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const MIN = 60 * 1000;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'routes-logos-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# x\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  process.env.CAREER_OPS_ROOT = root;
  logos = await import('../server/lib/routes/logos.mjs');
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
after(() => {
  logos._setFaviconFetcher(null);
  delete process.env.CAREER_OPS_ROOT;
  if (root) rmSync(root, { recursive: true, force: true });
  return new Promise((r) => server.close(r));
});
beforeEach(() => logos._clearLogoCache());

test('a miss is retried after the short negative TTL (not 24h)', async () => {
  let calls = 0;
  let answer = null;
  logos._setFaviconFetcher(async () => { calls += 1; return answer; });
  assert.equal((await fetch(`${baseUrl}/api/logo?domain=flaky.com`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/logo?domain=flaky.com`)).status, 404);
  assert.equal(calls, 1, 'miss cached briefly');
  logos._ageLogoCache('flaky.com', 11 * MIN);
  answer = { buf: PNG, contentType: 'image/png' };
  const r = await fetch(`${baseUrl}/api/logo?domain=flaky.com`);
  assert.equal(r.status, 200);
  assert.equal(calls, 2, 'refetched after the negative TTL');
});

test('a hit stays cached across the negative TTL', async () => {
  let calls = 0;
  logos._setFaviconFetcher(async () => { calls += 1; return { buf: PNG, contentType: 'image/png' }; });
  await fetch(`${baseUrl}/api/logo?domain=ok.com`);
  logos._ageLogoCache('ok.com', 60 * MIN);
  assert.equal((await fetch(`${baseUrl}/api/logo?domain=ok.com`)).status, 200);
  assert.equal(calls, 1);
  logos._ageLogoCache('ok.com', 25 * 60 * MIN);
  await fetch(`${baseUrl}/api/logo?domain=ok.com`);
  assert.equal(calls, 2, 'hit expires after 24h');
});

test('fetchFavicon asks for cap+1 bytes and rejects a body cut at the cap', async () => {
  let asked = 0;
  const big = Buffer.concat([PNG, Buffer.alloc(200 * 1024 + 1 - PNG.length)]);
  const r = await logos.fetchFavicon('big.com', {
    safeGet: async (_u, opts) => { asked = opts.maxBytes; return { status: 200, buffer: big.subarray(0, opts.maxBytes), contentType: 'image/png' }; },
  });
  assert.equal(asked, 200 * 1024 + 1);
  assert.equal(r, null);
});

test('fetchFavicon honours an explicit truncated flag from safeGet', async () => {
  const r = await logos.fetchFavicon('t.com', { safeGet: async () => ({ status: 200, buffer: PNG, contentType: 'image/png', truncated: true }) });
  assert.equal(r, null);
  const ok = await logos.fetchFavicon('t.com', { safeGet: async () => ({ status: 200, buffer: PNG, contentType: 'image/png', truncated: false }) });
  assert.ok(ok && ok.buf.equals(PNG));
});
