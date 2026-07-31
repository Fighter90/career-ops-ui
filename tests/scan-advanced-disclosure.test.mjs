/**
 * v1.68.0 — #/scan filter panel rework. The v1.55.6 "Advanced filters"
 * <details> disclosure that hid Scope/Source was reversed by user request:
 * every result filter is now a labelled `.field` (label ABOVE the control),
 * laid out in one `.scan-filters` panel with an explicit **Apply** + **Reset**
 * and an on-page usage hint. The salary range is strict — once a bound is set,
 * jobs with no listed salary are hidden (window.Skills.salaryInRange).
 *
 * The post-scan facet-chip cluster (stack/level/keyword) stays a collapsible
 * <details> (scan-advanced) — that's a separate refinement, not a filter box.
 *
 * scan.js is browser-only → asserted statically.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAppCss } from './helpers/css.mjs';

const __d = dirname(fileURLToPath(import.meta.url));
const SCAN = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'scan.js'), 'utf8');
const CSS = loadAppCss();

test('a labelled .scan-filters panel exists (label-above-field, a11y-associated)', () => {
  assert.match(SCAN, /className: 'scan-filters'/, 'scan.js must build a .scan-filters panel');
  assert.match(SCAN, /const field =/, 'a field() helper must exist');
  // field() WRAPS the control in a <label> (implicit association → the control
  // gets an accessible name without id wiring). The caption text sits above it.
  assert.match(SCAN, /c\('label', \{ className: 'field scan-field' \}/,
    'field() must wrap the control in a <label class="field scan-field">');
});

test('every result filter is rendered through the labelled field() helper', () => {
  for (const ctrl of ['filterText', 'filterRemote', 'filterSalaryMin', 'filterSalaryMax', 'filterSource', 'filterScope']) {
    assert.match(SCAN, new RegExp(`field\\(t\\('scan\\.[A-Za-z]+'[^)]*\\),\\s*${ctrl}\\)`),
      `${ctrl} must be wrapped in a labelled field()`);
  }
});

test('salary inputs carry no in-field placeholder (label is above)', () => {
  // The salaryFrom/To strings must not be used as input placeholders anymore.
  assert.doesNotMatch(SCAN, /placeholder: t\('scan\.salary(From|To)'/,
    'salary labels must be above the field, not a placeholder');
});

test('Apply + Reset buttons drive the filters (not live-on-input)', () => {
  assert.match(SCAN, /function applyFilters\(\)/, 'applyFilters() must exist');
  assert.match(SCAN, /function resetFilters\(\)/, 'resetFilters() must exist');
  assert.match(SCAN, /t\('scan\.applyFilters'/, 'Apply button label via scan.applyFilters');
  assert.match(SCAN, /t\('scan\.resetFilters'/, 'Reset button label via scan.resetFilters');
  // The old live render-on-every-input wiring must be gone.
  assert.doesNotMatch(SCAN, /\[filterText, filterRemote, filterSalaryMin, filterSalaryMax, filterSource, filterScope\]\.forEach\(\(el\) => el\.addEventListener\('input'/,
    'filters must no longer re-render live on every input');
});

test('an on-page usage hint explains the filters', () => {
  assert.match(SCAN, /scan-filters__hint/, '.scan-filters__hint paragraph must exist');
  assert.match(SCAN, /t\('scan\.filtersHint'/, 'hint text via scan.filtersHint');
});

test('salary range is applied strictly via window.Skills.salaryInRange', () => {
  assert.match(SCAN, /window\.Skills\.salaryInRange\(r, /,
    'the result predicate must gate rows through salaryInRange');
});

test('post-scan facet chips remain a collapsible <details> (scan-advanced)', () => {
  assert.match(SCAN, /chipsContainer = c\('details'/, 'the facet chip cluster stays a <details>');
  assert.match(SCAN, /scan-advanced/, 'facet disclosure keeps the .scan-advanced hook');
  assert.match(SCAN, /t\('scan\.advancedFilters'/, 'facet summary via scan.advancedFilters');
});

test('.scan-filters + .scan-advanced CSS exist', () => {
  assert.match(CSS, /\.scan-filters\b/, '.scan-filters layout CSS must exist');
  assert.match(CSS, /\.scan-filters__hint\b/, '.scan-filters__hint CSS must exist');
  assert.match(CSS, /\.scan-advanced\b/, '.scan-advanced CSS must still exist');
});
