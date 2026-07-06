/**
 * docs-fab.js (v1.113.0) — floating "Ask the docs" assistant launcher.
 *
 * The widget is browser-only (DOM), so these are source-contract + wiring
 * checks: it must be CSP-safe (no inline handlers), reuse the existing grounded
 * endpoint, be loaded by index.html on every page, carry data-i18n hooks so it
 * re-localizes, hide itself on the dedicated #/docs-assistant page, and its
 * i18n keys must exist in all 16 locales.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');
const SRC = read('public', 'js', 'lib', 'docs-fab.js');

test('docs-fab reuses the grounded docs-assistant endpoint (no new API surface)', () => {
  assert.match(SRC, /\/api\/docs-assistant\/ask/);
  assert.match(SRC, /run:\s*true/);
});

test('docs-fab is CSP-safe: no inline on* handlers, uses addEventListener + UI.md', () => {
  assert.doesNotMatch(SRC, /\son\w+=['"]/i);       // no inline onclick="…" attributes
  assert.match(SRC, /addEventListener\(/);
  assert.match(SRC, /UI\.md\(/);                    // answer markdown routed through the escape-first boundary
});

test('docs-fab mounts globally (self-init into document.body) and hides on #/docs-assistant', () => {
  assert.match(SRC, /document\.body\.appendChild/);
  assert.match(SRC, /docs-assistant/);              // route-visibility guard
  assert.match(SRC, /syncRouteVisibility/);
});

test('index.html loads docs-fab.js on every page (after api.js/i18n.js)', () => {
  const html = read('public', 'index.html');
  assert.match(html, /<script src="\/js\/lib\/docs-fab\.js"><\/script>/);
  const iApi = html.indexOf('/js/api.js');
  const iFab = html.indexOf('/js/lib/docs-fab.js');
  assert.ok(iApi !== -1 && iFab > iApi, 'docs-fab.js must load after api.js (needs UI/API)');
});

test('docs-fab carries data-i18n hooks so applyI18n() re-localizes it on language change', () => {
  assert.match(SRC, /data-i18n['"]?\s*:\s*['"]fab\.title/);
  assert.match(SRC, /data-i18n-aria-label['"]?\s*:\s*['"]fab\.open/);
});

test('the 5 fab.* keys + docs.err exist in all 16 locales (assembled per-key map)', () => {
  const dict = loadAssembledDict();
  const langs = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr'];
  for (const k of ['fab.open', 'fab.title', 'fab.status', 'fab.close', 'fab.greeting', 'docs.err']) {
    const perLocale = dict[k];
    assert.ok(perLocale && typeof perLocale === 'object', `missing i18n key ${k}`);
    for (const lang of langs) {
      assert.ok(typeof perLocale[lang] === 'string' && perLocale[lang].length > 0,
        `${lang} is missing i18n key ${k}`);
    }
  }
});

test('docs-fab panel respects [hidden] with an explicit display:none override (v1.58.35 lesson)', () => {
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.docs-fab__panel\[hidden\]\s*\{\s*display:\s*none/);
});

test('docs-fab launcher mirrors to bottom-left in RTL', () => {
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\[dir="rtl"\][^{]*\.docs-fab[^{]*\{[^}]*left:\s*24px/);
});
