/**
 * v1.55.5 — UX-3 (Information scent / cognitive load): #/dashboard
 * opened with ~30 nodes of equal weight. Promote the 1–2 P0 CTAs
 * (Auto-pipeline a URL, 🌐 Scan now) into a visually dominant hero
 * block with a focal recent-activity hint ("Last evaluation: <score>
 * — <title>"); demote the application-status buckets to compact
 * chips so the single most valuable next action is unmistakable.
 *
 * dashboard.js is browser-only → asserted statically (router.test.mjs
 * / auto-stepper-prerender.test.mjs style); the i18n contract is
 * re-derived from i18n-dict.js so it stays locked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const DASH = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'dashboard.js'), 'utf8');
const CSS = readFileSync(resolve(__d, '..', 'public', 'css', 'app.css'), 'utf8');
const DICT = legacyDictText();
const LOCALES = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW'];

test('a .dash-hero block exists and is built near the top', () => {
  assert.match(DASH, /className: 'dash-hero'/, 'dashboard must render a .dash-hero block');
  // Hero must precede the dense Quick-actions section in source order.
  const hero = DASH.indexOf("'dash-hero'");
  const quick = DASH.indexOf("dash.quick.title");
  assert.ok(hero > -1 && quick > -1 && hero < quick,
    'the hero must come before the Quick-actions grid');
});

test('hero promotes the 2 P0 CTAs as hero buttons', () => {
  // Both primary journeys reachable as prominent buttons in the hero.
  assert.match(DASH, /btn-hero/, 'P0 CTAs must use the .btn-hero treatment');
  assert.match(DASH, /Router\.go\('\/auto'\)/, 'Auto-pipeline CTA present');
  assert.match(DASH, /Router\.go\('\/scan'\)/, 'Scan CTA present');
  assert.match(DASH, /t\('dash\.autoPipeline'/, 'auto CTA uses dash.autoPipeline');
  assert.match(DASH, /t\('dash\.scanNow'/, 'scan CTA uses dash.scanNow');
});

test('hero shows a focal last-evaluation hint (or an empty-state)', () => {
  assert.match(DASH, /t\('dash\.lastEval'/, 'focal recent-activity label via dash.lastEval');
  assert.match(DASH, /t\('dash\.heroNoEval'/, 'cold-start empty-state via dash.heroNoEval');
});

test('status buckets demoted to compact chips', () => {
  assert.match(DASH, /dash-chip/, 'status buckets must use the compact .dash-chip class');
  assert.match(CSS, /\.dash-chip\s*\{/, '.dash-chip style must exist');
  assert.match(CSS, /\.btn-hero\s*\{/, '.btn-hero style must exist');
  assert.match(CSS, /\.dash-hero\s*\{/, '.dash-hero style must exist');
});

test('dash.lastEval + dash.heroNoEval present in all 8 locales', () => {
  for (const key of ['dash.lastEval', 'dash.heroNoEval']) {
    const line = DICT.split('\n').find((l) => l.includes(`'${key}'`));
    assert.ok(line, `i18n key ${key} missing`);
    for (const loc of LOCALES) {
      const tok = /-/.test(loc) ? `'${loc}':` : `${loc}:`;
      assert.ok(line.includes(tok), `${key} missing locale ${loc}`);
    }
  }
});
