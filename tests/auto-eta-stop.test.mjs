/**
 * v1.55.4 — UX-6 (Feedback / Error recovery):
 *   • #/auto must show the documented "1–2 minutes" ETA next to Run
 *     so the one-click promise is honest about how long it takes
 *     (career-ops.org/docs: auto-pipeline ≈ 1–2 min).
 *   • #/scan must promote Stop to a prominent destructive button
 *     while the multi-minute crawl is running (aria-busy), instead
 *     of a low-contrast ghost button the user can't find under load.
 *
 * Browser-only views → asserted statically (router.test.mjs /
 * auto-stepper-prerender.test.mjs style); the locale + class
 * contracts are re-derived from source so they stay locked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const AUTO = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'auto.js'), 'utf8');
const SCAN = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'scan.js'), 'utf8');
const DICT = legacyDictText();
const CSS = readFileSync(resolve(__d, '..', 'public', 'css', 'app.css'), 'utf8');
const LOCALES = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW'];

test('#/auto renders an ETA hint via auto.eta next to Run', () => {
  assert.match(AUTO, /t\('auto\.eta'/, 'auto.js must render t(auto.eta)');
  // ETA element carries the .auto-eta class and is built near runBtn.
  assert.match(AUTO, /className: 'auto-eta'/, 'ETA hint needs the .auto-eta class');
  // It must be in the same flex row as runBtn (rendered alongside it).
  assert.match(AUTO,
    /runBtn,\s*\n\s*etaHint,|etaHint,\s*\n\s*runBtn,|runBtn,\s*etaHint|etaHint[\s\S]{0,40}runBtn/,
    'the ETA hint must sit next to runBtn in the action row');
});

test('auto.eta present in all 8 locales', () => {
  const line = DICT.split('\n').find((l) => l.includes("'auto.eta'"));
  assert.ok(line, 'i18n key auto.eta missing');
  for (const loc of LOCALES) {
    const tok = /-/.test(loc) ? `'${loc}':` : `${loc}:`;
    assert.ok(line.includes(tok), `auto.eta missing locale ${loc}`);
  }
});

test('#/scan promotes Stop to a destructive button while running', () => {
  // setScanRunning toggles the Stop button class so it is prominent
  // (btn-danger) during the crawl and quiet (btn-ghost) otherwise.
  assert.match(SCAN, /scan-stop-btn/, 'stop button keeps its scan-stop-btn hook');
  assert.match(SCAN, /btn-danger/,
    'Stop must become btn-danger while the scan is running');
  // The class flip happens inside the running-state setter, keyed off
  // the `running` flag (same place aria-busy is toggled).
  assert.match(SCAN,
    /function setScanRunning\(running\)\s*\{[\s\S]*?btn-danger[\s\S]*?\}/,
    'the destructive promotion must live in setScanRunning(running)');
});

test('.btn-danger style exists and is visually distinct', () => {
  assert.match(CSS, /\.btn-danger\s*\{/, '.btn-danger rule must exist');
  // Filled, high-contrast (uses the error/rausch token, white text).
  const block = CSS.match(/\.btn-danger\s*\{[^}]*\}/);
  assert.ok(block && /color:\s*#?fff|color:\s*white/i.test(block[0]),
    '.btn-danger must use high-contrast white text on a filled bg');
});
