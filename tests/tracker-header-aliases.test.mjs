/**
 * HEADER_ALIASES fold in parseApplications.
 *
 * A tracker written with localized or variant column headers (Spanish
 * `empresa|puesto|estado|fecha|enlace`, English `position|stage|link`) must
 * still surface its values under the canonical field names the SPA reads
 * (`.company`/`.role`/`.status`/`.date`/`.url`). And an all-canonical English
 * header must keep parsing byte-identically to before the fold existed.
 *
 * Pure parser test — no server, no port, no parent-project dependency.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseApplications, HEADER_ALIASES } from '../server/lib/parsers.mjs';

test('parseApplications: Spanish headers fold onto canonical fields', () => {
  const md = `# Seguimiento de candidaturas

| # | Fecha | Empresa | Puesto | Score | Estado | PDF | Report | Enlace |
|---|-------|---------|--------|-------|--------|-----|--------|--------|
| 1 | 2026-05-02 | Wheely | Senior Backend | 4.2/5 | Evaluated | ✅ | [001](reports/001.md) | https://jobs.example.com/1 |
`;
  const apps = parseApplications(md);
  assert.equal(apps.length, 1);
  const a = apps[0];
  assert.equal(a.company, 'Wheely'); // empresa → company
  assert.equal(a.role, 'Senior Backend'); // puesto → role
  assert.equal(a.status, 'Evaluated'); // estado → status
  assert.equal(a.date, '2026-05-02'); // fecha → date
  assert.equal(a.url, 'https://jobs.example.com/1'); // enlace → url
  // Canonical labels in the same table are unaffected.
  assert.equal(a.num, '1');
  assert.equal(a.score, '4.2/5');
  assert.equal(a.scoreNum, 4.2);
  assert.equal(a.pdfReady, true);
  assert.equal(a.reportPath, 'reports/001.md');
});

test('parseApplications: English variant headers fold onto canonical fields', () => {
  const md = `| # | Date | Company | Position | Score | Stage | PDF | Report | Link |
|---|------|---------|----------|-------|-------|-----|--------|------|
| 1 | 2026-01-01 | Acme | Staff Eng | 3.0/5 | Applied | ❌ | — | https://acme.test/jd |`;
  const a = parseApplications(md)[0];
  assert.equal(a.company, 'Acme');
  assert.equal(a.role, 'Staff Eng'); // position → role
  assert.equal(a.status, 'Applied'); // stage → status
  assert.equal(a.url, 'https://acme.test/jd'); // link → url
  assert.equal(a.scoreNum, 3.0);
  assert.equal(a.pdfReady, false);
});

test('parseApplications: header matching is case- and whitespace-tolerant', () => {
  const md = `|  EMPRESA  |  Puesto  |  ESTADO  |
|---|---|---|
| Globex | Data Lead | Applied |`;
  const a = parseApplications(md)[0];
  assert.equal(a.company, 'Globex');
  assert.equal(a.role, 'Data Lead');
  assert.equal(a.status, 'Applied');
});

test('parseApplications: canonical English header is unchanged by the fold (regression)', () => {
  const md = `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
| 1 | 2026-05-02 | Wheely | Senior Backend | 4.2/5 | Evaluated | ✅ | [001](reports/001-wheely-2026-05-02.md) | Strong Go fit |
`;
  const apps = parseApplications(md);
  assert.equal(apps.length, 1);
  const a = apps[0];
  // Byte-for-byte the same assertions as the pre-existing real-world-row test.
  assert.equal(a.num, '1');
  assert.equal(a.date, '2026-05-02');
  assert.equal(a.company, 'Wheely');
  assert.equal(a.role, 'Senior Backend');
  assert.equal(a.score, '4.2/5');
  assert.equal(a.scoreNum, 4.2);
  assert.equal(a.status, 'Evaluated');
  assert.equal(a.notes, 'Strong Go fit');
  assert.equal(a.pdfReady, true);
  assert.equal(a.reportPath, 'reports/001-wheely-2026-05-02.md');
  // No stray canonical key leaked in from an alias source.
  assert.equal('empresa' in a, false);
  assert.equal('puesto' in a, false);
  assert.equal('estado' in a, false);
});

test('parseApplications: unknown headers pass through unchanged (no column dropped)', () => {
  const md = `| Company | Salary | Recruiter |
|---|---|---|
| Initech | 120k | Jane |`;
  const a = parseApplications(md)[0];
  assert.equal(a.company, 'Initech');
  // Columns with no alias keep their normalized (lowercased) header as the key.
  assert.equal(a.salary, '120k');
  assert.equal(a.recruiter, 'Jane');
});

test('HEADER_ALIASES: every value is a canonical field name', () => {
  const canonical = new Set([
    'num', 'date', 'company', 'via', 'role',
    'location', 'score', 'status', 'pdf', 'report', 'notes', 'url',
  ]);
  for (const [source, target] of Object.entries(HEADER_ALIASES)) {
    assert.equal(canonical.has(target), true, `${source} → ${target} is not canonical`);
  }
});
