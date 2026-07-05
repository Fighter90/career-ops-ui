/**
 * Company logo proxy (v1.104.0). CI-isolated: no live DNS/network — the favicon
 * fetcher is injected (endpoint) or safeGet is faked (unit). Verifies the
 * domain guard, image sniffing, negative caching, and the SSRF-safe binary path.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server; let baseUrl;
let isPlausibleDomain; let fetchFavicon; let _setFaviconFetcher; let _clearLogoCache;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

before(async () => {
  process.env.CAREER_OPS_ROOT = mkdtempSync(join(tmpdir(), 'logo-root-'));
  ({ isPlausibleDomain, fetchFavicon, _setFaviconFetcher, _clearLogoCache } = await import('../server/lib/routes/logos.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
after(() => { _setFaviconFetcher(null); delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });
beforeEach(() => { _clearLogoCache(); });

test('isPlausibleDomain accepts real hostnames, rejects schemes/paths/loopback/junk', () => {
  for (const ok of ['acme.com', 'careers.acme.io', 'a-b.co.uk']) assert.equal(isPlausibleDomain(ok), true, ok);
  for (const bad of ['', 'localhost', 'http://acme.com', 'acme.com/path', 'acme', '10.0.0.1',
    '../../etc/passwd', 'acme .com', 'a..b.com', '.acme.com', 'acme.com:8080']) {
    assert.equal(isPlausibleDomain(bad), false, bad);
  }
});

test('fetchFavicon returns the buffer only for image-looking 200s, else null', async () => {
  // A PNG magic buffer with no content-type → accepted via sniff.
  const okPng = await fetchFavicon('acme.com', { safeGet: async () => ({ status: 200, buffer: PNG, contentType: '' }) });
  assert.ok(okPng && Buffer.isBuffer(okPng.buf));
  // 200 but HTML body (an error page dressed as favicon) → rejected.
  const html = await fetchFavicon('acme.com', { safeGet: async () => ({ status: 200, buffer: Buffer.from('<html>nope</html>'), contentType: 'text/html' }) });
  assert.equal(html, null);
  // Non-200 → null.
  const notFound = await fetchFavicon('acme.com', { safeGet: async () => ({ status: 404, buffer: Buffer.alloc(0), contentType: '' }) });
  assert.equal(notFound, null);
  // safeGet throws (SSRF block / timeout) → null, never propagates.
  const threw = await fetchFavicon('acme.com', { safeGet: async () => { throw new Error('unsafe host'); } });
  assert.equal(threw, null);
});

test('GET /api/logo rejects an invalid domain with 400 (before any fetch)', async () => {
  const r = await fetch(`${baseUrl}/api/logo?domain=${encodeURIComponent('http://localhost/x')}`);
  assert.equal(r.status, 400);
});

test('GET /api/logo serves image bytes on hit and negatively-caches a miss', async () => {
  let calls = 0;
  _setFaviconFetcher(async () => { calls++; return { buf: PNG, contentType: 'image/png' }; });
  const r1 = await fetch(`${baseUrl}/api/logo?domain=acme.com`);
  assert.equal(r1.status, 200);
  assert.match(r1.headers.get('content-type'), /image\/png/);
  const bytes = Buffer.from(await r1.arrayBuffer());
  assert.equal(bytes[0], 0x89); assert.equal(bytes[1], 0x50);
  // Second hit is served from cache — the fetcher is not called again.
  const r2 = await fetch(`${baseUrl}/api/logo?domain=acme.com`);
  assert.equal(r2.status, 200);
  assert.equal(calls, 1, 'cache hit should not re-fetch');

  // A miss is cached as 404 and not re-fetched.
  _clearLogoCache();
  let missCalls = 0;
  _setFaviconFetcher(async () => { missCalls++; return null; });
  assert.equal((await fetch(`${baseUrl}/api/logo?domain=nologo.example`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/logo?domain=nologo.example`)).status, 404);
  assert.equal(missCalls, 1, 'negative cache should not re-fetch');
});

test('safe-fetch binary mode returns the raw Buffer + content-type (SSRF path unchanged)', async () => {
  const { safeGet, _setTransport } = await import('../server/lib/safe-fetch.mjs');
  const restore = _setTransport(async () => ({ status: 200, headers: { 'content-type': 'image/png' }, body: PNG }));
  try {
    // IP-literal host → dns.lookup resolves it without a network query (public IP,
    // passes the SSRF private-range check), so the test stays CI-isolated.
    const r = await safeGet('https://93.184.216.34/favicon.ico', { binary: true });
    assert.ok(Buffer.isBuffer(r.buffer));
    assert.equal(r.contentType, 'image/png');
    assert.equal(r.text, undefined);
    // text mode still works and does NOT return a buffer.
    const t = await safeGet('https://93.184.216.34/', {});
    assert.equal(typeof t.text, 'string');
    assert.equal(t.buffer, undefined);
  } finally { restore(); }
});
