/**
 * CAR-92 — LLM-layer review findings 7–11: validation false-accepts /
 * false-rejects and the extractor/validator disagreement.
 *
 *   7.  cutRepeatedBlockHeadings destroyed valid reports (a `### Option A`
 *       subheading "repeated" Block A) and the validator's latin regex
 *       false-accepted the same subheadings as block letters.
 *   8.  extractScore disagreed with the validator (localized decimals,
 *       native digits, first `score:` anywhere vs the SCORE_SUMMARY block).
 *   9.  extractLegitimacy missed its own prompt enum
 *       (`High Confidence | Proceed with Caution | Suspicious`).
 *   10. The Ukrainian ordinal sequence was fed the first character of ANY
 *       heading word (`Анализ`/`Бюджет`… cleared A–D), and its Є-only tail
 *       false-rejected Russian-tail (Е Ж) reports.
 *   11. The Arabic abjad F letter «و» ("and") as a standalone word satisfied
 *       Block F in any heading (`## تحليل و تطوير`).
 *
 * CI-isolated: pure modules, dynamic import inside before(), CAREER_OPS_ROOT
 * is a throwaway dir with cv.md (paths.mjs loads once per process). No
 * network, no server.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let ROOT;
let validateEvaluationReport, cutRepeatedBlockHeadings, extractSummaryScore;
let extractScore, extractLegitimacy;

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
  ROOT = mkdtempSync(resolve(tmpdir(), 'eval-validate-car92-'));
  mkdirSync(resolve(ROOT, 'config'), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  process.env.CAREER_OPS_ROOT = ROOT;
  ({ validateEvaluationReport, cutRepeatedBlockHeadings, extractSummaryScore } =
    await import('../server/lib/eval-validate.mjs'));
  ({ extractScore, extractLegitimacy } = await import('../server/lib/routes/auto-pipeline.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  try { rmSync(ROOT, { recursive: true, force: true }); } catch { /* temp dir */ }
});

// ── Finding 7 — the level filter: subheadings never count ───────────────────

test('CAR-92.7: a report with a repeated `### Option A` subheading (distinct content) is NOT cut', () => {
  const text = goodBlocks() + '\n### Option A\nPrefer the hybrid role.\n### Option B\nWait for the offer.\n';
  const r = cutRepeatedBlockHeadings(text);
  assert.equal(r.cut, false, `valid report destroyed at ${r.at} (letter ${r.letter})`);
  assert.equal(r.text, text);
});

test('CAR-92.7: `### Q&A`, `### Plan B` and `### A1` subheadings neither cut nor satisfy blocks', () => {
  const subheads = '### Q&A\nfaq\n### Plan B\nfallback\n### A1\nappendix\n';
  // Cutter: the subheadings never destroy a valid report.
  const valid = goodBlocks() + subheads;
  assert.equal(cutRepeatedBlockHeadings(valid).cut, false);
  // Validator: a report whose Block A exists only as a `### Option A`
  // SUBHEADING (below the report's `##` block level) is missing Block A —
  // the false-accept the review called out.
  const fakeA = '### Option A\nso-called block A\n'
    + ['B', 'C', 'D', 'E', 'F', 'G'].map((L) => `## Block ${L} — x`).join('\n') + '\n' + SUMMARY();
  const issues = validateEvaluationReport(fakeA);
  assert.ok(issues.includes('missing Block A'),
    'a subheading with a trailing letter must not count as a block heading');
});

test('CAR-92.7: same-level repeated block headings are still cut (looping detection kept)', () => {
  // A genuinely looping report: Block B repeats before D–G are ever written.
  const looping = ['## Block A — x\nok', '## Block B — first\nok', '## Block C — x\nok',
    '## Block B — repeated', 'loop garbage', SUMMARY()].join('\n');
  const r = cutRepeatedBlockHeadings(looping);
  assert.equal(r.cut, true);
  assert.equal(r.letter, 'B');
  assert.ok(r.at > 0 && r.at < looping.length);
  // The cut prefix is exactly what validation then judges (missing D–G).
  assert.ok(validateEvaluationReport(r.text).some((i) => i.startsWith('missing Block')));
});

test('CAR-92.7: a valid A–G report (all seven blocks, H2) still validates clean', () => {
  assert.deepEqual(validateEvaluationReport(goodBlocks()), []);
});

// ── Finding 8 — one score parser, summary block only ────────────────────────

test('CAR-92.8: localized decimal comma «4,2» extracts as 4.2 (validator agreement)', () => {
  const md = goodBlocks().replace(/^SCORE:.*$/m, 'SCORE: 4,2');
  assert.deepEqual(validateEvaluationReport(md), []);
  assert.equal(extractSummaryScore(md), 4.2);
  assert.equal(extractScore(md), 4.2, 'extractScore must agree with the validator');
});

test('CAR-92.8: native digits «٤٫٢» / «४.२» extract (no false reject for ar/hi)', () => {
  assert.equal(extractSummaryScore(goodBlocks().replace(/^SCORE:.*$/m, 'SCORE: ٤٫٢')), 4.2);
  assert.equal(extractScore(goodBlocks().replace(/^SCORE:.*$/m, 'SCORE: ४.२')), 4.2);
});

test('CAR-92.8: a sub-score in Block B prose does not win over the SCORE_SUMMARY score', () => {
  const md = goodBlocks().replace('## Block B — x\nbody', '## Block B — x\n...salary score: 4/5 in the JD rubric...')
    .replace(/^SCORE:.*$/m, 'SCORE: 3.1');
  assert.equal(extractSummaryScore(md), 3.1);
  assert.equal(extractScore(md), 3.1);
});

test('CAR-92.8: out-of-range / absent scores stay null', () => {
  assert.equal(extractSummaryScore(goodBlocks().replace(/^SCORE:.*$/m, 'SCORE: 9.9')), null);
  assert.equal(extractSummaryScore(goodBlocks().replace(/^SCORE:.*$/m, 'SCORE: 4,200 applicants')), null);
  assert.equal(extractSummaryScore('no summary here'), null);
});

// ── Finding 9 — the legitimacy enum ─────────────────────────────────────────

test('CAR-92.9: all three prompt tiers extract verbatim from the summary block', () => {
  for (const tier of ['High Confidence', 'Proceed with Caution', 'Suspicious']) {
    assert.equal(extractLegitimacy(goodBlocks().replace(/^LEGITIMACY:.*$/m, `LEGITIMACY: ${tier}`)), tier, tier);
  }
});

test('CAR-92.9: a `legitimacy:` mention in Block F prose does not win over the summary', () => {
  const md = goodBlocks().replace('## Block F — x\nbody', '## Block F — x\nlegitimacy: medium per the heuristic\n')
    .replace(/^LEGITIMACY:.*$/m, 'LEGITIMACY: Suspicious');
  assert.equal(extractLegitimacy(md), 'Suspicious');
});

test('CAR-92.9: a missing summary yields no tier', () => {
  assert.equal(extractLegitimacy('no summary'), '');
  assert.equal(extractLegitimacy(''), '');
});

// ── Finding 10 — the Ukrainian ordinal sequence ─────────────────────────────

test('CAR-92.10: Russian word-initial headings (Анализ/Бюджет/…) do NOT clear blocks A–D', () => {
  const ru = ['Анализ', 'Бюджет', 'Выводы', 'Гибкость', 'Ещё', 'Жалобы', 'Заголовок']
    .map((w) => `## ${w}\nтекст`).join('\n') + SUMMARY();
  const issues = validateEvaluationReport(ru);
  assert.ok(issues.some((i) => i.startsWith('missing Block A')), 'А in «Анализ» is glued to a word, not a block letter');
});

test('CAR-92.10: standalone Ukrainian ordinals А Б В Г Д Є Ж still validate in sequence', () => {
  const uk = ['А', 'Б', 'В', 'Г', 'Д', 'Є', 'Ж'].map((L, i) => `## ${L}) Раздел ${i + 1}`).join('\n')
    + SUMMARY();
  assert.deepEqual(validateEvaluationReport(uk), []);
});

test('CAR-92.10: the Russian-tail sequence А Б В Г Д Е Ж is accepted too', () => {
  const ru = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж'].map((L, i) => `## ${L}) Раздел ${i + 1}`).join('\n')
    + SUMMARY();
  assert.deepEqual(validateEvaluationReport(ru), []);
});

test('CAR-92.10: an out-of-sequence fragment (А, Б, Ж only) is not a uk numbering', () => {
  const partial = ['## А) Один', '## Б) Два', '## Ж) Семь'].join('\n') + SUMMARY();
  assert.ok(validateEvaluationReport(partial).some((i) => i.startsWith('missing Block')));
});

// ── Finding 11 — the Arabic «و» ─────────────────────────────────────────────

test('CAR-92.11: «و» inside a heading (…و …) does not satisfy Block F', () => {
  // «و» is the Arabic word "and" — a heading like «تحليل و تطوير» must not
  // be read as block F. The six other blocks are real.
  const ar = ['أ', 'ب', 'ج', 'د', 'هـ'].map((L, i) => `## القسم ${L} — عدد ${i + 1}`).join('\n') + '\n'
    + '## تحليل و تطوير\nنص\n## ز) الخاتمة\n'
    + SUMMARY();
  const issues = validateEvaluationReport(ar);
  assert.ok(issues.includes('missing Block F'), '«و» as the conjunction must not count');
});

test('CAR-92.11: abjad letters in the skeleton forms still count (و — title, و) title)', () => {
  const abjad = { A: 'أ', B: 'ب', C: 'ج', D: 'د', E: 'هـ', F: 'و', G: 'ز' };
  assert.deepEqual(validateEvaluationReport(goodBlocks((L) => `## الكتلة ${abjad[L]} — القسم`)), []);
  assert.deepEqual(validateEvaluationReport(goodBlocks((L) => `## ${abjad[L]}) القسم`)), []);
});

test('CAR-92.11: other abjad letters glued inside words still do not count', () => {
  const issues = validateEvaluationReport('## ملخص الدور\n## تحليل السيرة\n## المخاطر\n## التعويض\n## الاستراتيجية\n## الحكم\n## الشرعية\n' + SUMMARY());
  assert.equal(issues.filter((i) => i.startsWith('missing Block')).length, 7);
});
