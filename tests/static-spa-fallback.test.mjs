/**
 * CAR-39 — the SPA catch-all must not answer asset-shaped requests.
 *
 *   - A path whose LAST segment carries a file extension but which
 *     express.static did not find (GET /app.js, /style.css,
 *     /css/style.css, /styles.css) must 404. Pre-fix every unmatched GET
 *     fell through to `app.get('*')` and returned 200 + the index HTML
 *     shell, so a stale/relocated asset reference silently received HTML
 *     and the browser failed to parse it as JS/CSS.
 *   - The shell is served only for NAVIGATION requests: the client accepts
 *     text/html AND the last path segment has no extension. Deep
 *     extension-less paths (/scan, /some/deep/link) keep working — the
 *     SPA is hash-routed, so any extension-less path is a route.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with cv.md, dynamic import inside
 * before(), ephemeral 127.0.0.1 port, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'static-spa-fallback-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# placeholder\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

const isHtmlShell = (ct, body) =>
  (ct || '').startsWith('text/html') && body.includes('<!DOCTYPE html>');

test('CAR-39: missing asset-shaped paths return 404, not the HTML shell', async () => {
  for (const p of ['/app.js', '/style.css', '/css/style.css', '/styles.css']) {
    const res = await fetch(baseUrl + p, { headers: { accept: 'text/html' } });
    const body = await res.text();
    assert.equal(res.status, 404, `${p} must 404, got ${res.status}`);
    assert.ok(!body.includes('<!DOCTYPE html'), `${p} must not return the SPA shell`);
  }
});

test('CAR-39: extension-less paths keep serving the SPA shell', async () => {
  for (const p of ['/', '/scan', '/some/deep/link']) {
    const res = await fetch(baseUrl + p, { headers: { accept: 'text/html' } });
    const body = await res.text();
    assert.equal(res.status, 200, `${p} must serve the shell, got ${res.status}`);
    assert.ok(
      isHtmlShell(res.headers.get('content-type'), body),
      `${p} must return the HTML shell`,
    );
  }
});

test('CAR-39: a real static asset is still served by express.static', async () => {
  // Sanity guard: the 404 rule must only hit MISSING files. public/js/app.js
  // exists and must never reach the fallback handler.
  const res = await fetch(`${baseUrl}/js/app.js`);
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /javascript/);
  assert.ok(body.trim().length > 0);
});

test('CAR-39: a request that does not accept HTML is not navigation -> 404', async () => {
  const res = await fetch(baseUrl + '/scan', { headers: { accept: 'application/json' } });
  const body = await res.text();
  assert.equal(res.status, 404, 'non-navigation request must not receive the shell');
  assert.ok(!body.includes('<!DOCTYPE html'));
});
