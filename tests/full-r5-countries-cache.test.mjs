/**
 * FULL-R5 (review 4) — countries.js compiles its alias/city regexes once at
 * module load and memoizes detectCountry by input string.
 *
 * Pre-fix every detectCountry call constructed ~200 alias RegExps plus ~150
 * city RegExps; it runs several times per row on every SR.render()
 * (countriesIn, rowInCountry, splitTitleCountry's isPlace, FitScore,
 * RoleStats) — a chip toggle on a 5k-row scan compiled millions of regexes.
 *
 * Contract:
 *   • `window.Countries.resetCache()` exists and clears the memo (the scan
 *     view calls it when lastResults changes);
 *   • 5k detectCountry calls over warm cached inputs complete in < 50 ms;
 *   • detection results are byte-identical to the uncached contract
 *     (spot-checked, plus the whole pre-existing countries suite).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
// eslint-disable-next-line no-new-func
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/countries.js'), 'utf8'))(w);
const C = w.Countries;

const WARM_INPUTS = [
  'Berlin, Germany', 'London', 'New York, NY, USA', 'Remote', 'Москва, Россия',
  'San Francisco, CA', 'Amsterdam', 'Tokyo', 'Hangzhou', 'New South Wales',
  'Toronto, ON', 'singapore', 'Hyderabad, India', 'Lisbon, Portugal', 'Dublin',
];

test('resetCache is exposed for the scan view to call when lastResults changes', () => {
  assert.equal(typeof C.resetCache, 'function', 'window.Countries.resetCache must exist');
  // It must not change results.
  const before = C.detectCountry('Berlin, Germany');
  C.resetCache();
  const after = C.detectCountry('Berlin, Germany');
  assert.deepEqual(after, before);
});

test('memoization does not alter detection results', () => {
  assert.equal(C.detectCountry('Berlin, Germany').code, 'de');
  assert.equal(C.detectCountry('London').code, 'gb');
  assert.equal(C.detectCountry('Москва, Россия').code, 'ru');
  assert.equal(C.detectCountry('Remote'), null);
  assert.equal(C.detectCountry('Minsk, Belarus'), null);
  assert.equal(C.detectCountry('New South Wales'), null);
  assert.equal(C.detectCountry('Paducah'), null);
  assert.equal(C.detectCountry(''), null);
  assert.equal(C.detectCountry(null), null);
  assert.equal(C.detectCountry(undefined), null);
  assert.equal(C.detectCountry(42), null);
  // Non-string inputs are not cached into wrong answers.
  assert.equal(C.detectCountry('Berlin, Germany').code, 'de');
});

test('perf: 5k detectCountry calls on cached inputs complete in < 50 ms after warmup', () => {
  // Warm the cache.
  for (const loc of WARM_INPUTS) C.detectCountry(loc);
  C.resetCache();
  for (const loc of WARM_INPUTS) C.detectCountry(loc);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 5000; i++) {
    C.detectCountry(WARM_INPUTS[i % WARM_INPUTS.length]);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 50, `5000 cached detectCountry calls took ${ms.toFixed(1)} ms (budget 50 ms)`);
});

test('perf: the uncached path stays correct at scale (distinct inputs still resolve)', () => {
  C.resetCache();
  const t0 = process.hrtime.bigint();
  let hits = 0;
  for (let i = 0; i < 2000; i++) {
    const c = C.detectCountry(`Office ${i}, Berlin, Germany`);
    if (c && c.code === 'de') hits++;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(hits, 2000, 'every distinct input still resolves');
  // Distinct inputs can never be cached, but the precompiled regexes should
  // keep 2k cold resolutions well under a second (was ~2 Regexps × 350
  // aliases/cities PER CALL before — tens of ms for these 2k alone).
  assert.ok(ms < 1000, `2000 cold detectCountry calls took ${ms.toFixed(1)} ms`);
});

test('static: regexes are compiled once at module load, not per call', () => {
  const src = readFileSync(resolve(ROOT, 'public/js/lib/countries.js'), 'utf8');
  assert.ok(!/new RegExp\([^)]*\)\.test\(haystack\)/.test(src),
    'aliasHit must not construct a RegExp per call');
  assert.ok(/ALIAS_RES|ALIAS_RES\s*=/i.test(src) || /PRECOMPUTED|COMPILED/i.test(src),
    'the module must keep a precompiled alias-pattern table');
});
