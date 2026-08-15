/**
 * GET /api/cv-sync-check — read-only "setup doctor" relay of the parent's
 * cv-sync-check.mjs. That CLI has NO --json flag; it prints stable human text
 * (`ERROR:` / `WARN:` lines under a `=== career-ops sync check ===` banner) and
 * sets its exit code (1 when errors exist). We LIGHT-parse those lines into
 * { ok, errors[], warnings[] }.
 *
 * CI-isolated: bootstraps a mkdtemp CAREER_OPS_ROOT + a FAKE cv-sync-check.mjs
 * that reproduces the REAL observed stdout byte-for-byte, so the shell-out +
 * parse contract is tested without the real parent. paths.mjs carriers load via
 * dynamic import() AFTER the env is set (paths-once rule). The pure parser is
 * also unit-tested against the exact strings captured from the real CLI.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root, parseCvSyncOutput;

// ── Exact stdout captured from the real cv-sync-check.mjs (see route doc). ──
const REAL_ALL_PASSED = '\n=== career-ops sync check ===\n\nAll checks passed.\n\n';
const REAL_ERRORS =
  '\n=== career-ops sync check ===\n\nERRORS (2):\n' +
  '  ERROR: cv.md not found in project root. Create it with your CV in markdown format.\n' +
  '  ERROR: config/profile.yml not found. Copy from config/profile.example.yml and fill in your details.\n\n';
const REAL_WARNINGS =
  '\n=== career-ops sync check ===\n\n\nWARNINGS (3):\n' +
  '  WARN: cv.md seems too short. Make sure it contains your full CV.\n' +
  '  WARN: config/profile.yml may still have example data. Check field: full_name\n' +
  '  WARN: _shared.md:1 — Possible hardcoded metric: "170+ hours". Should this be read from cv.md/article-digest.md?\n\n';

/** Write a fake parent cv-sync-check.mjs that prints `text` and exits `code`. */
function writeFake(text, code) {
  const body = `process.stdout.write(${JSON.stringify(text)});\nprocess.exit(${code});\n`;
  writeFileSync(join(root, 'cv-sync-check.mjs'), body);
}

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'cvsync-root-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  writeFake(REAL_ERRORS, 1); // default fixture: errors present, exit 1
  process.env.CAREER_OPS_ROOT = root;
  // Dynamic import AFTER env is set so paths.mjs resolves to the temp root.
  ({ parseCvSyncOutput } = await import('../server/lib/routes/cv-sync.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  if (root) rmSync(root, { recursive: true, force: true });
  return new Promise((r) => server.close(r));
});

// ── Pure parser — exact real-CLI output shapes ──

test('parseCvSyncOutput: "All checks passed." → ok, no errors/warnings', () => {
  const d = parseCvSyncOutput(REAL_ALL_PASSED);
  assert.deepEqual(d, { ok: true, errors: [], warnings: [] });
});

test('parseCvSyncOutput: ERROR lines → ok:false with the messages (prefix stripped)', () => {
  const d = parseCvSyncOutput(REAL_ERRORS);
  assert.equal(d.ok, false);
  assert.equal(d.errors.length, 2);
  assert.equal(d.warnings.length, 0);
  assert.equal(d.errors[0], 'cv.md not found in project root. Create it with your CV in markdown format.');
  assert.match(d.errors[1], /^config\/profile\.yml not found\./);
});

test('parseCvSyncOutput: WARN lines → ok:true (warnings do not block), messages captured', () => {
  const d = parseCvSyncOutput(REAL_WARNINGS);
  assert.equal(d.ok, true); // no errors → not blocking
  assert.equal(d.warnings.length, 3);
  assert.equal(d.warnings[0], 'cv.md seems too short. Make sure it contains your full CV.');
  // The count header "WARNINGS (3):" must NOT be mistaken for a WARN line.
  assert.ok(!d.warnings.some((w) => /^WARNINGS/.test(w)));
});

test('parseCvSyncOutput: unrecognizable output (no banner) → null', () => {
  assert.equal(parseCvSyncOutput('boom: cannot find module'), null);
  assert.equal(parseCvSyncOutput(''), null);
});

// ── Route relay ──

test('GET /api/cv-sync-check relays parsed errors under available:true (exit 1 is a RESULT, not a failure)', async () => {
  const r = await fetch(baseUrl + '/api/cv-sync-check');
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.available, true);
  assert.equal(d.ok, false);
  assert.equal(d.errors.length, 2);
  assert.equal(d.warnings.length, 0);
});

test('GET /api/cv-sync-check relays a clean pass (exit 0)', async () => {
  writeFake(REAL_ALL_PASSED, 0);
  const r = await fetch(baseUrl + '/api/cv-sync-check');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.ok, true);
  assert.deepEqual(d.errors, []);
  assert.deepEqual(d.warnings, []);
});

test('GET /api/cv-sync-check relays warnings (ok stays true; not blocking)', async () => {
  writeFake(REAL_WARNINGS, 0);
  const r = await fetch(baseUrl + '/api/cv-sync-check');
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.ok, true);
  assert.equal(d.warnings.length, 3);
});

test('GET /api/cv-sync-check fails soft to {available:false, script-not-found} when the parent script is absent', async () => {
  rmSync(join(root, 'cv-sync-check.mjs'), { force: true });
  const r = await fetch(baseUrl + '/api/cv-sync-check');
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.available, false);
  assert.equal(d.reason, 'script-not-found');
});
