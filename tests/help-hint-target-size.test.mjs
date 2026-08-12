/**
 * FIX-4 (v1.162.0) — the "?" help affordance must present a ≥24×24 CSS-px
 * pointer target (WCAG 2.5.8 Target Size (Minimum)). Pre-fix `.help-hint` was
 * 18×18 with padding:0. The fix makes the ELEMENT box 24×24 (the measurable
 * target) while the visible ring is drawn at 18px by `::before`, so the glyph
 * size and the h1 baseline are unchanged.
 *
 * CSS-static assertion (same approach as css-modularization/help-hint tests);
 * the visual bounding box is exercised live by the Playwright suite loading the
 * help-hinted views. CI-isolated: reads the stylesheet, no browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = readFileSync(resolve(ROOT, 'public', 'css', 'components.css'), 'utf8');

// Extract the `.help-hint { … }` base rule (not :hover / ::before / [dir]).
const base = CSS.match(/\.help-hint\s*\{[\s\S]*?\}/);
const before = CSS.match(/\.help-hint::before\s*\{[\s\S]*?\}/);

test('FIX-4: .help-hint box is ≥24×24 (WCAG 2.5.8 target size)', () => {
  assert.ok(base, '.help-hint base rule exists');
  const px = (prop) => {
    const m = base[0].match(new RegExp(prop + '\\s*:\\s*(\\d+)px'));
    return m ? Number(m[1]) : null;
  };
  assert.ok(px('width') >= 24, `width must be ≥24px, got ${px('width')}`);
  assert.ok(px('height') >= 24, `height must be ≥24px, got ${px('height')}`);
});

test('FIX-4: the visible ring stays 18px via ::before (glyph unchanged)', () => {
  assert.ok(before, '.help-hint::before draws the visible ring');
  assert.match(before[0], /width:\s*18px/, 'ring width 18px');
  assert.match(before[0], /height:\s*18px/, 'ring height 18px');
  assert.match(before[0], /border-radius:\s*50%/, 'ring is a circle');
  // The box must NOT carry the visible border any more (moved to ::before),
  // otherwise a 24px box would draw a 24px circle and enlarge the glyph.
  assert.match(base[0], /border:\s*0/, 'the 24px box border is removed (ring is on ::before)');
});
