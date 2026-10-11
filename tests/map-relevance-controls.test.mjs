import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const map = readFileSync(resolve(root, 'public/js/views/map.js'), 'utf8');
const tracker = readFileSync(resolve(root, 'public/js/views/tracker.js'), 'utf8');
const css = ['app.css', 'components.css', 'overlays.css', 'map.css']
  .map((file) => readFileSync(resolve(root, 'public/css', file), 'utf8')).join('\n');

test('map exposes the agreed score, commute, unknown and unevaluated controls', () => {
  for (const token of ["[3, 3.8, 4.2]", 'showUnevaluated', 'showUnknown', "'/api/commute'", 'Fit results']) {
    assert.ok(map.includes(token), `missing map contract: ${token}`);
  }
  assert.match(map, /if \(!known && !unknownCommute\.checked\) return false;/,
    'unknown commute is independently hideable without selecting a time ceiling');
  assert.match(map, /if \(point\.evaluated\)[\s\S]*point\.scoreNum < minScore/,
    'the score threshold applies to evaluated jobs');
});

test('mobile map uses one bottom sheet and marker tap opens a peek before navigation', () => {
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.job-map-sheet\.is-open \{ display: block;/);
  assert.match(css, /\.job-map-page \{ height: calc\(100dvh/);
  assert.match(map, /if \(!coarsePointer\(\) && !opts\.peek\) \{ point\.open\?\.\(\); return; \}/);
  assert.match(map, /sheet\.classList\.add\('is-open', 'is-peek'\)/);
  assert.match(map, /map\.panBy\(\[0, Math\.ceil\(sheet\.offsetHeight \/ 2\)\]/);
});

test('the relevance palette contains no attention-grabbing red job tier', () => {
  const palette = css.match(/--map-score-top:[\s\S]*?--map-score-none:[^;]+;/)?.[0] || '';
  assert.ok(palette);
  assert.doesNotMatch(palette, /#(?:f00|ff0000|ef4444|dc2626|e53e3e)/i);
  assert.match(map, /members\[0\][\s\S]*best\.color/,
    'clusters inherit their best visible job colour');
});

test('tracker shares commute preferences and exposes location, filter and sort', () => {
  assert.match(tracker, /MapPrefs\.loadCommute\(\)/);
  assert.match(tracker, /sortKey === 'commute'/);
  assert.match(tracker, /commute\.col\.place/);
  assert.match(tracker, /commute\.col\.time/);
});
