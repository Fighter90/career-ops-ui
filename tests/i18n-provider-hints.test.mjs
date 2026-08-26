/**
 * i18n-provider-hints.test.mjs (v1.222.0)
 *
 * Contract: every `hintKey` referenced by the #/config field descriptors
 * (public/js/views/config/field-specs.js) is a real, localized dictionary
 * entry — present, non-empty, across all 17 locales. This guards the
 * field ↔ dict fidelity the parity gate can't see: parity proves all locales
 * share the SAME key set, but not that the keys the UI actually *asks for*
 * exist. It also locks the v1.216.0–v1.217.0 extended-provider roster
 * (DeepSeek … Volcengine Ark), whose hints were localized in v1.222.0.
 *
 * CI-isolated: reads only repo files through the vm helper — no network,
 * no parent-project dependency.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIELD_SPECS = resolve(HERE, '..', 'public', 'js', 'views', 'config', 'field-specs.js');

// Extract every `hintKey: 'config.<something>'` from the field descriptors.
function extractHintKeys() {
  const src = readFileSync(FIELD_SPECS, 'utf8');
  const keys = [];
  const re = /hintKey:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) keys.push(m[1]);
  return keys;
}

// The 11 OpenAI-compatible providers whose signup-key hints (…Hint, not
// …ModelHint / …BaseUrlHint) run the live eval — each must keep the ⚡ marker.
const EVAL_SIGNUP_HINTS = [
  'config.deepseekHint', 'config.zaiHint', 'config.kimiHint', 'config.minimaxHint',
  'config.mistralHint', 'config.grokHint', 'config.togetherHint', 'config.fireworksHint',
  'config.ollamaHint', 'config.arkHint', 'config.arkcnHint',
];

const DICT = loadAssembledDict();

test('field-specs.js references at least the full provider roster of hint keys', () => {
  const keys = extractHintKeys();
  // 7 original providers + runtime + 11 extended providers ≈ 40+ hint keys.
  assert.ok(keys.length >= 40, `expected ≥40 hintKeys, found ${keys.length}`);
  // no duplicates in the descriptor table
  assert.equal(new Set(keys).size, keys.length, 'duplicate hintKey in field-specs.js');
});

test('every field-specs hintKey is localized in all 17 locales, non-empty', () => {
  const keys = extractHintKeys();
  for (const key of keys) {
    const entry = DICT[key];
    assert.ok(entry, `hintKey ${key} referenced by field-specs.js is missing from the dictionary`);
    for (const lang of I18N_LANGS) {
      const v = entry[lang];
      assert.equal(typeof v, 'string', `${key}[${lang}] must be a string`);
      assert.ok(v.trim().length > 0, `${key}[${lang}] must be non-empty`);
      assert.ok(!/^\s|\s$/.test(v), `${key}[${lang}] has leading/trailing whitespace`);
    }
  }
});

test('extended-provider signup hints keep the ⚡ live-eval marker in every locale', () => {
  for (const key of EVAL_SIGNUP_HINTS) {
    const entry = DICT[key];
    assert.ok(entry, `${key} missing`);
    for (const lang of I18N_LANGS) {
      assert.ok(entry[lang].includes('⚡'), `${key}[${lang}] dropped the ⚡ live-eval marker`);
    }
  }
});

test('English extended-provider hints preserve their signup-URL / model tokens', () => {
  const tokens = {
    'config.deepseekHint': 'platform.deepseek.com',
    'config.zaiHint': 'z.ai',
    'config.kimiHint': 'platform.moonshot.ai',
    'config.minimaxHint': 'platform.minimax.io',
    'config.mistralHint': 'console.mistral.ai',
    'config.grokHint': 'console.x.ai',
    'config.togetherHint': 'together.ai',
    'config.fireworksHint': 'fireworks.ai',
    'config.ollamaHint': 'localhost:11434',
    'config.arkHint': 'console.byteplus.com',
    'config.arkcnHint': 'console.volcengine.com',
    'config.arkBaseUrlHint': 'ark.ap-southeast.bytepluses.com',
    'config.arkcnBaseUrlHint': 'ark.cn-beijing.volces.com',
  };
  for (const [key, token] of Object.entries(tokens)) {
    assert.ok(DICT[key], `${key} missing`);
    // token must survive translation in EVERY locale (it's language-neutral)
    for (const lang of I18N_LANGS) {
      assert.ok(DICT[key][lang].includes(token), `${key}[${lang}] lost the "${token}" token`);
    }
  }
});
