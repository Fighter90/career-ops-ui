/**
 * v1.30.0 — #/scan results paginator.
 *
 * Pre-v1.30 the scan results table truncated the filtered set to the
 * first 200 rows with a "Showing first 200 of N" footnote. There was
 * no way to reach rows 201..N from the UI. v1.30.0 swaps the
 * truncation for `UI.paginate` (same helper that drives #/tracker,
 * #/reports, #/activity) so users can page through the full set.
 *
 * Regression contract — three layers:
 *   1. Static-source canary: `scan.js` wires `UI.paginate` and resets
 *      page on filter input (matching the tracker pattern).
 *   2. Stale-string canary: the `scan.shownTop` i18n key is gone.
 *   3. Logic canary: replicate `UI.paginate` clamping behaviour and
 *      verify boundary cases (empty / first / middle / last / page
 *      overflow after filter narrowing).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function readSrc(...rel) {
  return readFileSync(resolve(ROOT, ...rel), 'utf8');
}

// ───────────────── static-source canaries ─────────────────

test('scan.js wires UI.paginate with PAGE_SIZE=200', () => {
  const src = readSrc('public', 'js', 'views', 'scan.js');
  assert.match(src, /const\s+PAGE_SIZE\s*=\s*200/,
    'scan.js must declare PAGE_SIZE=200 (preserves prior visual density)');
  assert.match(src, /UI\.paginate\s*\(\s*\{\s*pageSize\s*:\s*PAGE_SIZE/,
    'scan.js must construct paginator with the PAGE_SIZE constant');
  assert.match(src, /onChange\s*:\s*\(\s*\)\s*=>\s*renderResults\s*\(\s*\)/,
    'paginator must re-render results on page change');
});

test('scan.js resets paginator to page 1 when filters change', () => {
  // Matches the tracker / reports / activity pattern. Without this,
  // typing in the search filter on a deep page leaves the user
  // looking at an empty page (paginator clamp does the cleanup but
  // the UX is jarring).
  const src = readSrc('public', 'js', 'views', 'scan.js');
  assert.match(src,
    /forEach\s*\(\s*\(\s*el\s*\)\s*=>\s*el\.addEventListener\s*\(\s*['"]input['"]\s*,\s*\(\s*\)\s*=>\s*\{\s*pager\.reset\(\)\s*;\s*renderResults\(\)\s*;?\s*\}\s*\)\s*\)/,
    'scan.js must reset pager + renderResults on filter input');
});

test('scan.js uses pager.slice(sortedAll) — pages over the FULL sorted set', () => {
  // The pre-v1.30 bug-class: slicing BEFORE sorting would surface
  // different boosted rows on different pages. v1.30 sorts the full
  // filtered set first, then paginates.
  const src = readSrc('public', 'js', 'views', 'scan.js');
  // Sort must produce `sortedAll` from `rows.slice()` (full set, not truncated).
  assert.match(src, /const\s+sortedAll\s*=\s*rows\.slice\(\)\.sort\b/,
    'scan.js must sort the FULL filtered set into sortedAll before paginating');
  assert.match(src, /pager\.slice\s*\(\s*sortedAll\s*\)/,
    'scan.js must use pager.slice on the sorted set (so paging is stable across renders)');
});

test('scan.js appends pager.controls AFTER the table', () => {
  const src = readSrc('public', 'js', 'views', 'scan.js');
  assert.match(src, /resultsEl\.appendChild\s*\(\s*pager\.controls\s*\(\s*sorted\.length\s*,\s*rows\.length\s*\)\s*\)/,
    'scan.js must append pager.controls(visible, total) after the results table');
});

test('scan.js no longer truncates with rows.slice(0, 200)', () => {
  // The pre-v1.30 line was `rows.slice(0, 200).sort(...)`. Make sure
  // it's gone — that pattern is the bug we're fixing.
  const src = readSrc('public', 'js', 'views', 'scan.js');
  assert.doesNotMatch(src, /rows\.slice\s*\(\s*0\s*,\s*200\s*\)/,
    'scan.js still has the pre-v1.30 200-row truncation');
});

test('i18n-dict: stale scan.shownTop key was removed', () => {
  const src = legacyDictText();
  assert.doesNotMatch(src, /['"]scan\.shownTop['"]\s*:/,
    'i18n-dict.js still carries the stale `scan.shownTop` key — clean it up after the paginator swap');
});

test('UI.paginate is still defined in api.js with the same surface', () => {
  // Reachability check: the paginator helper that scan.js now relies on.
  const src = readSrc('public', 'js', 'api.js');
  assert.match(src, /function\s+paginate\s*\(/, 'api.js must keep the paginate() helper');
  for (const method of ['slice', 'controls', 'reset']) {
    assert.match(src, new RegExp(`\\b${method}\\s*[(:]`),
      `api.js paginate() must expose .${method}()`);
  }
});

// ───────────────── logic table (mirrors UI.paginate) ─────────────────

test('paginator clamp/slice logic (mirrors UI.paginate behaviour)', () => {
  // Replica of the clamp+slice rules so we can exercise boundary cases
  // deterministically. If a future refactor changes the rules in api.js,
  // this test won't notice — that's by design; the static canaries
  // above lock down the wiring shape.
  function makeMockPager(pageSize) {
    let page = 0;
    const totalPages = (total) => Math.max(1, Math.ceil((total || 0) / pageSize));
    const clamp = (total) => {
      const max = totalPages(total) - 1;
      if (page > max) page = max;
      if (page < 0) page = 0;
    };
    return {
      get page() { return page; },
      setPage(p) { page = p; },
      reset() { page = 0; },
      slice(arr) {
        clamp(arr.length);
        const start = page * pageSize;
        return arr.slice(start, start + pageSize);
      },
    };
  }

  const items = Array.from({ length: 550 }, (_, i) => i);
  const p = makeMockPager(200);

  // Page 0 (first 200) — items 0..199
  assert.equal(p.slice(items).length, 200);
  assert.equal(p.slice(items)[0], 0);
  assert.equal(p.slice(items)[199], 199);

  // Page 1 (rows 200..399)
  p.setPage(1);
  assert.equal(p.slice(items).length, 200);
  assert.equal(p.slice(items)[0], 200);

  // Page 2 (rows 400..549, only 150 rows)
  p.setPage(2);
  assert.equal(p.slice(items).length, 150);
  assert.equal(p.slice(items)[0], 400);
  assert.equal(p.slice(items)[149], 549);

  // Page overflow — paginator must clamp to last valid page.
  p.setPage(99);
  assert.equal(p.slice(items).length, 150);
  assert.equal(p.page, 2, 'overflow page must clamp to last valid index (2 of 0..2)');

  // Filter narrows to 5 rows after we were on page 2 of 550 — must
  // clamp back to page 0 + return the 5-row slice.
  p.setPage(2);
  const narrowed = items.slice(0, 5);
  assert.deepEqual(p.slice(narrowed), [0, 1, 2, 3, 4]);
  assert.equal(p.page, 0, 'shrinking the underlying list must clamp page back to 0');

  // Empty set → 1 totalPage (clamped), empty slice, page=0.
  p.setPage(7);
  assert.deepEqual(p.slice([]), []);
  assert.equal(p.page, 0);

  // Page size 200, exactly 200 items → single page, no overflow.
  p.reset();
  const exact = items.slice(0, 200);
  assert.equal(p.slice(exact).length, 200);
  assert.equal(p.page, 0);
});

test('controls() summary range computation for a 550-row dataset', () => {
  // Mirrors `start = page * pageSize + 1; end = Math.min(total, start + visibleCount - 1)`
  // from public/js/api.js paginate().controls().
  function summary(page, pageSize, visibleCount, total) {
    const start = page * pageSize + 1;
    const end = Math.min(total, start + visibleCount - 1);
    return { start, end };
  }
  assert.deepEqual(summary(0, 200, 200, 550), { start: 1,   end: 200 });
  assert.deepEqual(summary(1, 200, 200, 550), { start: 201, end: 400 });
  assert.deepEqual(summary(2, 200, 150, 550), { start: 401, end: 550 });
});
