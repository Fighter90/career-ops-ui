/**
 * v1.58.37 (NEW-D1) — Catch Latin-only page-title leaks on non-Latin
 * locales.
 *
 * The spirit of the v1.58.18 (I-3) closure was: page H1s must read in
 * the user's language, not English. The same principle applies to any
 * `*.title` key — if the value on a non-Latin locale is pure Latin
 * letters (with no whitelisted proper noun, acronym, or product name),
 * it's a leak.
 *
 * v1.60.0 (I18N-SPLIT) — the dictionary is now assembled from per-locale
 * files. We load the REAL assembled DICT (via tests/helpers/i18n-vm.mjs)
 * instead of regex-parsing a monolithic file, so the guard sees exactly
 * what the browser sees.
 *
 * Whitelisted tokens stay Latin in every locale by design (proper nouns,
 * acronyms, product names). Anything else in `*.title` keys on the 5
 * non-Latin locales is a failure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAssembledDict } from './helpers/i18n-vm.mjs';

const DICT = loadAssembledDict();

// Tokens that legitimately read as Latin in every locale.
const WHITELIST = new Set([
  'CV', 'API', 'URL', 'JD', 'PDF', 'TSV', 'CSV',
  'LinkedIn', 'OpenAI', 'OpenRouter', 'Anthropic', 'Gemini', 'Qwen', 'GitHub',
  'Pipeline', // — exception: en-locale row, others are tested below
]);

// A "pure Latin" value contains only ASCII letters, digits, spaces,
// and a small set of punctuation. CJK / Cyrillic / Hangul / Hiragana /
// Katakana / Hangeul / non-Latin scripts all fail this test.
const PURE_LATIN = /^[A-Za-z][A-Za-z0-9\s\-/·:.,()&]*$/;

// Locales whose UX expects native (non-Latin) script.
const NON_LATIN_LOCALES = ['ru', 'ko', 'ja', 'zh-CN', 'zh-TW', 'uk', 'ar'];

// Adapt the assembled key-major DICT into Map<key, Map<locale, value>>.
// Alias keys (`{ '@alias': … }`) carry no per-locale strings of their own
// and are skipped — their canonical target is checked under its own key.
function parseDict() {
  const map = new Map();
  for (const [key, row] of Object.entries(DICT)) {
    if (row['@alias']) continue;
    map.set(key, new Map(Object.entries(row)));
  }
  return map;
}

test('NEW-D1: no Latin-only *.title leaks on ru / ja / ko / zh-CN / zh-TW / uk / ar', () => {
  const dict = parseDict();
  const failures = [];
  for (const [key, locales] of dict.entries()) {
    if (!/\.title$/.test(key)) continue;
    for (const loc of NON_LATIN_LOCALES) {
      const v = locales.get(loc);
      if (!v) continue;
      if (PURE_LATIN.test(v) && !WHITELIST.has(v)) {
        failures.push(`${loc}.${key} = "${v}"`);
      }
    }
  }
  assert.deepEqual(
    failures,
    [],
    'Latin-only *.title leaks found in non-Latin locales:\n  ' + failures.join('\n  '),
  );
});

test('NEW-D1: pipe.title is fully localized on the 3 previously-leaking locales (es / pt-BR / ru)', () => {
  const dict = parseDict();
  const row = dict.get('pipe.title');
  assert.ok(row, 'pipe.title row must exist');
  // RU must be fully Cyrillic — no Latin letters at all.
  assert.match(row.get('ru'), /^[А-Яа-яЁё\s]+$/,
    `pipe.title[ru] must be Cyrillic, got "${row.get('ru')}"`);
  // ES must not be just "Pipeline" — has to add a noun.
  // UX-A11 (v1.58.64) refined the es copy from "Pipeline de vacantes"
  // to "Pipeline de candidaturas" (candidate-side perspective is the
  // user's mental model). Both are acceptable; the guard accepts either
  // contextualizing noun ("vacantes/vacant" employer-side, or
  // "candidaturas" candidate-side).
  assert.notEqual(row.get('es'), 'Pipeline',
    'pipe.title[es] must contextualize (e.g. "Pipeline de candidaturas")');
  assert.match(row.get('es'), /vacant|vaca|candidatur/i,
    'pipe.title[es] must mention "vacantes" OR "candidaturas"');
  // pt-BR must add Portuguese "vagas".
  assert.notEqual(row.get('pt-BR'), 'Pipeline',
    'pipe.title[pt-BR] must contextualize (e.g. "Pipeline de vagas")');
  assert.match(row.get('pt-BR'), /vaga/i,
    'pipe.title[pt-BR] must mention "vagas"');
});
