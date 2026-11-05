/**
 * runners-data-migrations.test.mjs — route-level contract for the
 * CAR-232/233/241/242 migration endpoints:
 *   · POST /api/runners/report-dates — mode validation, dry-run default
 *     (read-only), apply = header rewrite + per-file backup + atomic
 *     temp-rename; localized headers (en/ru/de) are found (CAR-241);
 *   · POST /api/runners/company-fix — mode validation, dry-run read-only,
 *     apply = line-surgical rewrite under the tracker lock; localized H1
 *     labels + dash variants resolve (CAR-242), the ATS slug fallback, and
 *     unresolved rows are reported with a reason.
 *
 * CI-isolated: CAREER_OPS_ROOT is a mktemp dir (cv.md + fixture reports +
 * applications.md), no network, no keys, servers on 127.0.0.1:0.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// import.meta.dirname needs Node >= 20.11 — CI still gates node 18.
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SAVE = {};

let createApp;
let app;
let server;
let baseUrl;
let dataRoot;

// CAR-241 — the three prod shapes the v1.268.0 scan missed: an EN header,
// a RU header and a DE header, each with an invented 2026-01-15 date against
// a true 2026-10-25 filename stamp.
const REPORT_EN = `# Evaluation: Acme — Engineer

**Company:** Acme
**Date:** 2026-01-15
**Score:** 4.1/5
`;
const REPORT_RU = `# Оценка вакансии: ООО Ромашка – Python-разработчик

**Компания:** ООО Ромашка
**Дата:** 2026-01-15
**Оценка:** 4.2/5
`;
const REPORT_DE = `# Bewertung: München GmbH — Dateningenieur

**Unternehmen:** München GmbH
**Datum:** 2026-01-15
**Bewertung:** 3.9/5
`;

// CAR-242 — one source-name row resolved from a localized, en-dash H1; one
// role-in-company row resolved from the ATS URL slug; one source-name row
// with neither a report nor an ATS URL (unresolved, never guessed).
const TRACKER = `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |
|---|------|---------|------|-------|--------|-----|--------|-------|-----|
| 1 | 2026-10-25 | **hh** | Python-разработчик | 4.2/5 | Оценена | ❌ | [2](../reports/002-ромашка-2026-10-25.md) | via hh | — |
| 2 | 2026-10-25 | Backend Engineer - Platform | Platform | 4.1/5 | Evaluated | ❌ | — | — | [2](https://boards.greenhouse.io/grafanalabs/jobs/123) |
| 3 | 2026-10-25 | habr | Инженер | — | Оценена | ❌ | — | — | — |
`;

before(async () => {
  for (const k of ['CAREER_OPS_ROOT']) { SAVE[k] = process.env[k]; }
  dataRoot = mkdtempSync(resolve(tmpdir(), 'runners-dm-'));
  process.env.CAREER_OPS_ROOT = dataRoot;
  mkdirSync(resolve(dataRoot, 'reports'), { recursive: true });
  mkdirSync(resolve(dataRoot, 'data'), { recursive: true });
  writeFileSync(resolve(dataRoot, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dataRoot, 'reports', '001-acme-2026-10-25.md'), REPORT_EN);
  writeFileSync(resolve(dataRoot, 'reports', '002-ромашка-2026-10-25.md'), REPORT_RU);
  writeFileSync(resolve(dataRoot, 'reports', '003-gmbh-2026-10-25.md'), REPORT_DE);
  writeFileSync(resolve(dataRoot, 'data', 'applications.md'), TRACKER);
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

test('all three endpoints reject a bad mode with 400', async () => {
  const r1 = await post('/api/runners/report-dates', { mode: 'yolo' });
  assert.equal(r1.status, 400);
  const r2 = await post('/api/runners/company-fix', { mode: 'yolo' });
  assert.equal(r2.status, 400);
  const r3 = await post('/api/runners/score-backfill', { mode: 'yolo' });
  assert.equal(r3.status, 400);
});

test('CAR-241: report-dates dry-run finds the three localized mismatches and writes nothing', async () => {
  const implicit = await post('/api/runners/report-dates', {});
  assert.equal(implicit.status, 200);
  assert.equal(implicit.body.mode, 'dry-run');
  assert.equal(implicit.body.count, 3, 'en + ru + de headers are all found');
  assert.deepEqual(implicit.body.rows.map((r) => r.headerDate), ['2026-01-15', '2026-01-15', '2026-01-15']);
  assert.ok(implicit.body.rows.every((r) => r.fileDate === '2026-10-25'), 'the filename stamp is the target');
  assert.ok(implicit.body.rows.every((r) => Number.isInteger(r.line) && r.line > 0), 'rows carry line numbers');
  assert.ok(Array.isArray(implicit.body.skipped), 'skipped files are listed with a reason');
  // Read-only: every header still carries the stale date, no backups exist.
  const ru = readFileSync(resolve(dataRoot, 'reports', '002-ромашка-2026-10-25.md'), 'utf8');
  assert.match(ru, /\*\*Дата:\*\* 2026-01-15/);
  assert.equal(readdirSync(resolve(dataRoot, 'reports')).filter((f) => f.includes('.bak-')).length, 0);
});

test('CAR-241: apply rewrites exactly the date line of each report and leaves per-file backups', async () => {
  const before = {
    en: readFileSync(resolve(dataRoot, 'reports', '001-acme-2026-10-25.md'), 'utf8').split('\n'),
    ru: readFileSync(resolve(dataRoot, 'reports', '002-ромашка-2026-10-25.md'), 'utf8').split('\n'),
    de: readFileSync(resolve(dataRoot, 'reports', '003-gmbh-2026-10-25.md'), 'utf8').split('\n'),
  };
  const r = await post('/api/runners/report-dates', { mode: 'apply' });
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, 'apply');
  assert.equal(r.body.count, 3);
  const cases = [
    ['001-acme-2026-10-25.md', 'Date', before.en],
    ['002-ромашка-2026-10-25.md', 'Дата', before.ru],
    ['003-gmbh-2026-10-25.md', 'Datum', before.de],
  ];
  const dateLineRe = (label) => new RegExp(`\\*\\*${label}:\\*\\* 2026-10-25`);
  for (const [file, label, beforeLines] of cases) {
    const afterLines = readFileSync(resolve(dataRoot, 'reports', file), 'utf8').split('\n');
    assert.equal(afterLines.length, beforeLines.length, `${file}: no lines added or removed`);
    const changedIdx = [];
    for (let i = 0; i < afterLines.length; i++) {
      if (afterLines[i] !== beforeLines[i]) changedIdx.push(i);
    }
    assert.equal(changedIdx.length, 1, `${file}: exactly one line changed`);
    assert.match(afterLines[changedIdx[0]], dateLineRe(label), `${file}: it is the date line`);
    assert.ok(existsSync(resolve(dataRoot, 'reports', `${file}`)), 'the report survives');
  }
  const backups = readdirSync(resolve(dataRoot, 'reports')).filter((f) => f.includes('.bak-'));
  assert.equal(backups.length, 3, 'one timestamped backup per touched file');
  const tmps = readdirSync(resolve(dataRoot, 'reports')).filter((f) => f.endsWith('.tmp'));
  assert.equal(tmps.length, 0, 'atomic rename left no temp file');
});

test('CAR-242: company-fix dry-run resolves from the report H1, the ATS slug, and reports the unresolved row', async () => {
  const dry = await post('/api/runners/company-fix', {});
  assert.equal(dry.status, 200);
  assert.equal(dry.body.mode, 'dry-run');
  assert.equal(dry.body.count, 3, 'all three bad cells are detected');
  const byNum = new Map(dry.body.rows.map((r) => [r.num, r]));
  const row1 = byNum.get('1');
  assert.equal(row1.reason, 'source-name');
  assert.equal(row1.reportCompany, 'ООО Ромашка', 'the localized en-dash H1 resolves');
  assert.equal(row1.fixed, 'ООО Ромашка');
  assert.equal(row1.source, 'report');
  const row2 = byNum.get('2');
  assert.equal(row2.reason, 'role-in-company');
  assert.equal(row2.fixed, 'Grafana Labs', 'the greenhouse slug falls back');
  assert.equal(row2.source, 'ats');
  const row3 = byNum.get('3');
  assert.equal(row3.fixed, null, 'no report, no ATS URL → never guessed');
  assert.ok(Array.isArray(dry.body.unresolved) && dry.body.unresolved.some((u) => u.num === '3' && u.reason === 'no-report'),
    'the unresolved row is listed with its reason');
  const untouched = readFileSync(resolve(dataRoot, 'data', 'applications.md'), 'utf8');
  assert.match(untouched, /\*\*hh\*\*/, 'dry-run left the tracker untouched');
});

test('CAR-242: company-fix apply fixes the two resolvable rows under backup, the third stays reported', async () => {
  const apply = await post('/api/runners/company-fix', { mode: 'apply' });
  assert.equal(apply.status, 200);
  assert.equal(apply.body.changed, 2, 'rows 1 and 2 are rewritten; row 3 is not guessed');
  const fixed = readFileSync(resolve(dataRoot, 'data', 'applications.md'), 'utf8');
  assert.match(fixed, /\| ООО Ромашка \| Python-разработчик \|/, 'the localized H1 company landed');
  assert.match(fixed, /\| Grafana Labs \| Platform \|/, 'the ATS slug company landed');
  assert.match(fixed, /\| habr \|/, 'the unresolved row is untouched');
  assert.equal(existsSync(`${resolve(dataRoot, 'data', 'applications.md')}.tmp`), false, 'atomic rename left no temp');
  const backups = readdirSync(resolve(dataRoot, 'data')).filter((f) => f.includes('.bak-'));
  assert.equal(backups.length, 1, 'exactly one timestamped backup');
});
