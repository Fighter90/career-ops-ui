/**
 * CAR-115 — #/scan filter system rework (successor of the v1.68.0 panel and
 * the v1.55.6/v1.244.2 disclosures).
 *
 * The ONE filter system is now a live chip bar: a search input (with inline
 * "-word" exclusions), popover chips for Work type / Salary / Source /
 * Country / Seniority / Freshness / More, saved searches as preset chips and
 * inline facet chips above the table. There is NO Apply button (acceptance:
 * filtering applies as you type/select — text debounced 250 ms, selects
 * immediately, Enter at once) and no "Advanced filters" disclosure.
 *
 * scan.js is browser-only → asserted statically via the concatenated
 * scan-view source (tests/helpers/scan-src.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAppCss } from './helpers/css.mjs';
import { loadScanSrc } from './helpers/scan-src.mjs';

const SCAN = loadScanSrc();
const CSS = loadAppCss();
const SCAN_RESULTS_SRC = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'js', 'lib', 'scan-results.js'),
  'utf8');

test('the live filter bar exists (one system, role=group, localized label)', () => {
  assert.match(SCAN, /className: 'v2-scan-bar'/, 'scan.js must build the .v2-scan-bar');
  assert.match(SCAN, /'aria-label': t\('scan\.filtersGroup', 'Result filters'\)/,
    'the bar keeps the localized group label');
  // The old two-system furniture is gone for good. (The bare-name pattern
  // must not match the `scan-filters__*` BEM children.)
  assert.doesNotMatch(SCAN, /id:\s*'scan-apply'/, 'no Apply button (live filtering)');
  assert.doesNotMatch(SCAN, /'scan-filters'(?![_\w-])/, 'no .scan-filters mega-panel');
  assert.doesNotMatch(SCAN, /'scan-filters__saved'/, 'no saved-searches sub-card');
});

test('every popover control is a labelled field() (label-above-control, a11y)', () => {
  assert.match(SCAN, /const field =/, 'a field() helper must exist');
  assert.match(SCAN, /c\('label', \{ className: 'field scan-field' \}/,
    'field() must wrap the control in a <label class="field scan-field">');
  for (const ctrl of ['filterRemote', 'filterSalaryMin', 'filterSalaryMax', 'filterSource', 'filterScope']) {
    assert.match(SCAN, new RegExp(`field\\(t\\('scan\\.[A-Za-z]+'[^)]*\\),\\s*${ctrl}\\)`),
      `${ctrl} must be wrapped in a labelled field()`);
  }
});

test('salary inputs carry no in-field placeholder (label is above)', () => {
  assert.doesNotMatch(SCAN, /placeholder: t\('scan\.salary(From|To)'/,
    'salary labels must be above the field, not a placeholder');
});

test('filters apply LIVE: 250 ms debounce on text, immediate on change, Enter now', () => {
  // The funnel cancels a pending debounce first (review r2: Enter during
  // the 250 ms window = one render, not two; the route teardown cancels too).
  assert.match(SCAN, /function commit\(\)\s*\{\s*if \(commitTimer\) \{ clearTimeout\(commitTimer\); commitTimer = null; \}\s*filtersApi\.commitFilters\(\);\s*syncFilterBar\(\);\s*\}/,
    'the single live-apply funnel');
  assert.match(SCAN, /commitTimer = setTimeout\(\(\) => \{ commitTimer = null; commit\(\); \}, 250\)/,
    'text inputs debounce at 250 ms');
  assert.match(SCAN, /el\.addEventListener\('input', \(\) => commitDebounced\(\)\)/,
    'text/number inputs apply on input');
  assert.match(SCAN, /if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); commit\(\); \}/,
    'Enter applies immediately (keyboard parity)');
  assert.match(SCAN, /el\.addEventListener\('change', \(\) => \{/, 'selects apply on change');
  // The old "no live re-render" guard is inverted by CAR-115 — the specific
  // wiring the v1.68.0 test banned must stay absent, but live input applies.
  assert.doesNotMatch(SCAN, /\[filterText, filterRemote, filterSalaryMin, filterSalaryMax, filterSource, filterScope\]\.forEach\(\(el\) => el\.addEventListener\('input'/,
    'the old all-fields live wiring is not back');
});

test('a Reset affordance exists (bar button + active-bar Reset all)', () => {
  assert.match(SCAN, /t\('scan\.resetFilters'/, 'Reset via scan.resetFilters');
  assert.match(SCAN, /t\('scan\.v2\.resetAll', 'Reset all'\)/, 'active-bar Reset all chip');
});

test('the search box takes inline "-word" exclusions', () => {
  assert.match(SCAN_RESULTS_SRC, /s\.startsWith\('-'\)/,
    'the predicate splits leading-dash tokens into exclusions');
});

test('salary range is applied strictly via window.Skills.salaryInRange', () => {
  assert.match(SCAN, /window\.Skills\.salaryInRange\(r, /,
    'the result predicate must gate rows through salaryInRange');
});

test('facet chips render inline (no Advanced disclosure) and keep their a11y wiring', () => {
  assert.match(SCAN, /v2-scan-facets/, 'the inline facet chip container');
  assert.doesNotMatch(SCAN, /details\.scan-advanced/, 'the disclosure is gone');
  assert.doesNotMatch(SCAN, /chipsContainer = c\('details'/, 'no <details> cluster');
  // keyboard-operable chips (the scan-chip-a11y suite re-checks the builder)
  assert.match(SCAN, /role: 'button'/, 'chips keep button semantics');
});

test('filter-bar + facet CSS exist (v2 additions live in app.css)', () => {
  assert.match(CSS, /\.v2-scan-bar\b/, '.v2-scan-bar layout CSS must exist');
  assert.match(CSS, /\.v2-scan-pop\b/, '.v2-scan-pop popover CSS must exist');
  assert.match(CSS, /\.v2-scan-active\b/, '.v2-scan-active chip CSS must exist');
  assert.match(CSS, /\.v2-scan-presets\b/, '.v2-scan-presets CSS must exist');
  assert.match(CSS, /\.v2-scan-facets\b/, '.v2-scan-facets CSS must exist');
  // CAR-115 review: the legacy .scan-filters / .scan-advanced rules are DEAD
  // (no view renders those classes any more). The rules live in
  // components.css — outside this change's file ownership — so the old
  // "must exist" assertions are dropped and the removal itself is a
  // hand-off to a components.css owner.
});
