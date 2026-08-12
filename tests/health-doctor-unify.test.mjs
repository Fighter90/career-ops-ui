/**
 * FIX-C6 + FIX-H6 — Health checks now mirror what `node doctor.mjs`
 * would report (parent-deps, Playwright, dirs, profile-customized).
 * Single source of truth via /api/health, no second read of state via
 * the Doctor button.
 *
 * v1.28.1 — HH_USER_AGENT row removed from /api/health (it was
 * redundant noise — the 403-from-non-RU hint still lives in
 * help-bundle §16 and in the ru-scanner's stderr at scan time).
 * `tests/health-no-hh-user-agent-row.test.mjs` is the regression
 * guard that asserts it stays absent.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let projectRoot;

before(async () => {
  projectRoot = mkdtempSync(resolve(tmpdir(), 'health-unify-'));
  mkdirSync(resolve(projectRoot, 'config'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'data'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'modes'), { recursive: true });
  writeFileSync(resolve(projectRoot, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(projectRoot, 'config', 'profile.yml'), 'candidate:\n  full_name: "Jane Smith"\n');
  writeFileSync(resolve(projectRoot, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(projectRoot, 'data', 'applications.md'), '');
  writeFileSync(resolve(projectRoot, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(projectRoot, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = projectRoot;
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

async function getHealth() {
  const res = await fetch(baseUrl + '/api/health');
  return res.json();
}

test('Health: surfaces all the checks Doctor used to expose', async () => {
  const h = await getHealth();
  const names = h.checks.map((c) => c.name);
  // v1.28.1 — bar was ≥13 pre-prune; HH_USER_AGENT removal drops it to ≥12.
  assert.ok(h.checks.length >= 12, `expected ≥12 checks, got ${h.checks.length}: ${names.join(', ')}`);
  // Critical doctor parity:
  for (const expected of [
    'Profile customized',
    'GEMINI_API_KEY',
    'HERMES_API_KEY', // v1.151.0 — the 7th live-eval provider gets a health/doctor row
    // v1.28.1 — HH_USER_AGENT removed (see file header).
    'Playwright (parent node_modules)',
    'Parent project dependencies',
    'data/ directory',
    'reports/ directory',
    'output/ directory',
    'jds/ directory',
  ]) {
    assert.ok(names.includes(expected), `missing check "${expected}". got: ${names.join(', ')}`);
  }
});

test('FIX-H6: placeholder "Jane Smith" profile flagged but does NOT flip ok', async () => {
  const h = await getHealth();
  const c = h.checks.find((x) => x.name === 'Profile customized');
  assert.ok(c, 'Profile customized check missing');
  assert.equal(c.ok, false);
  assert.equal(c.required, false, 'kept optional so a half-setup install does not break ok=true semantics');
  assert.match(c.value, /Jane Smith|template/i);
  // Overall ok should still be true since required checks still pass.
  assert.equal(h.ok, true);
  assert.ok(h.warnings >= 1);
});

test('FIX-H6: real name flips Profile customized to ok=true', async () => {
  writeFileSync(resolve(projectRoot, 'config', 'profile.yml'), 'candidate:\n  full_name: "Jane Doe"\n');
  const h = await getHealth();
  const c = h.checks.find((x) => x.name === 'Profile customized');
  assert.equal(c.ok, true);
  assert.equal(c.value, 'Jane Doe');
});

test('FIX-H6: empty / missing full_name → ok:false with explicit hint', async () => {
  writeFileSync(resolve(projectRoot, 'config', 'profile.yml'), 'candidate: {}\n');
  let h = await getHealth();
  let c = h.checks.find((x) => x.name === 'Profile customized');
  assert.equal(c.ok, false);
  assert.match(c.value, /full_name/);

  // Garbled YAML → also flagged but with a parse-error message
  writeFileSync(resolve(projectRoot, 'config', 'profile.yml'), '::: not yaml ::: : :');
  h = await getHealth();
  c = h.checks.find((x) => x.name === 'Profile customized');
  assert.equal(c.ok, false);
});
