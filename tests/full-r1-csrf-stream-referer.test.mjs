/**
 * FULL-R1 (finding 1) — Referer fallback for the request guard.
 *
 * request-guard.mjs already refuses an acting GET (`/api/stream/*`,
 * `/api/run/*`, `/api/geocode`) when the modern Fetch-Metadata header says
 * `Sec-Fetch-Site: cross-site`, or when a present `Origin` names a foreign
 * host (`tests/request-guard.test.mjs`). The gap: a request carrying
 * NEITHER header — an older browser's `<img src="http://host/api/stream/
 * batch">` sends no `Sec-Fetch-Site` and, per the Fetch spec, no `Origin`
 * on a simple cross-origin GET either — falls through `isCrossSite` to
 * `site === 'same-site'` with `site === ''`, i.e. `false`: NOT cross-site,
 * the request is let through. That is exactly the CSRF surface FULL-R1
 * describes: a cross-site page can trigger `/api/stream/batch` (LLM spend),
 * `/api/stream/scan` (file writes) or `/api/stream/pdf` (spawns Chromium)
 * from any page the user has open, using the browser's cached basic-auth.
 *
 * Fix: when both Sec-Fetch-Site and Origin are absent, fall back to
 * Referer — the one signal a legacy browser still sends on a subresource
 * request under the default Referrer-Policy. A Referer naming a foreign
 * host is refused, same discipline as the Origin check (exact host:port,
 * or an ALLOWED_HOSTS entry). No Referer either (curl, the CLI, the
 * SPA's own same-origin EventSource when a browser omits it, server-side
 * tests) stays trusted — unchanged from today.
 *
 * CI-isolated: a temp CAREER_OPS_ROOT, an ephemeral loopback port, no
 * network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let dir, guard, server, port, createApp;

function call({ method = 'GET', path = '/', headers = {} } = {}) {
  return new Promise((resolveP, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      // The guard answers (403, or a plain JSON body) before any route body
      // starts; an SSE route that gets PAST the guard keeps the connection
      // open indefinitely. Resolve on the response head and abort the
      // socket right after — this test only asserts whether the guard
      // itself refused the request, never the scan's own outcome.
      resolveP({ status: res.statusCode });
      req.destroy();
    });
    req.on('error', (e) => {
      // destroy() above races an ECONNRESET on some platforms once we've
      // already resolved — harmless, ignore it.
      if (e && (e.code === 'ECONNRESET' || e.message === 'aborted')) return;
      reject(e);
    });
    req.end();
  });
}

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'req-guard-referer-'));
  for (const d of ['config', 'data', 'reports']) mkdirSync(resolve(dir, d), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  process.env.CAREER_OPS_ROOT = dir;
  guard = await import('../server/lib/request-guard.mjs');
  ({ createApp } = await import('../server/index.mjs'));
  server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

after(async () => {
  await new Promise((r) => server.close(r));
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

test('isCrossSite: a foreign Referer is cross-site when neither Sec-Fetch-Site nor Origin is present', () => {
  const p = guard.buildHostPolicy({ allowedHosts: 'resumecraft.ru' });
  const req = (headers) => ({ headers });
  // The exact gap: no Sec-Fetch-Site, no Origin, but a Referer naming an
  // attacker page — the classic old-browser cross-site <img>.
  assert.equal(
    guard.isCrossSite(req({ host: 'localhost:1', referer: 'https://evil.example/attack.html' }), p),
    true,
    'a foreign Referer with no Origin/Sec-Fetch-Site must still be refused',
  );
  // Same-origin Referer stays allowed.
  assert.equal(
    guard.isCrossSite(req({ host: 'localhost:1', referer: 'http://localhost:1/some/page' }), p),
    false,
  );
  // An allowed public host behind a proxy (ALLOWED_HOSTS) is excused, same
  // as the Origin check.
  assert.equal(
    guard.isCrossSite(req({ host: 'proxy:9', referer: 'https://resumecraft.ru/scan' }), p),
    false,
  );
  // No Referer at all (curl, the CLI, server-side tests) stays trusted —
  // unchanged from today's documented behaviour.
  assert.equal(guard.isCrossSite(req({ host: 'localhost:1' }), p), false);
  // A malformed Referer can't be parsed into a host — fail closed, same as
  // a malformed Origin.
  assert.equal(
    guard.isCrossSite(req({ host: 'localhost:1', referer: 'not a url' }), p),
    true,
  );
  // An explicit Sec-Fetch-Site still takes precedence over any Referer —
  // same-origin fetch metadata is the stronger, more modern signal.
  assert.equal(
    guard.isCrossSite(req({ host: 'localhost:1', 'sec-fetch-site': 'same-origin', referer: 'https://evil.example' }), p),
    false,
  );
});

test('a cross-site <img>-style GET of /api/stream/scan with only a foreign Referer is refused (403)', async () => {
  const r = await call({
    path: '/api/stream/scan',
    headers: { referer: 'https://evil.example/attack.html' },
  });
  assert.equal(r.status, 403, 'expected the guard to refuse before the scan route runs');
});

test('the same request with a same-origin Referer (and no Origin/Sec-Fetch-Site) is not refused by the guard', async () => {
  const r = await call({
    path: '/api/stream/scan',
    headers: { referer: `http://127.0.0.1:${port}/app` },
  });
  // Not a 403 from the guard — it may still answer SCAN_BUSY/SSE/etc, but
  // the point of this test is the guard did not block it.
  assert.notEqual(r.status, 403);
});
