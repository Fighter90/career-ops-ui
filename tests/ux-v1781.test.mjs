/**
 * v1.78.1 — three UX fixes, asserted statically (browser-only files):
 *   1. Scan results table auto-refreshes live during + after a scan (runScanAll
 *      now polls + does a delayed final refresh, like the streamTo path).
 *   2. Top-bar global search: Enter on a non-URL query → #/scan with the search
 *      box pre-filled (was #/tracker); the badge reads "Enter".
 *   3. The brand logo is a link to the dashboard (home).
 * CI-isolated: no server, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const SCAN = read('public/js/views/scan.js');
const APP = read('public/js/app.js');
const HTML = read('public/index.html');

test('scan: the poll handles + cancel helper are DECLARED at module scope (not just referenced)', () => {
  // Guards against the AI-review "ReferenceError" concern: the symbols must be
  // real declarations, and cleanup must be wired to hashchange (navigate-away)
  // so the 2.5s interval can't fire against a detached view.
  assert.match(SCAN, /let __activeScanPollHandle\s*=/, '__activeScanPollHandle must be declared');
  assert.match(SCAN, /let __activeScanDoneTimeout\s*=/, '__activeScanDoneTimeout must be declared');
  assert.match(SCAN, /function __cancelActiveScanPoll\(\)/, '__cancelActiveScanPoll must be declared');
  assert.match(SCAN, /addEventListener\('hashchange', __cancelActiveScanPoll\)/, 'poll must be cancelled on route change');
});

test('scan: runScanAll sets up live polling + a delayed final refresh', () => {
  const fn = SCAN.match(/function runScanAll\(\)\s*\{[\s\S]*?\n {2}\}/);
  assert.ok(fn, 'runScanAll must exist');
  assert.match(fn[0], /__activeScanPollHandle\s*=\s*setInterval\(/, 'must poll refreshResults during the scan');
  assert.match(fn[0], /refreshResults\(\)/, 'must call refreshResults');
  assert.match(fn[0], /__activeScanDoneTimeout\s*=\s*setTimeout\(/, 'must do a delayed final refresh after the terminal done');
  assert.match(fn[0], /__cancelActiveScanPoll\(\)/, 'must clean up the poll on done/error');
});

test('scan: still only ends the run on the terminal done (final !== false)', () => {
  assert.match(SCAN, /data\.final !== false/, 'terminal-done guard must remain');
});

test('global search: Enter on a non-URL query jumps to #/scan, pre-filled (not #/tracker)', () => {
  assert.match(APP, /window\.__scanSearchPrefill\s*=\s*q/, 'app.js must hand the query to the scan view');
  assert.match(APP, /Router\.go\('\/scan'\)/, "app.js must navigate to '/scan' on a non-URL query");
  assert.doesNotMatch(APP, /Router\.go\('\/tracker'\)/, "the non-URL Enter path must no longer go to '/tracker'");
});

test('global search: same-route guard re-renders when already on #/scan (no stale prefill leak)', () => {
  assert.match(APP, /Router\.current\(\)\.name === 'scan'\s*\)\s*Router\.render\(\)/,
    'when already on #/scan, must force Router.render() so the prefill is consumed');
});

test('logo aria-label is localized (not hard-coded English)', () => {
  assert.match(HTML, /<a class="logo"[^>]*data-i18n-aria-label="nav\.logoHome"/, 'logo must use data-i18n-aria-label');
});

test('scan view consumes the one-shot search prefill', () => {
  assert.match(SCAN, /window\.__scanSearchPrefill/, 'scan.js must read the prefill handoff');
  assert.match(SCAN, /filterText\.value\s*=\s*window\.__scanSearchPrefill/, 'scan.js must set filterText from the prefill');
});

test('brand logo is a link to the dashboard (home)', () => {
  assert.match(HTML, /<a class="logo" href="#\/dashboard"/, 'the logo must be an <a> linking to #/dashboard');
});

test('search badge reads Enter (v1.78.1)', () => {
  assert.match(HTML, /<kbd[^>]*class="kbd-shortcut"[^>]*>Enter<\/kbd>/, 'the search badge must read Enter');
});
