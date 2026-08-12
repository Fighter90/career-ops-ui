/**
 * v1.56.2 — UX-N1: every SPA route must set a distinct, locale-aware
 * document.title so multi-tab browsers / bookmarks / screen-reader
 * "page changed" announcements identify the view. Pre-fix the title
 * was the static index.html <title> ("career-ops — command center")
 * for all 24 routes.
 *
 * The contract: router.js derives document.title from the view's own
 * localized <h1 class="page-title"> on every render — so titles are
 * automatically per-route AND translated (no new i18n keys), and the
 * assignment runs BEFORE the first-paint guard so the initial tab is
 * titled too (same ordering rule the v1.56.0 tabindex set follows).
 *
 * router.js is browser-only → asserted statically (same approach as
 * tests/dashboard-initial-focus.test.mjs). CI-isolated: no server,
 * no parent project, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const R = readFileSync(resolve(__d, '..', 'public', 'js', 'router.js'), 'utf8');
const fnMatch = R.match(/function focusNewView\(content\)\s*\{[\s\S]*?\n {2}\}/);

test('focusNewView exists and assigns document.title', () => {
  assert.ok(fnMatch, 'focusNewView(content) must exist');
  assert.match(
    fnMatch[0],
    /document\.title\s*=/,
    'focusNewView must set document.title on every render',
  );
});

test('title is derived from the view heading (per-route + localized)', () => {
  const body = fnMatch[0];
  // It must read the rendered heading's text, NOT assign one constant
  // string. The heading itself is localized per view, so deriving the
  // title from it gives distinct, translated titles for free.
  assert.match(
    body,
    /querySelector\(\s*['"][^'"]*\bh1\b[^'"]*['"]\s*\)[\s\S]*?\.textContent/,
    'document.title must come from the view <h1>/.page-title textContent',
  );
  // Guard: not a single hardcoded title for every route (the bug).
  assert.doesNotMatch(
    body,
    /document\.title\s*=\s*(['"`])[^'"`]+\1\s*;?\s*(\n|})/,
    'document.title must not be assigned one literal for all routes',
  );
});

test('document.title is set BEFORE the first-paint early-return', () => {
  const body = fnMatch[0];
  const titleAt = body.indexOf('document.title');
  const guardAt = body.indexOf('if (!firstPaintDone)');
  assert.ok(titleAt > -1 && guardAt > -1, 'both the title set and the guard must exist');
  assert.ok(
    titleAt < guardAt,
    'document.title must be set before the !firstPaintDone return so the ' +
      'initial tab (first paint) is titled, not just later navigations',
  );
});

test('v1.158.0 (NIT-1): the HelpHint "?" affordance is excluded from the title', () => {
  // HelpHint.title() builds the page <h1> as `[<span>text</span>,
  // <button class="help-hint">?</button>]`. Reading the raw h1.textContent
  // used to fold the "?" into document.title ("Vacancy search?"). The fix
  // clones the heading, strips `.help-hint`, then reads textContent — so the
  // "?" never leaks AND the live DOM heading (still showing its "?") is
  // untouched. Assert that clone-strip-read contract, in order.
  // Strip comments so the assertions match executable code, not the prose
  // above (which necessarily mentions "clone" and ".help-hint" too).
  const code = fnMatch[0]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  // Clone the heading (so the live DOM's own "?" is never mutated)…
  assert.match(
    code,
    /cloneNode\(\s*true\s*\)/,
    'must deep-clone the heading, never mutate the live DOM to compute the title',
  );
  // …strip every `.help-hint` from that clone…
  assert.match(
    code,
    /querySelectorAll\(\s*['"]\.help-hint['"]\s*\)[\s\S]*?\.remove\(\)/,
    'must remove .help-hint node(s) from the clone before reading the title',
  );
  // …and read the title text from the stripped clone (not the raw heading).
  assert.match(
    code,
    /clone\.textContent/,
    'the title text must come from the stripped clone, so "?" cannot leak',
  );
});

test('falls back to the product default when a view has no heading', () => {
  // 404 and every real view have an <h1>, but the expression must be
  // defensive (empty heading → product default, never "undefined").
  assert.match(
    fnMatch[0],
    /career-ops/,
    'a sensible product-name default/suffix must be present',
  );
});
