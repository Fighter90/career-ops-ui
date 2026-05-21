/**
 * v1.46.0 (WS2 UX-audit #5/#6/#21/#24) — scan SSE accessibility:
 * aria-live log region, Stop button, run-state (disabled + aria-busy),
 * and a persistent role=alert error banner with Retry. scan.js is
 * browser-only, so wiring is asserted statically (router.test.mjs
 * style); behaviour is Playwright-verified per ship.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const SCAN = readFileSync(R('public', 'js', 'views', 'scan.js'), 'utf8');
const DICT = legacyDictText();

test('#5: SSE console is an aria-live log region, keyboard-scrollable', () => {
  assert.match(SCAN, /id:\s*'scan-console',\s*\n?\s*role:\s*'log'/);
  assert.match(SCAN, /'aria-live':\s*'polite'/);
  assert.match(SCAN, /'aria-relevant':\s*'additions'/);
  assert.match(SCAN, /'aria-label':\s*t\('scan\.consoleLabel'/);
  assert.match(SCAN, /id:\s*'scan-console'[\s\S]{0,200}tabindex:\s*'0'/);
});

test('#5: a separate assertive status region for terminal announcements', () => {
  assert.match(SCAN, /id:\s*'scan-status',\s*role:\s*'status',\s*'aria-live':\s*'assertive'/);
  assert.match(SCAN, /className:\s*'visually-hidden'/);
  assert.match(SCAN, /function announce\(msg\)\s*\{\s*statusRegion\.textContent\s*=\s*msg;\s*\}/);
});

test('#6: a Stop button closes the active EventSource', () => {
  assert.match(SCAN, /let activeES = null;/);
  assert.match(SCAN, /const stopBtn = c\('button'/);
  assert.match(SCAN, /function stopScan\(\)/);
  assert.match(SCAN, /activeES\.close\(\)/);
  // both stream paths capture the handle
  const captures = SCAN.match(/activeES = API\.stream\(/g) || [];
  assert.ok(captures.length >= 2, `both stream call-sites must capture activeES (found ${captures.length})`);
  assert.match(SCAN, /scanBtn,\s*\n\s*stopBtn,/);
});

test('#21: run-state disables Scan + sets aria-busy, shows Stop', () => {
  assert.match(SCAN, /function setScanRunning\(running\)\s*\{/);
  assert.match(SCAN, /scanBtn\.disabled = running;/);
  assert.match(SCAN, /scanBtn\.setAttribute\('aria-busy',\s*running \? 'true' : 'false'\)/);
  assert.match(SCAN, /stopBtn\.hidden = !running;/);
  assert.match(SCAN, /setScanRunning\(true\)/);
  assert.match(SCAN, /setScanRunning\(false\)/);
});

test('#24: persistent role=alert error banner with a Retry action', () => {
  assert.match(SCAN, /id:\s*'scan-error',\s*role:\s*'alert'/);
  assert.match(SCAN, /function showScanError\(msg\)/);
  assert.match(SCAN, /t\('scan\.errRetry'/);
  assert.match(SCAN, /onClick:\s*\(\)\s*=>\s*\{\s*clearScanError\(\);\s*if \(lastRunFn\) lastRunFn\(\);\s*\}/);
  // error events in BOTH stream paths now raise the banner
  const calls = SCAN.match(/showScanError\(/g) || [];
  assert.ok(calls.length >= 3, `showScanError must be defined + called from both paths (found ${calls.length})`);
});

test('multi-phase runScanAll only ends run on the terminal done (final !== false)', () => {
  assert.match(SCAN, /if \(!data \|\| data\.final !== false\)\s*\{[\s\S]{0,120}setScanRunning\(false\)/);
});

test('i18n: all 8 new scan a11y keys present with 8 locales', () => {
  for (const k of [
    'scan.consoleLabel', 'scan.stop', 'scan.stopped', 'scan.statusDone',
    'scan.statusFailed', 'scan.statusStopped', 'scan.errBannerTitle', 'scan.errRetry',
  ]) {
    const line = DICT.split('\n').find((l) => l.includes(`'${k}'`));
    assert.ok(line, `missing i18n key ${k}`);
    for (const loc of ['en', 'es', "'pt-BR'", 'ko', 'ja', 'ru', "'zh-CN'", "'zh-TW'"]) {
      assert.ok(line.includes(loc + ':'), `${k} missing locale ${loc}`);
    }
  }
});
