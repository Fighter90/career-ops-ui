/**
 * CAR-113/123 R4 — the three loading stragglers (assessments, mode-page,
 * pipeline preview) rendered a bare «Loading…» text line while every other
 * data view uses the CAR-112 Skeleton shimmer. Source-static gate: the
 * loading sites must use `Skeleton.block` (role=status + aria-label +
 * shimmer rows) and the old bare `.loading` text lines must be gone.
 *
 * Red-first: both specs fail against main (verified before the fix).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

test('the three loading stragglers render Skeleton blocks', () => {
  const sites = [
    ['public/js/views/assessments.js', 'Skeleton.block(6'],
    ['public/js/views/mode-page.js', 'Skeleton.block(5'],
    ['public/js/views/pipeline.js', 'Skeleton.block(4'],
  ];
  for (const [file, needle] of sites) {
    const src = read(file);
    assert.ok(src.includes(needle), `${file} must render a Skeleton.block at its loading site`);
    assert.ok(src.includes('CAR-113 R4'), `${file} should carry the R4 marker comment`);
  }
});

test('no bare .loading text lines remain at the three sites', () => {
  const pairs = [
    ['public/js/views/assessments.js', "className: 'loading'"],
    ['public/js/views/mode-page.js', 'class="loading"'],
    ['public/js/views/pipeline.js', "className: 'loading'"],
  ];
  for (const [file, needle] of pairs) {
    const src = read(file);
    assert.ok(!src.includes(needle), `${file} still renders a bare .loading text line`);
  }
});

test('skeleton.js is loaded before the three views (classic-script order)', () => {
  const html = read('public/index.html');
  const skel = html.indexOf('/js/lib/skeleton.js');
  assert.ok(skel !== -1, 'skeleton.js must be loaded');
  for (const v of ['assessments.js', 'mode-page.js', 'pipeline.js']) {
    const at = html.indexOf(`/js/views/${v}`);
    assert.ok(at !== -1 && at > skel, `${v} must load after skeleton.js`);
  }
});
