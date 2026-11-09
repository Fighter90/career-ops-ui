/**
 * CAR-256 (#6597) — the #/pipeline close-date surface. The server joins the
 * scan-history `closes_at` days onto GET /api/pipeline; the view renders a
 * `pipe.closes` chip per row (flat + grouped), turning "due" (within a week
 * or past) into a warning tone. Browser-only view → asserted statically, the
 * pipeline-v2-car116.test.mjs style.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const PIPE = readFileSync(R('public', 'js', 'views', 'pipeline.js'), 'utf8');
const CSS = readFileSync(R('public', 'css', 'v2-pipeline.css'), 'utf8');
const ROUTE = readFileSync(R('server', 'lib', 'routes', 'pipeline.mjs'), 'utf8');

test('the queue read consumes the server-side closesAt join (fail-soft to an empty map)', () => {
  assert.match(PIPE, /fresh\.closesAt/, 'the view reads the closesAt payload');
  assert.match(PIPE, /\? fresh\.closesAt : \{\}/, 'a payload without the map degrades to {}');
});

test('both row shapes render the close-day chip through one helper', () => {
  assert.match(PIPE, /function closeChip\(/, 'one chip builder');
  // flat list: the chip rides the row actions div
  assert.match(PIPE, /c\('div', \{ className: 'flex gap-1' \}, \[\s*\n\s*closeChip\(url\),/);
  // grouped view: the chip joins the enriched chips
  assert.match(PIPE, /const closeChipEl = closeChip\(url\);/);
});

test('a day within a week (or past) is marked due', () => {
  assert.match(PIPE, /is-due/, 'due tone class');
  assert.match(PIPE, /86400000/, 'the week window is a day-count off the parsed day');
});

test('the chip is localized and CSP-safe (no innerHTML, keyed through t())', () => {
  assert.match(PIPE, /t\('pipe\.closes', 'Closes'\)/);
  const en = readFileSync(R('public', 'js', 'lib', 'locales', 'i18n-dict.en.js'), 'utf8');
  assert.match(en, /'pipe\.closes':/);
});

test('the stylesheet styles the chip and its due tone', () => {
  assert.match(CSS, /\.v2-chip-close \{/, 'chip rule');
  assert.match(CSS, /\.v2-chip-close\.is-due \{/, 'due tone rule');
});

test('the server payload keys the map by the raw queue URL', () => {
  assert.match(ROUTE, /closeDateForUrl\(index, url\)/, 'per-URL lookup');
  assert.match(ROUTE, /closesAt\[url\] = day/, 'keyed by the raw URL the client holds');
  assert.match(ROUTE, /catch \{ \/\* no history → no close days \*\/ \}/,
    'a missing history file degrades to an empty map');
});
