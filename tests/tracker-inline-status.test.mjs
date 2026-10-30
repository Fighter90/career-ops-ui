/**
 * Inline status edit — POST /api/tracker/status (v1.246.0 backlog #2).
 *
 * The #/tracker row's status <select> writes through the parent's canonical
 * writer, never directly: the route relays
 * `node set-status.mjs --row N <State> [--note "..."] [--dry-run] --json`.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with data/applications.md and a FAKE
 * set-status.mjs copied in (the route spawns it relative to cwd = the data
 * root; see tests/fixtures/fake-set-status.mjs). Failure modes (non-JSON
 * stdout, non-zero exit) are driven through a sibling set-status-mock.json
 * the fake reads at startup. No network, 127.0.0.1 bind, dynamic imports
 * AFTER the env is set (the paths-once eager-import rule).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAKE_SCRIPT = join(__dirname, 'fixtures', 'fake-set-status.mjs');

let server, baseUrl, root, mockCtl;

const TRACKER = `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
| 1 | 2026-10-01 | Acme | Backend Engineer | 4.2/5 | Applied | ❌ | — | — |
| 2 | 2026-10-02 | Globex | Product Designer | 3.8/5 | Interview | ❌ | — | — |
| 3 | 2026-10-03 | Initech | DevOps | — | Evaluated | ❌ | — | — |
`;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'trk-inline-status-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), TRACKER);
  copyFileSync(FAKE_SCRIPT, join(root, 'set-status.mjs'));
  mockCtl = join(root, 'set-status-mock.json');
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

const post = (body) => fetch(baseUrl + '/api/tracker/status', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
// Clear the mock override so a case only sets what it needs.
const clearMock = () => rmSync(mockCtl, { force: true });

// ── Validation guards run FIRST (a bad row/state must be a 400, no spawn) ──

test('400 on a bad row (0, 1.5, string, missing)', async () => {
  for (const row of [0, -1, 1.5, '2', null, undefined]) {
    const r = await post({ row, state: 'Applied' });
    assert.equal(r.status, 400, `row=${JSON.stringify(row)}`);
    assert.match((await r.json()).error, /row/i);
  }
});

test('400 on an unknown state — the whitelist is canonicalizeStatus, no spawn', async () => {
  const r = await post({ row: 1, state: 'Promoted' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /invalid state/i);
});

test('400 on a note with a control character or over the cap', async () => {
  const r = await post({ row: 1, state: 'Applied', note: 'line1\nline2' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /control characters/i);
  const r2 = await post({ row: 1, state: 'Applied', note: 'x'.repeat(201) });
  assert.equal(r2.status, 400);
  assert.match((await r2.json()).error, /note/i);
});

// ── Happy paths: the relay reaches the script with the right argv. ──

test('200 happy path: relays the script JSON (row, canonical state)', async () => {
  clearMock();
  const r = await post({ row: 2, state: 'Interview' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.row, 2);
  assert.equal(d.state, 'Interview');
  assert.equal(d.dryRun, false);
});

test('an alias/case state folds to its canonical label before the spawn', async () => {
  clearMock();
  const r = await post({ row: 3, state: 'hired' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.state, 'Hired');
});

test('note rides through as --note', async () => {
  clearMock();
  const r = await post({ row: 1, state: 'Applied', note: 'recruiter screen booked' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).note, 'recruiter screen booked');
});

test('dryRun:true is passed to the script and relayed', async () => {
  clearMock();
  const r = await post({ row: 1, state: 'Offer', dryRun: true });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).dryRun, true);
});

// ── Fail-soft 502: non-zero exit / non-JSON stdout / missing script. ──

test('502 on a non-zero exit (handled {error} on stdout is relayed)', async () => {
  writeFileSync(mockCtl, JSON.stringify({ stdout: '{"error":"No tracker row #9 found"}', code: 2 }));
  const r = await post({ row: 9, state: 'Applied' });
  assert.equal(r.status, 502);
  const d = await r.json();
  assert.match(d.error, /No tracker row #9/);
});

test('502 on an unparseable stdout', async () => {
  writeFileSync(mockCtl, JSON.stringify({ stdout: 'total nonsense, not JSON', code: 0 }));
  const r = await post({ row: 1, state: 'Applied' });
  assert.equal(r.status, 502);
  assert.ok((await r.json()).error);
});

test('502 when set-status.mjs is absent from the parent project', async () => {
  clearMock();
  rmSync(join(root, 'set-status.mjs'), { force: true });
  const r = await post({ row: 1, state: 'Applied' });
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /not found/);
});
