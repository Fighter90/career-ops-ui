/**
 * FULL-M4 (part 1) — /api/logo hardening.
 *
 *   /api/logo relayed attacker-chosen SVG from the app origin with
 *   `Cache-Control: public` and no nosniff; an SVG is active content
 *   (scripts, foreignObject) served same-origin, so it must be refused
 *   outright, and proxied per-domain bytes must be `private` + nosniff.
 *
 * CI-isolated: mkdtemp root with cv.md, injected favicon fetcher,
 * 127.0.0.1 bind, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let fetchFavicon;
let _setFaviconFetcher;
let _clearLogoCache;
let BATCH_LIMITS;
let __batchSlot;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'full-m4-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'batch', 'tracker-additions'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# x\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  // Stub runner: echoes args, exits 0 — the SSE `start` frame carries args.
  const runner = resolve(dir, 'batch', 'batch-runner.sh');
  writeFileSync(runner, '#!/usr/bin/env bash\necho "stub args: $@" >&2\nexit 0\n');
  chmodSync(runner, 0o755);
  process.env.CAREER_OPS_ROOT = dir;
  ({ fetchFavicon, _setFaviconFetcher, _clearLogoCache } = await import('../server/lib/routes/logos.mjs'));
  ({ BATCH_LIMITS, __batchSlot } = await import('../server/lib/routes/batch.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => {
  _setFaviconFetcher(null);
  delete process.env.CAREER_OPS_ROOT;
  server.closeAllConnections?.();
  return new Promise((r) => server.close(r));
});

async function events(path) {
  const res = await fetch(baseUrl + path);
  const text = await res.text();
  return text.split('\n\n').filter(Boolean).map((block) => {
    const ev = (block.match(/^event: (.+)$/m) || [])[1] || 'message';
    const data = JSON.parse((block.match(/^data: (.+)$/m) || [])[1] || 'null');
    return { ev, data };
  });
}

async function getStartArgs(qs) {
  const evs = await events('/api/stream/batch' + (qs ? '?' + qs : ''));
  const start = evs.find((e) => e.ev === 'start');
  if (!start) throw new Error(`no start frame: ${JSON.stringify(evs)}`);
  return start.data.args;
}

// ── /api/logo: SVG refusal ────────────────────────────────────────────────

test('fetchFavicon refuses a declared image/svg+xml payload', async () => {
  const got = await fetchFavicon('acme.com', { safeGet: async () => ({ status: 200, buffer: SVG, contentType: 'image/svg+xml' }) });
  assert.equal(got, null, 'SVG must never come back as a servable logo');
});

test('fetchFavicon refuses a sniffed <svg body even with no content-type', async () => {
  const got = await fetchFavicon('acme.com', { safeGet: async () => ({ status: 200, buffer: SVG, contentType: '' }) });
  assert.equal(got, null, 'the <svg sniff must not pass SVG bodies through');
});

test('GET /api/logo 404s when the upstream serves SVG', async () => {
  _setFaviconFetcher(async () => ({ buf: SVG, contentType: 'image/svg+xml' }));
  const r = await fetch(`${baseUrl}/api/logo?domain=evil.example`);
  assert.equal(r.status, 404);
});

// ── /api/logo: private cache + nosniff ────────────────────────────────────

test('GET /api/logo serves Cache-Control: private + nosniff (fresh)', async () => {
  _setFaviconFetcher(async () => ({ buf: PNG, contentType: 'image/png' }));
  const r = await fetch(`${baseUrl}/api/logo?domain=fresh.example`);
  assert.equal(r.status, 200);
  const cc = r.headers.get('cache-control') || '';
  assert.match(cc, /private/, `cache-control must be private, got "${cc}"`);
  assert.doesNotMatch(cc, /public/, 'a proxied same-origin response must not be publicly cacheable');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('GET /api/logo serves the same headers on a cache hit', async () => {
  _setFaviconFetcher(async () => ({ buf: PNG, contentType: 'image/png' }));
  await fetch(`${baseUrl}/api/logo?domain=cached.example`);
  const r2 = await fetch(`${baseUrl}/api/logo?domain=cached.example`);
  assert.equal(r2.status, 200);
  const cc = r2.headers.get('cache-control') || '';
  assert.match(cc, /private/);
  assert.doesNotMatch(cc, /public/);
  assert.equal(r2.headers.get('x-content-type-options'), 'nosniff');
});

