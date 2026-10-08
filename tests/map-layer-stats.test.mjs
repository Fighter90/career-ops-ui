/**
 * CAR-41 (v1.243.0 views-3) — the #/map header stats used inconsistent
 * denominators: "Places located: 39/1681" counted geocode GROUPS over all
 * layers while "Without a location: 25163" counted all-history rows, and the
 * located count kept creeping as the geocode cache warmed even with the
 * Scan-results layer switched off.
 *
 * The fix is the pure per-layer counter mapLayerStats (one denominator: the
 * ACTIVE layers' points), run for real in a vm below, wired into update()
 * and re-run on overlayadd/overlayremove.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const MAP = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'map.js'), 'utf8');

function sliceFn(src, startMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} must exist`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces after ${startMarker}`);
}

const statsOf = (() => {
  const ctx = vm.createContext({ Array, Set });
  vm.runInContext(sliceFn(MAP, 'function mapLayerStats'), ctx);
  return vm.runInContext('mapLayerStats', ctx);
})();

const point = (layer, overrides = {}) => ({
  layer, places: ['Berlin, Germany'], lat: null, lon: null, geoDone: false, ...overrides,
});

test('one denominator: the header numbers all count the ACTIVE layers\' points', () => {
  const points = [
    point('scan', { lat: 52.5, lon: 13.4 }),                    // located
    point('scan', { places: [] }),                              // no location at all
    point('scan', { geoDone: true }),                           // attempted, unresolvable
    point('scan'),                                              // pending
    point('pipeline', { lat: 48.1, lon: 11.5 }),                // located, other layer
    point('tracker', { places: [] }),                           // no location, other layer
  ];
  const allOn = () => true;
  const s = statsOf(points, allOn);
  assert.deepEqual({ ...s }, { located: 2, total: 6, noLoc: 3 },
    'located + noLoc + pending = total — one population, three views of it');

  // Scan layer off: every number shrinks consistently (the CAR-41 fix).
  const scanOff = (layer) => layer !== 'scan';
  const s2 = statsOf(points, scanOff);
  assert.deepEqual({ ...s2 }, { located: 1, total: 2, noLoc: 1 },
    'with the Scan-results layer off, none of its points are counted anywhere');
});

test('the located count does not creep with cache warm-up while the layer is off', () => {
  const scanOff = (layer) => layer !== 'scan';
  const before = statsOf(
    [point('scan', { places: [] }), point('pipeline', { places: [] })], scanOff);
  // The geocode loop resolves scan-layer groups in the background…
  const after = statsOf(
    [point('scan', { lat: 1, lon: 2 }), point('pipeline', { places: [] })], scanOff);
  assert.deepEqual({ ...before }, { ...after },
    'resolving hidden-layer points must not move the visible counters');
});

test('failed geocodes land in "Without a location" once attempted (not mid-queue)', () => {
  const points = [point('scan')];
  const allOn = () => true;
  assert.deepEqual({ ...statsOf(points, allOn) }, { located: 0, total: 1, noLoc: 0 },
    'a queued point is pending — neither located nor without-location yet');
  points[0].geoDone = true;
  assert.deepEqual({ ...statsOf(points, allOn) }, { located: 0, total: 1, noLoc: 1 },
    'after the attempt fails it is counted as without-location');
});

test('wiring: update() uses the per-layer counter and follows the layer toggles', () => {
  assert.match(MAP, /const s = mapLayerStats\(points, \(layer\) => map\.hasLayer\(toggles\[layer\]\)\);/,
    'the label is computed over the active layers, not geocode groups');
  assert.match(MAP, /map\.on\('overlayadd overlayremove', update\);/,
    'toggling a layer re-computes the header (the counter is bound to the active layer)');
  assert.doesNotMatch(MAP, /done \+ '\/' \+ byKey\.size/,
    'the old mixed-denominator label (groups vs rows) is gone');
  assert.match(MAP, /p\.geoDone = true;/,
    'failed geocode groups are marked so they count as without-location');
});
