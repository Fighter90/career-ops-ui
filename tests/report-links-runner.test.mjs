/**
 * Report-links runner — POST /api/runners/report-links (v1.246.0 backlog #4,
 * parent #4751). The #/health "Fix report links" action relays the parent's
 * canonical repair:
 *
 *   node fix-report-links.mjs --dry-run   (default — read-only preview)
 *   node fix-report-links.mjs             (apply — rewrites dead Report cells)
 *
 * Contract mirrored from the tracker-status relay (tests/tracker-inline-
 * status.test.mjs): CI-isolated mkdtemp CAREER_OPS_ROOT with a FAKE
 * fix-report-links.mjs copied in (tests/fixtures/fake-fix-report-links.mjs;
 * the route spawns it relative to cwd = the data root). Failure modes are
 * driven through a sibling report-links-mock.json the fake reads at startup.
 *
 * NOTE on the parent's stdout: the real script prints PLAIN TEXT (no --json
 * flag exists). So exit-0 runs pass text through as { output } + a light
 * parse (rows/summary); only a non-zero exit or a missing script is a 502 —
 * text with exit 0 is a SUCCESS, not an error. No network, 127.0.0.1 bind,
 * dynamic imports AFTER the env is set (paths-once eager-import rule).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAKE_SCRIPT = join(__dirname, 'fixtures', 'fake-fix-report-links.mjs');

let server, baseUrl, root, mockCtl;

const TRACKER = `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
| 1 | 2026-10-01 | Acme | Backend Engineer | 4.2/5 | Applied | ❌ | [1](reports/001-acme.md) | — |
| 2 | 2026-10-02 | Globex | Product Designer | 3.8/5 | Interview | ❌ | — | — |
`;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'report-links-runner-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  mkdirSync(join(root, 'reports'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), TRACKER);
  writeFileSync(join(root, 'reports', '001-acme.md'), '# Evaluation: Acme\n');
  copyFileSync(FAKE_SCRIPT, join(root, 'fix-report-links.mjs'));
  mockCtl = join(root, 'report-links-mock.json');
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); });
  });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  if (root) rmSync(root, { recursive: true, force: true });
  return new Promise((r) => server.close(r));
});

const post = (body) => fetch(baseUrl + '/api/runners/report-links', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
// Clear the mock override so a case only sets what it needs.
const clearMock = () => rmSync(mockCtl, { force: true });

// ── Validation guards run FIRST (a bad mode must be a 400, no spawn) ──

test('400 on an invalid mode — the whitelist is dry-run|apply, no spawn', async () => {
  for (const mode of ['Apply', 'repair', 'DRY-RUN', 1, true, null]) {
    const r = await post({ mode });
    assert.equal(r.status, 400, `mode=${JSON.stringify(mode)}`);
    assert.match((await r.json()).error, /mode/i);
  }
});

// ── Happy paths: the relay reaches the script with the right argv. ──

test('200 default (no body) is a dry-run: the script gets --dry-run', async () => {
  clearMock();
  const r = await post({});
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.mode, 'dry-run');
  assert.equal(d.ok, true);
  assert.equal(d.dryRun, true);
  assert.ok(d.argv.includes('--dry-run'), `argv must carry --dry-run: ${JSON.stringify(d.argv)}`);
});

test('200 explicit mode:"dry-run" is identical to the default', async () => {
  clearMock();
  const r = await post({ mode: 'dry-run' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.mode, 'dry-run');
  assert.ok(d.argv.includes('--dry-run'));
});

test('200 mode:"apply" drops --dry-run (the real repair)', async () => {
  clearMock();
  const r = await post({ mode: 'apply' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.mode, 'apply');
  assert.equal(d.dryRun, false);
  assert.ok(!d.argv.includes('--dry-run'), `argv must NOT carry --dry-run: ${JSON.stringify(d.argv)}`);
});

// ── Plain-text stdout with exit 0 is a SUCCESS (the real parent's shape). ──

test('200 non-JSON stdout + exit 0 passes through as output + a parsed summary', async () => {
  writeFileSync(mockCtl, JSON.stringify({
    stdout: 'Would rewrite #1 Acme — Backend Engineer: reports/999-gone.md\n'
      + '\n📊 1 dead report link(s) found\n(dry-run — no changes written)\n',
    code: 0,
  }));
  const r = await post({ mode: 'dry-run' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.mode, 'dry-run');
  assert.equal(d.code, 0);
  assert.match(d.output, /1 dead report link/);
  assert.deepEqual(d.rows, [{ num: 1, detail: 'Acme — Backend Engineer: reports/999-gone.md' }]);
  assert.equal(d.summary.count, 1);
  assert.equal(d.summary.dryRun, true);
});

test('200 apply-mode text parses Rewrote rows and dryRun:false', async () => {
  writeFileSync(mockCtl, JSON.stringify({
    stdout: 'Rewrote #1 Acme — Backend Engineer: reports/999-gone.md\n'
      + '\n📊 1 dead report link(s) fixed\n✅ Written to data/applications.md (backup: data/applications.md.bak)\n',
    code: 0,
  }));
  const r = await post({ mode: 'apply' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.mode, 'apply');
  assert.equal(d.summary.count, 1);
  assert.equal(d.summary.dryRun, false);
  assert.match(d.output, /Written to data\/applications\.md/);
});

// ── Fail-soft 502: non-zero exit / missing script. ──

test('502 on a non-zero exit (a handled {error} on stdout is relayed)', async () => {
  writeFileSync(mockCtl, JSON.stringify({ stdout: '{"error":"Cannot acquire tracker lock"}', code: 1 }));
  const r = await post({ mode: 'dry-run' });
  assert.equal(r.status, 502);
  const d = await r.json();
  assert.match(d.error, /Cannot acquire tracker lock/);
  assert.equal(d.code, 'script-error');
});

test('502 on plain-text stdout with a non-zero exit (output still carried)', async () => {
  writeFileSync(mockCtl, JSON.stringify({ stdout: 'some failure text', code: 3 }));
  const r = await post({ mode: 'apply' });
  assert.equal(r.status, 502);
  const d = await r.json();
  assert.equal(d.error, 'fix-report-links.mjs failed');
  assert.equal(d.code, 'script-error');
  assert.match(d.output, /some failure text/);
});

test('502 when fix-report-links.mjs is absent from the parent project', async () => {
  clearMock();
  rmSync(join(root, 'fix-report-links.mjs'), { force: true });
  const r = await post({ mode: 'dry-run' });
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /not found/);
  copyFileSync(FAKE_SCRIPT, join(root, 'fix-report-links.mjs')); // restore for later cases
});

// ── FULL-M1: apply rewrites data/applications.md, so two concurrent applies
// must serialize on the tracker lock (the fake's delayMs makes the overlap
// observable). Dry-run is read-only and takes no lock. ──

test('two concurrent apply runs serialize on the tracker lock', async () => {
  writeFileSync(mockCtl, JSON.stringify({ delayMs: 300 }));
  const t0 = Date.now();
  const [a, b] = await Promise.all([post({ mode: 'apply' }), post({ mode: 'apply' })]);
  const elapsed = Date.now() - t0;
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.ok(elapsed >= 550, `two 300ms applies must serialize (≥550ms), took ${elapsed}ms`);
});
