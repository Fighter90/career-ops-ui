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
    extractFn(PORTALS, 'hostOfCareerUrl'),
    extractFn(PORTALS, 'vendorOf'),
    extractFn(PORTALS, 'matchPortal'),
    extractFn(PORTALS, 'matchState'),
    'globalThis.__h = { vendorOf, matchPortal, matchState, hostOfCareerUrl };',
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
  // the select is labelled by a DEDICATED label, not its first option
  // (review finding 9 — "All portals, Disabled only").
  assert.match(PORTALS, /'aria-label':\s*t\('portals\.filterLabel', 'Show'\)/);
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

test('portals: vendorOf matches on domain BOUNDARIES (review finding 2)', () => {
  const { vendorOf, hostOfCareerUrl } = loadPortalsHelpers();
  // unanchored indexOf would misgroup these…
  assert.equal(vendorOf({ careers_url: 'https://clever.com/careers' }), null,
    'clever.com contains "lever" but is not lever.co');
  assert.equal(vendorOf({ careers_url: 'https://xhh.ru/x' }), null,
    'xhh.ru contains "hh.ru" but is not hh.ru');
  assert.equal(vendorOf({ careers_url: 'https://xpersonio.de/x' }), null,
    'a bare token never matches inside a label');
  // …while real subdomains and scheme-less / credentialed forms still group.
  assert.equal(vendorOf({ careers_url: 'https://acme.personio.de/x' }), 'Personio');
  assert.equal(vendorOf({ careers_url: 'https://jobs.teamtailor.com/acme' }), 'Teamtailor');
  assert.equal(vendorOf({ careers_url: 'https://career.hh.ru/employer/1' }), 'hh.ru');
  assert.equal(vendorOf({ careers_url: 'greenhouse.io/stripe' }), 'Greenhouse',
    'scheme-less URLs still parse the host (path dropped)');
  assert.equal(vendorOf({ careers_url: 'https://u:p@boards.greenhouse.io:8443/x' }), 'Greenhouse',
    'userinfo and port are stripped before matching');
  // host parse itself: scheme-less, pathful, credentialed, ported.
  assert.equal(hostOfCareerUrl('HTTPS://Boards.Greenhouse.IO/stripe'), 'boards.greenhouse.io');
  assert.equal(hostOfCareerUrl('greenhouse.io/stripe/jobs?q=1#x'), 'greenhouse.io');
  assert.equal(hostOfCareerUrl('user@hh.ru:8080/x'), 'hh.ru');
  assert.equal(hostOfCareerUrl(''), '');
  // the matcher stays RegExp-free: a dynamic `new RegExp` on the needle table
  // re-taints every entry with CodeQL js/missing-regexp-anchor (19 highs).
  const vendorSrc = extractFn(PORTALS, 'vendorOf');
  assert.doesNotMatch(vendorSrc, /new RegExp/, 'label matching is string-ops only');
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
  const { __sg: sortGroup } = (() => {
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

test('portals: the switch names its portal with a STABLE accessible name', () => {
  assert.match(PORTALS, /type: 'checkbox'/, 'a real checkbox input');
  assert.match(PORTALS, /role: 'switch'/, 'switch semantics');
  // Review finding 8 — the old name EMBEDDED the action ("Disable: Acme"),
  // so a screen reader read "Disable: Acme, switch, on" — contradictory,
  // and the name changed with state. The name is now the stable verb;
  // state is announced by the switch itself (checked property).
  assert.match(PORTALS, /'aria-label':\s*t\('portals\.watch', 'Watch'\)/,
    'stable name — does not flip with the state');
  assert.doesNotMatch(PORTALS, /'aria-label':\s*\(isOn \? t\('portals\.disable'/,
    'the state-conditional name is gone');
  assert.match(PORTALS, /\+ ': ' \+ \(company\.name \|\| company\.careers_url\)/,
    '…disambiguated by the company (CAR-21 contract)');
});

test('portals: toggles are undoable through the same POST /api/portals/toggle write path', () => {
  // one undo bar per action, LIFO, session-scoped, body-level (pipeline pattern).
  assert.match(PORTALS, /const undoStack = \[\];/, 'LIFO undo stack');
  assert.match(PORTALS, /id: 'portals-undo-bar'/, 'single body-level bar');
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

test('portals: the undo bar does not survive navigation (review finding 3)', () => {
  // One page-level hook: any route change hides the bar.
  assert.match(PORTALS, /addEventListener\('hashchange', hidePortalsUndoBar\)/,
    'a hashchange hook hides the bar on navigation');
  const hideAt = PORTALS.indexOf('function hidePortalsUndoBar');
  assert.ok(hideAt > -1, 'hide helper exists');
  const hide = PORTALS.slice(hideAt, PORTALS.indexOf('}', PORTALS.indexOf('clearTimeout', hideAt)) + 1);
  assert.match(hide, /\.hidden = true/, 'hides the bar');
  assert.match(hide, /clearTimeout\(portalsUndoTimer\)/, 'stops the auto-hide timer');
  // Belt to the braces: Undo on a DETACHED view refuses to write.
  const undoAt = PORTALS.indexOf('async function undoLast');
  const guardAt = PORTALS.indexOf('if (!root.isConnected)', undoAt);
  assert.ok(guardAt > undoAt, 'undoLast guards on a connected view');
  const seg = PORTALS.slice(guardAt, guardAt + 80);
  assert.match(seg, /hidePortalsUndoBar\(\); return;/, 'the guard hides and bails');
});

test('portals: undo pops only after success — a failed undo stays undoable (review finding 4)', () => {
  const undoAt = PORTALS.indexOf('async function undoLast');
  const undoEnd = PORTALS.indexOf('async function applyToggle', undoAt);
  const undo = PORTALS.slice(undoAt, undoEnd);
  // no blind pop: the stack is only popped when NOTHING failed
  assert.ok(undo.indexOf('undoStack.pop()') > -1, 'the stack is popped on the success path');
  const popAt = undo.indexOf('undoStack.pop()');
  const loopAt = undo.indexOf('for (const item of action.items)');
  assert.ok(popAt > loopAt, 'the pop happens AFTER the retry loop, not before it');
  assert.match(undo, /remaining\.push\(item\)/, 'failed items are collected');
  assert.match(undo, /action\.items = remaining/, 'the action keeps only the failed items (stays on the stack)');
  assert.match(undo, /showPortalsUndoBar\(/, 'the bar is re-shown for the remaining items');
});

test('portals: one write per portal at a time (review finding 5)', () => {
  assert.match(PORTALS, /const pendingToggles = new Set\(\);/, 'pending set exists');
  const fnAt = PORTALS.indexOf('async function applyToggle');
  const fnEnd = PORTALS.indexOf('function updateSummary', fnAt);
  const fn = PORTALS.slice(fnAt, fnEnd);
  const reentry = fn.indexOf('pendingToggles.has(url)');
  const add = fn.indexOf('pendingToggles.add(url)');
  const post = fn.indexOf("API.post('/api/portals/toggle'");
  assert.ok(reentry > -1 && add > reentry && post > add,
    're-entry guard → mark pending → then POST');
  assert.match(fn, /renderList\(\);[\s\S]*?let ok = false;/,
    'repaints immediately so the in-flight row renders disabled');
  const finallyAt = fn.indexOf('} finally {');
  assert.ok(finallyAt > -1, 'the pending mark is released in finally');
  const fin = fn.slice(finallyAt);
  assert.match(fin, /pendingToggles\.delete\(url\)/, 'pending cleared on both paths');
  // rows render in-flight switches disabled (no double writes via re-render).
  assert.match(PORTALS, /disabled: !canToggle \|\| pendingToggles\.has\(company\.careers_url\)/,
    'pending rows render with a disabled switch');
});

test('portals: the undo bar is announced as a status region (scoped, review finding 11)', () => {
  // the /role: 'status'/ canary used to match ANY markup in the file —
  // scope it to the bar builder itself.
  const showSrc = extractFn(PORTALS, 'showPortalsUndoBar');
  assert.match(showSrc, /role: 'status'/, 'the bar is announced politely');
  assert.match(showSrc, /'aria-live': 'polite'/);
});

test('portals: a fresh load clears the stale health-check line (review finding 7)', () => {
  const loadAt = PORTALS.indexOf('async function loadCompanies');
  const seg = PORTALS.slice(loadAt, PORTALS.indexOf('const norm', loadAt));
  assert.match(seg, /checkSummaryText = null;/, 'the alive/dead line does not survive a reload');
  assert.match(seg, /summary\.style\.color = '';/, 'its colour is reset too');
});

// ─────────────────────────── #/health v2 ───────────────────────────

test('health: the active provider is fetched and only the success case shows the green summary', () => {
  assert.match(HEALTH, /api\/status\/providers/, 'provider status is fetched');
  assert.match(HEALTH, /\.catch\(\(\) => null\)/, 'provider fetch failure degrades quietly');
  assert.match(HEALTH, /t\('health\.allOk',/, 'success summary is keyed');
  assert.match(HEALTH, /t\('health\.activeProvider'/, 'active-provider line is keyed');
  // Review finding 11 — assert the GATE structurally: the banner node is
  // BUILT under the allRequiredOk ternary, not merely "later in the file".
  assert.match(HEALTH,
    /const allRequiredOk = checksOk\s*&& requiredChecks\.length > 0\s*&& requiredBad\.length === 0;/,
    'the gate requires a non-empty required list (an empty/malformed payload is not success)');
  assert.match(HEALTH, /allRequiredOk \? c\('div', \{ className: 'v2-portals-health-ok'/,
    'the banner renders only under the gate');
  // Review finding 10 — provider/model are config/env-derived; a value like
  // "$&" must never be interpreted as a replace pattern.
  assert.match(HEALTH, /\.replace\('\{provider\}', \(\) => providers\.activeProvider\)/);
  assert.match(HEALTH, /\.replace\('\{model\}', \(\) => providers\.activeModel\)/);
  assert.doesNotMatch(HEALTH, /\.replace\('\{provider\}', providers\./,
    'no bare-value replacer for provider');
});

test('health: a missing/malformed checks payload is an explicit error, never a green page (review finding 6)', () => {
  assert.match(HEALTH, /const checksOk = Array\.isArray\(data\.checks\)/, 'payload shape is checked');
  assert.match(HEALTH, /t\('health\.checksUnavailable',/, 'the error state is keyed');
  const errAt = HEALTH.indexOf("t('health.checksUnavailable'");
  const errBlock = HEALTH.slice(Math.max(0, errAt - 300), errAt + 200);
  assert.match(errBlock, /!checksOk/, 'the error state renders only when the payload is malformed');
  assert.match(errBlock, /role: 'alert'/, 'the error state is announced');
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
