/**
 * BACKLOG css-a11y (CAR-23) — WCAG AA contrast CONTRACTS for the pairs the
 * audit flagged, computed from the live token values in the three app
 * stylesheets: light `:root`, explicit `[data-theme="dark"]`, and the
 * `prefers-color-scheme: dark` fallback block. The two dark variants carry
 * identical values today but are asserted separately, so a drift between
 * them fails here instead of shipping a half-dark theme.
 *
 * Source-static (no server, no browser) — same approach as
 * dark-theme-tokens.test.mjs. A pair fails CI if it drops below 4.5:1
 * (WCAG 1.4.3 normal text) in ANY resolved theme.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppCss } from './helpers/css.mjs';

const CSS = loadAppCss().replace(/\/\*[\s\S]*?\*\//g, '');

// ── tiny CSS value engine (token blocks are flat: no nested braces) ──────

/** Merge every `selector { … }` body whose selector matches `selRe`. */
function blocksBySelector(css, selRe) {
  const re = new RegExp(selRe + '\\s*\\{([^{}]*)\\}', 'g');
  const merged = {};
  for (const m of css.matchAll(re)) {
    for (const d of m[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      merged[d[1]] = d[2].trim();
    }
  }
  return merged;
}

const SETS = {
  light: blocksBySelector(CSS, ':root(?!\\()'),
  darkExplicit: blocksBySelector(CSS, '\\[data-theme="dark"\\]'),
  darkSystem: blocksBySelector(CSS, ':root:not\\(\\[data-theme="light"\\]\\)[^{}]*'),
};

/** Parse a color literal to [r,g,b]. Supports #rgb/#rrggbb/rgb(a)(). */
function parseColor(v) {
  const hex = v.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) return [0, 1, 2].map((i) => parseInt(h[i] + h[i], 16));
    if (h.length >= 6) return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const rgb = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]|$)/i);
  if (rgb) return [1, 2, 3].map((i) => Math.round(parseFloat(rgb[i])));
  return null;
}

/** Resolve var()/color-mix() chains against a token set; returns a color array. */
function resolveColor(set, value, seen = new Set()) {
  let v = String(value).trim();
  const varM = v.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([\s\S]+))?\)$/);
  if (varM) {
    const [, name, fallback] = varM;
    if (set[name] !== undefined && !seen.has(name)) {
      return resolveColor(set, set[name], new Set([...seen, name]));
    }
    if (fallback !== undefined) return resolveColor(set, fallback, seen);
    throw new Error(`unresolvable token reference: ${v}`);
  }
  const mixM = v.match(/^color-mix\(\s*in\s+srgb\s*,\s*([\s\S]+?)\s+([\d.]+)%\s*,\s*([\s\S]+?)\s*\)$/);
  if (mixM) {
    const a = resolveColor(set, mixM[1], seen);
    const b = resolveColor(set, mixM[3], seen);
    const w = parseFloat(mixM[2]) / 100;
    return a.map((ch, i) => Math.round(ch * w + b[i] * (1 - w)));
  }
  const c = parseColor(v);
  if (!c) throw new Error(`not a resolvable color: ${v}`);
  return c;
}

/** WCAG 2.x relative luminance + contrast ratio. */
function luminance([r, g, b]) {
  const lin = (ch) => {
    const s = ch / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function ratio(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite `rgba(r,g,b,a)` OVER `bg` (for the banner's translucent chip). */
function composite(fg, alpha, bg) {
  return fg.map((ch, i) => Math.round(ch * alpha + bg[i] * (1 - alpha)));
}

const AA = 4.5;

// ── contrast pairs: [label, fgValue, bgValue, minRatio] ──────────────────
// Values are resolved per theme; `+blend(bg)` composites first.
const PAIRS = [
  // toast trio — CAR-23 [H]: white on the near-white dark --hof was 1.10:1
  ['toast (default) text', 'var(--paper)', 'var(--hof)', AA],
  ['toast.error text', 'var(--paper)', 'var(--rausch-dark)', AA],
  ['toast.success text', 'var(--paper)', 'var(--kazan)', AA],
  // toast technical-detail chip: theme-neutral paper surface, not a dark
  // blend that turns unreadable on the bright error/success fills
  ['toast detail <code> text', 'var(--hof)', 'var(--paper)', AA],
  // .btn-dark — CAR-23 [H]: white on the near-white dark --hof was 1.10:1
  ['.btn-dark text', 'var(--paper)', 'var(--hof)', AA],
  // CAR-23 [M]: coral fill behind light text (conn-banner / onboarding-warn /
  // notif-badge use the same --rausch-dark + --paper pairing)
  ['.conn-banner text', 'var(--paper)', 'var(--rausch-dark)', AA],
  ['#onboarding-banner.onboarding-warn text', 'var(--paper)', 'var(--rausch-dark)', AA],
  ['.notif-badge count', 'var(--paper)', 'var(--rausch-dark)', AA],
  // CAR-23 [M]: text that sits ON --paper in the coral accent must use the
  // AA-tuned --rausch-text (3.52:1 light / 2.94:1 dark as raw --rausch)
  ['.tracker-tab.is-active text', 'var(--rausch-text)', 'var(--paper)', AA],
  ['.tracker-tab.is-active .tracker-tab-n count', 'var(--rausch-text)', 'var(--paper)', AA],
  ['.chip.clear text', 'var(--rausch-text)', 'var(--paper)', AA],
  ['.md a link text', 'var(--rausch-text)', 'var(--paper)', AA],
  ['.help-toc a.toc-current text', 'var(--rausch-text)', 'var(--paper)', AA],
  ['.scan-progress-label text', 'var(--rausch-text)', 'var(--paper)', AA],
];

test('every flagged text/fill pair meets WCAG AA (≥4.5:1) in light, dark-explicit and system-dark themes', () => {
  const failures = [];
  for (const [name, theme] of Object.entries(SETS)) {
    for (const [label, fgV, bgV, min] of PAIRS) {
      const fg = resolveColor(theme, fgV);
      const bg = resolveColor(theme, bgV);
      const r = ratio(fg, bg);
      if (!(r >= min)) {
        failures.push(`${name}: ${label} = ${r.toFixed(2)}:1 (${fgV} on ${bgV})`);
      }
    }
    // sanity: the two dark variants must not silently diverge
    if (name === 'darkSystem') {
      for (const t of ['--paper', '--hof', '--rausch-dark', '--kazan', '--rausch-text']) {
        const a = JSON.stringify(resolveColor(SETS.darkExplicit, `var(${t})`));
        const b = JSON.stringify(resolveColor(theme, `var(${t})`));
        assert.equal(a, b, `${t} diverges between [data-theme="dark"] and the system-dark block`);
      }
    }
  }
  assert.deepEqual(failures, [], `WCAG AA contrast failures:\n  ${failures.join('\n  ')}`);
});

test('.btn-primary / .btn-danger keep white text on EVERY gradient stop in both themes (≥4.5:1)', () => {
  // The fill is deliberately theme-INVARIANT (deep crimson): a bright dark-theme
  // coral cannot carry white text, and the buttons keep their literal #fff.
  const light = SETS.light;
  const fill = resolveColor(light, 'var(--rausch-fill)');
  const deep = resolveColor(light, 'color-mix(in srgb, var(--rausch-fill) 82%, #000)');
  const white = [255, 255, 255];
  const failures = [];
  for (const [stop, rgb] of [['start (--rausch-fill)', fill], ['end (deepened)', deep]]) {
    const r = ratio(white, rgb);
    if (!(r >= AA)) failures.push(`light: gradient ${stop} = ${r.toFixed(2)}:1`);
  }
  assert.deepEqual(failures, [], `btn gradient failures:\n  ${failures.join('\n  ')}`);
  // …and the fill still separates from a dark canvas as a UI component (1.4.11 ≥3:1)
  assert.ok(ratio(fill, resolveColor(SETS.darkExplicit, 'var(--beach)')) >= 3,
    '--rausch-fill must keep ≥3:1 against the dark canvas');
});

test('the banner Refresh chip stays readable over the translucent-black blend (both themes)', () => {
  for (const [name, theme] of Object.entries(SETS)) {
    const bannerBg = resolveColor(theme, 'var(--rausch-dark)');
    const chip = composite([0, 0, 0], 0.4, bannerBg);
    const r = ratio([255, 255, 255], chip);
    assert.ok(r >= AA, `${name}: banner .btn-dark text = ${r.toFixed(2)}:1 over the chip blend`);
  }
});

// ── bindings: the contract is tied to the selectors, not just the values ──

function rule(selector) {
  const m = CSS.match(new RegExp(selector.replace(/\s+/g, '\\s*') + '\\s*\\{([^{}]*)\\}'));
  assert.ok(m, `rule not found: ${selector}`);
  return m[1];
}

test('the flagged selectors actually paint with the AA token pair (source binding)', () => {
  assert.match(rule('\\.toast'), /color:\s*var\(--paper\)/, '.toast must paint text from --paper');
  assert.match(rule('\\.toast\\.error'), /background:\s*var\(--rausch-dark\)/, '.toast.error fill must be --rausch-dark');
  assert.match(rule('\\.toast\\.success'), /background:\s*var\(--kazan\)/, '.toast.success fill must be --kazan');
  assert.match(rule('\\.toast\\s+\\.toast-detail\\s*>\\s*code'), /background:\s*var\(--paper\)/, 'toast detail chip must be --paper');
  assert.match(rule('\\.btn-dark'), /color:\s*var\(--paper\)/, '.btn-dark must paint text from --paper');
  assert.match(rule('\\.conn-banner'), /background:\s*var\(--rausch-dark\)[\s\S]*color:\s*var\(--paper\)/, '.conn-banner must use the --rausch-dark/--paper pair');
  assert.match(rule('#onboarding-banner\\.onboarding-warn'), /background:\s*var\(--rausch-dark\)[\s\S]*color:\s*var\(--paper\)/, 'onboarding-warn must use the --rausch-dark/--paper pair');
});

test('text that sits on --paper uses --rausch-text, not raw --rausch (source binding)', () => {
  for (const sel of [
    '\\.tracker-tab\\.is-active',
    '\\.tracker-tab\\.is-active \\.tracker-tab-n',
    '\\.chip\\.clear',
    '\\.md a',
    '\\.help-toc a\\.toc-current',
    '\\.scan-progress-label',
  ]) {
    const block = rule(sel);
    assert.match(block, /color:\s*var\(--rausch-text\)/, `${sel} must paint text from --rausch-text (AA variant)`);
  }
});

test('.btn-primary/.btn-danger gradient is built from the theme-invariant --rausch-fill', () => {
  const decls = [...CSS.matchAll(/--rausch-fill\s*:/g)].length;
  assert.equal(decls, 1, '--rausch-fill must be declared exactly once on :root (theme-invariant; never redeclared under dark)');
  for (const sel of ['\\.btn-primary', '\\.btn-danger']) {
    assert.match(rule(sel), /var\(--rausch-fill\)/, `${sel} gradient must derive from --rausch-fill`);
    assert.match(rule(sel), /color:\s*#fff|color:\s*white/, `${sel} keeps literal white text`);
  }
});
