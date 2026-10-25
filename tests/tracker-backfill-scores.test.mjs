/**
 * CAR-129 (v1.256.0) — POST /api/tracker/backfill-scores fills the Score
 * column of tracker rows that carry a report link but no score, reading
 * the score from the report's own header (store.safeListReports →
 * parseReportHeader). Rows already scored, explicit sentinels (N/A),
 * rows without a report and reports without a parseable score are left
 * untouched. Idempotent: a second run updates nothing.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server;
let baseUrl;
let projectRoot;

const TRACKER = [
  '# Applications Tracker',
  '',
  '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
  '|---|------|---------|------|-------|--------|-----|--------|-------|',
  '| 001 | 2026-10-01 | Acme | Engineer | — | Evaluated | ❌ | [001](reports/001-acme-engineer.md) | scoreless row |',
  '| 002 | 2026-10-02 | Beta | Engineer | 4.2/5 | Evaluated | ❌ | [002](reports/002-beta-engineer.md) | already scored |',
  '| 002 | 2026-10-06 | Beta2 | Engineer | — | Evaluated | ❌ | [002](reports/002-beta-engineer.md) | duplicate #: scoreless twin |',
  '| 003 | 2026-10-03 | Gamma | Engineer | — | Evaluated | ❌ | [003](reports/003-gamma-engineer.md) | report without a score |',
  '| 004 | 2026-10-04 | Delta | Engineer | — | Evaluated | ❌ |  | no report at all |',
  '| 005 | 2026-10-05 | Epsilon | Engineer | N/A | SKIP | ❌ | [005](reports/005-epsilon-engineer.md) | explicit sentinel |',
  '',
].join('\n');

before(async () => {
  projectRoot = mkdtempSync(join(tmpdir(), 'tracker-backfill-'));
  mkdirSync(join(projectRoot, 'config'), { recursive: true });
  mkdirSync(join(projectRoot, 'data'), { recursive: true });
  mkdirSync(join(projectRoot, 'reports'), { recursive: true });
  writeFileSync(join(projectRoot, 'cv.md'), '# placeholder\n');
  writeFileSync(join(projectRoot, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(join(projectRoot, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(projectRoot, 'reports', '001-acme-engineer.md'),
    '# Evaluation: Acme — Engineer\n\n**Score:** 3.8/5\n**URL:** https://example.com/1\n\n## A\nBody.\n');
  writeFileSync(join(projectRoot, 'reports', '002-beta-engineer.md'),
    '# Evaluation: Beta — Engineer\n\n**Score:** 4.2/5\n**URL:** https://example.com/2\n\n## A\nBody.\n');
  writeFileSync(join(projectRoot, 'reports', '003-gamma-engineer.md'),
    '# Evaluation: Gamma — Engineer\n\n**URL:** https://example.com/3\n\n## A\nNo score in this report.\n');
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
  rmSync(projectRoot, { recursive: true, force: true });
  return new Promise((r) => server.close(r));
});

async function post(path) {
  const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  return { status: res.status, body: await res.json() };
}

function allRows(content, num) {
  return content.split('\n').filter((l) => l.startsWith(`| ${num} `))
    .map((l) => l.split(/(?<!\\)\|/).map((c) => c.trim()));
}

test('backfill fills only the scoreless rows whose report carries a score', async () => {
  writeFileSync(join(projectRoot, 'data', 'applications.md'), TRACKER);
  const { status, body } = await post('/api/tracker/backfill-scores');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.updated, 2, 'row 001 + the scoreless duplicate of row 002');
  assert.equal(body.reportScoreless, 1, 'row 003: report exists but carries no score');
  assert.equal(body.missingReport, 0, 'row 004 has no report link at all — not a missing file');

  const content = readFileSync(join(projectRoot, 'data', 'applications.md'), 'utf8');
  assert.equal(allRows(content, '001')[0][5], '3.8/5', 'row 001 score filled from the report header');
  assert.equal(allRows(content, '002')[0][5], '4.2/5', 'the already-scored twin keeps its own score');
  assert.equal(allRows(content, '002')[1][5], '4.2/5', 'the scoreless duplicate gets the report score');
  assert.equal(allRows(content, '003')[0][5], '—', 'scoreless report leaves the cell alone');
  assert.equal(allRows(content, '004')[0][5], '—', 'no report → untouched');
  assert.equal(allRows(content, '005')[0][5], 'N/A', 'explicit sentinel is never overwritten');
  // no other cell moved
  assert.match(content, /\| 001 \| 2026-10-01 \| Acme \| Engineer \| 3\.8\/5 \| Evaluated \| ❌ \| \[001\]\(reports\/001-acme-engineer\.md\) \| scoreless row \|/);
  assert.match(content, /\| 002 \| 2026-10-02 \| Beta \| Engineer \| 4\.2\/5 \| Evaluated \| ❌ \| \[002\]\(reports\/002-beta-engineer\.md\) \| already scored \|/);
});

test('backfill is idempotent: the second run updates nothing', async () => {
  const { body } = await post('/api/tracker/backfill-scores');
  assert.equal(body.ok, true);
  assert.equal(body.updated, 0);
});

test('backfill review: a hostile report path is an inert Map key, never a fs path', async () => {
  const hostile = [
    '# Applications Tracker',
    '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
    '| 004 | 2026-10-04 | Delta | Engineer | — | Evaluated | ❌ | [x](reports/../../etc/passwd.md) | hostile path |',
    '',
  ].join('\n');
  writeFileSync(join(projectRoot, 'data', 'applications.md'), hostile);
  const { status, body } = await post('/api/tracker/backfill-scores');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.missingReport, 1, 'counted as missing; the slug is only ever a Map key');
  assert.equal(body.updated, 0);
});

test('backfill on a missing tracker file is a clean no-op, not a crash', async () => {
  unlinkSync(join(projectRoot, 'data', 'applications.md'));
  const { status, body } = await post('/api/tracker/backfill-scores');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.updated, 0);
});
