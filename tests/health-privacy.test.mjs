/**
 * FIX-M1 — when the server is reachable from the LAN (HOST=0.0.0.0 or
 * any non-loopback bind), /api/health must not leak the absolute project
 * path or the exact Node version. Loopback responses keep the values
 * for local diagnostics.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let createApp;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'health-priv-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ createApp } = await import('../server/index.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  delete process.env.HOST;
});

async function bootAndGet(host, path = '/api/health') {
  process.env.HOST = host;
  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  try {
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    return await res.json();
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const bootAndGetHealth = (host) => bootAndGet(host);

test('/api/ping is a liveness probe that leaks nothing', async () => {
  // It exists so a monitor can reach the service WITHOUT the credentials that
  // guard /api/health — which reports absolute paths, the profile owner's real
  // name and which API keys are set. Those are fine for an authenticated
  // operator and must never be public, so this endpoint may never grow them.
  const ping = await bootAndGet('127.0.0.1', '/api/ping');
  assert.deepEqual(Object.keys(ping).sort(), ['ok', 'version'], 'exactly two fields — adding one needs a second look');
  assert.equal(ping.ok, true);
  assert.match(ping.version, /^\d+\.\d+\.\d+/);

  const body = JSON.stringify(ping);
  assert.equal(body.includes('/'), false, 'no filesystem path');
  assert.equal(/test/i.test(body), false, 'no profile owner name');
  assert.equal(/key|node|v\d+\.\d+\.\d+-/i.test(body.replace(ping.version, '')), false, 'no key inventory, no Node version');
});

test('on loopback, Node version + project root are visible', async () => {
  const h = await bootAndGetHealth('127.0.0.1');
  const node = h.checks.find((c) => c.name === 'Node version');
  const root = h.checks.find((c) => c.name === 'Project root');
  assert.match(node.value, /^v\d+\./, 'expected vN.x.x version');
  assert.match(root.value, /^\//, 'expected absolute path');
});

test('on 0.0.0.0, Node version + project root are masked', async () => {
  const h = await bootAndGetHealth('0.0.0.0');
  const node = h.checks.find((c) => c.name === 'Node version');
  const root = h.checks.find((c) => c.name === 'Project root');
  assert.equal(node.value, 'hidden');
  assert.equal(root.value, 'hidden');
});

test('masking applies to any non-loopback HOST', async () => {
  const h = await bootAndGetHealth('192.168.1.42');
  assert.equal(h.checks.find((c) => c.name === 'Node version').value, 'hidden');
  assert.equal(h.checks.find((c) => c.name === 'Project root').value, 'hidden');
});

test('the profile owner\u2019s name is masked off loopback, like paths and versions', async () => {
  // The guarantee exists only because `Profile customized` shares the same
  // `hidden ?? value` guard as the project root — nothing pinned it, so an edit
  // that gave this row its own value would leak a real person's name to the LAN
  // with no test to notice.
  const local = await bootAndGetHealth('127.0.0.1');
  const lan = await bootAndGetHealth('0.0.0.0');
  const row = (h) => h.checks.find((c) => c.name === 'Profile customized');
  // The row's value embeds the name in a status string rather than being the
  // bare name, which is exactly why masking must cover the whole value.
  assert.match(row(local).value, /Test/, 'on loopback the operator sees their own profile');
  assert.equal(row(lan).value, 'hidden', 'off loopback the name must not be reported');
  assert.equal(JSON.stringify(lan).includes('Test'), false, 'and it must not survive anywhere else in the payload');
});

test('the ok/required flags are unaffected by masking', async () => {
  const h = await bootAndGetHealth('0.0.0.0');
  // The Node check should still be "ok: true" since we ARE on Node ≥ 18 here.
  const node = h.checks.find((c) => c.name === 'Node version');
  assert.equal(node.ok, true);
  assert.equal(node.required, true);
});
