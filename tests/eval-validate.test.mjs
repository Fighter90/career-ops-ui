/**
 * Tests for validateEvaluationReport (v1.75.0 — parent v1.12.0 #819 parity).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEvaluationReport } from '../server/lib/eval-validate.mjs';

const GOOD = `
## Block A — Fit
...
## Block B
## Block C
## Block D
## Block E
## Block F
## Block G — Posting Legitimacy
...

---SCORE_SUMMARY---
COMPANY: Acme AI
ROLE: Head of Applied AI
ARCHETYPE: AI Leadership
LEGITIMACY: Verified
SCORE: 4.2
---END_SUMMARY---
`;

test('valid A–G report with SCORE_SUMMARY → no issues', () => {
  assert.deepEqual(validateEvaluationReport(GOOD), []);
});

test('empty text → single issue', () => {
  assert.deepEqual(validateEvaluationReport(''), ['empty evaluation report']);
  assert.deepEqual(validateEvaluationReport(null), ['empty evaluation report']);
});

test('missing blocks are each reported', () => {
  const text = `## Block A\n## Block B\n---SCORE_SUMMARY---\nCOMPANY: X\nROLE: Y\nARCHETYPE: Z\nLEGITIMACY: Verified\nSCORE: 3\n---END_SUMMARY---`;
  const issues = validateEvaluationReport(text);
  for (const b of ['C', 'D', 'E', 'F', 'G']) {
    assert.ok(issues.includes(`missing Block ${b}`), `expected missing Block ${b}`);
  }
});

test('missing SCORE_SUMMARY block flagged', () => {
  const text = '## Block A\n## Block B\n## Block C\n## Block D\n## Block E\n## Block F\n## Block G';
  assert.ok(validateEvaluationReport(text).includes('missing SCORE_SUMMARY block'));
});

test('score out of range flagged', () => {
  const text = GOOD.replace('SCORE: 4.2', 'SCORE: 9.9');
  assert.ok(validateEvaluationReport(text).includes('SCORE_SUMMARY score must be a number between 0 and 5'));
});

test('COMPANY may be unknown, but ROLE/ARCHETYPE/LEGITIMACY may not', () => {
  const text = GOOD
    .replace('COMPANY: Acme AI', 'COMPANY: unknown')
    .replace('ROLE: Head of Applied AI', 'ROLE: unknown');
  const issues = validateEvaluationReport(text);
  assert.ok(!issues.includes('SCORE_SUMMARY COMPANY is required'));
  assert.ok(issues.includes('SCORE_SUMMARY ROLE is required'));
});

// v1.238.4 — a translated report translates the word "Block" (the prompt asks
// for translated headings), and the live regression flagged 6–8 missing blocks
// in 9 of 17 locales for well-formed reports.
const SUMMARY = `
---SCORE_SUMMARY---
COMPANY: Acme
ROLE: Engineer
SCORE: 4.0
ARCHETYPE: Platform
LEGITIMACY: High Confidence
---END_SUMMARY---
`;
const blocks = (fmt) => ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(fmt).join('\n...\n') + SUMMARY;

test('translated block headings keep their letter and are recognised', () => {
  const cases = {
    es: (L) => `## Bloque ${L} — Sección`,
    fr: (L) => `## Bloc ${L} : Section`,
    pl: (L) => `### Blok ${L}. Sekcja`,
    ja: (L) => `## ブロック${L} — 概要`,
    'zh-CN': (L) => `## 区块 ${L}：概述`,
    hi: (L) => `## ब्लॉक ${L} — सारांश`,
    ar: (L) => `## القسم ${L} — ملخص`,
    plain: (L) => `## ${L}) Section`,
  };
  for (const [name, fmt] of Object.entries(cases)) {
    assert.deepEqual(validateEvaluationReport(blocks(fmt)), [], name);
  }
});

test('Cyrillic look-alike letters (А В С Е) count as blocks; Cyrillic words do not', () => {
  const cyr = { A: 'А', B: 'В', C: 'С', E: 'Е' };
  assert.deepEqual(validateEvaluationReport(blocks((L) => `## Блок ${cyr[L] || L} — Раздел`)), []);
  const issues = validateEvaluationReport('## Анализ\n## Вывод\n## Сводка\n## Если\n' + SUMMARY);
  for (const L of ['A', 'B', 'C', 'E']) assert.ok(issues.includes(`missing Block ${L}`), L);
});

test('v1.239.3: Arabic abjad block letters (أ ب ج د هـ و ز) count as blocks; Arabic words do not', () => {
  // Live regression (three runs): the Arabic report writes "## الكتلة أ — …"
  // whatever the prompt says; the masked heading skeleton showed no Latin letter.
  const abjad = { A: 'أ', B: 'ب', C: 'ج', D: 'د', E: 'هـ', F: 'و', G: 'ز' };
  assert.deepEqual(validateEvaluationReport(blocks((L) => `## الكتلة ${abjad[L]} — القسم`)), []);
  assert.deepEqual(validateEvaluationReport(blocks((L) => `## ${abjad[L]}) القسم`)), []);
  // The same letters inside Arabic words are not block letters.
  const issues = validateEvaluationReport('## ملخص الدور\n## تحليل السيرة\n## المخاطر\n## التعويض\n## الاستراتيجية\n## الحكم\n## الشرعية\n' + SUMMARY);
  assert.equal(issues.filter((i) => i.startsWith('missing Block')).length, 7);
});

test('a letter inside a Latin word is not a block heading', () => {
  const issues = validateEvaluationReport('## About the role\n## Benefits\n## Compensation\n## Details\n## Education\n## Fit\n## GDPR\n' + SUMMARY);
  assert.equal(issues.filter((i) => i.startsWith('missing Block')).length, 7);
});

test('stripScoreSummary removes the machine block and keeps the report', async () => {
  const { stripScoreSummary } = await import('../server/lib/eval-validate.mjs');
  const out = stripScoreSummary('## Block A — Fit\ntext\n' + SUMMARY + '\n');
  assert.equal(out, '## Block A — Fit\ntext');
  assert.equal(stripScoreSummary('no block here\n'), 'no block here');
});
