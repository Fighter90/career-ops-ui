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

test('perf: 5k detectCountry calls on cached inputs complete far under the pre-fix cost', () => {
  // FULL-R5 review r2 (finding 11) — wall-clock budgets are a regression
  // tripwire, not a benchmark (loaded CI runners vary). Pre-fix this same
  // loop measured 6673 ms (≈350 RegExps constructed per call); the fix made
  // it sub-millisecond locally. The budget is set an order of magnitude
  // above the observed post-fix cost to stay deterministic on CI while
  // still failing loudly on any re-per-call-compilation regression.
  for (const loc of WARM_INPUTS) C.detectCountry(loc);
  C.resetCache();
  for (const loc of WARM_INPUTS) C.detectCountry(loc);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 5000; i++) {
    C.detectCountry(WARM_INPUTS[i % WARM_INPUTS.length]);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 250, `5000 cached detectCountry calls took ${ms.toFixed(1)} ms (budget 250 ms; pre-fix 6673 ms)`);
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
  // Cold inputs can never be cached; the precompiled tables keep 2k
  // resolutions in bounded time (annotated tripwire, see the cached test).
  assert.ok(ms < 2500, `2000 cold detectCountry calls took ${ms.toFixed(1)} ms (budget 2500 ms)`);
});

test('static: regexes compile ONCE — detectCountry constructs no RegExp per call (spied)', () => {
  // FULL-R5 review r2 (finding 11) — replace the tautological source grep
  // with a real construction-count spy: shadow RegExp inside the module
  // realm and assert the cached hot path never constructs one.
  const src = readFileSync(resolve(ROOT, 'public/js/lib/countries.js'), 'utf8');
  // __RealRegExp is a PARAMETER: inside the realm the hoisted spy shadows
  // the global RegExp binding, so capturing it there would recurse.
  const PREAMBLE = [
    'function RegExp(...args) { __regexCount.n++; return new __RealRegExp(...args); }',
  ].join('\n');
  const w2 = {};
  // eslint-disable-next-line no-new-func
  new Function('window', '__RealRegExp', `${PREAMBLE}\nconst __regexCount = { n: 0 };\n${src}\n;window.__regexCount = __regexCount;`)(w2, RegExp);
  const C2 = w2.Countries;
  const afterLoad = w2.__regexCount.n;
  assert.ok(afterLoad >= 200, `module load must precompile the alias+city tables (got ${afterLoad})`);
  // Warm + hot loop: not a single additional construction.
  for (const loc of WARM_INPUTS) C2.detectCountry(loc);
  C2.resetCache();
  for (const loc of WARM_INPUTS) C2.detectCountry(loc);
  for (let i = 0; i < 5000; i++) C2.detectCountry(WARM_INPUTS[i % WARM_INPUTS.length]);
  // Distinct (uncached) inputs must not construct either — the tables hold
  // every compiled pattern; aliasHit falls back only for unknown aliases.
  for (let i = 0; i < 200; i++) C2.detectCountry(`Office ${i}, Berlin, Germany`);
  assert.equal(w2.__regexCount.n, afterLoad,
    `detectCountry must construct ZERO RegExp at query time (grew to ${w2.__regexCount.n})`);
});

// FULL-R5 review r2 (finding 8) — cached results are frozen: a caller that
// decorates the returned object (count, tag) must not poison every later
// lookup of the same location string.
test('the memo hands out frozen results — caller mutation cannot poison the cache', () => {
  C.resetCache();
  const first = C.detectCountry('Berlin, Germany');
  assert.ok(Object.isFrozen(first), 'cached results must be frozen');
  assert.throws(() => { first.code = 'xx'; }, TypeError,
    'mutation must be impossible (strict mode throws on frozen objects)');
  const second = C.detectCountry('Berlin, Germany');
  assert.equal(second.code, 'de', 'the cached entry is unchanged');
  // Null results are cached and returned as-is.
  assert.equal(C.detectCountry('Remote'), null);
  assert.equal(C.detectCountry('Remote'), null);
});
