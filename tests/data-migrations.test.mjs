/**
 * data-migrations.test.mjs — the CAR-232/233/241/242 migration primitives:
 *   · report header dates: scan finds filename-vs-header mismatches in ALL
 *     UI locales (CAR-241 — the v1.268.0 scan recognized only **Date:** and
 *     found 0 of 368 localized prod reports), the fix rewrites ONLY the date
 *     value on the matched line;
 *   · tracker Company cells: source-name ("hh") and role-in-company rows are
 *     detected (CAR-127/128), the fix comes from the row's report H1 in any
 *     locale with any dash variant (CAR-242), falls back to the ATS slug of
 *     the row's posting URL, and unresolved rows carry a reason;
 *   · the apply is line-surgical — every other column byte-identical.
 *
 * Pure functions over strings / temp dirs — no network, no keys.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import {
  filenameDate,
  scanReportDateMismatches,
  fixReportHeaderDate,
  scanTrackerCompanyIssues,
  applyTrackerCompanyFix,
  isSourceNameCompany,
  isRoleInCompany,
  companyFromReportH1,
  atsCompanyFromUrl,
  splitTrackerRow,
  trackerCellText,
} from '../server/lib/data-migrations.mjs';
import { extractCellUrl } from '../server/lib/parsers.mjs';

// ───────────────────────── filename dates ─────────────────────────

test('filenameDate: the reports/ convention (num-slug-YYYY-MM-DD.md, optional dedup suffix)', () => {
  assert.equal(filenameDate('042-acme-2026-05-01.md'), '2026-05-01');
  assert.equal(filenameDate('042-acme-2026-05-01-1730000000.md'), '2026-05-01');
  assert.equal(filenameDate('042-acme.md'), null);
  assert.equal(filenameDate('notes.md'), null);
});

test('filenameDate: non-ASCII slugs and bare slug-date names still carry the stamp (CAR-241)', () => {
  assert.equal(filenameDate('007-ромашка-2026-10-25.md'), '2026-10-25');
  assert.equal(filenameDate('acme-2026-10-25.md'), '2026-10-25', 'no numeric prefix required');
  assert.equal(filenameDate('001-x-2026-01-02-1730000000000.md'), '2026-01-02');
  assert.equal(filenameDate('report.pdf'), null);
  assert.equal(filenameDate(''), null);
});

// ───────────────────────── report dates (CAR-241) ─────────────────────────

test('report dates: the scan lists localized mismatches with line numbers, skipped files carry a reason', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'data-mig-'));
  writeFileSync(join(dir, '001-acme-2026-10-25.md'), '# Evaluation: Acme — Dev\n\n**Company:** Acme\n**Date:** 2026-01-15\n\n**Score:** 4.0/5\n');
  writeFileSync(join(dir, '002-ромашка-2026-10-25.md'), '# Оценка вакансии: ООО Ромашка – Python-разработчик\n\n**Дата:** 2026-01-15\n');
  writeFileSync(join(dir, '003-gmbh-2026-10-25.md'), '# Bewertung: München GmbH — Dateningenieur\n\n**Datum:** 2026-01-15\n');
  writeFileSync(join(dir, '004-ok-2026-10-25.md'), '# Evaluation: Ok — Dev\n\n**Date:** 2026-10-25\n');
  writeFileSync(join(dir, '005-nodate-2026-10-25.md'), '# Evaluation: NoDate — Dev\n\nno date line at all\n');
  writeFileSync(join(dir, 'notes.md'), '# no filename date\n**Date:** 2026-01-01\n');
  const { rows, skipped } = scanReportDateMismatches(dir);
  assert.deepEqual(rows.map((r) => r.file), ['001-acme-2026-10-25.md', '002-ромашка-2026-10-25.md', '003-gmbh-2026-10-25.md']);
  assert.deepEqual(rows.map((r) => r.headerDate), ['2026-01-15', '2026-01-15', '2026-01-15']);
  assert.ok(rows.every((r) => r.fileDate === '2026-10-25'), 'the filename stamp is the target');
  assert.equal(rows[0].line, 4, '1-based line number of the **Date:** line');
  assert.ok(rows[1].lineText.includes('Дата'), 'the matched line text rides the row');
  // 004 matched silently (not listed anywhere); 005 + notes.md are skipped with reasons.
  assert.deepEqual(skipped, [
    { file: '005-nodate-2026-10-25.md', reason: 'no-header-date' },
    { file: 'notes.md', reason: 'no-file-date' },
  ]);
  const fixed = fixReportHeaderDate(readFileSync(join(dir, '001-acme-2026-10-25.md'), 'utf8'), rows[0].fileDate);
  assert.match(fixed, /\*\*Date:\*\* 2026-10-25/);
  // Line-surgical: the score line and the H1 survive verbatim.
  assert.match(fixed, /\*\*Score:\*\* 4\.0\/5/);
  assert.match(fixed, /^# Evaluation: Acme — Dev$/m);
});

test('report dates: the fix preserves a localized label and touches only the date value', () => {
  const ru = '# Оценка вакансии: ООО Ромашка – Python-разработчик\n\n**Компания:** Ромашка\n**Дата:** 2026-01-15\n**Оценка:** 4.2/5\n';
  const fixed = fixReportHeaderDate(ru, '2026-10-25');
  assert.match(fixed, /\*\*Дата:\*\* 2026-10-25/, 'the localized label survives, only the value changes');
  assert.match(fixed, /\*\*Оценка:\*\* 4\.2\/5/, 'the score line is untouched');
  assert.match(fixed, /ООО Ромашка – Python-разработчик/, 'the H1 is untouched');
  assert.equal(fixed.split('\n').length, ru.split('\n').length, 'no lines added or removed');
});

test('scanReportDateMismatches on a missing directory returns empty rows+skipped (no throw)', () => {
  assert.deepEqual(scanReportDateMismatches(resolve(tmpdir(), 'does-not-exist-mig')), { rows: [], skipped: [] });
});

test('fixReportHeaderDate: a file without a date line returns null (nothing to rewrite)', () => {
  assert.equal(fixReportHeaderDate('# Evaluation: X\n\nno date line here\n', '2026-05-01'), null);
});

// ───────────────────────── company from a report H1 (CAR-242) ─────────────────────────

test('companyFromReportH1: em dash, en dash and spaced hyphen variants all split', () => {
  assert.equal(companyFromReportH1('# Evaluation: Netwrk — Team Lead Go'), 'Netwrk');
  assert.equal(companyFromReportH1('# Оценка вакансии: ООО Ромашка – Python-разработчик'), 'ООО Ромашка',
    'CAR-242 — the en dash variant (–) must split like the em dash');
  assert.equal(companyFromReportH1('# Оценка вакансии: ИП Иванов - Senior Go Developer'), 'ИП Иванов',
    'a spaced hyphen splits too');
  assert.equal(companyFromReportH1('# Evaluación: Acme Ibérica — Ingeniero de Datos'), 'Acme Ibérica');
  assert.equal(companyFromReportH1('# 評価: テック株式会社 — バックエンドエンジニア'), 'テック株式会社');
  assert.equal(companyFromReportH1('# Bewertung: München GmbH — Dateningenieur'), 'München GmbH');
});

test('companyFromReportH1: one-part headers, emphasis stripping, and non-header text', () => {
  assert.equal(companyFromReportH1('# Netwrk'), 'Netwrk', 'a one-part H1 names the company');
  assert.equal(companyFromReportH1('# **Acme Corp** — Dev'), 'Acme Corp', 'emphasis markers are stripped');
  assert.equal(companyFromReportH1('**Date:** 2026-01-15\nsome prose'), null, 'no H1 → null');
  assert.equal(companyFromReportH1(''), null);
  assert.equal(companyFromReportH1(null), null);
  // 'ACME-Global' has no spaces around its hyphen — a compound name, not a split.
  assert.equal(companyFromReportH1('# ACME-Global'), 'ACME-Global');
  assert.equal(companyFromReportH1('# Evaluation: ACME-Global'), 'ACME-Global');
});

// ───────────────────────── ATS slug fallback (CAR-242) ─────────────────────────

test('atsCompanyFromUrl: ATS host + slug → Title Case company', () => {
  assert.equal(atsCompanyFromUrl('https://boards.greenhouse.io/grafanalabs/jobs/123'), 'Grafana Labs');
  assert.equal(atsCompanyFromUrl('https://jobs.lever.co/acme-corp/abc-def'), 'Acme Corp');
  assert.equal(atsCompanyFromUrl('https://jobs.ashbyhq.com/munich-gmbh'), 'Munich Gmbh');
  assert.equal(atsCompanyFromUrl('https://jobs.smartrecruiters.com/AcmeCorp/123'), 'AcmeCorp');
  assert.equal(atsCompanyFromUrl('https://job-boards.greenhouse.io/grafanalabs/jobs/9'), 'Grafana Labs');
});

test('atsCompanyFromUrl: non-ATS hosts and slugless URLs yield null (never guessed)', () => {
  assert.equal(atsCompanyFromUrl('https://hh.ru/vacancy/123'), null, 'an aggregator is not an ATS');
  assert.equal(atsCompanyFromUrl('https://boards.greenhouse.io/'), null, 'no slug → null');
  assert.equal(atsCompanyFromUrl('not a url'), null);
  assert.equal(atsCompanyFromUrl(''), null);
  assert.equal(atsCompanyFromUrl(null), null);
});

// ───────────────────────── tracker Company cells ─────────────────────────

const TRACKER = [
  '# Applications Tracker',
  '',
  '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
  '|---|------|---------|------|-------|--------|-----|--------|-------|',
  '| 1 | 2026-05-01 | **hh** | Ведущий Go-разработчик | 4.0/5 | Оценена | ❌ | [7](../reports/007-netwrk-2026-05-01.md) | via hh |',
  '| 2 | 2026-05-02 | Senior Software Engineer | Platform | 3.2/5 | Оценена | ❌ | [9](../reports/009-circleci-2026-05-02.md) | — |',
  '| 3 | 2026-05-03 | Netwrk | Team Lead Go | 4.5/5 | Оценена | ❌ | [12](../reports/012-netwrk-2026-05-03.md) | — |',
  '| 4 | 2026-05-04 | Backend Engineer - Platform | Stack-ish | 2.0/5 | Оценена | ❌ | — | no report |',
].join('\n');

function resolveReportCompany(reportCell, urlCell) {
  const href = String(reportCell ?? '').match(/\]\(([^)]+)\)/)?.[1] ?? '';
  const base = href.split('/').pop();
  if (REPORT_H1S[base]) return { company: REPORT_H1S[base], source: 'report' };
  const ats = atsCompanyFromUrl(extractCellUrl(urlCell));
  return ats ? { company: ats, source: 'ats' } : { reason: 'no-report' };
}

const REPORT_H1S = {
  '007-netwrk-2026-05-01.md': 'Netwrk',
  '009-circleci-2026-05-02.md': 'CircleCI',
  '012-netwrk-2026-05-03.md': 'Netwrk',
};

test('CAR-127: a Company cell holding "hh" is detected as a source-name row', () => {
  assert.equal(isSourceNameCompany('**hh**'), true);
  assert.equal(isSourceNameCompany('hh.ru'), true);
  assert.equal(isSourceNameCompany('Habr Career'), true);
  assert.equal(isSourceNameCompany('Netwrk'), false);
});

test('CAR-128: a Company cell holding a role title is detected', () => {
  assert.equal(isRoleInCompany('Senior Software Engineer'), true);
  assert.equal(isRoleInCompany('Backend Engineer - Platform'), true);
  assert.equal(isRoleInCompany('Stacks'), false);
  assert.equal(isRoleInCompany('CircleCI'), false);
});

test('the scan flags source-name and role rows, resolves the employer from the report H1, and never guesses', () => {
  const issues = scanTrackerCompanyIssues(TRACKER, resolveReportCompany);
  // rows 1 (hh → Netwrk) and 2 (role → CircleCI); row 3 is clean; row 4 is a
  // role-in-company WITHOUT a report → reported with fixed: null + a reason.
  assert.equal(issues.length, 3);
  assert.deepEqual(issues.map((i) => i.num), ['1', '2', '4']);
  assert.equal(issues[0].reason, 'source-name');
  assert.equal(issues[0].fixed, 'Netwrk');
  assert.equal(issues[0].source, 'report');
  assert.equal(issues[1].reason, 'role-in-company');
  assert.equal(issues[1].fixed, 'CircleCI');
  assert.equal(issues[2].fixed, null, 'no report → never guessed');
  assert.equal(issues[2].source, null);
  assert.equal(issues[2].unresolvedReason, 'no-report');
});

test('the ATS fallback fixes a role-in-company row whose URL names the employer (CAR-242)', () => {
  const tracker = [
    '# Applications Tracker',
    '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|-----|',
    '| 4 | 2026-05-04 | Backend Engineer - Platform | Stack-ish | 2.0/5 | Оценена | ❌ | — | no report | [2](https://boards.greenhouse.io/grafanalabs/jobs/123) |',
  ].join('\n');
  const issues = scanTrackerCompanyIssues(tracker, resolveReportCompany);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].fixed, 'Grafana Labs');
  assert.equal(issues[0].source, 'ats', 'the URL slug is the source, not the report');
});

test('the apply is line-surgical: only the Company cell changes, every other byte survives', () => {
  const issues = scanTrackerCompanyIssues(TRACKER, resolveReportCompany);
  const { text, changed } = applyTrackerCompanyFix(TRACKER, issues);
  assert.equal(changed, 2);
  const row1 = text.split('\n').find((l) => l.startsWith('| 1 |'));
  assert.match(row1, /\| Netwrk \| Ведущий Go-разработчик \| 4\.0\/5 \| Оценена \| ❌ \| \[7\]/);
  assert.match(row1, /via hh \|$/);
  const row2 = text.split('\n').find((l) => l.startsWith('| 2 |'));
  assert.match(row2, /\| CircleCI \| Platform \| 3\.2\/5 \|/);
  // The clean row and the header survive byte-identically.
  assert.match(text, /\| 3 \| 2026-05-03 \| Netwrk \| Team Lead Go \| 4\.5\/5 \|/);
  assert.match(text, /^\| # \| Date \| Company \| Role \|/m);
  // Row 4 (unresolvable) is untouched.
  assert.match(text, /\| 4 \| 2026-05-04 \| Backend Engineer - Platform \|/);
});

test('apply branches: empty issues, unresolvable lines and non-table rows are safe no-ops (CAR-232)', () => {
  // No fixes → the text returns unchanged, changed = 0.
  const r0 = applyTrackerCompanyFix(TRACKER, []);
  assert.equal(r0.changed, 0);
  assert.equal(r0.text, TRACKER);
  // Issues whose fixed is null (no report) → nothing rewritten.
  const r1 = applyTrackerCompanyFix(TRACKER, [{ line: 5, num: '1', company: 'hh', reason: 'source-name', fixed: null }]);
  assert.equal(r1.changed, 0);
  // A line number that no longer resolves to a table row → skipped safely.
  const r2 = applyTrackerCompanyFix('some random text\nmore text', [{ line: 1, num: '1', company: 'hh', reason: 'source-name', fixed: 'Netwrk' }]);
  assert.equal(r2.changed, 0);
  assert.equal(r2.text, 'some random text\nmore text');
});

test('isSourceNameCompany: trailing dot and case folding (CAR-127)', () => {
  assert.equal(isSourceNameCompany('HH.'), true);
  assert.equal(isSourceNameCompany('Telegram'), true);
  assert.equal(isSourceNameCompany('Netwrk Gmbh'), false);
});

test('cellText edge: a bold-link company cell folds to its label (CAR-128 detection)', () => {
  assert.equal(isRoleInCompany('[Senior Developer - Platform](https://x)'), true);
  assert.equal(isRoleInCompany('**Acme Corp**'), false);
});

test('splitTrackerRow / trackerCellText: the shared row primitives', () => {
  assert.deepEqual(splitTrackerRow('| 1 | 2026-05-01 | hh | Role |'), ['1', '2026-05-01', 'hh', 'Role']);
  assert.equal(splitTrackerRow('prose'), null);
  assert.equal(splitTrackerRow(null), null);
  assert.equal(trackerCellText('**hh**'), 'hh');
  assert.equal(trackerCellText('[label](https://x)'), 'label');
  assert.equal(trackerCellText(' `hh` '), 'hh');
});

test('review v1.268.1 — a report company containing `|` never adds a phantom column', () => {
  const pipeResolver = (cell) => (/007-netwrk/.test(String(cell)) ? { company: 'ACME | Data Corp', source: 'report' } : (/009-circleci/.test(String(cell)) ? { company: 'Multi\nLine\tCorp', source: 'report' } : { reason: 'no-report' }));
  const issues = scanTrackerCompanyIssues(TRACKER, pipeResolver);
  const fixable = issues.find((i) => i.line === 5 && i.fixed === 'ACME | Data Corp');
  assert.ok(fixable, 'row 1 resolves to the pipe company');
  const before = TRACKER.split('\n')[4].split('|').length;
  const { text, changed } = applyTrackerCompanyFix(TRACKER, issues);
  assert.equal(changed, 2, 'both rows fix (pipe company + newline/tab company)');
  const row = text.split('\n')[4];
  assert.equal(row.split('|').length, before, `the fixed row keeps its column count: ${row}`);
  assert.match(row, /ACME\s+Data Corp/, 'the pipe is flattened to spaces — no phantom column');
  const row2 = text.split('\n')[5];
  assert.match(row2, /Multi\s+Line\s+Corp/, 'newlines and tabs flatten too — never a phantom row/column');
  // A null/empty resolution inside the fix list is skipped without touching the row.
  const { text: t3, changed: c3 } = applyTrackerCompanyFix(TRACKER, [{ line: 5, fixed: null }, { line: 5, fixed: '  ' }, { line: 5, fixed: 'Clean Co' }]);
  assert.equal(c3, 1, 'null/blank employers are skipped, the real one still lands');
  assert.match(t3, /Clean Co/);
});

test('scan: no resolver → every row is reported with fixed:null; malformed rows are skipped', () => {
  // The ternary's false side: scan called WITHOUT a resolver.
  const issues = scanTrackerCompanyIssues(TRACKER);
  assert.equal(issues.length, 3, 'hh (source-name) + two role-in-company rows');
  assert.ok(issues.every((i) => i.fixed === null && i.reportCompany === null), 'no resolver → nothing is fixable');
  // Non-table prose, a short row and a non-numeric # are all skipped silently.
  const messy = [
    '# Applications Tracker',
    'Some prose line',
    '| a | b |',                              // 3 cells < 8
    '| x | 2026-01-01 | hh | Role | 1 | 2 | 3 | no-link | notes |',  // non-numeric #
    TRACKER.split('\n')[4],
  ].join('\n');
  assert.deepEqual(scanTrackerCompanyIssues(messy, () => ({ company: 'X', source: 'report' })).map((i) => i.line), [5], 'only the real data row is scanned');
});

test('a tracker whose URL column carries the posting link hands it to the resolver (CAR-242)', () => {
  // The 10-column canonical+URL layout: the resolver must receive the URL cell.
  const tracker = [
    '# Applications Tracker',
    '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|-----|',
    '| 8 | 2026-06-01 | Senior Java Developer | Platform | — | Evaluated | ❌ | — | — | [x](https://jobs.lever.co/acme-corp/abc) |',
  ].join('\n');
  let seenUrl = null;
  const issues = scanTrackerCompanyIssues(tracker, (reportCell, urlCell) => {
    seenUrl = urlCell ?? null;
    return { company: 'Acme Corp', source: 'ats' };
  });
  assert.equal(issues.length, 1);
  assert.match(String(seenUrl), /jobs\.lever\.co\/acme-corp/, 'the URL cell reaches the resolver');
  assert.equal(issues[0].fixed, 'Acme Corp');
});

test('branch tails: string resolvers, same-company resolutions, default columns, unreadable files', () => {
  // A legacy string resolver (no {company, source} object) still resolves.
  const issues = scanTrackerCompanyIssues(TRACKER, () => 'Old Co');
  assert.equal(issues[0].fixed, 'Old Co');
  assert.equal(issues[0].source, 'report', 'a bare string is the report source');
  // A resolution equal to the current cell is reported, not rewritten.
  const same = scanTrackerCompanyIssues(TRACKER, (cell) => (String(cell).includes('007-netwrk') ? { company: 'hh', source: 'report' } : { reason: 'no-report' }));
  const sameRow = same.find((i) => i.num === '1');
  assert.equal(sameRow.fixed, null);
  assert.equal(sameRow.unresolvedReason, 'same-company');
  // A tracker without a '#' header row still scans positionally (defaults).
  const headerless = '| 9 | 2026-01-01 | hh | Role | 1.0/5 | Evaluated | ❌ | [1](../reports/007-netwrk-2026-05-01.md) | — |';
  const hIssues = scanTrackerCompanyIssues(headerless, (cell) => {
    assert.equal(String(cell).includes('007-netwrk'), true, 'the default report column (7) is used');
    return { company: 'Netwrk', source: 'report' };
  });
  assert.equal(hIssues.length, 1);
  assert.equal(hIssues[0].fixed, 'Netwrk');
  // A header whose labels don't fold falls back to the canonical positions.
  const ru = [
    '| № | Дата | Компания | Роль | Оценка | Статус | PDF | Отчёт | Заметки |',
    '|---|------|----------|------|--------|--------|-----|-------|---------|',
    headerless, // the RU fixture already carries the padded '| 9 |' num cell
  ].join('\n');
  assert.equal(scanTrackerCompanyIssues(ru, () => ({ company: 'Netwrk', source: 'report' }))[0].fixed, 'Netwrk');
  // An unreadable "report file" (a directory wearing a .md name) is skipped.
  const dir = mkdtempSync(resolve(tmpdir(), 'data-mig-un-'));
  mkdirSync(join(dir, '009-dir-2026-10-25.md'));
  writeFileSync(join(dir, '010-x-2026-10-25.md'), '**Datum:** 2026-01-15\n');
  const scan = scanReportDateMismatches(dir);
  assert.deepEqual(scan.rows.map((r) => r.file), ['010-x-2026-10-25.md']);
  assert.deepEqual(scan.skipped, [{ file: '009-dir-2026-10-25.md', reason: 'unreadable' }]);
});

test('branch tails: ATS variants and company edge shapes', () => {
  assert.equal(atsCompanyFromUrl('https://jobs.eu.lever.co/acme_corp/1'), 'Acme Corp', 'the EU lever host + underscore slug');
  assert.equal(atsCompanyFromUrl('https://apply.workable.com/acme/j/1/'), 'Acme');
  assert.equal(atsCompanyFromUrl('https://boards.greenhouse.io/grafanalabs'), 'Grafana Labs', 'a slug with no further path');
  assert.equal(companyFromReportH1('# **'), null, 'an emphasis-only H1 names nobody');
  assert.equal(companyFromReportH1('# Оценка вакансии'), null, 'a bare localized label names nobody');
  assert.equal(filenameDate('001-x-2026-10-25.MD'), '2026-10-25', 'case-insensitive extension');
  assert.deepEqual(splitTrackerRow('  | a | b |  '), ['a', 'b'], 'padded row boundaries are trimmed');
});
