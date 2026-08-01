/**
 * Design polish (v1.115.0) — conservative token/component refinements, coral
 * brand kept. These are source-guard checks so the polish (and, crucially, the
 * v1.58.x anti-regression: NO global `*:focus-visible` box-shadow that would
 * re-paint the spurious ring on managed-focus route <h1>s) can't silently
 * regress.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppCss } from './helpers/css.mjs';

const CSS = loadAppCss();

test('metric cards gained an interactive hover (lift + coral border)', () => {
  assert.match(CSS, /\.metric-card:hover\s*\{[^}]*translateY\(-2px\)[^}]*border-color:\s*var\(--rausch\)/);
});

test('primary/dark/danger buttons gained a resting shadow + hover lift', () => {
  assert.match(CSS, /\.btn-primary,\s*\.btn-dark,\s*\.btn-danger\s*\{[^}]*box-shadow/);
  assert.match(CSS, /\.btn-primary:hover,[^{]*\{[^}]*translateY\(-1px\)/);
});

test('the focus halo is scoped to interactive controls — NOT a global *:focus-visible box-shadow', () => {
  // Guard the v1.58.x lesson: a global *:focus-visible box-shadow re-paints the
  // spurious ring on managed-focus route <h1>s.
  assert.doesNotMatch(CSS, /\*:focus-visible\s*\{[^}]*box-shadow/);
  assert.match(CSS, /\.btn:focus-visible,[\s\S]*?box-shadow:\s*0 0 0 4px rgba\(255, 56, 92/);
});

test('the polish respects prefers-reduced-motion', () => {
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.metric-card:hover[\s\S]*?transform:\s*none/);
});

test('metric values align via tabular-nums', () => {
  assert.match(CSS, /\.metric-value\s*\{[^}]*tabular-nums/);
});
