/**
 * v1.56.1 — fix(a11y): the router gives every destination view's
 * <h1> tabindex="-1" and .focus()'s it on each client navigation so
 * screen readers announce the new page (see
 * tests/dashboard-initial-focus.test.mjs). A tabindex="-1" element is
 * never keyboard-reachable, yet Chromium's :focus-visible heuristic
 * still painted the brand ring around it — a red box around every
 * view's heading, which got baked into images/dashboard-*.png.
 *
 * app.css must suppress the ring for these PROGRAMMATIC managed-focus
 * targets only, while keeping the global keyboard *:focus-visible
 * ring intact (WCAG 2.4.7). CSS is static → asserted by parsing
 * public/css/app.css (CI-isolated: no server, no parent project).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAppCss } from './helpers/css.mjs';

const __d = dirname(fileURLToPath(import.meta.url));
const CSS = loadAppCss();
// Collapse whitespace so selector/declaration matching is
// formatting-agnostic (newlines vs spaces don't matter).
const FLAT = CSS.replace(/\s+/g, ' ');

test('global keyboard focus ring still defined (WCAG 2.4.7 not regressed)', () => {
  assert.match(
    FLAT,
    /\*:focus-visible \{ outline: 2px solid var\(--rausch[^}]*\}/,
    'the global *:focus-visible brand ring must remain so real ' +
      'keyboard focus on interactive controls stays visible',
  );
});

test('[tabindex="-1"] managed-focus targets suppress the spurious ring', () => {
  assert.match(
    FLAT,
    /\[tabindex="-1"\]:focus\s*,\s*\[tabindex="-1"\]:focus-visible \{ outline: none;? \}/,
    'app.css must contain `[tabindex="-1"]:focus, ' +
      '[tabindex="-1"]:focus-visible { outline: none }` so the ' +
      "router's programmatic heading focus draws no red box",
  );
});

test('suppression follows the global ring (cascade safety)', () => {
  const universal = FLAT.indexOf('*:focus-visible {');
  const suppress = FLAT.indexOf('[tabindex="-1"]:focus');
  assert.ok(universal > -1 && suppress > -1, 'both rules must exist');
  assert.ok(
    suppress > universal,
    'the [tabindex="-1"] suppression must come after *:focus-visible ' +
      'so it reliably overrides it',
  );
});

test('fix is scoped — the universal focus ring is NOT blanket-disabled', () => {
  assert.doesNotMatch(
    FLAT,
    /\*:focus(-visible)? \{ outline: none/,
    'must not disable the universal focus ring — keyboard users need it',
  );
});
