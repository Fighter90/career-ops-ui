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

test('usage-hud mounts into the sidebar (flush) with a fixed-corner fallback', () => {
  assert.match(SRC, /querySelector\(['"]\.sidebar['"]\)/);
  assert.match(SRC, /usage-hud--sidebar/);
  assert.match(SRC, /document\.body\.appendChild/);   // fallback path
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
  const langs = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr'];
  for (const k of ['hud.title', 'hud.empty', 'hud.estimate']) {
    const per = dict[k];
    assert.ok(per && typeof per === 'object', `missing i18n key ${k}`);
    for (const lang of langs) assert.ok(typeof per[lang] === 'string' && per[lang].length > 0, `${lang} missing ${k}`);
  }
});

test('usage-hud collapse state persists (localStorage) and body respects [hidden]', () => {
  assert.match(SRC, /localStorage\.setItem\(/);
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\.usage-hud__bodywrap\[hidden\]\s*\{\s*display:\s*none/);
});

test('usage-hud mirrors to the bottom-right in RTL (fixed fallback)', () => {
  const css = read('public', 'css', 'app.css');
  assert.match(css, /\[dir="rtl"\]\s*\.usage-hud\s*\{[^}]*right:\s*20px/);
});
