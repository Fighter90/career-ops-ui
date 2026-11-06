/**
 * runners-score-backfill.test.mjs — CAR-243: 159 prod tracker rows carry a
 * report but no score. The score-backfill runner scans tracker rows whose
 * Score cell is a sentinel (— / N/A / - / empty), resolves the row's report
 * (the same link resolver company-fix uses), reads the report's machine
 * surfaces (---SCORE_SUMMARY--- block, Machine-Summary yaml, localized bold
 * score labels), and rewrites ONLY the Score cell — dry-run default,
 * apply under the tracker lock with a timestamped .bak.
 *
 * Unit half: extractReportScore / isSentinelScore / the scan+apply pair.
 * Route half: POST /api/runners/score-backfill mode validation, read-only
 * dry-run default, apply contract.
 *
 * CI-isolated: CAREER_OPS_ROOT is a mktemp dir, no network, 127.0.0.1:0.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  extractReportScore,
  isSentinelScore,
  scanTrackerScoreGaps,
  applyTrackerScoreFix,
} from '../server/lib/score-backfill.mjs';

// import.meta.dirname needs Node >= 20.11 — CI still gates node 18.
const SAVE = {};

let createApp;
let app;
let server;
let baseUrl;
let dataRoot;

// ───────────────────────── unit half ─────────────────────────

test('extractReportScore: the SCORE_SUMMARY machine block wins over the header line', () => {
  const md = '# Evaluation: Alpha — Dev\n\n**Score:** 4.9/5\n\n---SCORE_SUMMARY---\nCOMPANY: Alpha\nSCORE: 2.5\n---END_SUMMARY---\n';
  assert.equal(extractReportScore(md), 2.5, 'CAR-92 — the machine block is the single source');
});

test('extractReportScore: the Machine-Summary yaml block fills in when the summary is absent', () => {
  const md = '# Evaluation: Beta — Dev\n\n## Machine Summary\nscore: 3.6\nlegitimacy: High Confidence\n';
  assert.equal(extractReportScore(md), 3.6);
});

test('extractReportScore: localized bold score labels (ru) and the /5 value form', () => {
  assert.equal(extractReportScore('# Оценка вакансии: Ромашка — Разработчик\n\n**Оценка:** 4.2/5\n'), 4.2);
  assert.equal(extractReportScore('# Отчёт\n\n**Итоговый балл:** 1.8 / 5\n'), 1.8);
});

test('extractReportScore: a plain English Score line is the last resort; garbage → null', () => {
  assert.equal(extractReportScore('# Evaluation: Gamma — Dev\n\nScore: 4/5\n'), 4);
  assert.equal(extractReportScore('# Evaluation: Delta — Dev\n\nno score anywhere\n'), null);
  assert.equal(extractReportScore(''), null);
  assert.equal(extractReportScore(null), null);
});

test('isSentinelScore: the tracker no-score conventions', () => {
  assert.equal(isSentinelScore('—'), true);
  assert.equal(isSentinelScore('-'), true);
  assert.equal(isSentinelScore('N/A'), true);
  assert.equal(isSentinelScore(''), true);
  assert.equal(isSentinelScore(' — '), true, 'whitespace-padded sentinel');
  assert.equal(isSentinelScore('**—**'), true, 'bold sentinel cell');
  assert.equal(isSentinelScore('4.0/5'), false);
  assert.equal(isSentinelScore('4,2/5'), false);
  assert.equal(isSentinelScore(null), true, 'a missing cell is a gap');
});

const SCORE_TRACKER = [
  '# Applications Tracker',
  '',
  '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
  '|---|------|---------|------|-------|--------|-----|--------|-------|',
  '| 1 | 2026-11-01 | Alpha | Dev | — | Evaluated | ❌ | [1](../reports/010-alpha-2026-11-01.md) | — |',
  '| 2 | 2026-11-01 | Beta | Dev | N/A | Evaluated | ❌ | [2](../reports/011-beta-2026-11-01.md) | — |',
  '| 3 | 2026-11-01 | Gamma | Dev | 4.5/5 | Evaluated | ❌ | [3](../reports/012-gamma-2026-11-01.md) | scored |',
  '| 4 | 2026-11-01 | Delta | Dev | — | Evaluated | ❌ | [4](../reports/013-delta-2026-11-01.md) | empty |',
].join('\n');

const SCORES = { '010-alpha': 4.1, '011-beta': 3.6 };

function resolveReportScore(reportCell) {
  const base = String(reportCell ?? '').match(/\]\(([^)]+)\)/)?.[1]?.split('/').pop() ?? '';
  const key = Object.keys(SCORES).find((k) => base.startsWith(k));
  if (base.startsWith('013-delta')) return { score: null, reason: 'no-score-in-report' };
  if (key) return { score: SCORES[key] };
  return { score: null, reason: 'no-report' };
}

test('scanTrackerScoreGaps: sentinel rows are found, scored rows are skipped, unresolved carry a reason', () => {
  const gaps = scanTrackerScoreGaps(SCORE_TRACKER, resolveReportScore);
  assert.deepEqual(gaps.map((g) => g.num), ['1', '2', '4'], 'row 3 (scored) is not a gap');
  assert.equal(gaps[0].fixed, '4.1/5');
  assert.equal(gaps[1].fixed, '3.6/5');
  assert.equal(gaps[0].reportScore, 4.1);
  assert.equal(gaps[2].fixed, null);
  assert.equal(gaps[2].unresolvedReason, 'no-score-in-report');
});

test('scanTrackerScoreGaps: no resolver → reported, never fixed', () => {
  const gaps = scanTrackerScoreGaps(SCORE_TRACKER);
  assert.equal(gaps.length, 3);
  assert.ok(gaps.every((g) => g.fixed === null));
});

test('applyTrackerScoreFix: only the Score cell of resolvable rows changes', () => {
  const gaps = scanTrackerScoreGaps(SCORE_TRACKER, resolveReportScore);
  const { text, changed } = applyTrackerScoreFix(SCORE_TRACKER, gaps);
  assert.equal(changed, 2);
  const row1 = text.split('\n').find((l) => l.startsWith('| 1 |'));
  assert.match(row1, /\| 4\.1\/5 \| Evaluated \| ❌ \| \[1\]/, 'the Score cell carries the report score');
  const row2 = text.split('\n').find((l) => l.startsWith('| 2 |'));
  assert.match(row2, /\| 3\.6\/5 \| Evaluated \|/);
  const row3 = text.split('\n').find((l) => l.startsWith('| 3 |'));
  assert.match(row3, /\| 4\.5\/5 \| Evaluated \|/, 'the scored row is byte-identical');
  const row4 = text.split('\n').find((l) => l.startsWith('| 4 |'));
  assert.match(row4, /\| — \| Evaluated \|/, 'the unresolvable row is untouched');
  assert.match(text, /^\| # \| Date \| Company \| Role \|/m, 'the header survives');
});

test('applyTrackerScoreFix: empty gaps and non-table lines are safe no-ops', () => {
  const r0 = applyTrackerScoreFix(SCORE_TRACKER, []);
  assert.equal(r0.changed, 0);
  assert.equal(r0.text, SCORE_TRACKER);
  const r1 = applyTrackerScoreFix('prose only', [{ line: 1, num: '1', fixed: '4.1/5' }]);
  assert.equal(r1.changed, 0);
  assert.equal(r1.text, 'prose only');
});

test('branch tails: bare-number resolvers, null resolvers, empty cells, flattened values', () => {
  // A legacy bare-number resolver (no {score} object) still fills the cell.
  const numbered = scanTrackerScoreGaps(SCORE_TRACKER, () => 2.4);
  assert.equal(numbered[0].fixed, '2.4/5');
  // An explicit null resolver is the reported-not-guessed path.
  const nulled = scanTrackerScoreGaps(SCORE_TRACKER, () => null);
  assert.ok(nulled.every((g) => g.fixed === null && g.unresolvedReason === 'no-report'));
  // An EMPTY score cell is a gap too, and reads back as null (not '').
  const emptyCell = SCORE_TRACKER.replace(
    '| 1 | 2026-11-01 | Alpha | Dev | — |',
    '| 1 | 2026-11-01 | Alpha | Dev |  |',
  );
  const empty = scanTrackerScoreGaps(emptyCell, () => ({ score: 4.1 }));
  assert.equal(empty[0].score, null);
  assert.equal(empty[0].fixed, '4.1/5');
  // A fixed value carrying pipe/newline noise is flattened, never a new column.
  const { text, changed } = applyTrackerScoreFix(SCORE_TRACKER, [{ line: 5, num: '1', fixed: '4\n1|5' }, { line: 6, num: '2', fixed: '  ' }]);
  assert.equal(changed, 1, 'the blank value is skipped, the noisy one lands');
  const row = text.split('\n')[4];
  assert.equal(row.split('|').length, SCORE_TRACKER.split('\n')[4].split('|').length, 'no phantom column');
  assert.match(row, /4 1 5 \| Evaluated \|/, 'newline and pipe flatten to spaces');
  assert.equal(isSentinelScore('na'), true, 'the lowercase na sentinel');
});

// ───────────────────────── route half ─────────────────────────

const REPORT_ALPHA = '# Evaluation: Alpha — Dev\n\n**Company:** Alpha\n**Date:** 2026-11-01\n**Score:** 4.1/5\n';
const REPORT_BETA = '# Evaluation: Beta — Dev\n\n## Machine Summary\nscore: 3.6\nlegitimacy: High Confidence\n';
const REPORT_DELTA = '# Evaluation: Delta — Dev\n\n**Company:** Delta\n**Date:** 2026-11-01\n\nno score anywhere\n';
const ROUTE_TRACKER = `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
| 1 | 2026-11-01 | Alpha | Dev | — | Evaluated | ❌ | [1](../reports/010-alpha-2026-11-01.md) | — |
| 2 | 2026-11-01 | Beta | Dev | N/A | Evaluated | ❌ | [2](../reports/011-beta-2026-11-01.md) | — |
| 3 | 2026-11-01 | Gamma | Dev | 4.5/5 | Evaluated | ❌ | — | scored |
| 4 | 2026-11-01 | Delta | Dev | — | Evaluated | ❌ | [4](../reports/013-delta-2026-11-01.md) | empty |
`;

before(async () => {
  for (const k of ['CAREER_OPS_ROOT']) { SAVE[k] = process.env[k]; }
  dataRoot = mkdtempSync(resolve(tmpdir(), 'runners-sb-'));
  process.env.CAREER_OPS_ROOT = dataRoot;
  mkdirSync(resolve(dataRoot, 'reports'), { recursive: true });
  mkdirSync(resolve(dataRoot, 'data'), { recursive: true });
  writeFileSync(resolve(dataRoot, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dataRoot, 'reports', '010-alpha-2026-11-01.md'), REPORT_ALPHA);
  writeFileSync(resolve(dataRoot, 'reports', '011-beta-2026-11-01.md'), REPORT_BETA);
  writeFileSync(resolve(dataRoot, 'reports', '013-delta-2026-11-01.md'), REPORT_DELTA);
  writeFileSync(resolve(dataRoot, 'data', 'applications.md'), ROUTE_TRACKER);
  ({ createApp } = await import('../server/index.mjs'));
  app = createApp();
  server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; });
  await new Promise((r) => { if (baseUrl) r(); else server.on('listening', r); });
});

after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  rmSync(dataRoot, { recursive: true, force: true });
  for (const [k, v] of Object.entries(SAVE)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

const post = async (path, body) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

test('score-backfill dry-run is the default and writes nothing', async () => {
  const implicit = await post('/api/runners/score-backfill', {});
  assert.equal(implicit.status, 200);
  assert.equal(implicit.body.mode, 'dry-run');
  assert.equal(implicit.body.count, 3, 'two sentinel rows + one reportless-score row');
  const byNum = new Map(implicit.body.rows.map((r) => [r.num, r]));
  assert.equal(byNum.get('1').fixed, '4.1/5');
  assert.equal(byNum.get('2').fixed, '3.6/5');
  assert.equal(byNum.get('4').fixed, null);
  assert.ok(implicit.body.unresolved.some((u) => u.num === '4' && u.reason === 'no-score-in-report'));
  const untouched = readFileSync(resolve(dataRoot, 'data', 'applications.md'), 'utf8');
  assert.match(untouched, /\| — \| Evaluated \|/, 'dry-run left the tracker untouched');
  assert.equal(readdirSync(resolve(dataRoot, 'data')).filter((f) => f.includes('.bak-')).length, 0);
});

test('score-backfill apply rewrites only the Score cells and leaves a backup', async () => {
  const before = readFileSync(resolve(dataRoot, 'data', 'applications.md'), 'utf8').split('\n');
  const r = await post('/api/runners/score-backfill', { mode: 'apply' });
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, 'apply');
  assert.equal(r.body.changed, 2);
  const after = readFileSync(resolve(dataRoot, 'data', 'applications.md'), 'utf8').split('\n');
  assert.equal(after.length, before.length, 'no lines added or removed');
  const changedIdx = [];
  for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) changedIdx.push(i);
  assert.deepEqual(changedIdx, [4, 5], 'exactly the two gap rows changed');
  assert.match(after[6], /\| 4\.5\/5 \| Evaluated \|/, 'the scored row is byte-identical');
  assert.match(after[7], /\| — \| Evaluated \|/, 'the unresolved row is untouched');
  const backups = readdirSync(resolve(dataRoot, 'data')).filter((f) => f.includes('.bak-'));
  assert.equal(backups.length, 1, 'exactly one timestamped backup');
  assert.equal(existsSync(`${resolve(dataRoot, 'data', 'applications.md')}.tmp`), false, 'atomic rename left no temp');
});
