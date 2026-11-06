/**
 * CAR-236 (P1 perf) — applications.md parse cache in store.safeReadApps().
 *
 * GET /api/tracker re-read and re-parsed the whole tracker on every call
 * (and /api/map/jobs parsed it a second time within one #/pipeline mount).
 * The parsed rows are now memoized keyed on (mtimeMs, size); every write
 * path — web-ui's own atomic writes AND the parent's set-status.mjs /
 * runners in another process — changes the file mtime, so invalidation is
 * automatic. Callers get a fresh shallow copy per call (array + rows), so
 * a mutating caller cannot poison the cache — the same contract
 * tests/reports-list-cache.test.mjs pins for safeListReports().
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server, baseUrl, root, __appsCache;

const trackerFile = (...p) => resolve(root, 'data', 'applications.md', ...p);
const trackerMd = (rows) => [
  '# Applications Tracker',
  '',
  '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
  '|---|------|---------|------|-------|--------|-----|--------|-------|',
  ...rows,
  '',
].join('\n');
const row = (n, company, extra = '') =>
  `| ${n} | 2026-01-0${n} | ${company} | Engineer | 4.0/5 | Applied | ❌ | — | note ${extra} |`;

before(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'tracker-cache-'));
  mkdirSync(resolve(root, 'data'), { recursive: true });
  mkdirSync(resolve(root, 'config'), { recursive: true });
  mkdirSync(resolve(root, 'reports'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# Jane\nEngineer\n');
  writeFileSync(trackerFile(), trackerMd([row(1, 'Acme'), row(2, 'Beta')]));
  // A report whose Machine Summary carries the #4452 evidence fields — the
  // CAR-236 slim projection below must drop them from list payloads.
  writeFileSync(resolve(root, 'reports', '042-acme-2026-01-05.md'), [
    '# Evaluation: Engineer — Acme',
    '**Date:** 2026-01-05',
    '**Score:** 4.2/5',
    '**URL:** https://acme.example.com/jobs/1',
    '**Legitimacy:** proceed',
    '',
    '## Machine Summary',
    'score: 4.2',
    'legitimacy: proceed',
    'date: 2026-01-05',
    'url: https://acme.example.com/jobs/1',
    'archetype: Platform Engineer',
    'score_evidence:',
    '  scope: supported',
    '  impact: partial',
    'confidence_gaps:',
    '  - scale unverified',
    '  - authorship unclear',
    '',
  ].join('\n'));
  process.env.CAREER_OPS_ROOT = root;
  ({ __appsCache } = await import('../server/lib/store.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const getJson = async (path) => {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, body: await res.json() };
};

test('two GET /api/tracker: one parse, the second served from the cache', async () => {
  __appsCache.reset();
  const first = await getJson('/api/tracker');
  assert.equal(first.status, 200);
  assert.equal(first.body.rows.length, 2);
  assert.equal(__appsCache.misses, 1, 'first read parses');
  const second = await getJson('/api/tracker');
  assert.deepEqual(second.body.rows, first.body.rows, 'identical payload');
  assert.equal(__appsCache.misses, 1, 'second read is a cache hit — no re-parse');
  assert.ok(__appsCache.hits >= 1);
});

test('callers get fresh copies: mutating a result cannot poison the cache', async () => {
  const { body } = await getJson('/api/tracker');
  body.rows[0].company = 'MUTATED';
  body.rows.push({ company: 'phantom' });
  const fresh = await getJson('/api/tracker');
  assert.equal(fresh.body.rows.length, 2, 'array mutations do not leak');
  assert.equal(fresh.body.rows[0].company, 'Acme', 'row mutations do not leak');
});

test('an out-of-process write (set-status/runner style) invalidates: re-parse, new rows visible', async () => {
  writeFileSync(trackerFile(), trackerMd([row(1, 'Acme'), row(2, 'Beta'), row(3, 'Gamma')]));
  const { body } = await getJson('/api/tracker');
  assert.equal(body.rows.length, 3);
  assert.equal(__appsCache.misses, 2, 'mtime+size changed → exactly one re-parse');
});

test('tracker and map/jobs share ONE parse per file version (the #/pipeline mount fan-out)', async () => {
  __appsCache.reset();
  await getJson('/api/tracker');
  const before = __appsCache.misses;
  const map = await getJson('/api/map/jobs');
  assert.equal(map.status, 200);
  assert.equal(__appsCache.misses, before, '/api/map/jobs hits the same parse cache — no second full parse');
  assert.equal(map.body.tracker.length, 3);
});

test('paginated + funnel reads ride the same cache', async () => {
  __appsCache.reset();
  const a = await getJson('/api/tracker?page=1&pageSize=2');
  const b = await getJson('/api/tracker?page=1&pageSize=2');
  assert.equal(a.body.total, 3);
  assert.equal(a.body.funnel.Applied, 3);
  assert.deepEqual(b.body.rows, a.body.rows);
  assert.equal(__appsCache.misses, 1, 'both paginated reads share one parse');
});

test('a missing file still degrades to [] and never caches the absence', async () => {
  const { unlinkSync } = await import('node:fs');
  __appsCache.reset();
  unlinkSync(trackerFile());
  const empty = await getJson('/api/tracker');
  assert.deepEqual(empty.body.rows, []);
  assert.equal(__appsCache.size, 0, 'absence is not memoized');
  writeFileSync(trackerFile(), trackerMd([row(1, 'Acme')]));
  const back = await getJson('/api/tracker');
  assert.equal(back.body.rows.length, 1, 'recovery is immediate');
});

// ─── CAR-236 item 4 — the ?fields=slim projection ──────────────────────────
// GET /api/reports?fields=slim and /api/dashboard's reports read drop the
// heavy scoreEvidence/confidenceGaps and the file name from every entry.
// The default shape is untouched (#/reports reads the evidence chips).

test('?fields=slim: exactly the card fields — no scoreEvidence/confidenceGaps/file', async () => {
  const full = await getJson('/api/reports');
  const entry = full.body.reports.find((r) => r.slug === '042-acme-2026-01-05');
  assert.ok(entry, 'fixture report listed');
  assert.equal(entry.score, '4.2/5');
  assert.deepEqual(entry.scoreEvidence, { scope: 'supported', impact: 'partial' }, 'default shape keeps the evidence chips');
  assert.deepEqual(entry.confidenceGaps, ['scale unverified', 'authorship unclear']);
  assert.equal(entry.file, '042-acme-2026-01-05.md');

  const slim = await getJson('/api/reports?fields=slim');
  const s = slim.body.reports.find((r) => r.slug === '042-acme-2026-01-05');
  assert.ok(s);
  assert.deepEqual(
    Object.keys(s).sort(),
    ['archetype', 'date', 'legitimacy', 'mtime', 'pdf', 'score', 'scoreNum', 'slug', 'title', 'url'].sort(),
    'slim drops exactly scoreEvidence/confidenceGaps/file',
  );
  assert.equal(s.score, '4.2/5');
  assert.equal(s.scoreNum, 4.2);
  assert.equal(s.legitimacy, 'proceed');
});

test('/api/dashboard: lastReport is slim — card fields intact, evidence weight gone', async () => {
  const { body } = await getJson('/api/dashboard');
  assert.equal(body.counts.reports, 1);
  const lr = body.lastReport;
  assert.ok(lr);
  assert.equal(lr.slug, '042-acme-2026-01-05');
  assert.equal(lr.scoreNum, 4.2, 'the hero score pill still renders');
  assert.equal(lr.legitimacy, 'proceed', 'the last-report legitimacy tag still renders');
  assert.equal('scoreEvidence' in lr, false);
  assert.equal('confidenceGaps' in lr, false);
  assert.equal('file' in lr, false);
});
