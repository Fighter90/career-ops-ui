/**
 * Opus 5-5 review SECOND pass on CAR-91/92 — eval-validate findings (r2).
 *
 *   H1. LETTER_TERMINATOR's lookbehind only rejects [A-Za-z\u0400-\u04FF], so
 *       `&`, `.` and `/` boundaries pass: `## Q&A` registered A, `## Plan B`
 *       (bare end-of-line) B, `## Ph.D. requirement` D, `## E-commerce` E —
 *       the cutter truncated valid reports at those headings and the validator
 *       false-accepted the letters as present blocks.
 *   H2. A Ukrainian/Russian-numbered report (А Б В Г Д Є Ж) registers only
 *       А→A and В→B (look-alikes), so lettered `### A. Strengths` subsections
 *       out-count the block level and win referenceHeadingLevel — the cutter
 *       (no UKR-sequence awareness) truncated at block Б's `### A.`.
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
let validateEvaluationReport, cutRepeatedBlockHeadings, extractBodyScore;

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
// The Cyrillic look-alikes a translated report writes (А→A, В→B, С→C, Е→E).
const CYR = { A: 'А', B: 'В', C: 'С', E: 'Е' };

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'eval-validate-opus-r2-'));
  mkdirSync(resolve(ROOT, 'config'), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  process.env.CAREER_OPS_ROOT = ROOT;
  ({ validateEvaluationReport, cutRepeatedBlockHeadings, extractBodyScore } =
    await import('../server/lib/eval-validate.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  try { rmSync(ROOT, { recursive: true, force: true }); } catch { /* temp dir */ }
});

// ── H1 — ordinary headings must not register as blocks ──────────────────────

const H1_CASES = [
  ['## Q&A', 'A'],
  ['## Plan B', 'B'],
  ['## Ph.D. requirement', 'D'],
  ['## E-commerce', 'E'],
];

for (const [heading, L] of H1_CASES) {
  test(`H1: «${heading}» does not register Block ${L} — no cut, no false-accept`, () => {
    // (a) appended to a valid report it must not truncate anything
    const valid = goodBlocks() + `\n${heading}\nfrequently asked\n`;
    const r = cutRepeatedBlockHeadings(valid);
    assert.equal(r.cut, false, `valid report truncated at ${r.at} (letter ${r.letter} — «${heading}» counted as ${L})`);
    assert.equal(r.text, valid);
    // (b) it cannot stand in for the missing block
    const text = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].filter((x) => x !== L)
      .map((x) => `## Block ${x} — x`).join('\n') + `\n${heading}\nbody\n` + SUMMARY();
    const issues = validateEvaluationReport(text);
    assert.ok(issues.includes(`missing Block ${L}`),
      `«${heading}» faked Block ${L} — got: ${JSON.stringify(issues)}`);
  });
}

test('H1: real bare-EOL block headings still register (`## Block A`, `## Блок А`)', () => {
  assert.deepEqual(validateEvaluationReport(goodBlocks((L) => `## Block ${L}`)), [],
    'the bare end-of-line form is the base report shape — it must survive');
  assert.deepEqual(validateEvaluationReport(goodBlocks((L) => `## Блок ${CYR[L] || L}`)), [],
    'the translated bare form (Russian Блок) must survive too');
});

// ── H2 — the UKR/RU sequence is the block level for the cutter ───────────────

test('H2: a UKR-numbered report with ### A/B/C subsections is NOT cut at block Б', () => {
  const seq = ['А', 'Б', 'В', 'Г', 'Д', 'Є', 'Ж'];
  const text = seq.map((L, i) => `## ${L}) Блок ${i + 1}\n`
    + '### A. Strengths\npoints\n### B. Gaps\nconcerns\n### C. Verdict\nok\n').join('\n')
    + SUMMARY();
  const r = cutRepeatedBlockHeadings(text);
  assert.equal(r.cut, false,
    `truncated at ${r.at} — the ### subsection letters won the reference level over the UKR ## sequence`);
  assert.equal(r.text, text);
  assert.deepEqual(validateEvaluationReport(text), [], 'the UKR rescue still clears the missing-block issues');
});

test('H2: a genuinely looping UKR-numbered report is still cut at its repeat', () => {
  const seq = ['А', 'Б', 'В', 'Г', 'Д', 'Є', 'Ж'];
  const looping = seq.map((L, i) => `## ${L}) Блок ${i + 1}\nтекст`).join('\n')
    + '\n## А) Блок 1 — повтор\nloop garbage\n' + SUMMARY();
  const r = cutRepeatedBlockHeadings(looping);
  assert.equal(r.cut, true, 'the UKR level override must not disable loop detection at that level');
  assert.equal(r.letter, 'A');
});

// ── M2 — extractBodyScore respects the denominator ──────────────────────────

test('M2: a non-5 denominator is not the 0–5 score — the line is skipped', () => {
  assert.equal(extractBodyScore('**Score:** 4/10'), null, '4 of 10 is not 4 of 5');
  assert.equal(extractBodyScore('Score: 2.5/10'), null);
  assert.equal(extractBodyScore('Score: 85/100'), null, 'a percentage is not the score either');
  assert.equal(extractBodyScore('Score: 4/7'), null, 'a 7-point rubric is not the score');
  assert.equal(extractBodyScore('Score: 9/20'), null);
  assert.equal(extractBodyScore('Score: 4/0'), null, 'a zero denominator never divides');
});

test('M2: a foreign-denominator sub-score no longer beats the header score', () => {
  const md = ['# Evaluation: Acme — Engineer', 'Score: 4/10', 'body', '**Score:** 4.2/5'].join('\n');
  assert.equal(extractBodyScore(md), 4.2, 'the /10 line is skipped; the header /5 line wins');
  const md2 = ['# Evaluation: Acme — Engineer', '**Score:** 4.2/5', 'body', 'Score: 3/10'].join('\n');
  assert.equal(extractBodyScore(md2), 4.2, 'the first usable line still wins');
  assert.equal(extractBodyScore('Score: 4/10'), null, 'a /10-only report has no 0–5 score');
});
