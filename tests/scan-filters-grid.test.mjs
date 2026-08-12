/**
 * #/scan filter-panel grid redesign (v1.148.0, Phase 4).
 *
 * The result-filter panel moved from a ragged flex-wrap of rigid 160–240px boxes
 * to a responsive grid with a separated, right-aligned actions row. These
 * source-static canaries lock the layout contract so a refactor can't silently
 * revert it; the real render is exercised by tests/playwright-scan-filters.mjs.
 *
 * CI-isolated: reads only repo CSS + scan.js, no parent dependency, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAppCss } from './helpers/css.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scanJs = readFileSync(resolve(ROOT, 'public/js/views/scan.js'), 'utf8');

test('.scan-filters is a responsive grid, not a flex-wrap', () => {
  const css = loadAppCss();
  const block = css.slice(css.indexOf('.scan-filters {'), css.indexOf('.scan-filters .scan-field'));
  assert.match(block, /display:\s*grid/, '.scan-filters uses display:grid');
  assert.match(block, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(/, 'auto-fill minmax columns');
  assert.doesNotMatch(block, /flex-wrap/, 'no leftover flex-wrap on the panel');
});

test('.scan-filters__actions spans the grid and is a separated right-aligned row', () => {
  const css = loadAppCss();
  const i = css.indexOf('.scan-filters__actions {');
  assert.ok(i >= 0, '.scan-filters__actions has a rule block');
  const block = css.slice(i, css.indexOf('}', i) + 1);
  assert.match(block, /grid-column:\s*1\s*\/\s*-1/, 'actions span the full grid width');
  assert.match(block, /justify-content:\s*flex-end/, 'actions right-aligned');
  assert.match(block, /border-top:/, 'actions separated by a hairline');
});

test('scan.js drops the old hidden-label alignment hack in the actions row', () => {
  // The redesign removed the visibility:hidden placeholder <label> and the inner
  // flex wrapper; the buttons are now direct children of .scan-filters__actions.
  assert.doesNotMatch(scanJs, /scan-filters__actions[\s\S]{0,120}visibility:\s*'hidden'/,
    'no hidden placeholder label left inside the actions row');
  assert.match(scanJs, /className:\s*'scan-filters__actions'\s*\}\s*,\s*\[applyBtn,\s*resetBtn\]/,
    'actions row holds applyBtn + resetBtn directly');
});
