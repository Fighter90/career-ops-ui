/**
 * #/scan filter-panel grid redesign (v1.148.0; re-contracted v1.244.2).
 *
 * The result-filter panel is a uniform responsive grid: small-caps labels
 * above 40px controls, the saved-searches row as a bordered sub-card spanning
 * the top, and a footer that keeps the hint LEFT and Apply/Reset RIGHT on one
 * baseline. These source-static canaries lock the layout contract so a
 * refactor can't silently revert it; the real render is exercised by
 * tests/playwright-scan-filters.mjs.
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
  const start = css.indexOf('.scan-filters {');
  const end = css.indexOf('.scan-filters .scan-field {', start);
  const block = css.slice(start, end);
  assert.match(block, /display:\s*grid/, '.scan-filters uses display:grid');
  // minmax(min(210px, 100%), 1fr): tidy ~210px columns (v1.244.2) that still
  // collapse to a single full-width column below 210px instead of overflowing
  // the panel on very narrow viewports.
  assert.match(block, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(210px,\s*100%\),\s*1fr\)\)/,
    'auto-fill minmax(min(210px,100%),1fr) columns');
  assert.doesNotMatch(block, /flex-wrap/, 'no leftover flex-wrap on the panel');
});

test('.scan-filters__footer spans the grid and separates hint (left) from actions (right)', () => {
  const css = loadAppCss();
  const i = css.indexOf('.scan-filters__footer {');
  assert.ok(i >= 0, '.scan-filters__footer has a rule block');
  const block = css.slice(i, css.indexOf('}', i) + 1);
  assert.match(block, /grid-column:\s*1\s*\/\s*-1/, 'footer spans the full grid width');
  assert.match(block, /justify-content:\s*space-between/, 'hint left / buttons right');
  assert.match(block, /border-top:/, 'footer separated by a hairline');
  const j = css.indexOf('.scan-filters__actions {');
  assert.ok(j >= 0, '.scan-filters__actions has a rule block');
  assert.match(css.slice(j, css.indexOf('}', j) + 1), /justify-content:\s*flex-end/, 'actions right-aligned');
});

test('saved searches render as one bordered sub-card inside the filter grid', () => {
  const css = loadAppCss();
  const i = css.indexOf('.scan-filters__saved {');
  assert.ok(i >= 0, '.scan-filters__saved has a rule block');
  const block = css.slice(i, css.indexOf('}', i) + 1);
  assert.match(block, /grid-column:\s*1\s*\/\s*-1/, 'saved-search sub-card spans the grid');
  assert.match(block, /border:/, 'sub-card is bordered');
  assert.match(scanJs, /className:\s*'scan-filters__saved'/, 'scan.js renders the saved sub-card in the grid');
});

test('scan chrome keeps the small-caps label + 40px control system', () => {
  const css = loadAppCss();
  assert.match(css, /\.scan-field__label[\s\S]{0,200}text-transform:\s*uppercase/,
    'field labels are small caps');
  assert.match(css, /\.scan-launcher \.select[\s\S]{0,300}min-height:\s*40px/,
    'launcher controls align on a 40px height');
  assert.match(scanJs, /className:\s*'card mb-3 scan-launcher'/, 'launcher card keeps its chrome hook');
  assert.match(scanJs, /className:\s*'scan-terminal'/, 'console strip keeps its chrome hook');
});

test('scan.js drops the old hidden-label alignment hack in the actions row', () => {
  // The redesign removed the visibility:hidden placeholder <label> and the inner
  // flex wrapper; the buttons are now direct children of .scan-filters__actions.
  assert.doesNotMatch(scanJs, /scan-filters__actions[\s\S]{0,120}visibility:\s*'hidden'/,
    'no hidden placeholder label left inside the actions row');
  assert.match(scanJs, /className:\s*'scan-filters__actions'\s*\}\s*,\s*\[applyBtn,\s*resetBtn\]/,
    'actions row holds applyBtn + resetBtn directly');
});

