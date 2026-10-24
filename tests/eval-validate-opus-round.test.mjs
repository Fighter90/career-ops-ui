/**
 * Opus 5-5 review round on CAR-91/92 — eval-validate findings.
 *
 *   R1. scanBlockLetterHeadings ran one regex per letter, so ONE heading could
 *       register SEVERAL letters: «## G) Interview Q&A» also registered the
 *       trailing A, «## D) Plan B» the B, «## F) Red Flags (Grade: D)» the D —
 *       the cutter truncated at the wrong heading and the validator read
 *       «Plan B» as a present Block B. Only the EARLIEST letter of a heading
 *       counts.
 *   R2. LETTER_TERMINATOR / SPELLED_TERMINATOR false-rejected real headings:
 *       `**Block A** — x`, `[A] x`, `A）x`, `A、x`, `ブロックA 役割`, CRLF
 *       output (`\r` before the newline), and the spelled forms `أ: x` /
 *       `ए. x`.
 *   R4. referenceHeadingLevel picked the MOST COMMON level, so recurring
 *       `### A. Strengths` subsections (14 × `###` vs 7 × `##`) made `###`
 *       the reference and reported C–G missing.
 *   R5. The gemini-eval.mjs subprocess path needs a whole-report score
 *       fallback (extractBodyScore) for reports with no ---SCORE_SUMMARY---
 *       block (the deployed parent's copy predates the summary prompt).
 *
 * CI-isolated: pure modules, dynamic import inside before(), CAREER_OPS_ROOT
 * is a throwaway dir with cv.md. No network, no server.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let ROOT;
let validateEvaluationReport, cutRepeatedBlockHeadings, extractSummaryScore, extractBodyScore;

const SUMMARY = (score = '4.2', legitimacy = 'High Confidence') => `
---SCORE_SUMMARY---
COMPANY: Acme
ROLE: Engineer
SCORE: ${score}
ARCHETYPE: Platform
LEGITIMACY: ${legitimacy}
---END_SUMMARY---
`;
const goodBlocks = (fmt = (L) => `## Block ${L} — x`) =>
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(fmt).join('\nbody\n') + '\n' + SUMMARY();

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'eval-validate-opus-'));
  mkdirSync(resolve(ROOT, 'config'), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  process.env.CAREER_OPS_ROOT = ROOT;
  ({ validateEvaluationReport, cutRepeatedBlockHeadings, extractSummaryScore, extractBodyScore } =
    await import('../server/lib/eval-validate.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  try { rmSync(ROOT, { recursive: true, force: true }); } catch { /* temp dir */ }
});

// ── R1 — one heading, one letter (the earliest) ──────────────────────────────

test('R1: «## G) Interview Q&A» does not also register A — the report is NOT cut', () => {
  const text = goodBlocks((L) => (L === 'G' ? '## G) Interview Q&A' : `## Block ${L} — x`));
  const r = cutRepeatedBlockHeadings(text);
  assert.equal(r.cut, false, `valid report truncated at ${r.at} (letter ${r.letter} — the A inside «Q&A» counted)`);
  assert.equal(r.text, text);
  assert.deepEqual(validateEvaluationReport(text), [], 'the full report still validates clean');
});

test('R1: «## D) Plan B» does not satisfy a missing Block B', () => {
  // All blocks EXCEPT B; the D heading carries the words «Plan B».
  const text = ['A', 'C', 'D', 'E', 'F', 'G'].map((L) => (L === 'D' ? '## D) Plan B' : `## Block ${L} — x`)).join('\nbody\n')
    + '\n' + SUMMARY();
  const issues = validateEvaluationReport(text);
  assert.ok(issues.includes('missing Block B'), `«Plan B» must not fake Block B — got: ${JSON.stringify(issues)}`);
});

test('R1: «## D) Plan B» as the D heading does not repeat B — no cut', () => {
  const text = goodBlocks((L) => (L === 'D' ? '## D) Plan B' : `## Block ${L} — x`));
  const r = cutRepeatedBlockHeadings(text);
  assert.equal(r.cut, false, `cut at ${r.at} (letter ${r.letter}) — «Plan B» counted as a B repeat`);
  assert.equal(r.text, text);
});

test('R1: «## F) Red Flags (Grade: D)» does not repeat D — no cut', () => {
  const text = goodBlocks((L) => (L === 'F' ? '## F) Red Flags (Grade: D)' : `## Block ${L} — x`));
  const r = cutRepeatedBlockHeadings(text);
  assert.equal(r.cut, false, `cut at ${r.at} (letter ${r.letter}) — the graded D counted as a D repeat`);
  assert.equal(r.text, text);
});

test('R1: a genuinely looping «## G) Interview Q&A» is still cut at its repeat', () => {
  const looping = [
    '## G) Interview Q&A', 'first pass',
    ...['A', 'B', 'C', 'D', 'E', 'F'].map((L) => `## Block ${L} — x`),
    '## G) Interview Q&A', 'loop garbage', SUMMARY(),
  ].join('\n');
  const r = cutRepeatedBlockHeadings(looping);
  assert.equal(r.cut, true);
  assert.equal(r.letter, 'G', 'the repeat must be read as G, not as the stray A inside the heading');
  assert.ok(r.at > 0 && r.at < looping.length);
});

// ── R2 — terminator false-rejects ────────────────────────────────────────────

test('R2: `## **Block A** — x` (bold heading) counts as Block A', () => {
  const text = goodBlocks((L) => (L === 'A' ? '## **Block A** — Overview' : `## Block ${L} — x`));
  assert.deepEqual(validateEvaluationReport(text), []);
});

test('R2: `## [A] x` (bracketed letter) counts as Block A', () => {
  const text = goodBlocks((L) => (L === 'A' ? '## [A] Context' : `## Block ${L} — x`));
  assert.deepEqual(validateEvaluationReport(text), []);
});

test('R2: `## A）x` (fullwidth paren) counts as Block A', () => {
  const text = goodBlocks((L) => (L === 'A' ? '## A）Контекст' : `## Block ${L} — x`));
  assert.deepEqual(validateEvaluationReport(text), []);
});

test('R2: `## A、x` (CJK enumerator comma) counts as Block A', () => {
  const text = goodBlocks((L) => (L === 'A' ? '## A、状況' : `## Block ${L} — x`));
  assert.deepEqual(validateEvaluationReport(text), []);
});

test('R2: `## ブロックA 役割` (CJK compound word) counts as Block A', () => {
  const text = goodBlocks((L) => (L === 'A' ? '## ブロックA 役割' : `## Block ${L} — x`));
  assert.deepEqual(validateEvaluationReport(text), []);
});

test('R2: CRLF output (`## Block A\\r\\n`) still counts — the \\r must not break the line-end terminator', () => {
  const text = goodBlocks().split('\n').join('\r\n');
  assert.deepEqual(validateEvaluationReport(text), [], 'a CRLF report must validate like the same LF report');
});

test('R2: spelled letters accept `:` and `.` separators (`## أ: x`, `## ए. x`)', () => {
  const ar = goodBlocks((L) => {
    const abjad = { A: 'أ', B: 'ب', C: 'ج', D: 'د', E: 'هـ', F: 'و', G: 'ز' };
    return L === 'A' ? `## ${abjad[L]}: القسم` : `## ${abjad[L]} — القسم`;
  });
  assert.deepEqual(validateEvaluationReport(ar), [], 'Arabic abjad A with a colon separator');
  const hi = goodBlocks((L) => {
    const dev = { A: 'ए', B: 'बी', C: 'सी', D: 'डी', E: 'ई', F: 'एफ़', G: 'जी' };
    return L === 'A' ? `## ${dev[L]}. खंड` : `## ${dev[L]}) खंड`;
  });
  assert.deepEqual(validateEvaluationReport(hi), [], 'Devanagari A with a dot separator');
});

// ── R4 — reference level = most distinct letters, ties to the shallowest ─────

test('R4: recurring `### A. Strengths` subsections do not make ### the block level', () => {
  const base = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => `## Block ${L} — x\nbody`).join('\n');
  const subSections = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    .map((L) => `### A. Strengths\npoints\n### B. Gaps\nconcerns`).join('\n');
  const text = `${base}\n${subSections}\n${SUMMARY()}`;
  const r = cutRepeatedBlockHeadings(text);
  assert.equal(r.cut, false, 'repeating SUBHEADINGS are not repeating blocks');
  assert.deepEqual(validateEvaluationReport(text), [], 'the seven ## blocks must not read as missing');
});

// ── R5 — the whole-report score fallback (gemini-eval.mjs subprocess path) ───

test('R5: extractBodyScore reads the parent header form «**Score:** 4.2/5»', () => {
  const md = ['# Evaluation: Acme — Engineer', '', '**Date:** 2026-10-24', '**Score:** 4.2/5', 'body'].join('\n');
  assert.equal(extractBodyScore(md), 4.2);
});

test('R5: extractBodyScore reads a plain «Score: x/5» line, localized digits included', () => {
  assert.equal(extractBodyScore('## Verdict\nScore: 3/5\nend'), 3);
  assert.equal(extractBodyScore('## Verdict\nScore: 3,8/5\nend'), 3.8, 'decimal comma folds through asciiNumber');
  assert.equal(extractBodyScore('Score: ٤٫٢/5'), 4.2, 'Arabic-Indic digits');
});

test('R5: extractBodyScore stays null without a usable score or outside 0–5', () => {
  assert.equal(extractBodyScore('no score anywhere'), null);
  assert.equal(extractBodyScore(''), null);
  assert.equal(extractBodyScore('score: 9.9'), null, 'the 0–5 gate holds');
  assert.equal(extractBodyScore('the scorecard: 4 points'), null, 'a word containing «score» is not a score line');
});

test('R5: extractSummaryScore (the shared parser) is untouched by the fallback', () => {
  assert.equal(extractSummaryScore('# report\n**Score:** 4.2/5'), null, 'no summary block → still null');
});
