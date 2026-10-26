/**
 * CAR-125 — #/map v2: non-overlapping marker clusters (pure math), a
 * bounds-synced side list, and filter chips.
 *
 * Acceptance (Linear CAR-125):
 *   - markers never overlap at any zoom → clusterMarkers() is a pure
 *     screen-pixel function whose returned anchors are pairwise farther
 *     apart than the sum of the two drawn radii (place-or-join pass, then
 *     a conflict pass that folds any pair whose drawn markers would touch);
 *   - the list is synchronised with the visible area → syncList() reads
 *     map.getBounds() on moveend/zoomend, no refetch;
 *   - filter chips (specialization from config/profile.yml target_roles +
 *     score bands) replace the old two-control toolbar.
 *
 * The pure functions are vm-sliced out of map.js exactly like
 * tests/map-layer-stats.test.mjs does for mapLayerStats — map.js is a
 * classic script, so slicing is the only way to unit-test its math.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const MAP = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'map.js'), 'utf8');
const CSS = readFileSync(resolve(__d, '..', 'public', 'css', 'map.css'), 'utf8');

function sliceFn(src, startMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} must exist`);
  // Walk the parameter list first (a default like `opts = {}` owns the
  // first brace pair), then balance the body braces.
  let parens = 0; let body = -1;
  for (let i = src.indexOf('(', start); i < src.length; i++) {
    if (src[i] === '(') parens++;
    else if (src[i] === ')') { parens--; if (parens === 0) { body = src.indexOf('{', i); break; } }
  }
  assert.ok(body > start, `${startMarker} has no body`);
  let depth = 0;
  for (let i = body; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces after ${startMarker}`);
}

const CLUSTER = (() => {
  const ctx = vm.createContext({ Math });
  vm.runInContext(sliceFn(MAP, 'function clusterRadius'), ctx);
  vm.runInContext(sliceFn(MAP, 'function clusterTier'), ctx);
  vm.runInContext(sliceFn(MAP, 'function spiral'), ctx);
  vm.runInContext(sliceFn(MAP, 'function clusterMarkers'), ctx);
  return {
    radius: vm.runInContext('clusterRadius', ctx),
    tier: vm.runInContext('clusterTier', ctx),
    spiral: vm.runInContext('spiral', ctx),
    markers: vm.runInContext('clusterMarkers', ctx),
  };
})();

// px point factory: best-first order matters (the greedy pass anchors each
// group on its first member).
const pt = (x, y, extra = {}) => ({ px: { x, y }, filled: false, rank: 0, ...extra });

function drawnRadius(g) {
  return g.members.length === 1 ? 12 : CLUSTER.radius(g.members.length);
}

test('CAR-125: clusterMarkers never returns two markers whose circles touch', () => {
  // Adversarial dense grids: everything within 30px on a lattice, plus a
  // sprinkling of pairs at awkward 18-40px distances.
  const pts = [];
  for (let gx = 0; gx < 12; gx++) {
    for (let gy = 0; gy < 12; gy++) pts.push(pt(gx * 30, gy * 30, { filled: (gx + gy) % 3 === 0, rank: gx * gy }));
  }
  for (let i = 0; i < 40; i++) pts.push(pt(400 + i * 19, 400 + (i % 7) * 23, { rank: i }));
  pts.sort((a, b) => b.rank - a.rank);

  const PAD = 4;
  for (const soloPx of [23, 26]) {
    const groups = CLUSTER.markers(pts, { soloPx });
    // nothing lost
    assert.equal(groups.reduce((s, g) => s + g.members.length, 0), pts.length,
      'every point lands in exactly one group');
    // the guarantee: anchors pairwise farther than the two drawn radii + pad
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i]; const b = groups[j];
        const d = Math.hypot(a.px.x - b.px.x, a.px.y - b.px.y);
        const need = drawnRadius(a) + drawnRadius(b) + PAD;
        assert.ok(d > need,
          `markers at (${a.px.x},${a.px.y}) and (${b.px.x},${b.px.y}) are ${d.toFixed(1)}px apart, need > ${need}`);
      }
    }
  }
});

test('CAR-125: lone points keep their own position; anchors never move', () => {
  const pts = [pt(0, 0, { rank: 5 }), pt(1000, 1000), pt(-2000, 500)];
  const groups = CLUSTER.markers(pts, { soloPx: 26 });
  assert.equal(groups.length, 3, 'far-apart points stay singletons');
  for (const g of groups) {
    assert.equal(g.px.x, g.members[0].px.x, 'the anchor is the best member position');
    assert.equal(g.px.y, g.members[0].px.y);
  }
});

test('CAR-125: evaluated dots do not ride a ring crowd when geometry allows', () => {
  const pts = [
    pt(0, 0, { filled: true }), pt(20, 0, { filled: true }),   // evaluated pair
    pt(400, 400), pt(415, 400),                                 // pending pair, far away
  ];
  const groups = CLUSTER.markers(pts, { soloPx: 26 });
  assert.equal(groups.length, 2, 'the two crowds stay apart');
  const kinds = groups.map((g) => new Set(g.members.map((m) => m.filled)));
  for (const set of kinds) assert.equal(set.size, 1, 'pass 1 keeps kinds unmixed');
});

test('CAR-125: cluster size and tier grow with the posting count', () => {
  assert.ok(CLUSTER.radius(1) <= CLUSTER.radius(5), 'radius is monotone');
  assert.ok(CLUSTER.radius(5) <= CLUSTER.radius(50), 'radius is monotone');
  assert.ok(CLUSTER.radius(50) <= CLUSTER.radius(500), 'radius is monotone');
  assert.equal(CLUSTER.radius(1) * 2, 36, 'the smallest cluster is the old 36px marker');
  assert.equal(CLUSTER.tier(9), 's');
  assert.equal(CLUSTER.tier(10), 'm');
  assert.equal(CLUSTER.tier(99), 'm');
  assert.equal(CLUSTER.tier(100), 'l');
});

test('CAR-125: the view drives clustering from zoom level and redraws per zoom', () => {
  assert.match(MAP, /clusterMarkers\(visible, zoom >= SPREAD_ZOOM \? \{ soloPx: 23 \} : \{ soloPx: 26 \}\)/,
    'one pure call site; high zoom keeps singletons separable, low zoom clusters harder');
  assert.match(MAP, /map\.on\('zoomend overlayadd overlayremove', render\);/,
    'clusters re-form per zoom level');
  assert.match(MAP, /const r = 30 \* Math\.sqrt\(i\);/,
    'the same-coordinate spiral clears BOTH the pass-1 solo distance and the widest singleton pair');
});

// CAR-125 review f1 — spiral(1) used to sit at 16px: inside soloPx (23/26),
// so two jobs sharing one geocoded place centre (the common fallback) stayed
// one cluster at EVERY zoom and only the best was ever reachable.
test('CAR-125 review f1: n postings at one coordinate spread into n markers', () => {
  for (const soloPx of [23, 26]) {
    for (const n of [2, 5, 12]) {
      const pts = Array.from({ length: n }, (_, i) => {
        const [dx, dy] = CLUSTER.spiral(i);
        return pt(500 + dx, 500 + dy, { rank: n - i });
      });
      pts.sort((a, b) => b.rank - a.rank);
      const groups = CLUSTER.markers(pts, { soloPx });
      assert.equal(groups.length, n,
        `${n} same-coordinate postings must never merge (soloPx ${soloPx})`);
      for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const d = Math.hypot(groups[i].px.x - groups[j].px.x, groups[i].px.y - groups[j].px.y);
          assert.ok(d > 12 + 12 + 4, `spread siblings ${d.toFixed(1)}px apart must clear the widest singleton pair`);
        }
      }
    }
  }
});

// CAR-125 review f2 — the old `guard < 100` sweep cap silently exited with
// overlaps on viewports needing >100 folds, and truncated the guarantee.
test('CAR-125 review f2: a dense 500-point viewport folds to zero overlapping pairs', () => {
  const pts = [];
  // A tight 22px lattice (inside every merge threshold) plus a jitter ring.
  for (let gx = 0; gx < 25; gx++) {
    for (let gy = 0; gy < 20; gy++) pts.push(pt(gx * 22, gy * 22, { filled: (gx + gy) % 4 === 0, rank: gx * gy }));
  }
  for (let i = 0; i < 100; i++) pts.push(pt(600 + i * 17, 500 + (i % 11) * 21, { rank: 10_000 + i }));
  pts.sort((a, b) => b.rank - a.rank);
  for (const soloPx of [23, 26]) {
    const groups = CLUSTER.markers(pts, { soloPx });
    assert.equal(groups.reduce((s, g) => s + g.members.length, 0), pts.length);
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i]; const b = groups[j];
        const d = Math.hypot(a.px.x - b.px.x, a.px.y - b.px.y);
        const need = drawnRadius(a) + drawnRadius(b) + 4;
        assert.ok(d > need, `fold cap left markers ${d.toFixed(1)}px apart (need > ${need}) at soloPx ${soloPx}`);
      }
    }
  }
});

// CAR-125 review f5 — pass-2 concat put a pending-ring job first in folded
// groups, so the cluster drew an EVALUATED posting with pending styling.
test('CAR-125 review f5: folds keep rank order and re-anchor on the best member', () => {
  // Big low-ranked pending crowd + a high-ranked evaluated singleton 20px
  // away — they conflict (18 + 12 + 4 > 20) and must fold.
  const pts = [
    pt(0, 0, { filled: false, rank: 1 }),
    pt(24, 0, { filled: false, rank: 0 }),
    pt(20, 0, { filled: true, rank: 500 }),
  ];
  pts.sort((a, b) => b.rank - a.rank);
  const groups = CLUSTER.markers(pts, { soloPx: 26 });
  assert.equal(groups.length, 1, 'the conflicting trio folds into one cluster');
  const g = groups[0];
  assert.equal(g.members.length, 3);
  assert.equal(g.members[0].filled, true, 'the evaluated posting stays the cluster best');
  assert.equal(g.members[0].rank, 500);
  assert.equal(g.px.x, g.members[0].px.x, 'the anchor rides the best member position');
  assert.equal(g.px.y, g.members[0].px.y);
});

test('CAR-125: the side list is synchronised with the visible bounds', () => {
  assert.match(MAP, /map\.on\('moveend', syncList\);/, 'pans re-sync the list');
  assert.match(MAP, /getBounds\(\)\.pad\(/, 'the list reads the live viewport');
  assert.match(MAP, /ranked\.filter\(\(p\) => b\.contains\(\[p\.lat, p\.lon\]\)\)/,
    'list membership is a pure bounds check over already-loaded points (no refetch)');
  assert.match(MAP, /const LIST_CAP = \d+;/, 'the list is capped, not unbounded');
  assert.match(MAP, /b\.rank - a\.rank/, 'the list is sorted best-first');
});

// CAR-125 review f3 — the old signature (`length|firstLatLon|lastLatLon`)
// served STALE rows: same-sized same-place sets under different filters
// left it unchanged, so the list showed the PREVIOUS filter's jobs.
test('CAR-125 review f3: the rebuild memo compares point identity, not geometry', () => {
  assert.match(MAP, /p\.tid \?\?= \+\+tidSeq/, 'every point carries a stable identity token');
  assert.match(MAP, /lastListIds && lastListIds\.length === ids\.length\s*&&\s*ids\.every\(\(id, i\) => lastListIds\[i\] === id\)/,
    'the memo is an ordered identity comparison');
  assert.doesNotMatch(MAP, /lat\.toFixed\(4\)/, 'the geometry signature is gone');
});

test('CAR-125: the side list is the keyboard-accessible path (a11y)', () => {
  assert.match(MAP, /c\('aside', \{ className: 'v2-map-list', id: 'v2-map-list', 'aria-label'/,
    'a labelled landmark');
  assert.match(MAP, /c\('button', \{ className: 'v2-map-row', type: 'button'/,
    'rows are real buttons — reachable and operable by keyboard');
  assert.match(MAP, /addEventListener\('focus', \(\) => hot\(p, true\)\)/,
    'keyboard focus highlights the marker, same as hover');
  assert.match(MAP, /classList\?\.toggle\('v2-map-marker-hot', on\)/,
    'one highlight primitive for hover and focus');
});

test('CAR-125: filter chips replace the select (single filter system)', () => {
  assert.match(MAP, /v2-map-chip/, 'chips exist');
  assert.match(MAP, /aria-pressed/, 'toggle state is exposed to AT');
  assert.match(MAP, /data-spec/, 'specialization chips carry the role name');
  assert.match(MAP, /const SCORE_BANDS = \[3, 3.8, 4.2\];/, 'the pinned score bands');
  assert.match(MAP, /target_roles/, 'specialization chips still come from the settings');
  assert.doesNotMatch(MAP, /job-map-spec-select/, 'the select is gone, not duplicated');
  assert.match(MAP, /\(\(profile \|\| \{\}\)\.summary \|\| \{\}\)\.target_roles/, 'fed from /api/profile summary');
});

// CAR-125 review f6 — a stale/tampered localStorage value (`"3.5"`, NaN)
// used to seed minScore: a silent filter with no active chip, and NaN
// comparisons are always false. Only the shipped bands may pass.
test('CAR-125 review f6: minScore only accepts the shipped score bands', () => {
  assert.match(MAP, /let minScore = mapPrefs\.scoreMin == null \? null\n\s*: SCORE_BANDS\.includes\(Number\(mapPrefs\.scoreMin\)\) \? Number\(mapPrefs\.scoreMin\) : null;/,
    'band whitelist at the single init site');
});

// CAR-125 review f7 — «+N more» rendered FIRST (before the rows).
test('CAR-125 review f7: the «+N more» row closes the list, it does not open it', () => {
  assert.match(MAP, /listRows\.replaceChildren\(\.\.\.inView\.slice\(0, LIST_CAP\)\.map\(rowFor\), listMore\)/,
    'rows first, the more-row last');
  assert.doesNotMatch(MAP, /replaceChildren\(listMore, \.\.\./, 'the old leading position is gone');
});

test('CAR-125: "Without a location" is clickable and leads to scan', () => {
  assert.match(MAP, /v2-map-noloc/, 'the counter is a control');
  assert.match(MAP, /Router\.go\('\/scan'\)/, '…that routes to #/scan');
});

test('CAR-125: a cluster at max zoom peeks instead of spinning its wheels', () => {
  assert.match(MAP, /getMaxZoom\?\.\(\)/, 'the cluster click knows the ceiling');
  assert.match(MAP, /showPeek\(best, m, null, \{ peek: true \}\)/,
    'un-expandable clusters fall back to the peek popup');
});

test('CAR-125: map.css gains the v2 surface (append-only, v2-map-prefixed)', () => {
  for (const rule of ['.v2-map-chip', '.v2-map-list', '.v2-map-row', '.v2-map-marker-hot',
    '.v2-map-cluster', '.v2-map-list-toggle']) {
    assert.ok(CSS.includes(rule), `missing css: ${rule}`);
  }
  assert.match(CSS, /\.v2-map-cluster \{[^}]*animation:[^}]*\}[\s\S]*?@media \(prefers-reduced-motion: reduce\) \{[^}]*\.v2-map-cluster \{[^}]*animation: none/,
    'cluster expansion animates, and respects reduced motion');
  assert.match(CSS, /@media \(max-width: 900px\) \{[\s\S]*\.v2-map-list\.is-open \{ display: flex;/,
    'on phones the list is a bottom sheet over the full-screen map');
  assert.match(CSS, /@media \(max-width: 900px\) \{[\s\S]*\.v2-map-list-toggle \{[^}]*display: inline-flex/,
    'the mobile list toggle is a real control');
});

// CAR-125 review f9 — `flex: 0 0 320px` squeezed the map to ~500px at
// 901–1100px. The list must shrink first, with a floor.
test('CAR-125 review f9: the side list yields width to the map before the floor', () => {
  assert.match(CSS, /\.v2-map-list \{[^}]*flex: 0 1 320px;[^}]*min-width: 260px;/,
    'shrinkable basis + a 260px floor keeps the map ≥ ~600px at 901px');
  assert.doesNotMatch(CSS, /\.v2-map-list \{[^}]*flex: 0 0 320px;/, 'the rigid basis is gone');
});
