/**
 * CAR-121 — [UX·Порталы и Состояние] #/portals + #/health v2.
 *
 * Spec (Linear CAR-121, ux-epics.md):
 *   - #/portals: search over the tracked companies (name / domain substring,
 *     debounced), an enabled/disabled filter, grouping by ATS vendor
 *     (Greenhouse, Ashby, Lever, Workable…, Other last), enable/disable as a
 *     real switch with an UNDO bar (same write path POST /api/portals/toggle,
 *     one bar per action — the pipeline undo pattern).
 *   - #/health: a calm page — success summary ("✓ all required checks pass ·
 *     active provider") on top, required checks prominent, the ~20 optional
 *     provider rows collapsed into an <details> "Optional" section, and no
 *     orange badges for merely-unset optional keys. Every row keeps its
 *     FIX_TARGETS hint.
 *
 * The views are browser-only Router registrations, so — per the standing repo
 * convention (funded-view.test.mjs, views-client-fixes-car21.test.mjs) — these
 * are static source canaries plus vm-extracted pure helpers
 * (vendorOf / matchPortal / matchState / sortGroup).
 *
 * CI-isolated: reads files only; no server, no network, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { loadAppCss } from './helpers/css.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PORTALS = readFileSync(resolve(ROOT, 'public/js/views/portals.js'), 'utf8');
const HEALTH = readFileSync(resolve(ROOT, 'public/js/views/health.js'), 'utf8');

/** Bracket-match a top-level `const NAME = …;` declaration (array or object). */
function extractConst(src, name) {
  const start = src.indexOf(`const ${name} =`);
  if (start === -1) throw new Error(`const ${name} not found`);
  const openRel = src.slice(start).search(/\[|\{/);
  const open = start + openRel;
  const openCh = src[open];
  const closeCh = openCh === '[' ? ']' : '}';
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === openCh) depth += 1;
    else if (src[i] === closeCh) { depth -= 1; if (depth === 0) return src.slice(start, i + 1) + ';'; }
  }
  throw new Error(`const ${name}: unterminated`);
}

/** Brace-match a `function NAME(…) {…}` out of src. */
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`function ${name} not found`);
  let depth = 0;
  let i = src.indexOf('{', start);
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
  }
  return src.slice(start, i);
}

function loadPortalsHelpers() {
  const ctx = createContext({});
  runInContext([
    extractConst(PORTALS, 'ATS_VENDORS'),
    extractConst(PORTALS, 'PROVIDER_LABELS'),
    extractFn(PORTALS, 'vendorOf'),
    extractFn(PORTALS, 'matchPortal'),
    extractFn(PORTALS, 'matchState'),
    'globalThis.__h = { vendorOf, matchPortal, matchState };',
  ].join('\n'), ctx);
  return ctx.__h;
}

// ─────────────────── #/portals · search + filter ───────────────────

test('portals: a debounced search input filters by name/domain substring', () => {
  // The toolbar exists…
  assert.match(PORTALS, /t\('portals\.search',/, 'search input is i18n-keyed');
  assert.match(PORTALS, /addEventListener\('input'/, 'live filtering on input');
  // …with a debounce timer so typing 129-company queries does not re-render per key.
  assert.match(PORTALS, /let searchTimer = 0;/, 'debounce timer state');
  assert.match(PORTALS, /clearTimeout\(searchTimer\)/, 'pending debounce cancelled');
  assert.match(PORTALS, /searchTimer = setTimeout\([\s\S]*?, 250\)/, 'debounce window is 250ms');
  const { matchPortal } = loadPortalsHelpers();
  const stripe = { name: 'Stripe', careers_url: 'https://boards.greenhouse.io/stripe' };
  assert.equal(matchPortal(stripe, ''), true, 'empty query matches everything');
  assert.equal(matchPortal(stripe, 'str'), true, 'name substring');
  assert.equal(matchPortal(stripe, 'STRIPE'), true, 'case-insensitive name');
  assert.equal(matchPortal(stripe, 'greenhouse'), true, 'domain substring');
  assert.equal(matchPortal(stripe, 'linear'), false, 'no match');
  assert.equal(matchPortal({ name: '', careers_url: '' }, 'x'), false, 'empty row never matches');
});

test('portals: an enabled-state filter (all / enabled / disabled)', () => {
  assert.match(PORTALS, /t\('portals\.filterAll',/);
  assert.match(PORTALS, /t\('portals\.filterEnabled',/);
  assert.match(PORTALS, /t\('portals\.filterDisabled',/);
  const { matchState } = loadPortalsHelpers();
  const on = { enabled: true }; const off = { enabled: false }; const unset = {};
  assert.equal(matchState(on, 'all') && matchState(off, 'all') && matchState(unset, 'all'), true);
  assert.equal(matchState(on, 'on'), true);
  assert.equal(matchState(unset, 'on'), true, 'undefined enabled counts as watched (scanner `!== false`)');
  assert.equal(matchState(off, 'on'), false);
  assert.equal(matchState(off, 'off'), true);
  assert.equal(matchState(on, 'off'), false);
});

// ─────────────────── #/portals · ATS grouping ───────────────────

test('portals: vendorOf derives the ATS vendor from the careers_url host', () => {
  const { vendorOf } = loadPortalsHelpers();
  assert.equal(vendorOf({ careers_url: 'https://boards.greenhouse.io/stripe' }), 'Greenhouse');
  assert.equal(vendorOf({ careers_url: 'https://jobs.eu.lever.co/acme' }), 'Lever');
  assert.equal(vendorOf({ careers_url: 'https://jobs.ashbyhq.com/x' }), 'Ashby');
  assert.equal(vendorOf({ careers_url: 'https://www.myworkdayjobs.com/en-US/x' }), 'Workday');
  assert.equal(vendorOf({ careers_url: 'https://careers.smartrecruiters.com/x' }), 'SmartRecruiters');
  assert.equal(vendorOf({ careers_url: 'https://hh.ru/employer/123' }), 'hh.ru');
  // provider field is the fallback when the host is not recognisable…
  assert.equal(vendorOf({ careers_url: 'https://jobs.example.com/x', provider: 'ashby' }), 'Ashby');
  // …and unknown hosts fall to the "Other" group (null — the view labels it).
  assert.equal(vendorOf({ careers_url: 'https://careers.example.com/x', provider: '' }), null);
  assert.equal(vendorOf({ careers_url: '', provider: '' }), null);
  assert.equal(vendorOf(null), null);
});

test('portals: rows render grouped by ATS vendor, "Other" last, with per-group counts', () => {
  assert.match(PORTALS, /v2-portals-group-h/, 'group header class');
  assert.match(PORTALS, /v2-portals-count/, 'per-group count badge');
  assert.match(PORTALS, /t\('portals\.groupOther',/, 'the Other group is labelled');
  // sort: alphabetical vendors, but the Other group sinks to the end.
  const groupAt = PORTALS.indexOf('function renderList');
  const seg = PORTALS.slice(groupAt);
  assert.match(seg, /localeCompare/, 'groups sort alphabetically');
  assert.match(seg, /=== otherLabel\) return 1/, 'Other sorts last');
  // dead-first / enabled-first ordering survives INSIDE each group.
  const { sortGroup } = (() => {
    const ctx = createContext({});
    runInContext(extractFn(PORTALS, 'sortGroup') + '\nglobalThis.__sg = sortGroup;', ctx);
    return ctx;
  })();
  const health = { 'https://x/dead': { ok: false } };
  const sorted = sortGroup([
    { name: 'Zeta', careers_url: '', enabled: true },
    { name: 'Dead Co', careers_url: 'https://x/dead', enabled: true },
    { name: 'Alpha', careers_url: '', enabled: false },
    { name: 'Alive', careers_url: '', enabled: true },
  ], health);
  assert.deepEqual(sorted.map((x) => x.name), ['Dead Co', 'Alive', 'Zeta', 'Alpha'],
    'dead first, then enabled, then by name');
});

test('portals: an empty search result says so (not the "not tracked yet" text)', () => {
  assert.match(PORTALS, /t\('portals\.noMatch',/);
});

// ─────────────────── #/portals · switch + undo ───────────────────

test('portals: enable/disable is a real switch (checkbox role=switch) that names its portal', () => {
  assert.match(PORTALS, /type: 'checkbox'/, 'a real checkbox input');
  assert.match(PORTALS, /role: 'switch'/, 'switch semantics');
  // The CAR-21 contract stays: the control announces Disable/Enable + the company.
  assert.match(PORTALS, /'aria-label':\s*\(isOn \? t\('portals\.disable', 'Disable'\) : t\('portals\.enable', 'Enable'\)\)/);
  assert.match(PORTALS, /\+ ': ' \+ \(company\.name \|\| company\.careers_url\)/);
});

test('portals: toggles are undoable through the same POST /api/portals/toggle write path', () => {
  // one undo bar per action, LIFO, session-scoped, body-level (pipeline pattern).
  assert.match(PORTALS, /const undoStack = \[\];/, 'LIFO undo stack');
  assert.match(PORTALS, /id: 'portals-undo-bar'/, 'single body-level bar');
  assert.match(PORTALS, /role: 'status'/, 'announced politely');
  assert.match(PORTALS, /'aria-live': 'polite'/);
  assert.match(PORTALS, /setTimeout\(\(\) => \{ bar\.hidden = true; \}, 8000\)/, 'auto-hides');
  assert.match(PORTALS, /t\('pipe\.undo', 'Undo'\)/, 'Undo button (existing key)');
  assert.match(PORTALS, /t\('pipe\.undoDismiss', 'Dismiss'\)/, 'Dismiss button (existing key)');
  // The ONLY write path is POST /api/portals/toggle — the forward toggle AND
  // the undo re-apply both go through it, nothing else writes.
  const sites = [...PORTALS.matchAll(/API\.post\('\/api\/portals\/toggle'/g)].length;
  assert.equal(sites, 2, `forward toggle + undo, found ${sites} call sites`);
  // undo restores the PREVIOUS state (not a blind flip).
  assert.match(PORTALS, /prev: !next/, 'the pre-toggle state is recorded');
});

// ─────────────────────────── #/health v2 ───────────────────────────

test('health: the active provider is fetched and only the success case shows the green summary', () => {
  assert.match(HEALTH, /api\/status\/providers/, 'provider status is fetched');
  assert.match(HEALTH, /\.catch\(\(\) => null\)/, 'provider fetch failure degrades quietly');
  assert.match(HEALTH, /t\('health\.allOk',/, 'success summary is keyed');
  assert.match(HEALTH, /t\('health\.activeProvider'/, 'active-provider line is keyed');
  // the banner renders ONLY when every required check passes.
  const bannerAt = HEALTH.indexOf("t('health.allOk'");
  const gateAt = HEALTH.indexOf('requiredBad.length === 0');
  assert.ok(gateAt > -1, 'required-failure gate exists');
  assert.ok(bannerAt > gateAt, 'the banner is built after (behind) the gate');
});

test('health: required checks stay prominent, optional ones collapse into <details>', () => {
  assert.match(HEALTH, /c\('details'/, 'optional section is a collapsed details');
  assert.match(HEALTH, /c\('summary'/, 'with a summary as its accessible name');
  assert.match(HEALTH, /t\('health\.optionalCollapsed',/, 'summary counts the unset optional keys');
  assert.match(HEALTH, /t\('health\.optionalOk',/, 'all-set optional section says so');
  // required first, optional after: the required list renders before the details.
  const requiredAt = HEALTH.indexOf('requiredChecks');
  const detailsAt = HEALTH.indexOf("c('details'");
  assert.ok(requiredAt > -1 && detailsAt > requiredAt, 'required list before the optional details');
});

test('health: orange is reserved for real problems — no badge-warn on optional rows', () => {
  assert.doesNotMatch(HEALTH, /badge-warn/, 'the OPTIONAL orange badge is gone');
  assert.match(HEALTH, /t\('health\.badgeOk'/, 'ok rows stay green');
  assert.match(HEALTH, /t\('health\.badgeFail'/, 'required failures stay red');
});

test('health: every row (required and optional) keeps its FIX_TARGETS hint', () => {
  assert.match(HEALTH, /const FIX_TARGETS = \{/, 'the fix-target map survives');
  assert.match(HEALTH, /\/_API_KEY\$\//, 'the *_API_KEY fallback survives');
  // one shared row renderer used by BOTH lists → optional rows keep Fix →.
  assert.match(HEALTH, /requiredChecks\.map\(checkRow\)/, 'required rows through the shared renderer');
  assert.match(HEALTH, /optionalChecks\.map\(checkRow\)/, 'optional rows through the same renderer');
});

// ─────────────────────────────── CSS ───────────────────────────────

test('v2-portals.css: switch, groups, undo bar, health-summary styles exist', () => {
  // The CAR-121 styles live in a dedicated stylesheet (the v2-pipeline.css /
  // v2-reports.css pattern): components.css sits at its 800-LOC hard limit,
  // so appending there breaks the css-modularization gate.
  const css = readFileSync(resolve(ROOT, 'public/css/v2-portals.css'), 'utf8');
  for (const sel of [
    '.v2-portals-switch',
    '.v2-portals-switch:checked',
    '.v2-portals-switch:focus-visible',
    '.v2-portals-group-h',
    '.v2-portals-count',
    '.v2-portals-undo-bar',
    '.v2-portals-undo-bar[hidden]',
    '.v2-portals-health-ok',
    '.v2-portals-optional',
  ]) {
    assert.ok(css.includes(sel), `missing ${sel}`);
  }
  // Reduced motion: the switch animates via `transition`, which the global
  // `@media (prefers-reduced-motion: reduce)` neutralizer (NEW-D2-motion,
  // overlays.css) already forces to 0.01ms — assert both halves so neither
  // half can silently disappear.
  assert.match(css, /\.v2-portals-switch\s*\{[^}]*transition:/,
    'the switch animates via transition (neutralized globally)');
  assert.match(loadAppCss(), /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?transition-duration:\s*0\.01ms !important/,
    'the global reduced-motion neutralizer is present');
  // components.css stays at/below its hard limit (the block must never move back).
  const base = readFileSync(resolve(ROOT, 'public/css/components.css'), 'utf8');
  assert.ok(base.split('\n').length <= 800, 'components.css must stay within the 800-LOC gate');
});

test('both CAR-121 views inject their stylesheet link (no index.html edit needed)', () => {
  for (const [name, src] of [['portals.js', PORTALS], ['health.js', HEALTH]]) {
    assert.match(src, /getElementById\('v2-portals-css'\)/, `${name}: idempotent guard`);
    assert.match(src, /href: '\/css\/v2-portals\.css'/, `${name}: links the stylesheet`);
  }
});
