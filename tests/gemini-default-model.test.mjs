/**
 * Gemini default-model drift gate (PR #144 follow-up, v1.125.2).
 *
 * v1.125.x inherited a silent split: `server/lib/gemini.mjs` fell back to one
 * model while the Config screen's hint promised another. PR #144 unified every
 * surface on a single default; this suite pins them together so the next model
 * bump has to move all of them at once:
 *   - server fallback literal in server/lib/gemini.mjs
 *   - Config dropdown (GEMINI_MODELS + defaultValue + hintFallback)
 *   - OpenRouter fallback chain in server/lib/openai.mjs
 *   - `config.geminiModelHint` in all 17 i18n locales
 *   - the in-app help guide in all 17 locales
 *
 * Text-extraction (not import) on purpose: config.js is a classic browser
 * script, and importing server modules here would eagerly resolve paths.mjs
 * (see tests/paths-once.test.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { I18N_LANGS, localeSource } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const geminiSrc = read('server/lib/gemini.mjs');
// v1.155.0 (P-15 split) — GEMINI_MODELS + its dropdown field moved from
// config.js to config/field-specs.js.
const configSrc = read('public/js/views/config/field-specs.js');
const openaiSrc = read('server/lib/openai.mjs');

const serverDefault = (geminiSrc.match(/envKey\('GEMINI_MODEL'\)\s*\|\|\s*'([^']+)'/) || [])[1];

test('server fallback literal exists and is a gemini model id', () => {
  assert.ok(serverDefault, 'gemini.mjs must carry a literal GEMINI_MODEL fallback');
  assert.match(serverDefault, /^gemini-/);
});

test('Config dropdown leads with the server default and offers it as defaultValue', () => {
  const models = (configSrc.match(/const GEMINI_MODELS = \[([\s\S]*?)\]/) || [])[1];
  assert.ok(models, 'config.js must declare GEMINI_MODELS');
  const list = [...models.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.equal(list[0], serverDefault, 'first dropdown entry must be the server default');

  const defaultValue = (configSrc.match(/options: GEMINI_MODELS, defaultValue: '([^']+)'/) || [])[1];
  assert.equal(defaultValue, serverDefault, 'dropdown defaultValue must match the server default');

  const tail = configSrc.slice(configSrc.indexOf('options: GEMINI_MODELS'));
  const hint = (tail.match(/hintFallback: '([^']+)'/) || [])[1] || '';
  assert.ok(hint.includes(serverDefault), 'gemini hintFallback must name the server default');
});

test('OpenRouter fallback chain includes the google-prefixed default', () => {
  const block = (openaiSrc.match(/OPENROUTER_FALLBACK_MODELS = \[([\s\S]*?)\]/) || [])[1];
  assert.ok(block, 'openai.mjs must declare OPENROUTER_FALLBACK_MODELS');
  const list = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(list.includes(`google/${serverDefault}`),
    `OPENROUTER_FALLBACK_MODELS must include google/${serverDefault}`);
});

test('config.geminiModelHint names the server default in all 17 locales', () => {
  for (const lang of I18N_LANGS) {
    const src = localeSource(lang);
    const hit = src.match(/'config\.geminiModelHint':\s*(?:"([^"]*)"|'([^']*)')/);
    assert.ok(hit, `${lang}: config.geminiModelHint missing`);
    const value = hit[1] ?? hit[2];
    assert.ok(value.includes(serverDefault),
      `${lang}: geminiModelHint must mention ${serverDefault}, got: ${value}`);
  }
});

test('help guide names the server default and carries no stale gemini ids (x17)', () => {
  const files = readdirSync(resolve(ROOT, 'docs/help')).filter((f) => f.endsWith('.md'));
  assert.equal(files.length, 17, 'expected 17 help bundles');
  for (const f of files) {
    const text = read(`docs/help/${f}`);
    assert.ok(text.includes(`\`${serverDefault}\``),
      `${f}: help must name the default ${serverDefault}`);
    assert.ok(!/gemini-2\.0-flash|gemini-1\.5-/.test(text),
      `${f}: stale gemini model id left in help`);
  }
});
