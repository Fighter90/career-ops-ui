/**
 * v1.56.0 — UX-10: an honest "what will ⚡ Run live cost?" hint must
 * sit next to the live-run control on #/auto, #/evaluate, #/deep and
 * #/<mode>. One shared helper (UI.providerCostHint) reuses
 * GET /api/status/providers (v1.55.3) and degrades to a clear
 * no-cost note in manual-prompt mode. Browser-only → source-static.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(__d, '..', p), 'utf8');
const API = read('public/js/api.js');
const DICT = legacyDictText();
const CSS = read('public/css/app.css');
const LOCALES = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW'];

test('UI.providerCostHint helper exists, exported, and is fail-soft', () => {
  assert.match(API, /function providerCostHint\(t\)/, 'helper must be defined');
  assert.match(API, /return \{[^}]*providerCostHint[^}]*\};/,
    'providerCostHint must be on the UI surface');
  assert.match(API, /\/api\/status\/providers/, 'must reuse the v1.55.3 endpoint');
  assert.match(API, /catch\s*\{[^}]*\}/, 'network failure must be swallowed (fail-soft)');
  assert.match(API, /cost\.manual/, 'no-key path uses cost.manual copy');
  assert.match(API, /cost\.estimate/, 'keyed path uses cost.estimate copy');
});

test('all 4 live-run views render the cost hint', () => {
  for (const v of ['auto', 'evaluate', 'deep', 'mode-page']) {
    const src = read(`public/js/views/${v}.js`);
    assert.match(src, /UI\.providerCostHint\(t\)/,
      `#/${v} must render UI.providerCostHint(t)`);
  }
});

test('cost.* i18n keys present in all 8 locales', () => {
  for (const key of ['cost.estimate', 'cost.manual']) {
    const line = DICT.split('\n').find((l) => l.includes(`'${key}'`));
    assert.ok(line, `i18n key ${key} missing`);
    for (const loc of LOCALES) {
      const tok = /-/.test(loc) ? `'${loc}':` : `${loc}:`;
      assert.ok(line.includes(tok), `${key} missing locale ${loc}`);
    }
  }
});

test('.cost-hint style exists and is quiet', () => {
  assert.match(CSS, /\.cost-hint\s*\{/, '.cost-hint rule must exist');
  assert.match(CSS, /\.cost-hint\[hidden\]\s*\{\s*display:\s*none/,
    '.cost-hint must hide when offline');
});
