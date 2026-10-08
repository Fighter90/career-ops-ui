/**
 * Unit tests for the #/scan salary range filter helpers on window.Skills:
 *   - parseSalaryRange(str) -> { min, max } | null
 *   - salaryInRange(row, min, max) -> boolean
 *
 * Loaded the same way as tests/skills.test.mjs: the browser IIFE is run under a
 * synthetic globalThis.window so it attaches window.Skills, then exercised from
 * Node's test runner. Salary strings mirror the real per-source formats:
 *   trudvsem  "от 100000 до 200000 RUB"
 *   hh / habr "100 000 – 200 000 ₽"  (regular + non-breaking spaces)
 *   geekjob   "100000 — 200000 ₽"
 *   lever     "120000-150000 USD"
 *   ashby     "$120K – $150K"
 *   most ATS  "" (greenhouse / workable / workday / smartrecruiters / rss)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, '..', 'public', 'js', 'lib', 'skills.js'),
  'utf8'
);
globalThis.window = {};
new Function(SRC)();
const Skills = globalThis.window.Skills;

// ───────────────────────── parseSalaryRange ─────────────────────────

test('parseSalaryRange: trudvsem "от … до … RUB"', () => {
  assert.deepEqual(Skills.parseSalaryRange('от 100000 до 200000 RUB'), { min: 100000, max: 200000 });
});

test('parseSalaryRange: single-bound "от N" → min=max=N', () => {
  assert.deepEqual(Skills.parseSalaryRange('от 150000 RUB'), { min: 150000, max: 150000 });
  assert.deepEqual(Skills.parseSalaryRange('до 300000 RUB'), { min: 300000, max: 300000 });
});

test('parseSalaryRange: spaced thousands incl. non-breaking spaces (hh/habr)', () => {
  assert.deepEqual(Skills.parseSalaryRange('100 000 – 200 000 ₽'), { min: 100000, max: 200000 });
  assert.deepEqual(Skills.parseSalaryRange('от 90 000 ₽'), { min: 90000, max: 90000 });
});

test('parseSalaryRange: lever "min-max USD"', () => {
  assert.deepEqual(Skills.parseSalaryRange('120000-150000 USD'), { min: 120000, max: 150000 });
});

test('parseSalaryRange: comma thousands "$120,000 - $150,000"', () => {
  assert.deepEqual(Skills.parseSalaryRange('$120,000 - $150,000'), { min: 120000, max: 150000 });
});

test('parseSalaryRange: K suffix "$120K – $150K" → ×1000', () => {
  assert.deepEqual(Skills.parseSalaryRange('$120K – $150K'), { min: 120000, max: 150000 });
});

// v1.243.0 — decimals, cents and currency words used to be mangled by the
// digits-only tokenizer ("$182.9K" folded into 1829000, "$85,000.00" ×100,
// "kr" read as a K-suffix). The shared parser (window.Skills.parseAmounts)
// fixes all three.

test('parseSalaryRange: decimal K "$182.9K - $240K" → 182900..240000', () => {
  assert.deepEqual(Skills.parseSalaryRange('$182.9K - $240K'), { min: 182900, max: 240000 });
});

test('parseSalaryRange: cents "$85,000.00" → 85000 (not ×100)', () => {
  assert.deepEqual(Skills.parseSalaryRange('$85,000.00'), { min: 85000, max: 85000 });
});

test('parseSalaryRange: Swedish krona "100 000 kr" → 100000 (not ×1000)', () => {
  assert.deepEqual(Skills.parseSalaryRange('100 000 kr'), { min: 100000, max: 100000 });
  assert.deepEqual(Skills.parseSalaryRange('450 000 kr/mån'), { min: 450000, max: 450000 });
});

test('parseSalaryRange: million suffix "€1.5M – €2M"', () => {
  assert.deepEqual(Skills.parseSalaryRange('€1.5M – €2M'), { min: 1500000, max: 2000000 });
});

test('parseSalaryRange: de-DE grouping "80.000 - 100.000 €"', () => {
  assert.deepEqual(Skills.parseSalaryRange('80.000 - 100.000 €'), { min: 80000, max: 100000 });
});

test('parseSalaryRange: empty / unparseable → null', () => {
  assert.equal(Skills.parseSalaryRange(''), null);
  assert.equal(Skills.parseSalaryRange(null), null);
  assert.equal(Skills.parseSalaryRange('Competitive'), null);
});

// ───────────────────────── salaryInRange ─────────────────────────

const row = (salary) => ({ salary });

test('salaryInRange: no bounds set → always true', () => {
  assert.equal(Skills.salaryInRange(row('100000-200000 ₽'), null, null), true);
  assert.equal(Skills.salaryInRange(row(''), NaN, NaN), true);
});

test('salaryInRange: no bounds set keeps rows that have no salary too', () => {
  assert.equal(Skills.salaryInRange(row(''), null, null), true);
  assert.equal(Skills.salaryInRange(row('Competitive'), NaN, NaN), true);
});

test('salaryInRange: rows without a listed salary are HIDDEN once a bound is set (v1.68.0)', () => {
  assert.equal(Skills.salaryInRange(row(''), 150000, null), false);
  assert.equal(Skills.salaryInRange(row('Competitive'), null, 300000), false);
  assert.equal(Skills.salaryInRange(row(''), 100000, 300000), false);
});

test('salaryInRange: min bound matches against the upper end', () => {
  assert.equal(Skills.salaryInRange(row('100000-200000 ₽'), 150000, null), true);  // 200k ≥ 150k
  assert.equal(Skills.salaryInRange(row('от 80000 ₽'), 150000, null), false);      // 80k < 150k
});

test('salaryInRange: max bound matches against the lower end', () => {
  assert.equal(Skills.salaryInRange(row('200000-400000 ₽'), null, 300000), true);  // 200k ≤ 300k
  assert.equal(Skills.salaryInRange(row('от 500000 ₽'), null, 300000), false);     // 500k > 300k
});

test('salaryInRange: combined от/до = overlapping-range semantics', () => {
  assert.equal(Skills.salaryInRange(row('100000-200000 ₽'), 150000, 300000), true);
  assert.equal(Skills.salaryInRange(row('310000-450000 ₽'), 150000, 300000), false); // above ceiling
  assert.equal(Skills.salaryInRange(row('50000-120000 ₽'), 150000, 300000), false);  // below floor
});
