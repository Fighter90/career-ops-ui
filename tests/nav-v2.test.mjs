/**
 * CAR-122 — sidebar v2 (collapsible groups · favorites · Cmd+K palette).
 *
 * Two layers:
 *   1. BEHAVIOUR of the pure core — the lib is a classic script, so it is
 *      executed here via the tracker-stages.test.mjs `new Function('window',
 *      src)` pattern with a stub window (no document → the wiring boot
 *      no-ops and only window.NavV2's pure exports are exercised):
 *        - persisted-group state machine (explicit open/closed beats the
 *          auto "follow the active section" default),
 *        - favorites pin/unpin/reorder (cap, dedupe, bounds),
 *        - recents tracking (dedupe, cap 5),
 *        - the fuzzy matcher (subsequence + scoring) and palette assembly
 *          (favorites → recents → actions → routes; stable ties).
 *   2. SOURCE-STATIC wiring gates — index.html link/script order, the
 *      byte-count of nav items, aria-controls pairing, CSP discipline
 *      (no innerHTML in the lib, no hex in the stylesheet).
 *
 * CI-isolated: pure reads, no server, no network, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);

const SRC = readFileSync(R('public', 'js', 'lib', 'nav-v2.js'), 'utf8');
const CORE_SRC = readFileSync(R('public', 'js', 'lib', 'nav-v2-core.js'), 'utf8');
const HTML = readFileSync(R('public', 'index.html'), 'utf8');
const CSS = readFileSync(R('public', 'css', 'v2-nav.css'), 'utf8');

// ── execute core + wiring with a stub window (no document → pure exports only) ──
const win = {};
new Function('window', CORE_SRC)(win); // eslint-disable-line no-new-func
new Function('window', SRC)(win); // eslint-disable-line no-new-func
const V = win.NavV2;
test('the lib exports the pure core on window.NavV2', () => {
  assert.ok(V, 'window.NavV2 missing');
  for (const fn of ['defaultState', 'serializeState', 'loadState', 'isGroupOpen',
    'toggleGroup', 'pin', 'unpin', 'moveFav', 'trackVisit', 'pruneState',
    'fuzzyMatch', 'fuzzyFilter', 'buildPaletteItems', 'formatEvalUrl',
    'looksLikeUrl']) {
    assert.equal(typeof V[fn], 'function', `NavV2.${fn} missing`);
  }
});

// ── state machine ────────────────────────────────────────────────────────

test('groups: explicit open/closed beats the auto "follow active section" default', () => {
  const s = V.defaultState();
  // untouched groups follow the active route…
  assert.equal(V.isGroupOpen(s, 'analytics', 'analytics'), true, 'active untouched group opens');
  assert.equal(V.isGroupOpen(s, 'setup', 'analytics'), false, 'inactive untouched group stays closed');
  // …an explicit choice always wins, whatever the active group is
  const opened = V.toggleGroup(s, 'setup');
  assert.deepEqual(opened.collapsed, { setup: 'open' }, 'toggling a closed group pins it open');
  assert.equal(V.isGroupOpen(opened, 'setup', 'analytics'), true, 'pinned open survives navigation');
  const closed = V.toggleGroup(opened, 'setup');
  assert.equal(V.isGroupOpen(closed, 'setup', 'setup'), false, 'pinned closed survives even being the active group');
  // toggle on an auto-open (active, untouched) group pins it closed — the
  // wiring passes the group's VISIBLE state as the third argument
  const closedActive = V.toggleGroup(V.defaultState(), 'analytics', true);
  assert.deepEqual(closedActive.collapsed, { analytics: 'closed' });
  assert.equal(V.isGroupOpen(closedActive, 'analytics', 'analytics'), false);
  // the input state is never mutated (value semantics)
  assert.deepEqual(s.collapsed, {});
});

test('loadState: garbage, wrong shapes and prototype keys fall back safely', () => {
  assert.deepEqual(V.loadState(null), V.defaultState());
  assert.deepEqual(V.loadState('not json'), V.defaultState());
  assert.deepEqual(V.loadState('42'), V.defaultState());
  // Raw JSON so "__proto__" is a real OWN property inside parsed.collapsed
  // (an object literal would set the prototype instead — its own CodeQL
  // class, js/invalid-prototype-value).
  const s = V.loadState('{"collapsed":{"analytics":"closed","junk":"whatever","__proto__":"open"},"favs":["scan",42,"","tracker"],"recent":"nope"}');
  assert.deepEqual(s.collapsed, { analytics: 'closed' },
    'only literal static-group ids survive, whatever the blob carries');
  assert.deepEqual(s.favs, ['scan', 'tracker'], 'non-string ids dropped');
  assert.deepEqual(s.recent, []);
  // constructor/prototype shapes are ignored the same structural way
  const evil = V.loadState('{"collapsed":{"constructor":"open","prototype":"closed","__proto__":"open"},"favs":null}');
  assert.deepEqual(evil.collapsed, {});
  // an id that is not a static group is dropped even when well-formed
  const ghost = V.loadState('{"collapsed":{"notagroup":"open"}}');
  assert.deepEqual(ghost.collapsed, {});
});

test('STATIC_GROUP_IDS: the literal allowlist matches the index.html sections', () => {
  const htmlGroups = (HTML.match(/data-nav-group="([a-z]+)"/g) || [])
    .map((m) => m.replace(/data-nav-group="|"/g, ''));
  assert.deepEqual(V.STATIC_GROUP_IDS, htmlGroups,
    'the loadState allowlist and the shell must not drift');
});

test('serializeState/loadState round-trip', () => {
  const s = { collapsed: { setup: 'open' }, favs: ['scan', 'reports'], recent: ['tracker'] };
  assert.deepEqual(V.loadState(V.serializeState(s)), s);
});

// ── favorites ────────────────────────────────────────────────────────────

test('favorites: pin appends, dedupes, caps; unpin filters; move is bounds-safe', () => {
  let s = V.defaultState();
  s = V.pin(s, 'scan');
  s = V.pin(s, 'reports');
  assert.deepEqual(s.favs, ['scan', 'reports']);
  assert.equal(V.pin(s, 'scan'), s, 'pin is a no-op when already pinned (same ref)');
  // cap
  let full = V.defaultState();
  for (let i = 0; i < V.FAV_CAP + 3; i++) full = V.pin(full, 'route' + i);
  assert.equal(full.favs.length, V.FAV_CAP, 'favorites cap respected');
  // unpin
  const unpinned = V.unpin(s, 'scan');
  assert.deepEqual(unpinned.favs, ['reports']);
  assert.equal(V.unpin(s, 'nope'), s, 'unpin unknown id is a no-op');
  // move
  const moved = V.moveFav(s, 'reports', -1);
  assert.deepEqual(moved.favs, ['reports', 'scan']);
  assert.equal(V.moveFav(s, 'scan', -1), s, 'moving past the top is a no-op');
  assert.equal(V.moveFav(s, 'reports', +1), s, 'moving past the bottom is a no-op');
  assert.equal(V.moveFav(s, 'ghost', +1), s, 'moving an unpinned id is a no-op');
});

// ── recents ──────────────────────────────────────────────────────────────

test('recents: newest first, deduped, capped at 5', () => {
  let s = V.defaultState();
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) s = V.trackVisit(s, id);
  assert.deepEqual(s.recent, ['f', 'e', 'd', 'c', 'b'], 'cap 5, newest first');
  const revisited = V.trackVisit(s, 'c');
  assert.deepEqual(revisited.recent, ['c', 'f', 'e', 'd', 'b'], 'revisit moves to front, no dupes');
});

test('recents: re-visiting the current head is a no-op (same ref — no store write)', () => {
  const s = V.defaultState();
  const once = V.trackVisit(s, 'a');
  assert.equal(V.trackVisit(once, 'a'), once, 'head re-visit returns the SAME state');
  assert.notEqual(V.trackVisit(once, 'b'), once, 'a different route still produces a new state');
});

test('pruneState: stale favorites/recents ids drop; clean state returned by reference', () => {
  const byId = (id) => ({ scan: 1, tracker: 1 }.hasOwnProperty(id) ? {} : null);
  const stale = { collapsed: {}, favs: ['scan', 'ghost', 'tracker'], recent: ['phantom', 'scan'] };
  const pruned = V.pruneState(stale, byId);
  assert.deepEqual(pruned.favs, ['scan', 'tracker'], 'stale favorite dropped');
  assert.deepEqual(pruned.recent, ['scan'], 'stale recent dropped');
  const clean = { collapsed: {}, favs: ['scan'], recent: ['scan'] };
  assert.equal(V.pruneState(clean, byId), clean, 'nothing stale → same ref (no store write)');
});

test('formatEvalUrl: $ sequences in the URL stay literal (no replace-pattern expansion)', () => {
  const out = V.formatEvalUrl('Auto-pipeline: {url}', 'https://x.test/?q=$&v=$`w=$\'z=$$');
  assert.equal(out, 'Auto-pipeline: https://x.test/?q=$&v=$`w=$\'z=$$',
    'the URL is inserted verbatim — no $&, $`, $\' or $$ expansion');
});

test('fuzzyMatch: per-char lowering keeps indexes aligned on length-changing folds (İ)', () => {
  // 'İ'.toLowerCase() is TWO code units — a whole-string toLowerCase would
  // misalign every later index onto the wrong original characters.
  const m = V.fuzzyMatch('ix', 'İX');
  assert.ok(m, 'İ lowers to i (first unit) and X matches at its TRUE index');
  const scattered = V.fuzzyMatch('px', 'İpx'); // 'x' after the folded char
  assert.ok(scattered, 'matches after a length-changing fold still resolve');
  // camelCase hump detection stays intact for normal text
  assert.ok(V.fuzzyMatch('b', 'fooBar').score > 0);
});

test('buildPaletteItems: group carries the LOCALIZED label for fuzzy matching', () => {
  const routes = [{
    id: 'scan', href: '#/scan', group: 'sourcing',
    titleKey: 'nav.scan', fallback: 'Scan',
    groupKey: 'nav.group.sourcing', groupFallback: 'Sourcing',
  }];
  const ru = (k, f) => (k === 'nav.group.sourcing' ? 'Поиск' : f);
  const items = V.buildPaletteItems(routes, [], V.defaultState(), ru);
  assert.equal(items[0].group, 'Поиск', 'group is the translated label');
  const hits = V.fuzzyFilter('поиск', items);
  assert.equal(hits.length, 1, 'a ru query matches the translated group name');
  // fixtures WITHOUT a groupKey keep their literal group (id-less label)
  const plain = V.buildPaletteItems([{ id: 'x', href: '#/x', group: 'Setup' }], [], V.defaultState(), ident);
  assert.equal(plain[0].group, 'Setup');
});

// ── fuzzy matcher ────────────────────────────────────────────────────────

test('fuzzyMatch: subsequence or null, case-insensitive', () => {
  assert.equal(V.fuzzyMatch('trk', 'Tracker') !== null, true, 'subsequence hit');
  assert.equal(V.fuzzyMatch('xyz', 'Tracker'), null, 'non-subsequence misses');
  assert.equal(V.fuzzyMatch('TCK', 'tracker') !== null, true, 'case-insensitive');
  assert.deepEqual(V.fuzzyMatch('', 'anything'), { score: 0 }, 'empty query matches everything');
});

test('fuzzyMatch ranks: prefix > word-start > consecutive > scattered', () => {
  const score = (q, t) => V.fuzzyMatch(q, t).score;
  assert.ok(score('scan', 'Scan') > score('scan', 'Jobscan'), 'prefix beats infix');
  assert.ok(score('b', 'Batch evaluate') > score('b', 'Jobb'), 'word start beats mid-word');
  // 'Settings · CV' legitimately outranks via the "CV" word start, so the
  // scattered fixture is a single word where s…c are split mid-word
  assert.ok(score('sc', 'Scan') > score('sc', 'Sysconfig'), 'consecutive beats scattered');
});

test('fuzzyFilter: empty query keeps order; ranked otherwise; ties stable', () => {
  const items = [
    { id: 'a', title: 'Tracker', group: 'Application' },
    { id: 'b', title: 'Batch evaluate', group: 'Decision' },
    { id: 'c', title: 'Activity', group: 'Analytics' },
  ];
  assert.deepEqual(V.fuzzyFilter('', items).map((i) => i.id), ['a', 'b', 'c'], 'empty → input order (copy)');
  assert.deepEqual(V.fuzzyFilter('bat', items).map((i) => i.id), ['b'], 'non-matches dropped');
  // Tracker/Batch only reach weaker signals (scattered subsequence, group
  // keyword) — Activity's title match must rank first
  const top = V.fuzzyFilter('act', items).map((i) => i.id);
  assert.equal(top[0], 'c', 'Activity (id c) ranks first for "act"');
  // stable tie: identical titles keep input order
  const tied = V.fuzzyFilter('z', [{ id: 'x1', title: 'Zzz' }, { id: 'x2', title: 'Zzz' }]);
  assert.deepEqual(tied.map((i) => i.id), ['x1', 'x2']);
  // keyword signal works but does not outrank the title ('Canyon' has no
  // s-c-a-n subsequence in the TITLE, so only its keyword matches)
  const kw = [
    { id: 't', title: 'Canyon', keywords: ['scan'] },
    { id: 's', title: 'Scan', group: null },
  ];
  assert.deepEqual(V.fuzzyFilter('scan', kw).map((i) => i.id), ['s', 't'],
    'title match beats keyword-only match');
});

// ── palette assembly ─────────────────────────────────────────────────────

const ROUTES = [
  { id: 'scan', href: '#/scan', group: 'sourcing', titleKey: 'nav.scan', fallback: 'Scan',
    groupKey: 'nav.group.sourcing', groupFallback: 'Sourcing' },
  { id: 'tracker', href: '#/tracker', group: 'application', titleKey: 'nav.tracker', fallback: 'Tracker',
    groupKey: 'nav.group.application', groupFallback: 'Application' },
  { id: 'reports', href: '#/reports', group: 'analytics', titleKey: 'nav.reports', fallback: 'Reports',
    groupKey: 'nav.group.analytics', groupFallback: 'Analytics' },
];
const ACTIONS = [{ id: 'action-theme', title: 'Toggle theme', kind: 'action', run: () => {} }];
const ident = (k, f) => f;

test('buildPaletteItems: favorites → recents → actions → the rest, deduped', () => {
  const state = { collapsed: {}, favs: ['reports'], recent: ['tracker', 'reports'] };
  const items = V.buildPaletteItems(ROUTES, ACTIONS, state, ident);
  assert.deepEqual(items.map((i) => `${i.kind}:${i.id}`), [
    'route:reports', 'route:tracker', 'action:action-theme', 'route:scan',
  ]);
  assert.equal(items[0].fav, true, 'favorite flagged');
  assert.equal(items[1].recent, true, 'recent flagged');
  assert.equal(items[0].title, 'Reports', 'title resolved through the injected t()');
  assert.equal(items[3].fav, undefined, 'the plain listing does not repeat favorites');
});

test('buildPaletteItems: unknown favorites/recents ids are skipped, not thrown', () => {
  const state = { collapsed: {}, favs: ['ghost'], recent: ['phantom'] };
  const items = V.buildPaletteItems(ROUTES, [], state, ident);
  assert.deepEqual(items.map((i) => i.id), ['scan', 'tracker', 'reports']);
});

// ── source-static wiring gates ───────────────────────────────────────────

test('index.html: v2-nav.css links after v2-reports.css and before map.css', () => {
  const iPipe = HTML.indexOf('/css/v2-pipeline.css');
  const iRep = HTML.indexOf('/css/v2-reports.css');
  const iNav = HTML.indexOf('/css/v2-nav.css');
  const iMap = HTML.indexOf('/css/map.css');
  assert.ok(iPipe > -1 && iRep > iPipe && iNav > iRep && iMap > iNav,
    `cascade order broken: pipeline=${iPipe} reports=${iRep} nav=${iNav} map=${iMap}`);
});

test('index.html: nav-v2-core.js loads before nav-v2.js, which loads before router.js', () => {
  const iCore = HTML.indexOf('/js/lib/nav-v2-core.js');
  const iLib = HTML.indexOf('/js/lib/nav-v2.js');
  const iRouter = HTML.indexOf('/js/router.js');
  const iApp = HTML.indexOf('/js/app.js');
  assert.ok(iCore > -1 && iLib > iCore, 'the core must precede the wiring lib');
  assert.ok(iRouter > iLib && iApp > iRouter, 'nav-v2.js must precede router.js and app.js');
});

test('both halves respect the ≤800-LOC contract and stay CSP-safe', () => {
  for (const [name, src] of [['nav-v2-core.js', CORE_SRC], ['nav-v2.js', SRC]]) {
    assert.doesNotMatch(src, /innerHTML/, `${name}: no raw HTML assignment`);
    assert.doesNotMatch(src, /\son[a-z]+=/, `${name}: no inline handler assignments`);
    const lines = src.split('\n').length;
    assert.ok(lines <= 800, `${name} is ${lines} lines — over the 800-LOC hard limit`);
  }
});

test('index.html: all 38 nav items kept with data-route + data-i18n labels', () => {
  const items = HTML.match(/<a class="nav-item" href="#\/[a-z-]+" data-route="[a-z-]+">/g) || [];
  assert.equal(items.length, 38, 'nav item count changed — update this gate deliberately');
  const labeled = (HTML.match(/class="nav-item"[\s\S]{0,120}?data-i18n="nav\.[a-zA-Z]+"/g) || []).length;
  assert.ok(labeled >= 38, 'every nav item keeps its data-i18n label (locale-sweep pin)');
});

test('index.html: every group toggle aria-controls pairs with its items id', () => {
  const sections = HTML.match(/<section class="nav-v2-group" data-nav-group="[a-z]+">[\s\S]*?<\/section>/g) || [];
  assert.equal(sections.length, 7, '7 static groups expected');
  for (const s of sections) {
    const id = s.match(/data-nav-group="([a-z]+)"/)[1];
    assert.match(s, new RegExp(`aria-controls="nav-v2-items-${id}"`), `${id}: toggle aria-controls`);
    assert.match(s, new RegExp(`id="nav-v2-items-${id}"`), `${id}: items container id`);
    assert.match(s, /aria-expanded="true"/, `${id}: static default expanded (JS corrects at boot)`);
    assert.match(s, /data-i18n="nav\.group\./, `${id}: label stays i18n-keyed`);
  }
});

test('the palette launch button exists with dialog semantics', () => {
  assert.match(HTML, /<button class="nav-v2-launch" id="nav-v2-launch" type="button" aria-haspopup="dialog"/);
  assert.match(HTML, /data-i18n-aria-label="nav\.v2\.palette"/);
});

test('nav-v2.js keeps its wiring-only CSP gates', () => {
  assert.doesNotMatch(SRC, /document\.write/, 'no document.write');
});

test('v2-nav.css: token-based (no hex), ≤ 800 LOC, motion-safe, RTL-mirrored', () => {
  assert.ok(!/#\s*[0-9a-fA-F]{3,8}\b/.test(CSS.replace(/\/\*[\s\S]*?\*\//g, '')),
    'no hardcoded hex colors — use the design tokens');
  const lines = CSS.split('\n').length;
  assert.ok(lines <= 800, `v2-nav.css is ${lines} lines — over the 800-LOC hard limit`);
  assert.match(CSS, /prefers-reduced-motion/, 'reduced-motion opt-out required');
  assert.match(CSS, /\[dir="rtl"\]/, 'RTL chevron mirror required');
});

// ── owner UX batch — recents group: hint + Clear ────────────────────────────

test('recents: the group header carries a hint and a Clear button that empties the list', () => {
  assert.ok(SRC.includes("'nav.v2.recentHint'"), 'recToggle must carry the recentHint key (title + aria-label)');
  assert.ok(SRC.includes("'nav.v2.clearRecent'"), 'the Clear button must use the clearRecent key');
  assert.match(SRC, /nav-v2-clear/, 'the Clear button class exists');
  assert.match(SRC, /Object\.assign\(\{\}, state, \{ recent: \[\] \}\)/,
    'the clear handler empties recent immutably, then writeStore + renderDynamicGroups');
  assert.match(CSS, /\.nav-v2-clear/, 'v2-nav.css styles the clear button');
  assert.match(CSS, /\.nav-v2-group-head/, 'the toggle + clear row has a shared flex head');
});

// ── CAR-203 — sidebar pill: long localized labels truncate gracefully ──────

test('CAR-203: nav labels shrink (min-width:0) + ellipsize inside the pill; the full text is reachable via title', () => {
  // 1. The base pill: the label span is a flex child whose default
  //    min-width:auto refused to shrink, so the long ru label
  //    («Профинансированные компании») overflowed the pill and hard-clipped
  //    at the row edge. Both label contracts live in v2-nav.css (the
  //    sidebar-v2 sheet — app.css sits exactly at its 800-LOC ceiling):
  //    the label is shrinkable and truncates on one line. Logical
  //    properties only — the ellipsis lands on the inline end in RTL too;
  //    padding/min-height (the 44px touch target) and the active paint
  //    are untouched.
  const label = CSS.match(
    /\.nav-item > span:not\(\.nav-ico\),\s*\.nav-v2-row-link > span:not\(\.nav-ico\)\s*\{[^}]*\}/,
  );
  assert.ok(label, 'v2-nav.css must style both nav label spans (CAR-203)');
  for (const decl of ['min-width:\\s*0', 'overflow:\\s*hidden',
    'text-overflow:\\s*ellipsis', 'white-space:\\s*nowrap']) {
    assert.match(label[0], new RegExp(decl), `.nav-item label misses ${decl.replace(/\\\\/g, '')}`);
  }
  // 2. Favorites/recents rows reuse the very same labels over a narrower
  //    row (the star + reorder controls steal width) — the shared rule
  //    covers them (see the selector list above).
  // 3. Truncation must stay discoverable: the wiring mirrors the
  //    LOCALIZED label into the span's title, reusing the SAME i18n key
  //    (zero new dictionary entries). t() is read directly — not off the
  //    span's textContent — so the result is order-independent with
  //    app.js's applyI18n pass. Synced at boot, on every dynamic-row
  //    rebuild and on language switch.
  assert.match(SRC, /function syncLabelTitles/, 'nav-v2.js must define syncLabelTitles');
  assert.match(SRC, /\.title = t\(/, 'titles carry the localized t() value');
  assert.ok((SRC.match(/syncLabelTitles\(\)/g) || []).length >= 3,
    'syncLabelTitles must run at boot, per row rebuild and on language switch');
  // 4. The reported pill keeps its static data-i18n label — the title
  //    reuses that exact key, so the fallback text below stays English.
  assert.match(HTML, /<span class="nav-ico">💰<\/span> <span data-i18n="nav\.funded">Funded companies<\/span>/);
});
