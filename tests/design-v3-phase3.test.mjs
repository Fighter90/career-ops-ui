/**
 * Design v3 phase 3 (Lovable) — density tokens, the coral-residue sweep,
 * the --ease-out hand-off closure, and the callout ok/danger contract.
 *
 * Phase 2 activated the cv3 palette (app.css values are var(--cv3-*)
 * indirections into tokens-v3.css). Phase 3 closes the tails:
 *
 *   1. DENSITY — the sheet's theme-invariant --cv3-row-h (32px) and
 *      --cv3-control-h (30px) are CONSUMED: .tbl rows derive their
 *      block padding from the row height, .btn/.btn-sm block size rides
 *      the control height, .chip compacts to the 24px WCAG 2.5.8 floor
 *      (with the .chip-row 8px gap that makes it a spaced target).
 *   2. RESIDUES — the leftover literal-coral rgba washes move to the cv3
 *      soft pairs: .dash-hero tints → accent-soft gradient, .badge-bad and
 *      .chip.clear:hover → the danger-soft wash (alias --danger-soft),
 *      .tab-btn.is-active → the accent pair (active = accent semantics,
 *      like tracker-tab/v2-scan-chip since phase 2), the focus halo →
 *      accent-soft. No 255,56,92 literal remains in app/components/overlays.
 *   3. --ease-out — the CAR-123 R3 hand-off closes: the token is declared
 *      once in the app.css token block (the bare cv3 motion curve) and
 *      every animation easing consumes it; the v2-llm fallback drops.
 *   4. CALLOUT CONTRACT — .callout--ok / .callout--danger exist on the cv3
 *      ok/danger soft/ink pairs (future-use, mirrors --info/--warn).
 *
 * Contrast for the new pairs is gated in tests/css-a11y-contrast.test.mjs.
 * CI-isolated: pure source-static reads, no server, no network, no parent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = (f) => readFileSync(resolve(ROOT, 'public', 'css', f), 'utf8');
const APP = css('app.css');
const COMPONENTS = css('components.css');
const OVERLAYS = css('overlays.css');
const MAP = css('map.css');
const LLM = css('v2-llm.css');
const TOKENS = css('tokens-v3.css');

/** First `selector { … }` block body. The selector is anchored to a line start
 *  (`(^|\n)`) so a compound tail (`.topbar .topbar-actions .btn {`) never
 *  matches as the bare `.btn` rule. */
function rule(src, selector) {
  const re = new RegExp('(^|\\n)' + selector.replace(/\s+/g, '\\s*') + '\\s*\\{([^{}]*)\\}');
  const m = src.match(re);
  return m ? m[2] : null;
}

/** Blank /* … *\/ comments (history prose may legitimately name old literals). */
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

// ── 1. density ────────────────────────────────────────────────────────────

test('the sheet declares the density pair (theme-invariant, the phase-3 consumers rely on it)', () => {
  assert.match(TOKENS, /--cv3-row-h:\s*32px/);
  assert.match(TOKENS, /--cv3-control-h:\s*30px/);
});

test('.tbl rows derive block padding from --cv3-row-h (≈32px data rows)', () => {
  const cell = rule(COMPONENTS, 'table\\.tbl th, table\\.tbl td');
  assert.ok(cell, 'the .tbl cell rule must exist');
  assert.match(cell, /padding:\s*calc\(\(var\(--cv3-row-h\)\s*-\s*1\.45em\s*-\s*1px\)\s*\/\s*2\)\s*16px/,
    `cells must compute block padding from the row token, got: ${cell}`);
  const reposts = rule(COMPONENTS, '\\.reposts-body \\.tbl th, \\.reposts-body \\.tbl td');
  assert.ok(reposts, 'the reposts override must exist');
  assert.match(reposts, /padding:\s*calc\(\(var\(--cv3-row-h\)\s*-\s*1\.45em\s*-\s*1px\)\s*\/\s*2\)\s*12px/);
});

test('.btn block size rides --cv3-control-h (30px controls, ≥ the WCAG 2.5.8 floor)', () => {
  const btn = rule(APP, '\\.btn');
  assert.ok(btn, '.btn rule found');
  assert.match(btn, /min-height:\s*var\(--cv3-control-h\)/, '.btn min-height must be the control token');
  assert.match(btn, /padding:\s*calc\(\(var\(--cv3-control-h\)\s*-\s*1\.2em\s*-\s*2px\)\s*\/\s*2\)\s*20px/,
    '.btn block padding must derive from the control token');
  assert.doesNotMatch(btn, /min-height:\s*44px/, 'the 44px literal floor is retired');
  const sm = rule(APP, '\\.btn-sm');
  assert.match(sm, /min-height:\s*var\(--cv3-control-h\)/, '.btn-sm follows the same control token (30px, not the old 32px)');
});

test('.chip compacts to 24px — the WCAG 2.5.8 minimum, spaced by the 8px chip-row gap', () => {
  const chip = rule(COMPONENTS, '\\.chip');
  assert.ok(chip, '.chip rule found');
  assert.match(chip, /min-height:\s*24px/);
  assert.doesNotMatch(chip, /min-height:\s*28px/);
  const row = rule(COMPONENTS, '\\.chip-row');
  assert.match(row, /gap:\s*8px/, 'the 8px spacing half of the 2.5.8 exception must stay');
});

// ── 2. coral-residue sweep ────────────────────────────────────────────────

test('.dash-hero tints ride the accent-soft gradient (was a literal coral rgba)', () => {
  const hero = rule(COMPONENTS, '\\.dash-hero');
  assert.ok(hero, '.dash-hero rule found');
  assert.match(hero, /linear-gradient\(135deg,\s*var\(--accent-soft\)\s*0%,\s*transparent\s*100%\)/);
  assert.doesNotMatch(hero, /255,\s*56,\s*92/);
});

test('.badge-bad and .chip.clear:hover wash with --danger-soft (the cv3 danger soft pair)', () => {
  assert.match(APP, /--danger-soft:\s*var\(--cv3-danger-soft\)/,
    'the app-level danger-soft alias must resolve to the cv3 sheet value');
  const bad = rule(COMPONENTS, '\\.badge-bad');
  assert.match(bad, /background:\s*var\(--danger-soft\)/);
  assert.match(bad, /color:\s*var\(--rausch-text\)/, 'the ink side stays the AA danger text');
  assert.doesNotMatch(bad, /255,\s*56,\s*92/);
  const clear = rule(COMPONENTS, '\\.chip\\.clear:hover');
  assert.match(clear, /background:\s*var\(--danger-soft\)/);
  assert.doesNotMatch(clear, /255,\s*56,\s*92/);
});

test('the invalid-field halo and the scan-dot pulse wash the cv3 pairs (no coral left anywhere)', () => {
  const err = rule(OVERLAYS, '\\.input\\.is-error, \\.textarea\\.is-error, \\.select\\.is-error');
  assert.ok(err, 'the invalid-field halo rule found');
  assert.match(err, /box-shadow:\s*0 0 0 3px var\(--danger-soft\)/);
  const dot = COMPONENTS.match(/@keyframes scan-dot\s*\{\s*50%\s*\{\s*box-shadow:\s*0 0 0 5px var\(--accent-soft\);\s*\}\s*\}/);
  assert.ok(dot, 'the scan-dot halo must paint var(--accent-soft)');
});

test('active tabs ride the accent pair (phase-2 active semantics; the coral wash is gone)', () => {
  const tab = rule(OVERLAYS, '\\.tab-btn\\.is-active');
  assert.ok(tab, '.tab-btn.is-active rule found');
  assert.match(tab, /background:\s*var\(--accent-soft\)/);
  assert.match(tab, /color:\s*var\(--accent-soft-ink\)/);
  assert.doesNotMatch(tab, /rgba\(255,\s*56,\s*92/);
});

test('the focus halo washes accent-soft (was the literal coral rgba)', () => {
  const halo = rule(OVERLAYS,
    '\\.btn:focus-visible, \\.qa-tile:focus-visible, \\.nav-item:focus-visible, a:focus-visible, \\.chip:focus-visible');
  assert.ok(halo, 'the interactive-control halo rule found');
  assert.match(halo, /box-shadow:\s*0 0 0 4px var\(--accent-soft\)/);
  assert.doesNotMatch(halo, /rgba\(255,\s*56,\s*92/);
});

test('no coral 255,56,92 literal remains in the ordered chrome sheets', () => {
  for (const [name, src] of [['app.css', APP], ['components.css', COMPONENTS], ['overlays.css', OVERLAYS]]) {
    assert.doesNotMatch(noComments(src), /255,\s*56,\s*92/, `${name} still carries a coral rgba literal`);
  }
});

// ── 3. --ease-out hand-off closure ────────────────────────────────────────

test('--ease-out is declared once in the app token block (the bare cv3 curve)', () => {
  const decls = [...APP.matchAll(/--ease-out\s*:/g)].length;
  assert.equal(decls, 1, `--ease-out declared ${decls}× (want exactly 1, in the token block)`);
  assert.match(APP, /--ease-out:\s*cubic-bezier\(\.2,\s*0,\s*0,\s*1\)/);
  // same curve the sheet couples with the 120ms duration
  assert.match(TOKENS, /--cv3-motion:\s*120ms cubic-bezier\(\.2,\s*0,\s*0,\s*1\)/);
});

test('every animation easing consumes the token — no literal ease-out keyword, no stale fallback', () => {
  assert.match(LLM, /animation:\s*llm2-slide\s*1\.2s\s*var\(--ease-out\)\s*infinite/,
    'the llm2run slide must consume the token without the ease-in-out fallback');
  assert.doesNotMatch(LLM, /var\(--ease-out,/);
  for (const [name, src] of [['app.css', APP], ['components.css', COMPONENTS], ['overlays.css', OVERLAYS], ['map.css', MAP], ['v2-llm.css', LLM]]) {
    assert.doesNotMatch(src, /(?<!-)\bease-out\b/, `${name} still uses a literal ease-out keyword`);
  }
});

// ── 4. callout ok/danger contract (future-use) ───────────────────────────

test('.callout--ok / .callout--danger exist on the cv3 ok/danger pairs', () => {
  const ok = rule(COMPONENTS, '\\.callout--ok');
  assert.ok(ok, '.callout--ok must exist');
  assert.match(ok, /--callout-bg:\s*var\(--cv3-ok-soft\)/);
  assert.match(ok, /--callout-border:\s*var\(--cv3-ok\)/);
  assert.match(ok, /--callout-text:\s*var\(--cv3-ok-ink\)/);
  assert.match(ok, /--callout-link:\s*var\(--cv3-ok-ink\)/);
  const danger = rule(COMPONENTS, '\\.callout--danger');
  assert.ok(danger, '.callout--danger must exist');
  assert.match(danger, /--callout-bg:\s*var\(--cv3-danger-soft\)/);
  assert.match(danger, /--callout-border:\s*var\(--cv3-danger\)/);
  assert.match(danger, /--callout-text:\s*var\(--cv3-danger-ink\)/);
  assert.match(danger, /--callout-link:\s*var\(--cv3-danger-ink\)/);
});
