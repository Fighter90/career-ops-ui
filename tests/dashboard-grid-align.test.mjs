/**
 * The Dashboard quick-action grid (`.qa-grid`) must use a FIXED column count,
 * not `auto-fill`. With `auto-fill` a group of 3 tiles stretched its tiles
 * wider than a group of 4, so the sections stacked with a ragged right edge.
 * A fixed `repeat(N, minmax(0,1fr))` keeps every group's tiles the same width
 * and flush on the right. This guards against a revert to the auto-fill form.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const CSS = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'css', 'components.css'),
  'utf8',
);

/** The base `.qa-grid { … }` rule body, comments stripped (we assert on the
 *  declarations, and the explanatory comment legitimately mentions auto-fill). */
function baseQaGridRule() {
  const m = CSS.match(/\n\.qa-grid\s*\{([^}]*)\}/);
  assert.ok(m, '.qa-grid base rule must exist');
  return m[1].replace(/\/\*[\s\S]*?\*\//g, '');
}

test('.qa-grid uses fixed equal-width columns, never auto-fill/auto-fit', () => {
  const rule = baseQaGridRule();
  assert.match(rule, /grid-template-columns:\s*repeat\(\s*4\s*,\s*minmax\(\s*0\s*,\s*1fr\s*\)\s*\)/,
    'base grid must be repeat(4, minmax(0, 1fr)) so short groups keep equal-width tiles');
  assert.doesNotMatch(rule, /auto-fill|auto-fit/,
    'auto-fill/auto-fit let a 3-tile group render wider tiles than a 4-tile group');
});

test('.qa-grid steps down its column count responsively', () => {
  // Narrower content areas drop to 3 → 2 → 1 columns; each keeps equal widths.
  for (const cols of ['3', '2']) {
    assert.match(CSS, new RegExp(`@media[^{]*\\{\\s*\\.qa-grid\\s*\\{\\s*grid-template-columns:\\s*repeat\\(\\s*${cols}\\s*,\\s*minmax\\(\\s*0\\s*,\\s*1fr\\s*\\)`),
      `a breakpoint must set the grid to ${cols} equal columns`);
  }
});
