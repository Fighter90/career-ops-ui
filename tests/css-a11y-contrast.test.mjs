/**
 * BACKLOG css-a11y (CAR-23) — WCAG AA contrast CONTRACTS for the pairs the
 * audit flagged, computed from the live token values in the app stylesheets:
 * light `:root`, explicit `[data-theme="dark"]`, and the
 * `prefers-color-scheme: dark` fallback block. The two dark variants carry
 * identical values today but are asserted separately, so a drift between
 * them fails here instead of shipping a half-dark theme.
 *
 * Design v3 phase 2 (Lovable palette): app.css token values are `var(--cv3-*)`
 * indirections into tokens-v3.css, so the concatenation includes that sheet
 * (helpers/css.mjs APP_CSS_FILES) and the value engine understands `oklch()`.
 * Dark sets INHERIT the light declarations (real cascade semantics) — a token
 * declared once on :root (e.g. the theme-invariant --rausch-fill, or the
 * --cv3-* indirections that re-resolve per element) resolves in every theme.
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

const LIGHT = blocksBySelector(CSS, ':root(?!\\()');
const SETS = {
  light: LIGHT,
  // dark sets inherit the light declarations (cascade semantics): a :root
  // token re-resolves per element, so it is visible under data-theme too.
  darkExplicit: { ...LIGHT, ...blocksBySelector(CSS, '\\[data-theme="dark"\\]') },
  darkSystem: { ...LIGHT, ...blocksBySelector(CSS, ':root:not\\(\\[data-theme="light"\\]\\)[^{}]*') },
};

/** oklch(L C H[/a]) → [r,g,b] (OKLab → linear sRGB → gamma; clamped). */
function oklchToSrgb(L, C, H) {
  const hr = (H * Math.PI) / 180, a = C * Math.cos(hr), b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3, m3 = m_ ** 3, s3 = s_ ** 3;
  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  const gam = (c) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)));
  return [gam(r), gam(g), gam(bb)];
}

/** Parse a color literal to [r,g,b]. Supports #rgb/#rrggbb/rgb(a)()/oklch(). */
function parseColor(v) {
  const hex = v.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) return [0, 1, 2].map((i) => parseInt(h[i] + h[i], 16));
    if (h.length >= 6) return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const rgb = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]|$)/i);
  if (rgb) return [1, 2, 3].map((i) => Math.round(parseFloat(rgb[i])));
  const ok = v.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.%]+)\s*)?\)$/i);
  if (ok) return oklchToSrgb(parseFloat(ok[1]), parseFloat(ok[2]), parseFloat(ok[3]));
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
  // v3 phase 2 — toast.error rides the theme-INVARIANT danger red --rausch-fill
  // with literal white text (the inherited --paper goes near-black in dark)
  ['toast.error text', '#ffffff', 'var(--rausch-fill)', AA],
  ['toast.success text', 'var(--cv3-ok-ink)', 'var(--cv3-ok-soft)', AA],
  // toast technical-detail chip: theme-neutral paper surface, not a dark
  // blend that turns unreadable on the bright error/success fills
  ['toast detail <code> text', 'var(--hof)', 'var(--paper)', AA],
  // .btn-dark — CAR-23 [H]: white on the near-white dark --hof was 1.10:1
  ['.btn-dark text', 'var(--paper)', 'var(--hof)', AA],
  // CAR-23 [M]: accent fill behind light text (conn-banner / onboarding-warn /
  // notif-badge use the same --rausch-dark + --paper pairing; v3 = accent blue)
  ['.conn-banner text', 'var(--paper)', 'var(--rausch-dark)', AA],
  ['#onboarding-banner.onboarding-warn text', 'var(--paper)', 'var(--rausch-dark)', AA],
  ['.notif-badge count', 'var(--paper)', 'var(--rausch-dark)', AA],
  // CAR-23 [M]: text that sits ON --paper in the danger red must use the
  // AA-tuned --rausch-text (v3 = the cv3 danger ink; 7.47/10.60:1)
  ['.chip.clear text', 'var(--rausch-text)', 'var(--paper)', AA],
  ['.md a link text', 'var(--rausch-text)', 'var(--paper)', AA],
  ['.help-toc a.toc-current text', 'var(--rausch-text)', 'var(--paper)', AA],
  ['.scan-progress-label text', 'var(--rausch-text)', 'var(--paper)', AA],
  // v3 phase 2 — ACTIVE states moved to the independent accent family:
  // text from --accent-soft-ink (8.38/8.63:1), not the danger ink
  ['.tracker-tab.is-active text', 'var(--accent-soft-ink)', 'var(--paper)', AA],
  ['.tracker-tab.is-active .tracker-tab-n count', 'var(--accent-soft-ink)', 'var(--paper)', AA],
  ['.v2-scan-chip-btn.is-on text', 'var(--accent-soft-ink)', 'var(--paper)', AA],
  // v3 phase 2 — the primary button is flat accent: cv3 ink on the cv3 fill
  // (light 6.01:1; dark flips the ink near-black — literal white is 2.46:1)
  ['.btn-primary text', 'var(--accent-ink)', 'var(--accent-c)', AA],
  // v3 phase 2 — score chips ride the cv3 band pairs (ink on its own wash)
  ['score-high chip', 'var(--band-a-ink)', 'var(--band-a-bg)', AA],
  ['score-good chip', 'var(--band-b-ink)', 'var(--band-b-bg)', AA],
  ['score-mid chip', 'var(--band-d-ink)', 'var(--band-d-bg)', AA],
  ['score-low chip', 'var(--band-g-ink)', 'var(--band-g-bg)', AA],
  ['score-muted chip', 'var(--cv3-neutral-ink)', 'var(--cv3-neutral-soft)', AA],
  // v3 phase 2 — callout families on the cv3 soft/ink pairs
  ['callout--info text', 'var(--cv3-info-ink)', 'var(--cv3-info-soft)', AA],
  ['callout--warn text', 'var(--cv3-warn-ink)', 'var(--cv3-warn-soft)', AA],
  // v3 phase 3 — the ok/danger callout contract (future-use) on the same pairs
  ['callout--ok text', 'var(--cv3-ok-ink)', 'var(--cv3-ok-soft)', AA],
  ['callout--danger text', 'var(--cv3-danger-ink)', 'var(--cv3-danger-soft)', AA],
  // v3 phase 3 — the danger wash consumers (badge-bad keeps the AA danger ink)
  ['.badge-bad text', 'var(--rausch-text)', 'var(--danger-soft)', AA],
  // v3 phase 3 — active tabs are ACCENT semantics like their phase-2 siblings
  ['.tab-btn.is-active text', 'var(--accent-soft-ink)', 'var(--accent-soft)', AA],
  // v3 phase 2 — scan-error banner on the closed --rose* hand-off
  ['scan-error-banner text', 'var(--rose-ink)', 'var(--rose)', AA],
  // v3 phase 2 — .brief-warning on the closed --warn-* hand-off
  ['.brief-warning text', 'var(--warn-fg)', 'var(--warn-bg)', AA],
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
      for (const t of ['--paper', '--hof', '--rausch-dark', '--cv3-ok-soft', '--rausch-text', '--accent-c', '--band-a-ink']) {
        const a = JSON.stringify(resolveColor(SETS.darkExplicit, `var(${t})`));
        const b = JSON.stringify(resolveColor(theme, `var(${t})`));
        assert.equal(a, b, `${t} diverges between [data-theme="dark"] and the system-dark block`);
      }
    }
  }
  assert.deepEqual(failures, [], `WCAG AA contrast failures:\n  ${failures.join('\n  ')}`);
});

test('.btn-danger keeps white text on EVERY gradient stop in both themes (≥4.5:1); the fill separates from the dark canvas (1.4.11)', () => {
  // The fill is deliberately theme-INVARIANT (deep danger red, the cv3-danger
  // light value): a bright dark-theme red cannot carry white text, and the
  // button keeps its literal #fff.
  const fill = resolveColor(SETS.light, 'var(--rausch-fill)');
  const deep = resolveColor(SETS.light, 'color-mix(in srgb, var(--rausch-fill) 82%, #000)');
  const white = [255, 255, 255];
  const failures = [];
  for (const [stop, rgb] of [['start (--rausch-fill)', fill], ['end (deepened)', deep]]) {
    const r = ratio(white, rgb);
    if (!(r >= AA)) failures.push(`gradient ${stop} = ${r.toFixed(2)}:1`);
  }
  assert.deepEqual(failures, [], `btn-danger gradient failures:\n  ${failures.join('\n  ')}`);
  // …and the fill still separates from a dark canvas as a UI component (1.4.11 ≥3:1)
  assert.ok(ratio(fill, resolveColor(SETS.darkExplicit, 'var(--beach)')) >= 3,
    '--rausch-fill must keep ≥3:1 against the dark canvas');
});

test('.btn-primary paints flat accent (ink on fill ≥4.5:1 per theme; the light/dark ink flip is load-bearing)', () => {
  for (const [name, theme] of Object.entries(SETS)) {
    const r = ratio(resolveColor(theme, 'var(--accent-ink)'), resolveColor(theme, 'var(--accent-c)'));
    assert.ok(r >= AA, `${name}: btn-primary = ${r.toFixed(2)}:1`);
  }
  // the ink must genuinely flip per theme (near-black on light blue in dark;
  // literal white on the dark accent is 2.46:1 — the Lovable pairing)
  const lightInk = JSON.stringify(resolveColor(SETS.light, 'var(--accent-ink)'));
  const darkInk = JSON.stringify(resolveColor(SETS.darkExplicit, 'var(--accent-ink)'));
  assert.notEqual(lightInk, darkInk, '--accent-ink must follow the theme (white light / near-black dark)');
});

test('the banner Refresh chip stays readable over the translucent-black blend (both themes)', () => {
  for (const [name, theme] of Object.entries(SETS)) {
    const bannerBg = resolveColor(theme, 'var(--rausch-dark)');
    const chip = composite([0, 0, 0], 0.4, bannerBg);
    const r = ratio([255, 255, 255], chip);
    assert.ok(r >= AA, `${name}: banner .btn-dark text = ${r.toFixed(2)}:1 over the chip blend`);
  }
});

test('banner .btn-dark rules BIND literal white text (owner screenshot: var(--ink) painted black-on-crimson in light)', () => {
  for (const sel of ['.conn-banner \\.btn-dark', '#onboarding-banner\\.onboarding-warn \\.btn-dark']) {
    const r = rule(sel);
    assert.match(r, /color:\s*#fff/i, `${sel} must paint literal white — --ink is near-black in light`);
    assert.doesNotMatch(r, /var\(--ink\)/, `${sel} must not ride --ink (theme-flipped to black in light)`);
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
  assert.match(rule('\\.toast\\.error'), /background:\s*var\(--rausch-fill\)/, '.toast.error fill must be the invariant danger red --rausch-fill');
  assert.match(rule('\\.toast\\.error'), /color:\s*#fff/, '.toast.error keeps literal white text over the invariant fill');
  assert.match(rule('\\.toast\\.success'), /background:\s*var\(--cv3-ok-soft\)/, '.toast.success fill must be the ok-soft AA pair');
  assert.match(rule('\\.toast\\s+\\.toast-detail\\s*>\\s*code'), /background:\s*var\(--paper\)/, 'toast detail chip must be --paper');
  assert.match(rule('\\.btn-dark'), /color:\s*var\(--paper\)/, '.btn-dark must paint text from --paper');
  assert.match(rule('\\.conn-banner'), /background:\s*var\(--rausch-dark\)[\s\S]*color:\s*var\(--paper\)/, '.conn-banner must use the --rausch-dark/--paper pair');
  assert.match(rule('#onboarding-banner\\.onboarding-warn'), /background:\s*var\(--rausch-dark\)[\s\S]*color:\s*var\(--paper\)/, 'onboarding-warn must use the --rausch-dark/--paper pair');
});

test('danger-red text on --paper paints --rausch-text; ACTIVE states paint the accent family (source binding)', () => {
  for (const sel of [
    '\\.chip\\.clear',
    '\\.md a',
    '\\.help-toc a\\.toc-current',
    '\\.scan-progress-label',
  ]) {
    const block = rule(sel);
    assert.match(block, /color:\s*var\(--rausch-text\)/, `${sel} must paint text from --rausch-text (danger ink, AA variant)`);
  }
  // v3 phase 2 — active/selected states are ACCENT semantics now
  for (const sel of [
    '\\.tracker-tab\\.is-active',
    '\\.tracker-tab\\.is-active \\.tracker-tab-n',
    '\\.v2-scan-chip-btn\\.is-on',
  ]) {
    const block = rule(sel);
    assert.match(block, /color:\s*var\(--accent-soft-ink\)/, `${sel} must paint text from --accent-soft-ink (active = accent family)`);
  }
});

test('the phase-3 consumers paint the cv3 pairs they are contrast-gated on (source binding)', () => {
  // .badge-bad washes --danger-soft under the AA danger ink
  const bad = rule('\\.badge-bad');
  assert.match(bad, /background:\s*var\(--danger-soft\)/, '.badge-bad must wash --danger-soft');
  assert.match(bad, /color:\s*var\(--rausch-text\)/, '.badge-bad text stays --rausch-text (danger ink)');
  // active tabs joined the accent pair
  const tab = rule('\\.tab-btn\\.is-active');
  assert.match(tab, /background:\s*var\(--accent-soft\)/, '.tab-btn.is-active must wash --accent-soft');
  assert.match(tab, /color:\s*var\(--accent-soft-ink\)/, '.tab-btn.is-active text must paint --accent-soft-ink');
  // the ok/danger callout contract rides the same soft/ink pairs as --info/--warn
  const ok = rule('\\.callout--ok');
  assert.match(ok, /--callout-bg:\s*var\(--cv3-ok-soft\)/);
  assert.match(ok, /--callout-text:\s*var\(--cv3-ok-ink\)/);
  const danger = rule('\\.callout--danger');
  assert.match(danger, /--callout-bg:\s*var\(--cv3-danger-soft\)/);
  assert.match(danger, /--callout-text:\s*var\(--cv3-danger-ink\)/);
});

test('.btn-danger gradient is built from the theme-invariant --rausch-fill; .btn-primary is flat accent', () => {
  const decls = [...CSS.matchAll(/--rausch-fill\s*:/g)].length;
  assert.equal(decls, 1, '--rausch-fill must be declared exactly once on :root (theme-invariant; never redeclared under dark)');
  assert.match(rule('\\.btn-danger'), /var\(--rausch-fill\)/, '.btn-danger gradient must derive from --rausch-fill');
  assert.match(rule('\\.btn-danger'), /color:\s*#fff|color:\s*white/, '.btn-danger keeps literal white text');
  assert.match(rule('\\.btn-primary'), /background:\s*var\(--accent-c\)/, '.btn-primary must paint the flat accent fill');
  assert.match(rule('\\.btn-primary'), /color:\s*var\(--accent-ink\)/, '.btn-primary must paint text from --accent-ink');
  assert.doesNotMatch(rule('\\.btn-primary'), /--rausch/, '.btn-primary must be off the rausch family entirely (accent split)');
});
