/**
 * Skills self-assessment log routes — GET /api/assessments (list relay) and
 * POST /api/assessments (explicit append via assessment-log.mjs).
 *
 * CI-isolated: bootstraps a mkdtemp CAREER_OPS_ROOT and writes a FAITHFUL fake
 * assessment-log.mjs into it — one that actually appends an 8-column TSV row on
 * `add` and lists it back as the parent's real JSON shape (verified against the
 * real CLI), so the append→read round-trip is genuinely exercised without the
 * real parent. The fake resolves its log path relative to its OWN location
 * (data/assessments.tsv), exactly like the real script.
 *
 * All paths.mjs carriers load via dynamic import() AFTER the env is set
 * (the paths-once eager-import rule).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAKE_SCRIPT = join(__dirname, 'fixtures', 'fake-assessment-log.mjs');

let server, baseUrl, root, tsvPath;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'asmt-root-'));
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  copyFileSync(FAKE_SCRIPT, join(root, 'assessment-log.mjs'));
  tsvPath = join(root, 'data', 'assessments.tsv');
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

const post = (body) => fetch(baseUrl + '/api/assessments', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

// ── Injection guards run FIRST, while the TSV does not yet exist, so any write
//    would create it — proving the reject happens BEFORE the shell-out. ──

test('POST rejects a TAB in a field → 400, no write, no TSV row', async () => {
  assert.equal(existsSync(tsvPath), false, 'precondition: log not yet created');
  const r = await post({ company: 'Acme', platform: 'eSkill', subject: 'MS\tExcel' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /control characters/);
  assert.equal(existsSync(tsvPath), false, 'a TAB field must not reach the TSV');
});

test('POST rejects a NEWLINE in a field → 400, no write, no injected row', async () => {
  const r = await post({ company: 'Acme\n2026-01-01\tEvil\t-\tHackerRank\tRust', platform: 'eSkill', subject: 'Excel' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /control characters/);
  assert.equal(existsSync(tsvPath), false, 'a newline field must not splice a row into the TSV');
});

test('POST rejects a carriage return in the note field → 400, no write', async () => {
  const r = await post({ company: 'Acme', platform: 'eSkill', subject: 'Excel', stale: 'line1\rline2' });
  assert.equal(r.status, 400);
  assert.equal(existsSync(tsvPath), false);
});

test('POST requires company, platform and subject → 400', async () => {
  const r = await post({ company: 'Acme', subject: 'Excel' }); // no platform
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /required/);
  assert.equal(existsSync(tsvPath), false);
});

test('POST whitelists the score to a 0–100 range → 400 out of range', async () => {
  for (const bad of ['150', '-5', 'high']) {
    const r = await post({ company: 'Acme', platform: 'eSkill', subject: 'Excel', score: bad });
    assert.equal(r.status, 400, `score "${bad}" should be rejected`);
  }
  assert.equal(existsSync(tsvPath), false, 'no bad-score write reached the TSV');
});

// ── Happy path: append two rows, read them back with the real field mapping. ──

test('POST appends a valid row and GET reads it back', async () => {
  const r = await post({ company: 'Acme', platform: 'eSkill', subject: 'MS Excel', score: '88', stale: 'references Excel 2010' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.added, true);
  // 8-column row, date-stamped, defaults applied (report/threshold → '-').
  assert.equal(d.row.length, 8);
  assert.equal(d.row[1], 'Acme');
  assert.equal(d.row[3], 'eSkill');
  assert.equal(d.row[4], 'MS Excel');
  assert.equal(d.row[6], '88');
  assert.ok(existsSync(tsvPath), 'the TSV now exists');

  const list = await (await fetch(baseUrl + '/api/assessments')).json();
  assert.equal(list.available, true);
  assert.equal(list.assessments.length, 1);
  const a = list.assessments[0];
  assert.equal(a.company, 'Acme');
  assert.equal(a.platform, 'eSkill');
  assert.equal(a.subject, 'MS Excel');
  assert.equal(a.score, 88);          // parsed to a number by the parent
  assert.equal(a.reportNum, null);    // '-' → null
  assert.equal(a.staleNote, 'references Excel 2010');
});

test('POST a second (minimal) row → GET returns both, exactly two TSV data rows', async () => {
  const r = await post({ company: 'Globex', platform: 'HackerRank', subject: 'JavaScript' });
  assert.equal(r.status, 200);
  const list = await (await fetch(baseUrl + '/api/assessments')).json();
  assert.equal(list.assessments.length, 2);
  assert.equal(list.quality.total, 2);
  // The file has exactly two NON-comment data rows — no injection inflated it.
  const dataRows = readFileSync(tsvPath, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  assert.equal(dataRows.length, 2);
});

// ── Fail-soft: the parent script is absent (CI / standalone). Runs LAST. ──

test('GET fails soft to {available:false} when the script is absent; POST → 400', async () => {
  rmSync(join(root, 'assessment-log.mjs'), { force: true });
  const g = await fetch(baseUrl + '/api/assessments');
  assert.equal(g.status, 200);
  const d = await g.json();
  assert.equal(d.available, false);
  assert.equal(d.reason, 'script-not-found');

  const p = await post({ company: 'Acme', platform: 'eSkill', subject: 'Excel' });
  assert.equal(p.status, 400);
  assert.match((await p.json()).error, /not found/);
});
