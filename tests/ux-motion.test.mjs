/**
 * ux-motion — source-static gates for the motion layer (Emil interaction
 * audit, 2026-10). Three surfaces moved together and must keep moving
 * together:
 *
 *   public/css/motion.css  — the new motion sheet, loaded LAST (every rule is
 *                            a cascade override; app.css/components.css sit
 *                            at the 800-LOC canary and must not grow);
 *   public/js/router.js    — tags the first element of a CHANGED route with
 *                            .page-enter (never on first paint / re-render);
 *   public/js/api.js       — the toast leaves via [data-leaving] +
 *                            animationend with a setTimeout fuse;
 *   public/index.html      — /css/motion.css linked after tokens-v3.css.
 *
 * Also locks the motion contracts themselves: durations ride the --motion-*
 * tokens (the only literal ms values are the token definitions and the
 * stagger delay ramp), easing consumes var(--ease-out)/--ease-spring (never
 * a literal easing keyword), every motion rule has a reduced-motion
 * neutralizer, and the car112 skeleton contract stays untouched in
 * overlays.css.
 *
 * CI-isolated: pure source-static reads, no server, no network, no parent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const MOTION_PATH = 'public/css/motion.css';
const MOTION = read(MOTION_PATH);
const ROUTER = read('public/js/router.js');
const API = read('public/js/api.js');
const INDEX = read('public/index.html');
const OVERLAYS = read('public/css/overlays.css');

/** Blank out /* … *\/ comments so prose can't read as a declaration. */
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

// ── 1 · the sheet itself ──────────────────────────────────────────────────

test('motion.css exists and stays within its own 400-line budget', () => {
  const lines = MOTION.split('\n').length;
  assert.ok(lines > 0, 'motion.css must exist');
  assert.ok(lines <= 400, `motion.css is ${lines} lines — over the 400-line motion-layer budget`);
});

test('motion tokens are declared once in the motion sheet', () => {
  const src = noComments(MOTION);
  for (const tok of ['--ease-spring', '--motion-fast', '--motion-base', '--motion-rise']) {
    const decls = [...src.matchAll(new RegExp(`${tok}\\s*:`, 'g'))].length;
    assert.equal(decls, 1, `${tok} declared ${decls}× (want exactly 1, in the motion :root)`);
  }
  assert.match(src, /--ease-spring:\s*cubic-bezier\(\.34,\s*1\.56,\s*\.64,\s*1\)/);
  // --ease-out itself is NOT re-declared: it lives once in the app token
  // block (design-v3-phase3 hand-off) and motion.css only consumes it.
  assert.doesNotMatch(src, /--ease-out\s*:/);
  assert.match(src, /var\(--ease-out\)/);
});

test('every animation/transition duration rides a token — literals only in token defs and the stagger delay ramp', () => {
  const src = noComments(MOTION);
  const offenders = [];
  for (const line of src.split('\n')) {
    if (!/\d*\.?\d+(?:ms|s)\b/.test(line)) continue;
    const isTokenDef = /--motion-(fast|base|rise)\s*:/.test(line);
    const isDelay = /animation-delay\s*:/.test(line);
    if (!isTokenDef && !isDelay) offenders.push(line.trim());
  }
  assert.deepEqual(offenders, [],
    `literal durations outside the token block / delay ramp (fold onto var(--motion-*)):\n  ${offenders.join('\n  ')}`);
  // the shorthand declarations must consume the tokens
  assert.match(src, /animation:\s*m-fade\s+var\(--motion-fast\)\s+var\(--ease-out\)\s+forwards/);
  assert.match(src, /animation:\s*m-rise\s+var\(--motion-base\)\s+var\(--ease-out\)\s+forwards/);
  assert.match(src, /animation:\s*toast-in\s+var\(--motion-rise\)\s+var\(--ease-spring\)/);
  assert.match(src, /animation:\s*toast-out\s+var\(--motion-fast\)\s+var\(--ease-out\)\s+both/);
  assert.match(src, /animation:\s*rise-in\s+var\(--motion-base\)\s+var\(--ease-out\)/);
});

test('no literal ease-out easing keyword anywhere in the motion sheet', () => {
  assert.doesNotMatch(noComments(MOTION), /(?<!-)\bease-out\b/);
});

// ── 2 · touch + lift contracts (CAR-207 / CAR-196) ────────────────────────

test('CAR-207: (hover: none) neutralizes every hover lift', () => {
  const block = MOTION.match(/@media \(hover: none\) \{[\s\S]*?\n\}/);
  assert.ok(block, 'the (hover: none) touch block must exist');
  for (const sel of ['.qa-tile:hover', '.metric-card:hover', '.card:hover', '.docs-fab:hover', '.btn:hover']) {
    assert.ok(block[0].includes(sel), `touch block must neutralize ${sel}`);
  }
  assert.match(block[0], /transform:\s*none/);
});

test('CAR-196: on pointer devices the .card lift is interactive-only', () => {
  const block = MOTION.match(/@media \(hover: hover\) \{[\s\S]*?\n\}/);
  assert.ok(block, 'the (hover: hover) lift block must exist');
  assert.match(block[0], /\.card:hover\s*\{[^}]*transform:\s*none/);
  for (const sel of ['.card:has(a):hover', 'a.card:hover', 'button.card:hover', '[role="button"].card:hover']) {
    assert.ok(block[0].includes(sel), `interactive card lift must cover ${sel}`);
  }
  assert.match(block[0], /transform:\s*translateY\(-1px\)/);
});

// ── 3 · modal / popover / press / theme-toggle ────────────────────────────

test('modal enter: backdrop fades, card rises — using the REAL base-sheet class names', () => {
  // classes live in overlays.css (.modal-backdrop / .modal-card) — if the
  // base sheet renames them, this pin fails and motion.css must follow.
  assert.match(OVERLAYS, /\.modal-backdrop \{/);
  assert.match(OVERLAYS, /\.modal-card \{/);
  assert.match(noComments(MOTION), /\.modal-backdrop\s*\{[^}]*animation:\s*m-fade/);
  assert.match(noComments(MOTION), /\.modal-card\s*\{[^}]*animation:\s*m-rise/);
  for (const kf of ['m-fade', 'm-rise']) {
    assert.match(MOTION, new RegExp(`@keyframes ${kf}\\b`), `@keyframes ${kf} must exist`);
  }
});

test('popovers rise on open — help-pop and v2-scan-pop both covered', () => {
  assert.match(noComments(MOTION), /\.help-pop,\s*\.v2-scan-pop\s*\{[^}]*animation:\s*m-rise/);
});

test('press feedback: chip/tab/tracker-tab/map-chip scale on :active with a transform-capable transition; .btn untouched', () => {
  const src = noComments(MOTION);
  assert.match(src, /\.chip:active,\s*\.tab-btn:active,\s*\.tracker-tab:active,\s*\.v2-map-chip:active\s*\{[^}]*transform:\s*scale\(\.97\)/);
  // the transition override adds transform FIRST (the base sheets' lists lack it)
  assert.match(src, /\.chip,\s*\.tab-btn,\s*\.tracker-tab,\s*\.v2-map-chip\s*\{[^}]*transition:[^;]*transform\s+var\(--motion-fast\)/);
  // .btn keeps the app.css press — motion.css must not re-style it
  assert.doesNotMatch(src, /\.btn\s*[,{]/);
});

test('theme-toggle gets the spring press; the icon swap stays in components.css', () => {
  const src = noComments(MOTION);
  assert.match(src, /\.theme-toggle\s*\{[^}]*transition:[^;]*var\(--ease-spring\)/);
  assert.match(src, /\.theme-toggle:active\s*\{[^}]*transform:\s*scale\(\.92\)/);
});

// ── 4 · route enter (router.js) ───────────────────────────────────────────

test('router.js tags changed routes with page-enter; first paint and re-renders do not animate', () => {
  assert.match(ROUTER, /page-enter/);
  assert.match(MOTION, /\.page-enter\s*\{[^}]*animation:\s*rise-in/);
  // the change detection: a tracked previous name, null on first paint
  assert.match(ROUTER, /prevRouteName\s*=\s*null/);
  assert.match(ROUTER, /prevRouteName\s*!==\s*null\s*&&\s*prevRouteName\s*!==\s*name/);
  // applied on BOTH render paths (success + error), next to focusNewView
  const calls = ROUTER.match(/applyRouteEnter\(content, routeChanged\)/g) || [];
  assert.ok(calls.length >= 2, `expected applyRouteEnter on ≥2 render paths, found ${calls.length}`);
});

// ── 5 · toast leave (api.js) ──────────────────────────────────────────────

test('api.js hides the toast through data-leaving + animationend with a setTimeout fuse', () => {
  assert.match(API, /data-leaving/);
  assert.match(API, /animationend/);
  assert.match(API, /animationName\s*===?\s*['"]toast-out['"]/);
  assert.match(MOTION, /\.toast\[data-leaving\]\s*\{[^}]*animation:\s*toast-out/);
  // the fuse: a bounded timer completes the hide if animationend never fires
  assert.match(API, /setTimeout\(finish,\s*200\)/);
  // the dwell timer and dismissToast() both route through hideToast
  assert.match(API, /setTimeout\(\(\) => hideToast\(t\), dwell\)/);
  assert.match(API, /function dismissToast\(\)/); // name pinned by qa-report-fixes
  assert.match(API, /if \(t\) hideToast\(t\)/);
  // a re-shown toast cancels a pending leave
  assert.match(API, /if \(t\._toastLeave\) t\._toastLeave\(\);/);
});

// ── 6 · reduced motion + untouched contracts ──────────────────────────────

test('every motion rule has a prefers-reduced-motion neutralizer in the motion sheet', () => {
  const block = MOTION.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\n\}/);
  assert.ok(block, 'the motion reduce block must exist');
  const b = block[0];
  for (const sel of ['.modal-backdrop', '.modal-card', '.help-pop', '.v2-scan-pop', '.card:has(a):hover',
    '.toast[data-leaving]', '.page-enter', '.stagger > *']) {
    assert.ok(b.includes(sel), `reduce block must neutralize ${sel}`);
  }
});

test('the car112 skeleton contract is untouched — overlays.css still owns the exact reduce pin', () => {
  assert.match(OVERLAYS, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.skeleton-row \{ animation: none;/);
  // no skeleton RULES in the motion sheet (comment prose may mention why not)
  assert.doesNotMatch(noComments(MOTION), /skeleton/);
});

// ── 7 · index.html wiring ─────────────────────────────────────────────────

test('index.html links /css/motion.css after tokens-v3.css — the cascade-last position', () => {
  const motion = INDEX.indexOf('/css/motion.css');
  const tokens = INDEX.indexOf('/css/tokens-v3.css');
  assert.ok(tokens > -1, 'tokens-v3.css must be linked');
  assert.ok(motion > -1, 'motion.css must be linked');
  assert.ok(motion > tokens, 'motion.css must load AFTER tokens-v3.css (cascade-last override sheet)');
  // and it is the LAST app stylesheet of all
  const lastCss = INDEX.lastIndexOf('/css/');
  assert.equal(lastCss, motion, 'motion.css must be the last /css/ link in index.html');
});
