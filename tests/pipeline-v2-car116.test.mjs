/**
 * CAR-116 — #/pipeline v2 (UX·Воронка): 30 358 raw URLs → enriched
 * cards, grouping with collapse, bulk discard with progress + cancel,
 * and session undo. Contract lock for the view + its stylesheet + the
 * shell wiring (browser-only view → asserted statically, the
 * pipeline-row-action-names.test.mjs style; the PURE helpers behind it
 * get behavioural tests in pipeline-view-lib.test.mjs).
 *
 * Enrichment boundary (the load-bearing rule): the view may only join
 * payloads the EXISTING endpoints already return — /api/tracker rows,
 * /api/reports headers, /api/map/jobs checklist cells. No new endpoint,
 * no invented data; unmatched entries render host + URL and nothing else.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const PIPE = readFileSync(R('public', 'js', 'views', 'pipeline.js'), 'utf8');
const LIB = readFileSync(R('public', 'js', 'lib', 'pipeline-view.js'), 'utf8');
const CSS = readFileSync(R('public', 'css', 'v2-pipeline.css'), 'utf8');
const HTML = readFileSync(R('public', 'index.html'), 'utf8');
const EN_DICT = readFileSync(R('public', 'js', 'lib', 'locales', 'i18n-dict.en.js'), 'utf8');

// ── enrichment: existing endpoints only ──────────────────────────────

test('enrichment fetches only existing endpoints, fail-soft, once at mount', () => {
  assert.match(PIPE, /API\.get\('\/api\/tracker'\)/, 'tracker rows');
  assert.match(PIPE, /API\.get\('\/api\/reports'\)/, 'report headers');
  assert.match(PIPE, /API\.get\('\/api\/map\/jobs'\)/, 'checklist cells');
  // each new source degrades to a harmless default — a failing report/map
  // read must never blank the queue
  assert.match(PIPE, /API\.get\('\/api\/reports'\)\.catch\(\(\) => null\)/);
  assert.match(PIPE, /API\.get\('\/api\/map\/jobs'\)\.catch\(\(\) => null\)/);
});

test('the view never invents payloads — the join lives in the pure lib', () => {
  assert.match(PIPE, /PV\.buildEnrichment\(\{\s*\n?\s*trackerRows,/);
  assert.match(PIPE, /PV\.enrichEntries\(allUrls, enrichment\)/);
  // the lib reads only the three documented shapes
  for (const marker of ['o.mapRows', 'o.reports', 'o.trackerRows']) {
    assert.ok(LIB.includes(marker), `lib consumes ${marker}`);
  }
});

// ── grouped view: cards, collapse, volume ────────────────────────────

test('grouped view is the default and renders enriched entry cards', () => {
  assert.match(PIPE, /setViewMode\(PV \? 'grouped' : 'flat'\)/,
    'grouped cards are the default view when the lib loaded');
  assert.match(PIPE, /function entryCard\(url\)/);
  // role/company title, URL link, score chip, evaluated chip
  assert.match(PIPE, /className: 'v2-row-title'/);
  assert.match(PIPE, /className: 'v2-row-url'/);
  assert.match(PIPE, /v2-chip-score/);
  assert.match(PIPE, /t\('pipe\.evaluatedBadge', 'Evaluated'\)/);
});

test('groups collapse; the count is announced; volume is bounded', () => {
  assert.match(PIPE, /'aria-expanded': open \? 'true' : 'false'/);
  assert.match(PIPE, /'aria-controls': bodyId/);
  assert.match(PIPE, /'aria-hidden': 'true'[\s\S]{0,80}open \? '▾' : '▸'/);
  // 30k rows must never render at once: pagination over groups +
  // a per-group render budget with an explicit "show more"
  assert.match(PIPE, /GROUPS_PER_PAGE = \d+/);
  assert.match(PIPE, /GROUP_WINDOW = \d+/);
  assert.match(PIPE, /groupPager = UI\.paginate\(\{ pageSize: GROUPS_PER_PAGE/);
  assert.match(PIPE, /g\.entries\.slice\(0, budget\)/);
  assert.match(PIPE, /t\('pipe\.showMore', 'Show more'\)/);
});

test('focus management on group collapse (a11y)', () => {
  // CAR-116 review: the grep-only assertion (btn.focus() somewhere in
  // toggleGroup) passed while the focus landed on the PRE-render toggle
  // that replaceChildren() immediately destroyed. The behavioural
  // contract — focus ends on the toggle in the NEW DOM — lives in
  // tests/playwright-pipeline-v2.mjs (F7). Here we only pin the shape:
  // the re-query happens AFTER renderGroups() inside toggleGroup.
  const at = PIPE.indexOf('function toggleGroup');
  const body = PIPE.slice(at, PIPE.indexOf('function groupBlock', at));
  assert.match(body, /body\.contains\(document\.activeElement\)/,
    'collapse detects focus inside the vanishing body');
  const renderAt = body.indexOf('renderGroups();');
  const refocusAt = body.indexOf('`[aria-controls=');
  assert.ok(renderAt > -1 && refocusAt > renderAt,
    'the toggle is re-queried in the NEW DOM, after the repaint');
});

test('hide-already-evaluated defaults ON and filters both views', () => {
  assert.match(PIPE, /id: 'pipe-hide-tracked',\s*\n\s*type: 'checkbox',\s*\n\s*checked: '',/);
  assert.match(PIPE, /htmlFor: 'pipe-hide-tracked'/);
  assert.match(PIPE, /hideTracked: hideTracked\.checked/, 'grouped filter');
  assert.match(PIPE, /hideT && trackedKeys\.has\(PV\.normKey\(u\)\)/, 'flat filter');
});

// ── bulk select + discard: existing per-entry mechanism, sequential ──

test('bulk selection: every checkbox carries a disambiguated label', () => {
  assert.match(PIPE, /function selectLabel\(u\)/, 'row checkbox label helper');
  assert.match(PIPE, /t\('pipe\.selectOne', 'Select'\) \+ ': ' \+ shortUrl\(u\)/);
  assert.match(PIPE, /t\('pipe\.selectGroup', 'Select all in group'\) \+ ': ' \+ g\.label/);
  // the group checkbox announces its three-state via indeterminate
  assert.match(PIPE, /box\.indeterminate = true/);
});

test('bulk discard: confirm → sequential per-entry DELETE → progress → undo', () => {
  // the only NEW confirm is the bulk one, danger:true
  const at = PIPE.indexOf('async function bulkRemove');
  const body = PIPE.slice(at, PIPE.indexOf('function toggleSelect', at));
  assert.match(body, /await UI\.confirm\(/);
  assert.match(body, /danger: true/);
  // sequential client-side calls through the shared per-entry remover
  assert.match(body, /for \(let i = 0; i < urls\.length; i\+\+\)/);
  assert.match(body, /await removeFromPipeline\(urls\[i\]\)/);
  // progress is announced (role=status) and cancellable
  assert.match(PIPE, /role: 'status', 'aria-live': 'polite', className: 'v2-bulk-progress'/);
  assert.match(body, /bulkCancelFlag \|\| Router\.current\(\)\.name !== 'pipeline'/,
    'cancels on button AND on leaving #/pipeline');
  // nothing submits applications — only pipeline deletes happen
  assert.doesNotMatch(body, /api\/tracker|applications|auto-pipeline/);
});

test('bulk discard: the confirm states the TRUE count (selected ∩ shown)', () => {
  const at = PIPE.indexOf('async function bulkRemove');
  const body = PIPE.slice(at, PIPE.indexOf('function toggleSelect', at));
  assert.match(body, /currentFiltered\(\)/,
    'the removal set is intersected with what is actually shown');
  assert.match(body, /shown\.has\(u\)/,
    'stale selections (filtered out / deleted elsewhere) never reach the confirm');
});

test('selection is pruned when the filters change or the queue refreshes', () => {
  assert.match(PIPE, /function pruneSelection\(/, 'the pruner exists');
  const filterAt = PIPE.indexOf('filterInput.addEventListener');
  const filterBody = PIPE.slice(filterAt, filterAt + 400);
  assert.match(filterBody, /pruneSelection\(/, 'filter input prunes');
  const hideAt = PIPE.indexOf("const hideTracked = c('input'");
  const hideBody = PIPE.slice(hideAt, PIPE.indexOf('const hideTrackedLabel', hideAt));
  assert.match(hideBody, /pruneSelection\(/, 'the hide-tracked lens prunes');
  const refreshAt = PIPE.indexOf('async function refresh');
  const refreshBody = PIPE.slice(refreshAt, PIPE.indexOf('function rebuildEntries', refreshAt));
  assert.match(refreshBody, /pruneSelection\(/, 'refresh prunes');
});

test('bulk remove is re-entrancy guarded (bulkRunning + disabled button)', () => {
  const at = PIPE.indexOf('async function bulkRemove');
  const body = PIPE.slice(at, PIPE.indexOf('function toggleSelect', at));
  assert.match(body, /if \(bulkRunning\) return;/, 'second concurrent run is a no-op');
  assert.match(body, /bulkRunning = true;/);
  assert.match(body, /finally \{[\s\S]*?bulkRunning = false;/, 'the guard releases on every path');
  assert.match(PIPE, /disabled: bulkRunning/, 'the Remove button disables while running');
});

test('undo re-add counts successes; the success toast only fires when >0', () => {
  const at = PIPE.indexOf('async function undoLast');
  const body = PIPE.slice(at, PIPE.indexOf('function shortHost', at));
  assert.match(body, /restored \+= 1/, 'successes are counted, not assumed');
  assert.match(body, /if \(restored > 0\)/, 'no success toast on a fully failed undo');
});

test('group checkbox repaints once, not once per entry', () => {
  const at = PIPE.indexOf('function groupBlock');
  const body = PIPE.slice(at, PIPE.indexOf('function currentFiltered', at));
  const handler = body.slice(body.indexOf('onChange:'), body.indexOf('if (someSel'));
  assert.ok(!handler.includes('toggleSelect('),
    'mutates selected directly — no O(n) toggleSelect chain');
  assert.equal((handler.match(/paintBulkBar\(\)/g) || []).length, 1,
    'exactly one bulk-bar paint');
  assert.equal((handler.match(/renderGroups\(\)/g) || []).length, 1,
    'exactly one group repaint');
});

// ── undo: session-scoped, through the existing add path ─────────────

test('undo bar: body-level (survives re-render), keyboard-reachable, POST re-add', () => {
  assert.match(PIPE, /document\.body\.appendChild\(bar\)/,
    'the bar must live on body — Router.render() re-mounts the view');
  assert.match(PIPE, /id: 'pipeline-undo-btn'/);
  assert.match(PIPE, /API\.post\('\/api\/pipeline', \{ url: u \}\)/,
    'undo re-adds through the existing add path');
  assert.match(PIPE, /undoQueue = PV \? PV\.createUndoQueue\(5\) : null/,
    'bounded session queue');
});

// ── single delete: confirm → removal → undo ONLY on success ─────────

test('all three single-delete sites confirm first and report success only on success', () => {
  // CAR-116 review: removeFromPipeline() swallows errors and returns a
  // boolean, so every UI call site must (a) confirm before deleting,
  // (b) check the boolean instead of relying on the dead try/catch, and
  // (c) push undo ONLY when the removal actually happened.
  const sites = [
    ['preview pane', PIPE.indexOf('removeFromPipeline(activeUrl)')],
    ['flat row', PIPE.indexOf('removeFromPipeline(url)', PIPE.indexOf('function urlRow'))],
    ['grouped card', PIPE.indexOf('removeFromPipeline(url)', PIPE.indexOf('function entryCard'))],
  ];
  for (const [name, at] of sites) {
    assert.ok(at > -1, `${name} delete site exists`);
    const handler = PIPE.slice(PIPE.lastIndexOf('onClick', at), PIPE.indexOf('},', at));
    assert.match(handler, /await UI\.confirm\(/, `${name}: confirm dialog first`);
    assert.match(handler, /removeFromPipeline\(/, `${name}: through the shared remover`);
    assert.match(handler, /if \(!removed\) return;/,
      `${name}: a failed DELETE must not push undo or celebrate`);
    assert.match(handler, /pushUndo\(\[/, `${name}: undo queued after success`);
  }
});

// ── shell wiring ─────────────────────────────────────────────────────

test('index.html loads the stylesheet after the three app sheets, lib before the view', () => {
  const cssOrder = ['/css/app.css', '/css/components.css', '/css/overlays.css', '/css/v2-pipeline.css', '/css/map.css']
    .map((f) => HTML.indexOf(f));
  assert.ok(cssOrder.every((p) => p > -1), 'every stylesheet linked');
  assert.ok(cssOrder.every((p, i) => i === 0 || cssOrder[i - 1] < p),
    'v2-pipeline.css sits between overlays.css and map.css');
  assert.match(HTML, /<!-- CAR-116 — #\/pipeline v2/);
  const lib = HTML.indexOf('/js/lib/pipeline-view.js');
  const view = HTML.indexOf('/js/views/pipeline.js');
  assert.ok(lib > -1 && view > -1 && lib < view,
    'the lib must load before the view (document order = bundle order)');
  const between = HTML.slice(lib, view).match(/<script src=/g) || [];
  assert.equal(between.length, 1,
    'no other script may sit between the lib and the view');
});

test('v2-pipeline.css: exists, token-based, ≤ 800-LOC contract, RTL/motion-safe', () => {
  const lines = CSS.split('\n').length;
  assert.ok(lines <= 800, `v2-pipeline.css is ${lines} lines — over the 800-LOC hard limit`);
  assert.ok(!/#\s*[0-9a-fA-F]{3,8}\b/.test(CSS.replace(/\/\*[\s\S]*?\*\//g, '')),
    'no hardcoded hex colors — tokens only, so dark theme follows');
  assert.match(CSS, /direction: ltr/, 'URLs stay LTR in RTL locales');
  assert.match(CSS, /prefers-reduced-motion: reduce/);
  // CAR-116 review: the undo bar centers PHYSICALLY (left: 50% +
  // translateX(-50%)) — the old inset-inline-start: 50% mirrored to
  // right: 50% in RTL while the transform kept pulling LEFT, pushing
  // the bar off-screen in RTL locales.
  const undoBar = CSS.slice(CSS.indexOf('.v2-undo-bar {'), CSS.indexOf('.v2-undo-bar[hidden]'));
  assert.match(undoBar, /left: 50%/, 'physical left anchor');
  assert.match(undoBar, /transform: translateX\(-50%\)/, '…+ the matching transform (direction-agnostic)');
  assert.doesNotMatch(undoBar, /inset-inline-start/, 'no logical anchor that un-mirrors the transform');
  assert.match(CSS, /max-width: 720px/, 'narrow-viewport stacking');
});

// ── i18n discipline ──────────────────────────────────────────────────

test('CAR-116 strings: I18n.t + EN fallback, fanned out to every locale dict', () => {
  // The review round removed the CAR116_PENDING coverage allowlist —
  // the hand-off comment must be gone and the keys must live in the
  // dicts like every other key.
  assert.doesNotMatch(PIPE, /CAR116_PENDING/, 'no allowlist reference left in the view');
  const keys = Array.from(PIPE.matchAll(/t\('(pipe\.[A-Za-z]+)',\s*'[^']*'\)/g), (m) => m[1]);
  assert.ok(keys.length >= 15, `new fallback-keyed strings present (${keys.length})`);
  for (const k of ['pipe.viewGrouped', 'pipe.viewFlat', 'pipe.hideTracked', 'pipe.undo',
    'pipe.bulkRemove', 'pipe.showMore', 'pipe.evaluatedBadge']) {
    assert.ok(keys.includes(k), `missing new key ${k}`);
    assert.match(EN_DICT, new RegExp(`'${k.replace(/\./g, '\\.')}'`),
      `${k} must exist in the en locale table`);
  }
});
