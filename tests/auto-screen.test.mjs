/**
 * v1.34.0 (WS5) — #/auto one-click AutoPipeline screen.
 *
 * The view is a browser classic-script (window.Router.register) so it
 * can't be imported in node. These are static-source canaries + an
 * i18n-parity gate that lock the WS5 contract:
 *   1. auto.js registers the 'auto' route.
 *   2. It POSTs /api/auto-pipeline and drains the SSE stream
 *      (mirrors the proven lib/auto-pipeline.js transport).
 *   3. Accessibility scaffolding present: aria-live region + the
 *      stepper sets aria-current on the running step.
 *   4. index.html wires the script + a sidebar nav entry.
 *   5. The dashboard ✨ button now routes to #/auto (single flow).
 *   6. Every new i18n key resolves in all 8 locales.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAssembledDict } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const AUTO = readFileSync(R('public', 'js', 'views', 'auto.js'), 'utf8');
const INDEX = readFileSync(R('public', 'index.html'), 'utf8');
const DASH = readFileSync(R('public', 'js', 'views', 'dashboard.js'), 'utf8');

test('auto.js registers the "auto" route', () => {
  assert.match(AUTO, /Router\.register\(\s*['"]auto['"]/);
});

test('auto.js POSTs /api/auto-pipeline and drains the SSE stream', () => {
  assert.match(AUTO, /fetch\(\s*['"]\/api\/auto-pipeline['"]/);
  assert.match(AUTO, /method:\s*['"]POST['"]/);
  assert.match(AUTO, /getReader\(\)/);
  assert.match(AUTO, /event:\s*\\s\*\(\[/); // the `^event:` SSE match regex
});

test('a11y: aria-live region + aria-current on running step', () => {
  assert.match(AUTO, /aria-live['"]\s*:\s*['"]polite['"]/);
  assert.match(AUTO, /setAttribute\(\s*['"]aria-current['"]\s*,\s*['"]step['"]\s*\)/);
});

test('manual-mode (no key) path renders a copy-prompt card', () => {
  assert.match(AUTO, /mode\s*===\s*['"]manual['"]/);
  assert.match(AUTO, /auto\.copyPrompt/);
});

test('success path deep-links to #/reports and #/tracker', () => {
  assert.match(AUTO, /#\/reports\/['"]\s*\+\s*data\.slug/);
  assert.ok(AUTO.includes("'#/tracker'") || AUTO.includes('"#/tracker"'));
});

test('index.html wires the auto.js script + sidebar nav entry', () => {
  assert.match(INDEX, /<script src="\/js\/views\/auto\.js"><\/script>/);
  assert.match(INDEX, /href="#\/auto"\s+data-route="auto"/);
  assert.match(INDEX, /data-i18n="nav\.auto"/);
});

test('dashboard ✨ button routes to #/auto (single coherent flow)', () => {
  assert.match(DASH, /Router\.go\(\s*['"]\/auto['"]\s*\)/);
});

test('every new WS5 i18n key resolves in all 8 locales', () => {
  const D = loadAssembledDict();
  const LOCALES = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr'];
  const KEYS = [
    'nav.auto', 'auto.subtitle', 'auto.urlLabel', 'auto.urlRequired',
    'auto.step.report', 'auto.stepWord', 'auto.doneTitle', 'auto.viewReport',
    'auto.viewTracker', 'auto.legitimacy', 'auto.manualTitle', 'auto.manualHint',
    'auto.copyPrompt', 'auto.copied',
  ];
  for (const k of KEYS) {
    assert.ok(D[k], `missing key ${k}`);
    for (const lc of LOCALES) {
      assert.ok(typeof D[k][lc] === 'string' && D[k][lc].length > 0,
        `key ${k} missing locale ${lc}`);
    }
  }
});
