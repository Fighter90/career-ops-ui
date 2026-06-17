/**
 * v1.57.0 — #/config gains an OpenRouter provider: OPENROUTER_API_KEY
 * (secret) + OPENROUTER_MODEL (a dynamic select fed by the live
 * OpenRouter catalogue via GET /api/openrouter/models, with a curated
 * offline fallback). Mirrors openai-model-selector.test.mjs: config.js
 * is browser-only so it's asserted statically; env-config is importable
 * so its contract is exercised directly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { KNOWN_KEYS, KEY_GROUPS, SECRET_KEYS } from '../server/lib/env-config.mjs';

const __d = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(resolve(__d, '..', ...p), 'utf8');

test('env-config: OPENROUTER_MODEL is core + non-secret, follows the key', () => {
  assert.ok(KNOWN_KEYS.includes('OPENROUTER_MODEL'));
  assert.equal(
    KNOWN_KEYS.indexOf('OPENROUTER_MODEL'), KNOWN_KEYS.indexOf('OPENROUTER_API_KEY') + 1,
    'OPENROUTER_MODEL must follow OPENROUTER_API_KEY in KNOWN_KEYS');
  assert.equal(KEY_GROUPS.OPENROUTER_MODEL, 'core');
  assert.ok(!SECRET_KEYS.has('OPENROUTER_MODEL'), 'model id is not a credential');
  assert.ok(SECRET_KEYS.has('OPENROUTER_API_KEY'), 'the key itself is secret');
});

test('config.js defines OPENROUTER_MODELS fallback defaulting to openrouter/auto', () => {
  const src = read('public', 'js', 'views', 'config.js');
  assert.match(src, /const OPENROUTER_MODELS = \[/, 'OPENROUTER_MODELS list missing');
  const list = src.match(/const OPENROUTER_MODELS = \[([\s\S]*?)\]/)[1];
  const first = list.split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean)[0];
  assert.equal(first, 'openrouter/auto', `OPENROUTER_MODELS[0] should be openrouter/auto, got ${first}`);
});

test('config.js wires a remote OPENROUTER_MODEL select after OPENROUTER_API_KEY', () => {
  const src = read('public', 'js', 'views', 'config.js');
  const field = src.match(/key: 'OPENROUTER_MODEL'[\s\S]{0,320}?labelKey: 'config\.openrouterModel'/);
  assert.ok(field, 'OPENROUTER_MODEL field block (key → labelKey) not found together');
  for (const tok of ['secret: false', "kind: 'select-remote'",
    "remote: '/api/openrouter/models'", 'options: OPENROUTER_MODELS',
    "defaultValue: 'openrouter/auto'"]) {
    assert.ok(field[0].includes(tok), `OPENROUTER_MODEL field missing token: ${tok}`);
  }
  const iKey = src.indexOf("key: 'OPENROUTER_API_KEY'");
  const iModel = src.indexOf("key: 'OPENROUTER_MODEL'");
  assert.ok(iKey > 0 && iModel > iKey, 'OPENROUTER_MODEL must follow OPENROUTER_API_KEY');
  // openrouter must be a selectable LLM_PROVIDER option
  assert.match(src, /options: \['auto', 'claude', 'gemini', 'openai', 'qwen', 'openrouter', 'github'\]/);
});

test('i18n: all 4 OpenRouter config keys cover the 8 locales', () => {
  const dict = legacyDictText();
  const locales = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr'];
  for (const key of ['config.openrouterKey', 'config.openrouterHint',
    'config.openrouterModel', 'config.openrouterModelHint']) {
    const line = dict.split('\n').find((l) => l.includes(`'${key}'`));
    assert.ok(line, `i18n key ${key} missing`);
    for (const loc of locales) {
      const tok = /-/.test(loc) ? `'${loc}':` : `${loc}:`;
      assert.ok(line.includes(tok), `${key} missing locale ${loc}`);
    }
  }
});
