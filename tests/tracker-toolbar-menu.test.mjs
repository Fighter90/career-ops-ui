/**
 * CAR-117 tail (P3.2) — the tracker header's overflow menu.
 *
 * The header used to expose four heavy operations as big toolbar buttons
 * (Normalize / Dedup / Merge TSV / Import CSV). They now collapse into one
 * compact «⋯» overflow button. Source-static assertions (browser-only view,
 * router.test.mjs style):
 *
 *   1. the page-header toolbar no longer renders the four action buttons
 *      directly — the run-fix API paths + the CSV import pick appear ONLY
 *      inside the menu builder (buildHeaderMenu);
 *   2. the menu is a real a11y widget: a <button> trigger with the
 *      track.moreActions aria-label + aria-expanded + aria-haspopup, the
 *      menu is role="menu" with role="menuitem" <button> items, Escape
 *      closes and returns focus to the trigger, outside click closes;
 *   3. the destructive items still route through the confirm-gated runFix
 *      (UI.confirm BEFORE API.post — the gate itself is pinned by
 *      tests/confirm-gate.test.mjs), and the CSV import item keeps its own
 *      preview → confirm modal in lib/tracker-import.js;
 *   4. the new i18n key 'track.moreActions' exists in all 19 locales, and
 *      the four item labels stay keyed ×19.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict, I18N_LANGS } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const TRK = readFileSync(R('public', 'js', 'views', 'tracker.js'), 'utf8');

// The header construction slice: from the page-header element to the filter
// card that follows it. Everything in between is the toolbar under test.
function headerSlice() {
  const start = TRK.indexOf("c('header', { className: 'page-header' }");
  assert.ok(start >= 0, 'page-header construction found');
  const end = TRK.indexOf("c('div', { className: 'card mb-3' }", start);
  assert.ok(end > start, 'filter card found after the header');
  return TRK.slice(start, end);
}

function menuSlice() {
  const start = TRK.indexOf('function buildHeaderMenu');
  assert.ok(start >= 0, 'buildHeaderMenu builder found');
  const next = TRK.indexOf('\nfunction ', start + 10);
  const end = next > start ? next : TRK.indexOf('\n// ---', start);
  return TRK.slice(start, end > start ? end : TRK.length);
}

test('header toolbar no longer renders the four action buttons directly', () => {
  const HEADER = headerSlice();
  assert.ok(!HEADER.includes('/api/run/'), 'no run-fix button may be wired in the header toolbar');
  assert.ok(!HEADER.includes('runFix('), 'no runFix call may sit in the header toolbar');
  assert.ok(!HEADER.includes('TrackerImport.pick'), 'no direct CSV-import button in the header toolbar');
  assert.ok(!HEADER.includes('track.normalize') && !HEADER.includes('track.dedup') && !HEADER.includes('track.merge'),
    'no Normalize/Dedup/Merge labels may render as header buttons');
  // the toolbar hands the work to the menu builder
  assert.match(HEADER, /buildHeaderMenu\(/);
});

test('menu builder owns the four operations (with their existing handlers)', () => {
  const MENU = menuSlice();
  for (const api of ['/api/run/normalize', '/api/run/dedup', '/api/run/merge']) {
    assert.ok(MENU.includes(`'${api}'`), `menu must wire ${api}`);
  }
  assert.match(MENU, /TrackerImport\.pick/, 'menu must wire the CSV import');
  // U-10 (v1.58.30) empty-tracker tooltips survive the move
  assert.match(MENU, /t\('track\.fixEmpty'/);
  assert.match(MENU, /t\('track\.fixHint'/);
});

test('menu is an accessible widget: trigger button, role=menu, menuitem buttons', () => {
  const MENU = menuSlice();
  // trigger: a real <button> with the new aria-label key + expanded/haspopup
  assert.match(MENU, /c\('button',\s*\{[^}]*type: 'button'/s);
  assert.match(MENU, /t\('track\.moreActions'/);
  assert.match(MENU, /'aria-expanded': 'false'/);
  assert.match(MENU, /'aria-haspopup': 'true'/);
  assert.match(MENU, /'aria-label': t\('track\.moreActions'/);
  // menu container + items
  assert.match(MENU, /role: 'menu'/);
  assert.match(MENU, /role: 'menuitem'/);
  assert.ok((MENU.match(/role: 'menuitem'/g) || []).length >= 1, 'items are buttons with role=menuitem');
});

test('Escape closes the menu and returns focus to the trigger; outside click closes', () => {
  const MENU = menuSlice();
  assert.match(MENU, /e\.key === 'Escape'/, 'Escape closes the menu');
  assert.match(MENU, /trigger\.focus\(\)/, 'explicit dismissal returns focus to the trigger');
  assert.match(MENU, /addEventListener\('click', onDocClick, true\)/, 'outside click closes');
  assert.match(MENU, /addEventListener\('keydown', onKey, true\)/);
  assert.match(MENU, /removeEventListener\('click', onDocClick, true\)/, 'listeners are detached on close');
  assert.match(MENU, /setAttribute\('aria-expanded', 'false'\)/, 'aria-expanded resets on close');
  assert.match(MENU, /setAttribute\('aria-expanded', 'true'\)/, 'aria-expanded opens');
});

test('destructive items keep confirm gates: runFix (UI.confirm before API.post) + import preview modal', () => {
  const MENU = menuSlice();
  // the three rewrite ops are wired with their api path and routed through
  // fixItem, whose click handler calls the confirm-gated runFix
  for (const api of ['normalize', 'dedup', 'merge']) {
    assert.match(MENU, new RegExp(`fixItem\\(t\\('track\\.${api}'\\), '/api/run/${api}'\\)`),
      `menu must wire /api/run/${api} through fixItem`);
  }
  assert.match(MENU, /onClick: \(\) => \{ closeMenu\(true\); runFix\(trigger, api, t\); \}/,
    'fixItem must route its op through runFix (confirm-gated)');
  // runFix still confirms BEFORE the POST (mirror of tests/confirm-gate.test.mjs)
  const fix = TRK.slice(TRK.indexOf('async function runFix'));
  assert.ok(/await UI\.confirm\([\s\S]*?\)\)\) \{\s*return;\s*\}[\s\S]*API\.post\(path\)/.test(fix),
    'runFix must confirm before API.post(path)');
  // the CSV import keeps its preview → confirm flow in lib/tracker-import.js
  const imp = readFileSync(R('public', 'js', 'lib', 'tracker-import.js'), 'utf8');
  assert.match(imp, /import\.confirm/, 'tracker-import still gates the commit behind a confirm button');
});

test("'track.moreActions' exists ×19; the four item labels stay keyed ×19", () => {
  const dict = loadAssembledDict();
  for (const lang of I18N_LANGS) {
    const v = (dict['track.moreActions'] || {})[lang];
    assert.ok(v && String(v).length > 0, `track.moreActions missing/empty in ${lang}`);
    if (lang !== 'en') assert.notEqual(v, 'More actions', `track.moreActions untranslated in ${lang}`);
  }
  for (const k of ['track.normalize', 'track.dedup', 'track.merge', 'import.btn']) {
    for (const lang of I18N_LANGS) {
      assert.ok((dict[k] || {})[lang], `${k} missing in ${lang}`);
    }
  }
});

// v1.268.1 SPA review — the menu is appended to document.body, so a
// navigation that happens while it is open leaves it hanging over the next
// page. The router's cleanup registry closes it, but the registration must
// be a MODULE-LEVEL single slot: the toolbar (and buildHeaderMenu) is
// re-created on every #/tracker visit, so a per-render hook would leak one
// registry entry per visit. One registration, one slot, armed on open,
// nulled inside closeMenu (its `if (!menu)` guard makes that idempotent).

test('the route-change close hook is registered exactly ONCE, at module level (no per-render hooks)', () => {
  const calls = TRK.match(/Router\.onRouteChange\(/g) || [];
  assert.equal(calls.length, 1, `exactly one registration (found ${calls.length})`);
  const hookIdx = TRK.indexOf('Router.onRouteChange');
  const menuIdx = TRK.indexOf('function buildHeaderMenu');
  assert.ok(hookIdx >= 0 && hookIdx < menuIdx,
    'the hook must be registered at module level, not inside buildHeaderMenu (per-render)');
});

test('the menu close is a single slot: armed on open, nulled inside closeMenu', () => {
  assert.match(TRK, /let activeMenuClose = null;/, 'one module-level slot');
  assert.match(TRK, /activeMenuClose && activeMenuClose\(\)/, 'the hook fires the armed slot');
  // armed when the menu opens
  const MENU = menuSlice();
  assert.match(MENU, /activeMenuClose = \(\) => closeMenu\(false\);/, 'opening the menu arms the slot');
  // nulled inside closeMenu — slice the closeMenu body so the assertion
  // cannot be satisfied by some other assignment elsewhere in the file.
  const closeIdx = TRK.indexOf('function closeMenu');
  assert.ok(closeIdx >= 0, 'closeMenu found');
  const bodyEnd = TRK.indexOf('\n  function position()', closeIdx);
  const closeBody = TRK.slice(closeIdx, bodyEnd > closeIdx ? bodyEnd : TRK.length);
  assert.match(closeBody, /activeMenuClose = null;/, 'closeMenu disarms the slot (idempotent via its !menu guard)');
});
