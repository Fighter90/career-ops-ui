/**
 * field-specs labelKey/hintKey ↔ dictionary contract (BACKLOG v1.243.0).
 *
 * Every `labelKey:` / `hintKey:` named in
 * public/js/views/config/field-specs.js must exist in the assembled
 * dictionary (and — via the global parity gates — in all 17 locales).
 * 26 provider-field keys (config.deepseekKey, config.arkcnModel, …) were
 * referenced but present in NO locale, so every non-en config screen fell
 * back to raw keys for those labels. This guard closes the class: the
 * next field-spec entry without a dict key fails here, not in QA.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SPEC_SOURCE = readFileSync(resolve(ROOT, 'public', 'js', 'views', 'config', 'field-specs.js'), 'utf8');
const DICT = loadAssembledDict();

/** Every labelKey/hintKey literal named by the spec (static keys only). */
function specKeys() {
  const keys = new Set();
  for (const m of SPEC_SOURCE.matchAll(/(?:labelKey|hintKey):\s*'([a-zA-Z0-9_.\-]+)'/g)) {
    keys.add(m[1]);
  }
  return [...keys].sort();
}

test('every field-specs labelKey/hintKey exists in the dictionary', () => {
  const keys = specKeys();
  assert.ok(keys.length > 50, `expected to scan the full spec, found only ${keys.length} keys`);
  const missing = keys.filter((k) => !DICT[k]);
  assert.deepEqual(missing, [], 'field-specs keys missing from the dictionary:\n  ' + missing.join('\n  '));
});

test('every field-specs key resolves in all 17 locales', () => {
  const missing = [];
  for (const key of specKeys()) {
    if (!DICT[key] || DICT[key]['@alias']) continue;
    for (const lang of I18N_LANGS) {
      const v = DICT[key][lang];
      if (typeof v !== 'string' || !v.trim()) missing.push(`${lang}.${key}`);
    }
  }
  assert.deepEqual(missing, [], 'empty translations:\n  ' + missing.join('\n  '));
});
