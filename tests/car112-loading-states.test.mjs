/**
 * CAR-112 — loading states: shimmer skeleton rows + an h1 that exists
 * before the data fetch.
 *
 * Two defects, one concern (perceived performance + a11y):
 *   1. #/map and #/tracker built their whole DOM (h1 included) only AFTER
 *      the data GETs resolved — until then the route showed the router's
 *      bare «Loading…» and focusNewView's h1 target did not exist.
 *   2. Tracker board, scan results and the map shell had no loading
 *      placeholder beyond that text.
 *
 * Fix: both views mount the static page h1 + a shared skeleton block into
 * #content synchronously, BEFORE the first await; public/js/lib/skeleton.js
 * renders N `.skeleton-row` shimmer rows (overlays.css; animation disabled
 * under prefers-reduced-motion); scan seeds its results table and the
 * reposts panel with the same helper.
 *
 * Browser-only view code → source-static assertions (tracker-a11y-sort
 * style) + a synthetic-window unit test of the helper itself.
 * No new i18n keys: the helper is string-free and the call sites reuse
 * existing keys (track.title / map.title / common.loading).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScanSrc } from './helpers/scan-src.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R = (...p) => resolve(ROOT, ...p);
const TRACKER = readFileSync(R('public', 'js', 'views', 'tracker.js'), 'utf8');
const MAP = readFileSync(R('public', 'js', 'views', 'map.js'), 'utf8');
const SCAN = readFileSync(R('public', 'js', 'views', 'scan.js'), 'utf8');
const SKELETON = readFileSync(R('public', 'js', 'lib', 'skeleton.js'), 'utf8');
const INDEX = readFileSync(R('public', 'index.html'), 'utf8');
const OVERLAYS = readFileSync(R('public', 'css', 'overlays.css'), 'utf8');

// --- 1 · the page h1 mounts before the data fetch ---------------------------

test('CAR-112: #/tracker mounts its localized h1 BEFORE the data fetch', () => {
  const h1 = TRACKER.indexOf("HelpHint.title(t('track.title')");
  const awaitPos = TRACKER.indexOf('await Promise.all');
  assert.ok(h1 > -1, 'tracker renders the track.title h1');
  assert.ok(awaitPos > -1);
  assert.ok(h1 < awaitPos,
    'the h1 must be built before await Promise.all — the router focus target and heading tree must exist while the tracker GETs are in flight');
  // The early shell mounts into the router's #content (the full page
  // returned below replaces it once the data lands).
  assert.match(TRACKER, /document\.getElementById\('content'\)/);
  assert.match(TRACKER, /shell\.replaceChildren\(/);
});

test('CAR-112: #/map mounts its h1 BEFORE the data fetch', () => {
  const h1 = MAP.indexOf("t('map.title', 'Job map')");
  const awaitPos = MAP.indexOf('await Promise.all');
  assert.ok(h1 > -1, 'map renders the map.title h1');
  assert.ok(awaitPos > -1);
  assert.ok(h1 < awaitPos,
    'the h1 must be built before await Promise.all — the map awaits five GETs before its DOM existed at all');
  assert.match(MAP, /shell\.replaceChildren\(/);
});

// --- 2 · the shared skeleton helper -----------------------------------------

test('CAR-112: skeleton helper exists, is string-free (no new i18n), renders .skeleton-row rows', () => {
  assert.match(SKELETON, /window\.Skeleton = /);
  assert.match(SKELETON, /skeleton-row/);
  // The helper never localizes — that is the views' job (existing keys only).
  assert.ok(!/I18n/.test(SKELETON), 'skeleton.js must not reference I18n (no new keys from agents)');
  assert.match(SKELETON, /aria-hidden/);
});

test('CAR-112: skeleton helper unit — rows clamp, aria-hidden, block carries a polite label', () => {
  const made = [];
  const fakeEl = (tag) => {
    const el = {
      tag, children: [], attrs: {}, style: {},
      setAttribute(k, v) { el.attrs[k] = String(v); },
      appendChild(ch) { el.children.push(ch); return ch; },
    };
    made.push(el);
    return el;
  };
  const document = {
    createElement: fakeEl,
    createDocumentFragment: () => fakeEl('#fragment'),
  };
  const w = {};
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', SKELETON)(w, document);
  const SK = w.Skeleton;
  assert.ok(SK, 'window.Skeleton defined');

  const rows = SK.rows(3);
  assert.equal(rows.children.length, 3);
  for (const r of rows.children) {
    assert.equal(r.className, 'skeleton-row');
    assert.equal(r.attrs['aria-hidden'], 'true');
  }
  // Clamp: a caller bug can neither paint zero nor thousands of rows.
  assert.equal(SK.rows(0).children.length, 1);
  assert.equal(SK.rows(9999).children.length, 24);
  assert.equal(SK.rows(undefined).children.length, 1);

  const block = SK.block(2, 'Loading…');
  assert.equal(block.attrs.role, 'status');
  assert.equal(block.attrs['aria-label'], 'Loading…');
  assert.equal(block.children.length, 1); // the rows fragment
  assert.equal(block.children[0].children.length, 2);
});

// --- 3 · wired into the three views -----------------------------------------

test('CAR-112: tracker + scan + map render skeleton rows instead of a bare Loading text', () => {
  const SCAN_ALL = loadScanSrc();
  for (const [name, src] of [['tracker', TRACKER], ['map', MAP], ['scan', SCAN]]) {
    assert.match(src, /Skeleton\.block\(/, `${name} view must use the shared skeleton helper`);
  }
  // scan seeds BOTH surfaces that used to show text/nothing:
  // the initial results table and the lazy reposts panel. CAR-115 moved the
  // reposts panel to views/scan/runner.js — read the concatenated view.
  assert.match(SCAN, /resultsEl\.replaceChildren\(\s*window\.Skeleton\.block\(/);
  assert.match(SCAN_ALL, /repostsBody\.replaceChildren\(\s*window\.Skeleton\.block\(/);
  assert.ok(!/repostsBody\.textContent = t\('common\.loading'/.test(SCAN_ALL),
    'the reposts panel must not paint a bare Loading text anymore');
  // Call sites reuse EXISTING keys only.
  assert.match(TRACKER, /Skeleton\.block\(8, t\('common\.loading', 'Loading…'\)\)/);
  assert.match(MAP, /Skeleton\.block\(\d+, t\('common\.loading', 'Loading…'\)\)/);
});

test('CAR-112: index.html loads the helper before the three views', () => {
  const skel = INDEX.indexOf('/js/lib/skeleton.js');
  assert.ok(skel > -1, 'skeleton.js must be wired into index.html');
  for (const v of ['/js/views/scan.js', '/js/views/map.js', '/js/views/tracker.js']) {
    const pos = INDEX.indexOf(v);
    assert.ok(pos > -1, `${v} present`);
    assert.ok(skel < pos, `skeleton.js must load before ${v}`);
  }
});

// --- 4 · the shimmer CSS -----------------------------------------------------

test('CAR-112: .skeleton-row shimmer CSS exists and honours prefers-reduced-motion', () => {
  assert.match(OVERLAYS, /\.skeleton-row \{/);
  assert.match(OVERLAYS, /@keyframes skeleton-shimmer/);
  // No animation for users who asked for reduced motion.
  assert.match(OVERLAYS, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.skeleton-row \{ animation: none;/);
});
