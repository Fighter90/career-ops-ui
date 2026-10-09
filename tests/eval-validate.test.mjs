/**
 * Tests for validateEvaluationReport (v1.75.0 — parent v1.12.0 #819 parity).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEvaluationReport, asciiNumber } from '../server/lib/eval-validate.mjs';

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

test('v1.241.1: Devanagari-spelled block letters (ए बी सी डी ई एफ जी) count as blocks; Hindi words do not', () => {
  // Local deepseek hi run, 2026-10-07: "## ए) …", "## बी) CV …" — no Latin letter.
  const deva = { A: 'ए', B: 'बी', C: 'सी', D: 'डी', E: 'ई', F: 'एफ', G: 'जी' };
  assert.deepEqual(validateEvaluationReport(blocks((L) => `## ${deva[L]}) भूमिका`)), []);
  assert.deepEqual(validateEvaluationReport(blocks((L) => `## ब्लॉक ${deva[L]} — भूमिका`)), []);
  assert.deepEqual(validateEvaluationReport(blocks((L) => (L === 'F' ? '## एफ़) भूमिका' : `## ${deva[L]}) भूमिका`))), []);
  // Inside a word the same syllables are not block letters (बीमा, सीवी, जीवन).
  const issues = validateEvaluationReport('## बीमा\n## सीवी विश्लेषण\n## जीवन\n## एक सारांश\n' + SUMMARY);
  assert.equal(issues.filter((i) => i.startsWith('missing Block')).length, 7);
});

test('v1.241.1: SCORE in local digits or with a decimal comma is a number', async () => {
  const { asciiNumber } = await import('../server/lib/eval-validate.mjs');
  const withScore = (v) => blocks((L) => `## Block ${L} — x`).replace(/SCORE:.*$/m, `SCORE: ${v}`);
  for (const v of ['३.८', '٣٫٨', '۳.۸', '３．８', '3,8', '**3.8**', '3.8/5', '3.8 / 5']) {
    assert.deepEqual(validateEvaluationReport(withScore(v)), [], v);
  }
  for (const v of ['७.२', 'high', '', '-1']) {
    assert.ok(validateEvaluationReport(withScore(v)).some((i) => i.startsWith('SCORE_SUMMARY score')), v);
  }
  assert.equal(asciiNumber('४,५ / ५'), '4.5 / 5');
  assert.equal(asciiNumber('Berlin, 3'), 'Berlin, 3', 'a comma between words stays');
});

// ── v1.248.2 — robust SCORE parsing (the da regression) ─────────────────────
// A well-formed da report (blocks A–G) was rejected with
// "SCORE_SUMMARY score must be a number between 0 and 5" because its score
// line used a form the strict `SCORE:` regex / bare number parse refused.

const daSummary = (scoreLine) => blocks((L) => `## Block ${L} — x`).replace(/^SCORE:.*$/m, scoreLine);
const scoreOk = (scoreLine) => !validateEvaluationReport(daSummary(scoreLine)).some((i) => i.startsWith('SCORE_SUMMARY score'));

test('v1.248.2: «4,2/5», «4.2 / 5», «**4.2**», «SCORE :» and bold labels all parse as a valid score', () => {
  for (const line of ['SCORE: 4,2/5', 'SCORE : 4,2 / 5', 'SCORE : 4.2', 'SCORE: **4.2**', '**SCORE:** 4.2', '**SCORE:** 4,2/5']) {
    assert.ok(scoreOk(line), `${JSON.stringify(line)} must parse as a valid 0..5 score`);
  }
});

test('v1.248.2: a comma with three trailing digits is thousands — «4,200» must NOT read as 4.2', () => {
  // The old parser turned "4,200" into 4.200 → 4.2 and PASSED the gate.
  assert.equal(asciiNumber('4,200'), '4200');
  assert.equal(asciiNumber('1,234'), '1234');
  assert.ok(!scoreOk('SCORE: 4,200 applicants'), 'thousands are out of the 0..5 range');
  // 1–2 trailing digits stay decimal.
  assert.equal(asciiNumber('4,2/5'), '4.2/5');
  assert.equal(asciiNumber('4,25'), '4.25');
});

test('v1.248.2: an ambiguous comma group is left untouched, not misread as a decimal', () => {
  // The old parser turned "1,2345" into 1.2345; the new one refuses to guess.
  assert.equal(asciiNumber('1,2345'), '1,2345');
  assert.ok(!scoreOk('SCORE: 1,234,567'), 'multi-group thousands stay out of the 0..5 range');
});

test('v1.248.2: a failing score logs ONLY the SCORE line — never other report content', () => {
  const seen = [];
  const origWarn = console.warn;
  console.warn = (...a) => seen.push(a.map(String).join(' '));
  let issues;
  try {
    issues = validateEvaluationReport(daSummary('SCORE: high — see analysis'));
  } finally { console.warn = origWarn; }
  assert.ok(issues.some((i) => i.startsWith('SCORE_SUMMARY score')));
  assert.equal(seen.length, 1, `exactly one log line, got ${seen.length}`);
  assert.match(seen[0], /SCORE line/);
  assert.ok(seen[0].includes('SCORE:'), 'the SCORE line itself is logged');
  // The SUMMARY block's other fields and the report body must not leak.
  for (const leak of ['COMPANY', 'ROLE:', 'ARCHETYPE', 'LEGITIMACY', 'Block A']) {
    assert.ok(!seen[0].includes(leak), `log must not carry "${leak}"`);
  }
});

test('v1.248.2: a valid score logs nothing', () => {
  const seen = [];
  const origWarn = console.warn;
  console.warn = (...a) => seen.push(a.map(String).join(' '));
  try { validateEvaluationReport(daSummary('SCORE : 4,2 / 5')); }
  finally { console.warn = origWarn; }
  assert.deepEqual(seen, [], 'no console output for a well-formed score');
});

