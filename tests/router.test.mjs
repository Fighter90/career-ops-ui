/**
 * Router config — sanity checks on the ALIASES table. Static guarantee
 * that future refactors don't silently regress FIX-C2 (#/profile alias).
 * The router itself is browser-only (touches `window`, `location.hash`,
 * etc.), so we read the file as text and grep.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTER_PATH = resolve(__dirname, '..', 'public', 'js', 'router.js');
const SRC = readFileSync(ROUTER_PATH, 'utf8');

test('router: ALIASES table maps settings → profile (v1.10.0 rename)', () => {
  // The canonical route was renamed from `settings` to `profile` in
  // v1.10.0. The old `settings` hash now aliases to the new route so
  // existing bookmarks keep working.
  assert.match(SRC, /ALIASES\s*=\s*\{[^}]*settings\s*:\s*['"]profile['"]/s);
});

test('router: #/portals is a real registered view (v1.99.0), no longer aliased to config', () => {
  // v1.99.0 promoted #/portals from a config alias to a dedicated Portals
  // health view (Router.register('portals', …) in public/js/views/portals.js).
  // The old `portals: 'config'` alias MUST be gone or it would shadow the view.
  assert.doesNotMatch(SRC, /\bportals\s*:\s*['"]config['"]/);
  assert.match(SRC, /const\s+ALIASES\s*=\s*\{/);
  const viewSrc = readFileSync(resolve(__dirname, '..', 'public', 'js', 'views', 'portals.js'), 'utf8');
  assert.match(viewSrc, /Router\.register\(\s*['"]portals['"]/);
});

test('router: nav highlight handles both alias name and resolved route', () => {
  // The nav-active toggle should compare against EITHER `name` or `rawName`,
  // otherwise #/profile would not light up the Profile sidebar item.
  assert.match(SRC, /classList\.toggle\(\s*['"]active['"]\s*,\s*r\s*===\s*name\s*\|\|\s*r\s*===\s*rawName/);
});

// ───────────────────────── FIX-C7: catch-all 404 ─────────────────────────

test('router: __not_found__ view is registered (FIX-C7)', () => {
  assert.match(SRC, /register\(\s*['"]__not_found__['"]/);
});

test('router: unknown routes fall back to __not_found__, NOT dashboard', () => {
  // The renderer-resolution line should reference __not_found__, not silently fall back to dashboard.
  assert.match(SRC, /routes\[\s*['"]__not_found__['"]\s*\]/);
  // Old behavior (`routes['dashboard']` as fallback) must be gone.
  assert.ok(
    !/renderer\s*=\s*routes\[name\]\s*\|\|\s*routes\['dashboard'\]/.test(SRC),
    'router still falls back to dashboard for unknown routes — FIX-C7 regressed'
  );
});

test('router: 404 view links back to dashboard', () => {
  assert.match(SRC, /href\s*=\s*['"]#\/dashboard['"]/);
});

// ───────── WS2 UX-audit HIGH: SPA route-change focus management ─────────

test('router: focusNewView helper is defined (WCAG 2.4.3 focus order)', () => {
  // The cross-cutting UX-audit HIGH: render() swapped #content without
  // moving focus, stranding keyboard/SR users on the destroyed node.
  assert.match(SRC, /function\s+focusNewView\s*\(\s*content\s*\)/);
});

test('router: focusNewView targets the new view heading, falls back to content', () => {
  assert.match(SRC, /querySelector\(\s*['"]h1,\s*\.page-title,\s*\[data-autofocus\]['"]\s*\)\s*\|\|\s*content/);
  assert.match(SRC, /\.focus\(\s*\{\s*preventScroll:\s*false\s*\}\s*\)/);
});

test('router: first paint is skipped so focus does not fight the skip-link', () => {
  assert.match(SRC, /firstPaintDone/);
  assert.match(SRC, /if\s*\(\s*!firstPaintDone\s*\)\s*\{\s*firstPaintDone\s*=\s*true;\s*return;\s*\}/);
});

test('router: focusNewView is invoked on BOTH the success and error render paths', () => {
  // Two call sites: after appendChild/string render, and in the catch block.
  const calls = SRC.match(/focusNewView\(content\)/g) || [];
  assert.ok(calls.length >= 2, `expected ≥2 focusNewView(content) call sites, found ${calls.length}`);
});
