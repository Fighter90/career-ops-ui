/**
 * BACKLOG css-a11y (CAR-23 + CAR-43) — layout / landmark / a11y-structure
 * contracts for the three app stylesheets + index.html:
 *
 *   - the sticky connection/onboarding banner no longer covers the sticky
 *     topbar (one sticky layer only);
 *   - scroll-padding-top keeps focused elements clear of the sticky bars
 *     (WCAG 2.4.11);
 *   - the closed mobile sidebar drawer is visibility:hidden (no invisible
 *     tab stops / AT exposure — WCAG 2.4.3/4.1.2);
 *   - the RTL off-canvas breakpoint matches the LTR mobile breakpoint (900px);
 *   - --shadow-1/--shadow-2 are defined for .qa-tile;
 *   - the docs FAB sits BELOW the aria-modal dialog layer and never covers
 *     content on phones (CAR-43);
 *   - RTL mirrors: table alignment, toc-current rail, score glyph margin;
 *     dead physical-direction rules are gone;
 *   - index.html exposes ONE main landmark, ONE navigation landmark, no
 *     banner nested in main, no aria-live on the render target, and no
 *     hard-coded English where an i18n hook exists.
 *
 * Source-static (no server, no browser) — same approach as
 * tests/css-modularization.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAppCss } from './helpers/css.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = loadAppCss().replace(/\/\*[\s\S]*?\*\//g, '');
const APP = readFileSync(resolve(ROOT, 'public', 'css', 'app.css'), 'utf8');
const COMPONENTS = readFileSync(resolve(ROOT, 'public', 'css', 'components.css'), 'utf8');
const OVERLAYS = readFileSync(resolve(ROOT, 'public', 'css', 'overlays.css'), 'utf8');
const HTML_RAW = readFileSync(resolve(ROOT, 'public', 'index.html'), 'utf8');
// Comments may mention markup ("<main>", role names) — strip them so the
// landmark counts see only real elements/attributes.
const HTML = HTML_RAW.replace(/<!--[\s\S]*?-->/g, '');

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (css, selector) => {
  const m = stripComments(css).match(new RegExp(selector.replace(/\s+/g, '\\s*') + '\\s*\\{([^{}]*)\\}'));
  assert.ok(m, `rule not found: ${selector}`);
  return m[1];
};
/** Body of the FIRST `@media (max-width: Npx)` block containing `needle`. */
function mediaBlock(css, maxWidth, needle) {
  const re = new RegExp(`@media\\s*\\(max-width:\\s*${maxWidth}px\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'g');
  for (const m of stripComments(css).matchAll(re)) {
    if (m[1].includes(needle)) return m[1];
  }
  return null;
}

// ── sticky layering: banner vs topbar ────────────────────────────────────

test('the topbar is the ONLY sticky layer — the conn/onboarding banners scroll in flow', () => {
  // line-anchored: the DESKTOP `.topbar` rule, not the mobile `header.topbar` block
  const desktop = stripComments(APP).match(/\n\.topbar\s*\{([^}]*)\}/);
  assert.ok(desktop, 'the desktop .topbar rule exists');
  assert.match(desktop[1], /position:\s*sticky/, 'the topbar stays sticky');
  for (const [css, sel, label, hiddenSel] of [
    [COMPONENTS, '\\.conn-banner', '.conn-banner', '\\.conn-banner\\[hidden\\]'],
    [COMPONENTS, '#onboarding-banner\\.onboarding-warn', '#onboarding-banner.onboarding-warn', '#onboarding-banner\\[hidden\\]'],
  ]) {
    const block = rule(css, sel);
    assert.doesNotMatch(block, /position:\s*sticky/, `${label} must not be sticky — at top:0/z:49-50 it painted over the sticky topbar and made search/Doctor unclickable`);
    assert.doesNotMatch(block, /z-index:/, `${label} keeps no z-index (nothing to stack once it is in flow)`);
    assert.match(css, new RegExp(hiddenSel + '\\s*\\{\\s*display:\\s*none'), `${label} keeps its [hidden] override`);
  }
});

// ── scroll-padding (WCAG 2.4.11 focus-visibility after scroll) ───────────

test('html carries scroll-padding-top clearing the sticky topbar', () => {
  assert.match(rule(APP, 'html'),
    /scroll-padding-top:\s*calc\(var\(--topbar-h\)\s*\+\s*16px\)/,
    'focused/scrolled-to elements must land below the sticky topbar (WCAG 2.4.11)');
});

// ── mobile drawer: closed = hidden from tab order and AT ─────────────────

test('the ≤900px sidebar drawer is visibility:hidden closed and visible when open', () => {
  const closed = mediaBlock(APP, 900, 'transform: translateX(-100%)');
  assert.ok(closed, 'the ≤900px off-canvas block must exist in app.css');
  assert.match(closed, /visibility:\s*hidden/, 'closed drawer must be visibility:hidden (transform alone leaves 40 invisible tab stops)');
  assert.match(closed, /transition:[^;]*visibility/, 'visibility must join the transition so the slide-in still animates');
  const open = closed.match(/body\.sidebar-open \.sidebar\s*\{([^}]*)\}/);
  assert.ok(open, 'the open-state rule must sit inside the same media block');
  assert.match(open[1], /visibility:\s*visible/, 'open drawer must be visibility:visible');
  // RTL mirror: same contract in overlays.css
  const rtl = mediaBlock(OVERLAYS, 900, '[dir="rtl"] .sidebar');
  assert.ok(rtl, 'the RTL off-canvas block must exist at the 900px breakpoint');
  assert.match(rtl, /body\.sidebar-open \.sidebar/, 'RTL block keeps the open-state override');
});

test('the RTL off-canvas breakpoint matches the LTR one (900px, not 768/600)', () => {
  const ltr = mediaBlock(APP, 900, 'transform: translateX(-100%)');
  assert.ok(ltr, 'LTR mobile breakpoint is 900');
  for (const w of [768, 600]) {
    const stale = mediaBlock(OVERLAYS, w, '[dir="rtl"] .sidebar');
    assert.equal(stale, null,
      `no [dir="rtl"] sidebar off-canvas rules may remain at ${w}px — 769-${w === 768 ? 900 : 768}px showed the sidebar ON TOP of the content plus a dead 256px strip`);
  }
});

// ── tokens: shadow scale + docs FAB layer ────────────────────────────────

test('--shadow-1/--shadow-2 are defined so .qa-tile keeps its resting shadow and hover lift', () => {
  const root = rule(APP, ':root(?!\\()');
  assert.match(root, /--shadow-1:\s*var\(--shadow-sm\)/, '--shadow-1 must alias the shadow scale');
  assert.match(root, /--shadow-2:\s*var\(--shadow-md\)/, '--shadow-2 must alias the shadow scale');
  assert.match(rule(COMPONENTS, '\\.qa-tile'), /box-shadow:\s*var\(--shadow-1\)/);
  assert.match(rule(COMPONENTS, '\\.qa-tile:hover'), /box-shadow:\s*var\(--shadow-2\)/);
});

test('the docs FAB (and its panel) sit BELOW the aria-modal dialog layer (z < --z-modal)', () => {
  for (const sel of ['\\.docs-fab', '\\.docs-fab__panel']) {
    assert.match(rule(OVERLAYS, sel),
      /z-index:\s*calc\(var\(--z-modal\)\s*-\s*1\)/,
      `${sel} must resolve below the modal (a z:1150 launcher focused itself over the open dialog)`);
  }
});

test('CAR-43: on ≤768px the content shell gains bottom padding that clears the 60px FAB', () => {
  const block = mediaBlock(OVERLAYS, 768, '.content');
  assert.ok(block, 'the ≤768px content block must exist in overlays.css');
  assert.match(block, /padding-bottom:\s*calc\([\s\S]*84px[\s\S]*\)/,
    'content needs ≥ 60px FAB + 24px offset of extra bottom padding so the last interactive row never sits under the FAB');
});

// ── RTL mirrors ──────────────────────────────────────────────────────────

test('RTL mirrors .tbl alignment, the toc-current rail and the score glyph margin', () => {
  assert.match(CSS, /\[dir="rtl"\] table\.tbl th,\s*\[dir="rtl"\] table\.tbl td\s*\{[^}]*text-align:\s*right/,
    'data tables must mirror their alignment in RTL');
  assert.match(CSS, /\[dir="rtl"\] \.help-toc a\.toc-current\s*\{[^}]*border-right:[^}]*margin-right:\s*-11px/,
    'the toc-current rail must flip sides in RTL');
  assert.match(CSS, /\[dir="rtl"\] \.score-(high|mid|low)::before\s*\{[^}]*margin-right:\s*0[^}]*margin-left:\s*6px/,
    'the score glyph margin must mirror in RTL');
});

test('dead physical-direction RTL rules are gone (sidebar-toggle, notif-drawer__close)', () => {
  assert.doesNotMatch(CSS, /\[dir="rtl"\] \.sidebar-toggle\s*\{/,
    'the toggle is a flex child of the topbar, never absolutely positioned — the rule could never apply');
  assert.doesNotMatch(CSS, /\[dir="rtl"\] \.notif-drawer__close\s*\{/,
    'the drawer close is a flex child of the drawer head — the rule could never apply');
});

// ── index.html landmarks + aria wiring ───────────────────────────────────

test('index.html exposes ONE main landmark and ONE navigation landmark', () => {
  assert.equal((HTML.match(/<main\b/g) || []).length, 1, 'exactly one <main> element');
  assert.doesNotMatch(HTML, /role=["']main["']/, 'no second main landmark via role="main"');
  assert.equal((HTML.match(/<nav\b/g) || []).length, 1, 'exactly one <nav> element');
  assert.doesNotMatch(HTML, /role=["']navigation["']/, 'no second navigation landmark via role="navigation"');
  assert.doesNotMatch(HTML, /role=["']banner["']/, 'no banner landmark nested inside <main>');
});

test('no hard-coded English aria-labels remain where an i18n key exists', () => {
  assert.doesNotMatch(HTML, /aria-label="Main navigation"/, 'the nav landmark carries no English name');
  // Every data-i18n-aria-label key referenced in the shell must exist in the EN
  // dictionary — this is what catches wiring a key that was never added.
  // KNOWN GAP (handed off, needs a new ×17-locale string — not addable here):
  //   - #sidebar-toggle aria-label="Toggle menu" — no key exists;
  //   - .modal-close aria-label="Close dialog" — no key exists ("fab.close" is
  //     the docs-FAB's own string, "notif.closeAria" is drawer-specific).
  const dict = readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'locales', 'i18n-dict.en.js'), 'utf8');
  for (const m of HTML.matchAll(/data-i18n-aria-label="([^"]+)"/g)) {
    assert.match(dict, new RegExp(`['"]${m[1].replace(/\./g, '\\.')}['"]`),
      `aria i18n key "${m[1]}" must exist in the EN dictionary`);
  }
});

test('#content announces via managed focus, not a polite live region', () => {
  const tag = HTML.match(/<section[^>]*id="content"[^>]*>/);
  assert.ok(tag, '#content section exists');
  assert.doesNotMatch(tag[0], /aria-live/,
    'aria-live=polite re-announced the ENTIRE view on every render; route changes already announce via the focused heading');
  assert.match(tag[0], /tabindex="-1"/, 'the managed-focus target stays focusable');
});
