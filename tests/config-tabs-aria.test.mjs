/**
 * v1.45.0 (WS2 UX-audit #3) — config.js tabs implement the WAI-ARIA
 * Tabs pattern (role=tablist/tab/tabpanel, aria-selected, roving
 * tabindex, ←/→/↑/↓/Home/End). config.js is browser-only, so the
 * wiring is asserted statically (router.test.mjs style); live ARIA
 * state is Playwright-verified per ship.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const CONFIG = readFileSync(R('public', 'js', 'views', 'config.js'), 'utf8');
const DICT = legacyDictText();

test('tablist container has role=tablist + an aria-label', () => {
  assert.match(CONFIG, /role:\s*'tablist'/);
  assert.match(CONFIG, /'aria-label':\s*t\('config\.tablistLabel'/);
});

test('each tab button is role=tab with aria-controls + roving tabindex', () => {
  assert.match(CONFIG, /role:\s*'tab'/);
  assert.match(CONFIG, /'aria-controls':\s*'cfg-tabpanel'/);
  assert.match(CONFIG, /'aria-selected':\s*'false'/);
  assert.match(CONFIG, /tabindex:\s*'-1'/);
  assert.match(CONFIG, /id:\s*'cfg-tab-'\s*\+\s*key/);
});

test('panel is role=tabpanel, focusable, labelled by the active tab', () => {
  assert.match(CONFIG, /id:\s*'cfg-tabpanel',\s*role:\s*'tabpanel',\s*tabindex:\s*'0'/);
  assert.match(CONFIG, /panelHost\.setAttribute\('aria-labelledby',\s*tab\.btn\.id\)/);
});

test('activate() syncs aria-selected + roving tabindex across all tabs', () => {
  assert.match(CONFIG, /x\.btn\.setAttribute\('aria-selected',\s*on\s*\?\s*'true'\s*:\s*'false'\)/);
  assert.match(CONFIG, /x\.btn\.tabIndex\s*=\s*on\s*\?\s*0\s*:\s*-1/);
  // keeps the legacy CSS hook
  assert.match(CONFIG, /x\.btn\.classList\.toggle\('is-active',\s*on\)/);
});

test('keyboard nav: arrows + Home/End, wrapping, preventDefault, focus moves', () => {
  assert.match(CONFIG, /ArrowRight'\s*\|\|\s*e\.key === 'ArrowDown'/);
  assert.match(CONFIG, /ArrowLeft'\s*\|\|\s*e\.key === 'ArrowUp'/);
  assert.match(CONFIG, /e\.key === 'Home'/);
  assert.match(CONFIG, /e\.key === 'End'/);
  assert.match(CONFIG, /\(i \+ 1\) % TABS\.length/);
  assert.match(CONFIG, /\(i - 1 \+ TABS\.length\) % TABS\.length/);
  assert.match(CONFIG, /e\.preventDefault\(\);\s*activate\(TABS\[n\]\.label\);\s*TABS\[n\]\.btn\.focus\(\)/);
});

test('the old textContent-based active toggle is gone (no regression)', () => {
  assert.ok(!/b\.classList\.toggle\('is-active',\s*b\.textContent === label\)/.test(CONFIG),
    'legacy textContent-compare tab toggle must be removed');
});

test('i18n: config.tablistLabel present with all 8 locales', () => {
  const line = DICT.split('\n').find((l) => l.includes("'config.tablistLabel'"));
  assert.ok(line, 'config.tablistLabel missing from i18n-dict');
  for (const loc of ['en', 'es', "'pt-BR'", 'ko', 'ja', 'ru', "'zh-CN'", "'zh-TW'"]) {
    assert.ok(line.includes(loc + ':') || line.includes(loc + ' :'),
      `config.tablistLabel missing locale ${loc}`);
  }
});
