/**
 * CAR-236 — the SPA reads tracker rows through ONE shared loader, and the
 * #/tracker table pages SERVER-SIDE.
 *
 * The three ranked findings this pins (docs/sdd/specs/2026-11-05-perf-findings.md,
 * last item): tracker.js, pipeline.js and stats.js each hit /api/tracker with
 * no params on every navigation — the table shipped every row to the browser,
 * and a single visit to #/stats cost up to three whole-table reads.
 *
 * Contract:
 *   - window.TrackerRows (module-level in tracker.js) is the ONLY read path:
 *     mount()  — a view render declares its mount first (drops the previous
 *                mount's shared promise, so a new navigation re-reads);
 *     all()    — the ALL-rows read the funnel board and the stats aggregates
 *                need, memoized per mount (one fetch per navigation);
 *     all({ fresh: true }) — the post-mutation re-read (pipeline refresh());
 *                bypasses the cache and never poisons it;
 *     page(n)  — the table's server-side pagination ?page=&pageSize=200
 *                (optionally ?status=<canonical stage> for the stage tabs).
 *   - The funnel board keeps ALL rows (it groups every application); once its
 *     read is cached the table derives its pages locally, so a board move is
 *     already visible when the user flips back.
 *   - tracker-kanban.js itself never reads /api/tracker (only the canonical
 *     status POST).
 *
 * CI-isolated: source reads only, no network, no server.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const TRK = readFileSync(R('public/js/views/tracker.js'), 'utf8');
const PIPE = readFileSync(R('public/js/views/pipeline.js'), 'utf8');
const STATS = readFileSync(R('public/js/views/stats.js'), 'utf8');
const KANBAN = readFileSync(R('public/js/lib/tracker-kanban.js'), 'utf8');

// pipeline.js: stats.js: stats.js: stats.js
// the loader instead (the guarded fallbacks in pipeline.js/stats.js are the
// documented dead path for a synthetic-window harness without cross-view
// globals — tests/stats-overview-car120 evaluates views in such a sandbox;
// tests/pipeline-v2-car116 + views-client-fixes-car21 pin that textual shape).
// The [^.\w] guard keeps the loader's own window.API.get(...) call out.
const DIRECT_READ = /[^.\w]API\.get\('\/api\/tracker'\)/;

// A direct read may survive ONLY behind the window.TrackerRows guard.
function assertNoUnguardedDirectReads(src, label) {
  for (const m of src.matchAll(/[^.\w]API\.get\('\/api\/tracker'\)/g)) {
    const before = src.slice(Math.max(0, m.index - 200), m.index);
    assert.ok(before.includes('window.TrackerRows') && before.includes('?'),
      `${label}: a direct read sits behind the window.TrackerRows guard`);
  }
}

// ── 1 · the loader ──────────────────────────────────────────────────────────

test('the shared loader lives at tracker.js module level with the documented surface', () => {
  assert.match(TRK, /window\.TrackerRows = \(function \(\) \{/,
    'the loader is a module-level IIFE (pipeline.js loads before tracker.js, stats.js after — all calls happen at render time)');
  assert.match(TRK, /TABLE_PAGE_SIZE = 200/, 'the table page size is 200');
  assert.match(TRK, /function mount\(\) \{ shared = null; \}/,
    'mount() drops the previous mount\'s shared promise');
  assert.match(TRK, /function all\(opts\)/, 'all() — the ALL-rows read');
  assert.match(TRK, /function page\(n, opts\)/, 'page() — the server-paginated read');
  assert.match(TRK, /'\/api\/tracker\?page=' \+ num \+ '&pageSize=' \+ size/,
    'page() builds the documented ?page=&pageSize= query');
  assert.match(TRK, /'&status=' \+ encodeURIComponent/, '?status= rides encodeURIComponent');
});

// ── 2 · tracker.js — table pages server-side, board keeps ALL rows ──────────

test('tracker.js never reads /api/tracker directly — the loader is the only path', () => {
  assert.doesNotMatch(TRK, DIRECT_READ);
  assert.match(TRK, /TrackerRows\.mount\(\)/, 'the view declares its mount first');
  assert.match(TRK, /TrackerRows\.page\(1\)/, 'the default table view fetches page 1');
  assert.match(TRK, /TrackerRows\.all\(\)/, 'the funnel board fetches ALL rows');
});

test('the table pages SERVER-SIDE: the pager drives TrackerRows.page, no client slice', () => {
  assert.match(TRK, /UI\.paginate\(\{ pageSize: PAGE_SIZE/, 'the pager pages over the server page size');
  assert.ok(!TRK.includes('pager.slice('), 'the client-side slice is gone — every row of the current page renders');
  assert.match(TRK, /TrackerRows\.page\(Math\.max\(1, n \|\| 1\), activeStage \? \{ status: activeStage \} : \{\}\)/,
    'stage tabs ride the server ?status= parameter (whole-history funnel counts stay from the response)');
});

test('the funnel board caches ALL rows per mount; the table derives its pages from them', () => {
  assert.match(TRK, /let allRows = /, 'the mount-scoped ALL-rows cache exists');
  assert.match(TRK, /let rows = /, 'rows is mode-scoped (let, not const)');
  assert.match(TRK, /function stageList\(\)/, 'the board-fresh table source folds the active stage the same way ?status= does');
});

test('whole-history numbers come from the funnel/allRows, never from the page rows', () => {
  assert.match(TRK, /function totalForTabs\(\)/, 'the ALL-tab count and the header count');
  assert.match(TRK, /function countsForTabs\(\)/, 'the stage-tab counts');
  assert.match(TRK, /function bumpFunnel\(/, 'an optimistic status move adjusts the whole-history funnel in place');
  assert.match(TRK, /TS\.stageCounts\(allRows, STAGES, ALIASES\)/,
    'with allRows loaded the counts recount client-side (fresh after board moves)');
});

test('the mode flip loads what the new mode needs, exactly once per mount', () => {
  assert.match(TRK, /function onModeFlip\(\)/, 'the toggle change loads, then applies visibility');
  assert.match(TRK, /let loadToken = 0/, 'superseded loads are token-guarded');
  assert.match(TRK, /initialMode === 'kanban' \? TrackerRows\.all\(\) : TrackerRows\.page\(1\)/,
    'the initial fetch follows the restored view choice');
});

// pipeline.js: the loader plus its guarded dead fallback (see DIRECT_READ).
test('pipeline.js: the mount fan-out reads through the loader; refresh() re-reads fresh', () => {
  assert.match(PIPE, /window\.TrackerRows\) TrackerRows\.mount\(\)/, 'the view declares its mount first');
  const mountAt = PIPE.indexOf('const [p0, tr0, sd0, rep0, map0]');
  assert.ok(mountAt > -1, 'the mount fan-out block is found');
  const mountSlice = PIPE.slice(mountAt, mountAt + 400);
  assert.match(mountSlice, /readTrackerRows\(\)/, 'the mount read goes through the loader helper');
  // CAR-21: the post-mutation refresh() bypasses the shared cache — the
  // helper's fresh branch is the only fresh read, and refresh() is its only
  // true caller.
  assert.match(PIPE, /TrackerRows\.all\(fresh \? \{ fresh: true \} : undefined\)/,
    'the loader helper carries the fresh branch');
  const refreshAt = PIPE.indexOf('async function refresh');
  const refresh = PIPE.slice(refreshAt, PIPE.indexOf('filterInput.addEventListener', refreshAt));
  assert.match(refresh, /readTrackerRows\(true\)/, 'refresh() is the fresh caller');
  assertNoUnguardedDirectReads(PIPE, 'pipeline.js');
});

// ── 4 · stats.js — three tab renders, ONE fetch per navigation ──────────────

test('stats.js: one mount declaration, every tab render reads the shared loader', () => {
  const mounts = STATS.match(/TrackerRows\.mount\(\)/g) || [];
  assert.equal(mounts.length, 1, 'exactly one mount declaration per view render');
  const reads = STATS.match(/TrackerRows\.all\(\)/g) || [];
  assert.equal(reads.length, 3,
    'all three tracker-reading tab renders (Overview / My pipeline / Details) use the loader');
  assertNoUnguardedDirectReads(STATS, 'stats.js');
});

// ── 5 · the kanban lib stays read-free ──────────────────────────────────────

test('tracker-kanban.js never reads /api/tracker (only the canonical status POST)', () => {
  assert.doesNotMatch(KANBAN, DIRECT_READ);
  assert.match(KANBAN, /\/api\/tracker\/status/, 'the board writes through the sanctioned relay');
});
