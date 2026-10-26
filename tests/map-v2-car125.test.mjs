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
  vm.runInContext(sliceFn(MAP, 'function clusterMarkers'), ctx);
  return {
    radius: vm.runInContext('clusterRadius', ctx),
    tier: vm.runInContext('clusterTier', ctx),
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
  assert.match(MAP, /const r = 16 \* Math\.sqrt\(i\);/,
    'the same-coordinate spiral clears the widest singleton pair (2×12px + pad)');
});

test('CAR-125: the side list is synchronised with the visible bounds', () => {
  assert.match(MAP, /map\.on\('moveend', syncList\);/, 'pans re-sync the list');
  assert.match(MAP, /getBounds\(\)\.pad\(/, 'the list reads the live viewport');
  assert.match(MAP, /ranked\.filter\(\(p\) => b\.contains\(\[p\.lat, p\.lon\]\)\)/,
    'list membership is a pure bounds check over already-loaded points (no refetch)');
  assert.match(MAP, /const LIST_CAP = \d+;/, 'the list is capped, not unbounded');
  assert.match(MAP, /b\.rank - a\.rank/, 'the list is sorted best-first');
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
