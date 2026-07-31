/**
 * usage-hud.js (v1.114.0) — bottom-left "USAGE" meter on every page.
 *
 * Browser-only (DOM), so these are source-contract + wiring checks: it must be
 * CSP-safe, read the existing read-only usage endpoint, mount into the sidebar
 * (flush section) with a fixed-corner fallback, carry data-i18n hooks, and its
 * 3 new i18n keys must exist in all 16 locales.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict } from './helpers/i18n-vm.mjs';
import { loadAppCss } from './helpers/css.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');
const SRC = read('public', 'js', 'lib', 'usage-hud.js');

test('usage-hud reads the read-only /api/usage endpoint (no new API surface, no writes)', () => {
  assert.match(SRC, /API\.get\(['"]\/api\/usage['"]\)/);
  assert.doesNotMatch(SRC, /API\.(post|put|delete)\(/);
});

test('usage-hud is CSP-safe: no inline on* handlers, uses addEventListener', () => {
  assert.doesNotMatch(SRC, /\son\w+=['"]/i);
  assert.match(SRC, /addEventListener\(/);
});

test('usage-hud is pinned to the sidebar bottom (fixed, full sidebar width) and pads the sidebar so nav is never covered', () => {
  assert.match(SRC, /document\.body\.appendChild/);
  const css = loadAppCss();
  // Fixed to the bottom-left, sidebar-width, on top of the sidebar.
  assert.match(css, /\.usage-hud\s*\{[^}]*position:\s*fixed[^}]*left:\s*0[^}]*bottom:\s*0/);
  assert.match(css, /\.usage-hud\s*\{[^}]*width:\s*var\(--sidebar-w\)/);
  // JS reserves matching space at the sidebar bottom (via a CSS custom property,
  // never clobbering inline padding) so the menu clears above it; and without a
  // sidebar in the DOM the HUD does not mount at all (v1.116 review findings).
  assert.match(SRC, /function syncSidebarPad/);
  assert.match(SRC, /setProperty\(['"]--usage-hud-pad['"]/);
  assert.doesNotMatch(SRC, /style\.paddingBottom\s*=/);
  assert.match(SRC, /if \(!document\.querySelector\(['"]\.sidebar['"]\)\) return;/);
  assert.match(css, /--usage-hud-pad/);
});

test('usage-hud refreshes in real time (interval + tab-focus + hashchange)', () => {
  // v1.117.x SPA-M3: the interval drives tick() (backoff-aware) instead of
  // calling refresh() directly; focus/hashchange still retry immediately.
  assert.match(SRC, /setInterval\(tick,\s*\d+\)/);
  assert.match(SRC, /visibilitychange/);
  assert.match(SRC, /addEventListener\(['"]hashchange['"],\s*refresh\)/);
});

test('usage-hud shows real tokens + cost per window, not a misleading share %', () => {
  // The row value is `<tokens> · <cost>`, and bars scale against the 30d window.
  assert.match(SRC, /money\(w\.totalUsd\)/);
  assert.match(SRC, /winOf\(data,\s*['"]30d['"]\)/);
  assert.doesNotMatch(SRC, /pct\s*\+\s*'%'\s*\)\s*,?\s*el\('span'/); // no "· N%" text in the value
});

test('index.html loads usage-hud.js on every page (after api.js)', () => {
  const html = read('public', 'index.html');
  assert.match(html, /<script src="\/js\/lib\/usage-hud\.js"><\/script>/);
  const iApi = html.indexOf('/js/api.js');
  const iHud = html.indexOf('/js/lib/usage-hud.js');
  assert.ok(iApi !== -1 && iHud > iApi, 'usage-hud.js must load after api.js');
});

test('usage-hud carries data-i18n hooks so applyI18n() re-localizes it', () => {
  assert.match(SRC, /data-i18n['"]?\s*:\s*['"]hud\.title/);
});

test('the 3 hud.* keys exist in all 16 locales', () => {
  const dict = loadAssembledDict();
  const langs = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi'];
  for (const k of ['hud.title', 'hud.empty', 'hud.estimate']) {
    const per = dict[k];
    assert.ok(per && typeof per === 'object', `missing i18n key ${k}`);
    for (const lang of langs) assert.ok(typeof per[lang] === 'string' && per[lang].length > 0, `${lang} missing ${k}`);
  }
});

test('usage-hud collapse state persists (localStorage) and body respects [hidden]', () => {
  assert.match(SRC, /localStorage\.setItem\(/);
  const css = loadAppCss();
  assert.match(css, /\.usage-hud__bodywrap\[hidden\]\s*\{\s*display:\s*none/);
});

test('usage-hud mirrors to the sidebar bottom-right edge in RTL', () => {
  const css = loadAppCss();
  assert.match(css, /\[dir="rtl"\]\s*\.usage-hud\s*\{[^}]*right:\s*0/);
});

test('HUD backs off exponentially while /api/usage is failing (SPA-M3)', () => {
  // Source contract: the interval drives tick() (not refresh directly), a
  // failure grows skipTicks (capped), and a success resets both counters.
  assert.match(SRC, /setInterval\(tick, 15000\)/);
  assert.match(SRC, /skipTicks = Math\.min\(Math\.pow\(2, failCount - 1\), 16\)/);
  assert.match(SRC, /failCount = 0;\s*\n\s*skipTicks = 0;/);
  assert.match(SRC, /if \(skipTicks > 0\) \{ skipTicks -= 1; return; \}/);
});
