/**
 * Application-outcome route — POST /api/outcome (dryRun preview + explicit write
 * via outcome.mjs).
 *
 * CI-isolated: bootstraps a mkdtemp CAREER_OPS_ROOT with a FAITHFUL fake
 * outcome.mjs (matches a tracker row from data/applications.md, validates the
 * outcome type, previews under --dry-run, and appends outcome.md on a real run),
 * so the preview→write flow is exercised without the real parent.
 *
 * All paths.mjs carriers load via dynamic import() AFTER the env is set (the
 * paths-once eager-import rule).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAKE_SCRIPT = join(__dirname, 'fixtures', 'fake-outcome.mjs');

let server, baseUrl, root, journalPath;

const TRACKER = `# Applications

| # | Company | Role | Status |
|---|---------|------|--------|
| 1 | Acme | Backend Engineer | Applied |
| 2 | Globex | Product Designer | Interview |
`;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'outcome-root-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), TRACKER);
  copyFileSync(FAKE_SCRIPT, join(root, 'outcome.mjs'));
  journalPath = join(root, 'outcome.md');
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  if (root) rmSync(root, { recursive: true, force: true });
  return new Promise((r) => server.close(r));
});

const post = (body) => fetch(baseUrl + '/api/outcome', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

// ── Injection + validation guards run FIRST, while the journal does not yet
//    exist, so any write would create it — proving the reject is pre-shell-out. ──

test('rejects a control char in a field → 400, no write', async () => {
  assert.equal(existsSync(journalPath), false, 'precondition: journal not yet created');
  const r = await post({ selector: '1', type: 'rejected', feedback: 'line1\nline2' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /control characters/);
  assert.equal(existsSync(journalPath), false);
});

test('requires selector and type → 400', async () => {
  const r = await post({ selector: '1' }); // no type
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /required/);
  assert.equal(existsSync(journalPath), false);
});

test('rejects an unknown outcome type BEFORE spawning → 400', async () => {
  const r = await post({ selector: '1', type: 'promoted' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /invalid outcome type/);
  assert.equal(existsSync(journalPath), false);
});

// ── Preview (dry-run) reads the tracker and reports, writing nothing. ──

test('preview matches by report # and writes nothing', async () => {
  const r = await post({ selector: '1', type: 'rejected', dryRun: true });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.available, true);
  assert.equal(d.dryRun, true);
  assert.equal(d.num, 1);
  assert.equal(d.company, 'Acme');
  assert.equal(d.role, 'Backend Engineer');
  assert.equal(d.outcomeType, 'rejected');
  assert.equal(d.canonicalState, 'Rejected');
  assert.equal(existsSync(journalPath), false, 'a dry-run must not write the journal');
});

test('preview matches by company name and normalizes a hyphenated type', async () => {
  const r = await post({ selector: 'Globex', type: 'offer-received', dryRun: true });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.num, 2);
  assert.equal(d.outcomeType, 'offer_received');
  assert.equal(d.canonicalState, 'Offer');
  assert.equal(existsSync(journalPath), false);
});

test('preview surfaces a no-match as a handled 400 with a code', async () => {
  const r = await post({ selector: '99', type: 'rejected', dryRun: true });
  assert.equal(r.status, 400);
  const d = await r.json();
  assert.equal(d.code, 'row-not-found');
  assert.equal(existsSync(journalPath), false);
});

// ── Explicit write records the outcome (appends the journal). ──

test('write records the outcome and appends the journal', async () => {
  const r = await post({ selector: '2', type: 'hired', stage: 'Onsite', feedback: 'Strong system design', note: 'accepted verbal' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.success, true);
  assert.equal(d.num, 2);
  assert.equal(d.canonicalState, 'Hired');
  assert.equal(d.setStatusResult.updated, true);
  assert.ok(existsSync(journalPath), 'the journal now exists');
  assert.match(readFileSync(journalPath, 'utf8'), /#2 Globex — hired \(Hired\)/);
});

// ── Fail-soft: the parent script is absent (CI / standalone). Runs LAST. ──

test('preview fails soft to {available:false} when the script is absent; write → 422', async () => {
  rmSync(join(root, 'outcome.mjs'), { force: true });
  const preview = await post({ selector: '1', type: 'rejected', dryRun: true });
  assert.equal(preview.status, 200);
  const pd = await preview.json();
  assert.equal(pd.available, false);
  assert.equal(pd.reason, 'script-not-found');

  const write = await post({ selector: '1', type: 'rejected' });
  assert.equal(write.status, 422);
  assert.match((await write.json()).error, /not found/);
});
