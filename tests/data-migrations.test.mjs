/**
 * data-migrations.test.mjs — the CAR-232/233 migration primitives:
 *   · report header dates: scan finds filename-vs-header mismatches, the fix
 *     rewrites ONLY the **Date:** line (CAR-101 tail);
 *   · tracker Company cells: source-name ("hh") and role-in-company rows are
 *     detected (CAR-127/128 — 123 + 14 prod rows), the fix comes from the
 *     row's report H1, rows without a resolvable report are reported with
 *     `fixed: null` (never guessed), and the apply is line-surgical — every
 *     other column byte-identical.
 *
 * Pure functions over strings — no network, no keys.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
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
} from '../server/lib/data-migrations.mjs';

test('filenameDate: the reports/ convention (num-slug-YYYY-MM-DD.md, optional dedup suffix)', () => {
  assert.equal(filenameDate('042-acme-2026-05-01.md'), '2026-05-01');
  assert.equal(filenameDate('042-acme-2026-05-01-1730000000.md'), '2026-05-01');
  assert.equal(filenameDate('042-acme.md'), null);
  assert.equal(filenameDate('notes.md'), null);
});

test('report dates: the scan lists only mismatches, the fix rewrites only the Date line', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'data-mig-'));
  writeFileSync(join(dir, '001-acme-2026-05-01.md'), '# Evaluation: Acme — Dev\n\n**Date:** 2026-01-15\n\n**Score:** 4.0/5\n');
  writeFileSync(join(dir, '002-beta-2026-06-01.md'), '# Evaluation: Beta — Dev\n\n**Date:** 2026-06-01\n');
  writeFileSync(join(dir, '003-gamma.md'), '# no filename date — skipped\n**Date:** 2026-01-01\n');
  const rows = scanReportDateMismatches(dir);
  assert.deepEqual(rows.map((r) => r.file), ['001-acme-2026-05-01.md']);
  assert.equal(rows[0].headerDate, '2026-01-15');
  const fixed = fixReportHeaderDate(readFileSync(join(dir, '001-acme-2026-05-01.md'), 'utf8'), rows[0].fileDate);
  assert.match(fixed, /\*\*Date:\*\* 2026-05-01/);
  // Line-surgical: the score line and the H1 survive verbatim.
  assert.match(fixed, /\*\*Score:\*\* 4\.0\/5/);
  assert.match(fixed, /^# Evaluation: Acme — Dev$/m);
});

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

const REPORT_H1S = {
  '007-netwrk-2026-05-01.md': '# Evaluation: Netwrk — Ведущий Go-разработчик',
  '009-circleci-2026-05-02.md': '# Evaluation: CircleCI — Platform',
  '012-netwrk-2026-05-03.md': '# Evaluation: Netwrk — Team Lead Go',
};

function resolveReportCompany(cell) {
  const href = String(cell ?? '').match(/\]\(([^)]+)\)/)?.[1] ?? '';
  const base = href.split('/').pop();
  return REPORT_H1S[base] ? REPORT_H1S[base].replace(/^#\s+(?:Evaluation:\s*)?/, '').split('—')[0].trim() : null;
}

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
  // role-in-company WITHOUT a report → reported with fixed: null.
  assert.equal(issues.length, 3);
  assert.deepEqual(issues.map((i) => i.num), ['1', '2', '4']);
  assert.equal(issues[0].reason, 'source-name');
  assert.equal(issues[0].fixed, 'Netwrk');
  assert.equal(issues[1].reason, 'role-in-company');
  assert.equal(issues[1].fixed, 'CircleCI');
  assert.equal(issues[2].fixed, null, 'no report → never guessed');
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

test('scanReportDateMismatches on a missing directory returns [] (no throw)', () => {
  assert.deepEqual(scanReportDateMismatches(resolve(tmpdir(), 'does-not-exist-mig')), []);
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

test('filenameDate edge: dedup-suffixed names and non-md files', () => {
  assert.equal(filenameDate('001-x-2026-01-02-1730000000000.md'), '2026-01-02');
  assert.equal(filenameDate('report.pdf'), null);
  assert.equal(filenameDate(''), null);
});

test('fixReportHeaderDate: a file without a Date line returns null (nothing to rewrite)', () => {
  assert.equal(fixReportHeaderDate('# Evaluation: X\n\nno date line here\n', '2026-05-01'), null);
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

test('review v1.268.1 — a report company containing `|` never adds a phantom column', () => {
  const pipeResolver = (cell) => (/007-netwrk/.test(String(cell)) ? 'ACME | Data Corp' : (/009-circleci/.test(String(cell)) ? 'Multi\nLine\tCorp' : null));
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
  assert.deepEqual(scanTrackerCompanyIssues(messy, () => 'X').map((i) => i.line), [5], 'only the real data row is scanned');
});
