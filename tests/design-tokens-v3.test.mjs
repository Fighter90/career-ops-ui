/**
 * Phase 1/3 of the Lovable design integration — the token-sheet port gate.
 *
 * `public/css/tokens-v3.css` is a PASSIVE sheet: every token lives in the
 * `--cv3-*` namespace and nothing in the app consumes it yet (app.css stays
 * the authority until phase 2 rewires the call sites). This gate locks the
 * sheet's structural contract so phase 2 can switch consumers without
 * re-auditing it:
 *
 *   1. the file exists and stays within the 400-LOC limit (a token sheet is
 *      data, not logic — it must stay readable top to bottom),
 *   2. namespace purity: every custom property it declares is `--cv3-*`,
 *      so the passive sheet can never shadow a live app token,
 *   3. declaration-ONLY: every block head is one of the three theme blocks
 *      (inside the single prefers-color-scheme wrapper) — no selector is ever
 *      styled, which is the machine-checked passivity guarantee,
 *   4. every theme-dependent token is declared in ALL THREE blocks and the
 *      two dark blocks carry byte-identical values (no half-dark drift —
 *      the css-a11y-contrast discipline, applied to the new sheet),
 *   5. theme-invariant scales (density / radius / motion / typography) are
 *      declared exactly once on :root, like the z-index layers in app.css,
 *   6. the score-band set is complete: 7 bands × {ink, bg} in both themes,
 *   7. the sheet is self-contained: every var() it references resolves to a
 *      `--cv3-*` token (per theme; the dark blocks inherit the :root block),
 *   8. values are oklch-first: no hex/rgb(a) color literal sneaks in,
 *   9. index.html loads it LAST of the /css/ sheets — after map.css, before
 *      the leaflet vendor stylesheet — so the phase-2 override wins the
 *      cascade without touching the locked app/components/overlays order.
 *
 * CI-isolated: pure source-static reads, no server, no network, no parent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'public', 'css', 'tokens-v3.css');
const HTML = () => readFileSync(resolve(ROOT, 'public', 'index.html'), 'utf8');

const raw = () => readFileSync(FILE, 'utf8');
/** Blank /* … *\/ comments while preserving line structure. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** The three theme-block selector heads, in app.css order. */
const LIGHT_SEL = ':root';
const DARK_SEL = '[data-theme="dark"]';
const SYSTEM_SEL = ':root:not([data-theme="light"]):not([data-theme="dark"])';
const MEDIA_SEL = '@media (prefers-color-scheme: dark)';

const THEME_DEPENDENT = [
  // surfaces
  '--cv3-surface-0', '--cv3-surface-1', '--cv3-surface-2', '--cv3-surface-3',
  // ink + lines
  '--cv3-ink', '--cv3-ink-2', '--cv3-ink-3', '--cv3-line', '--cv3-line-strong',
  // accent family
  '--cv3-accent', '--cv3-accent-hover', '--cv3-accent-ink', '--cv3-accent-soft', '--cv3-accent-soft-ink',
  // semantic families (base / soft wash / AA ink tone)
  '--cv3-ok', '--cv3-ok-soft', '--cv3-ok-ink',
  '--cv3-warn', '--cv3-warn-soft', '--cv3-warn-ink',
  '--cv3-danger', '--cv3-danger-soft', '--cv3-danger-ink',
  '--cv3-info', '--cv3-info-soft', '--cv3-info-ink',
  '--cv3-neutral', '--cv3-neutral-soft', '--cv3-neutral-ink',
  // score bands A-G (ink + bg pair)
  '--cv3-band-a-ink', '--cv3-band-a-bg',
  '--cv3-band-b-ink', '--cv3-band-b-bg',
  '--cv3-band-c-ink', '--cv3-band-c-bg',
  '--cv3-band-d-ink', '--cv3-band-d-bg',
  '--cv3-band-e-ink', '--cv3-band-e-bg',
  '--cv3-band-f-ink', '--cv3-band-f-bg',
  '--cv3-band-g-ink', '--cv3-band-g-bg',
  // elevation + managed focus
  '--cv3-shadow-1', '--cv3-shadow-2', '--cv3-focus',
];

const THEME_INVARIANT = [
  // density
  '--cv3-row-h', '--cv3-control-h',
  // radius ramp + pill
  '--cv3-radius-1', '--cv3-radius-2', '--cv3-radius-3', '--cv3-radius-4', '--cv3-radius-pill',
  // motion
  '--cv3-motion',
  // typography (Inter by deliberate divergence; see the sheet header)
  '--cv3-font-sans', '--cv3-font-mono',
  '--cv3-fs-xs', '--cv3-fs-sm', '--cv3-fs-md', '--cv3-fs-base', '--cv3-fs-lg',
  '--cv3-fs-xl', '--cv3-fs-2xl', '--cv3-fs-3xl',
  '--cv3-lh-tight', '--cv3-lh-ui', '--cv3-tracking-tight', '--cv3-tracking-display',
  '--cv3-numeric',
];

/** Parse one theme block body into a Map of --cv3-* declarations. */
function blockDefs(css, sel) {
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^{}]*)\\}');
  const m = css.match(re);
  assert.ok(m, `theme block missing: ${sel}`);
  const defs = new Map();
  for (const d of m[1].matchAll(/(--cv3-[a-z0-9-]+)\s*:\s*([^;]+);/g)) defs.set(d[1], d[2].trim());
  return defs;
}

const css = () => stripComments(raw());
const LIGHT = () => blockDefs(css(), LIGHT_SEL);
const DARKX = () => blockDefs(css(), DARK_SEL);
const DARKS = () => blockDefs(css(), SYSTEM_SEL);

test('the sheet exists and stays within the 400-LOC limit', () => {
  const lines = raw().split('\n').length;
  assert.ok(lines <= 400, `tokens-v3.css is ${lines} lines — over the 400-LOC sheet limit`);
});

test('namespace purity — every declared custom property is --cv3-*', () => {
  const all = [...css().matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]);
  const foreign = all.filter((t) => !t.startsWith('--cv3-'));
  assert.deepEqual(foreign, [],
    'the passive sheet must never declare a non-cv3 token (it would shadow a live app token)');
});

test('declaration-only — the only blocks are the three theme blocks under one media wrapper', () => {
  const src = css();
  const heads = [...src.matchAll(/(^|\n)([^{}@\n][^{}\n]*?)\{/g)].map((m) => m[2].trim());
  const allowed = [LIGHT_SEL, DARK_SEL, SYSTEM_SEL];
  assert.deepEqual([...new Set(heads)].sort(), [...allowed].sort(),
    'the sheet must not style any selector — token declarations only');
  assert.equal((src.match(new RegExp(MEDIA_SEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1,
    'exactly one prefers-color-scheme wrapper');
  assert.doesNotMatch(src, /@(?!media)[a-zA-Z-]+/, 'no other at-rules (@keyframes, @supports, …)');
});

test('every theme-dependent token is declared in all three theme blocks', () => {
  for (const set of [LIGHT(), DARKX(), DARKS()]) {
    const missing = THEME_DEPENDENT.filter((t) => !set.has(t));
    assert.deepEqual(missing, [], `theme block is missing tokens: ${missing.join(', ')}`);
  }
});

test('the two dark blocks carry identical values (no half-dark drift)', () => {
  const x = DARKX();
  const s = DARKS();
  for (const t of THEME_DEPENDENT) {
    assert.equal(x.get(t), s.get(t), `${t} differs between [data-theme="dark"] and the prefers-color-scheme fallback`);
  }
});

test('theme-invariant scales are declared exactly once (on :root)', () => {
  const src = css();
  for (const t of THEME_INVARIANT) {
    const n = (src.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:', 'g')) || []).length;
    assert.equal(n, 1, `${t} must be declared exactly once (theme-invariant), found ${n}`);
  }
  const light = LIGHT();
  for (const t of THEME_INVARIANT) {
    assert.ok(light.has(t), `${t} must live on :root so the dark blocks inherit it`);
  }
});

test('the score-band set is complete — 7 bands × {ink, bg} in both themes', () => {
  for (const set of [LIGHT(), DARKX(), DARKS()]) {
    const missing = [];
    for (const b of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      for (const slot of ['ink', 'bg']) {
        if (!set.has(`--cv3-band-${b}-${slot}`)) missing.push(`band-${b}-${slot}`);
      }
    }
    assert.deepEqual(missing, [], `incomplete band set: ${missing.join(', ')}`);
  }
});

test('self-contained — every var() reference resolves to a --cv3-* token', () => {
  const light = LIGHT();
  for (const [sel, defs] of [[LIGHT_SEL, light], [DARK_SEL, DARKX()], [SYSTEM_SEL, DARKS()]]) {
    // dark blocks inherit the :root definitions — resolution scope is the union
    const scope = sel === LIGHT_SEL ? light : new Map([...light, ...defs]);
    const m = css().match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^{}]*)\\}'));
    for (const ref of m[1].matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
      assert.ok(ref[1].startsWith('--cv3-'), `${sel} references a foreign token ${ref[1]}`);
      assert.ok(scope.has(ref[1]), `${sel}: var(${ref[1]}) does not resolve inside the sheet`);
    }
  }
});

test('values are oklch-first — no hex/rgb(a) color literals', () => {
  for (const set of [LIGHT(), DARKX(), DARKS()]) {
    for (const [t, v] of set) {
      assert.doesNotMatch(v, /#[0-9a-f]{3,8}\b|\brgba?\s*\(/i,
        `${t} carries a legacy color literal (${v}) — the sheet is oklch-first`);
    }
  }
});

test('index.html loads motion.css last of the /css/ sheets, tokens-v3 after map, leaflet last', () => {
  const html = HTML();
  const links = [...html.matchAll(/\/css\/([a-z0-9-]+\.css)/g)];
  const last = links[links.length - 1];
  assert.equal(last[1], 'motion.css',
    `motion.css must be the LAST /css/ stylesheet (found ${last[1]})`);
  const mapPos = html.indexOf('/css/map.css');
  const tokPos = html.indexOf('/css/tokens-v3.css');
  const motPos = html.indexOf('/css/motion.css');
  const leafPos = html.indexOf('/vendor/leaflet/leaflet.css');
  assert.ok(mapPos > -1 && mapPos < tokPos, 'tokens-v3.css must load after map.css');
  assert.ok(tokPos < motPos, 'motion.css must load after tokens-v3.css (cascade overrides)');
  assert.ok(leafPos > motPos, 'the leaflet vendor stylesheet must load after all app sheets');
});
