/**
 * v1.109.0 — scan Exclude filter + include-OR, and the pipeline overview strip.
 * Client-view source-pattern checks (the views touch `window`/DOM), matching the
 * convention in router.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadScanSrc } from './helpers/scan-src.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');

test('scan.js has an Exclude field wired into filtering + saved-search state', () => {
  const src = loadScanSrc();
  assert.match(src, /const filterExclude = /);
  // include treated as comma-OR, exclude hides on ANY match
  assert.match(src, /qTerms\.some\(\(term\) => hay\.includes\(term\)\)/);
  assert.match(src, /exTerms\.some\(\(term\) => hay\.includes\(term\)\)/);
  // round-trips through saved-search state + reset
  assert.match(src, /exclude: filterExclude\.value/);
  assert.match(src, /filterExclude\.value = s\.exclude/);
  assert.match(src, /filterExclude\.value = '';/);
});

test('pipeline.js renders an overview strip (inbox + tracked + key statuses)', () => {
  const src = read('public', 'js', 'views', 'pipeline.js');
  assert.match(src, /const overview = /);
  assert.match(src, /ovChip\(allUrls\.length, t\('pipe\.ovInbox'/);
  assert.match(src, /ovChip\(trackerRows\.length, t\('pipe\.ovTracked'/);
  assert.match(src, /\['Applied', 'Responded', 'Interview', 'Offer'\]/);
  // degrades gracefully if the tracker can't be read
  assert.match(src, /catch \{ trackerRows = \[\]; \}/);
});
