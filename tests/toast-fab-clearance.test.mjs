/**
 * DES-1 — the toast stack must clear the bottom-right docs FAB so a toast
 * never lands under the launcher and truncates. Source guard: the toast's
 * bottom offset accounts for the FAB height (60px) rather than sitting at
 * the bare --space-5 both share.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppCss } from './helpers/css.mjs';

const CSS = loadAppCss();

test('.toast bottom clears the 60px FAB (not the bare --space-5)', () => {
  const block = CSS.match(/\.toast\s*\{[\s\S]*?\n\}/);
  assert.ok(block, '.toast rule not found');
  // calc() nests var(--space-…) parens, so match the declaration loosely:
  // a `bottom: calc(` line that mentions the FAB's 60px height.
  assert.match(block[0], /bottom:\s*calc\([\s\S]*?60px[\s\S]*?;/,
    'toast bottom must account for the FAB height');
});
