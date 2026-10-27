/**
 * CAR-136 — the docs-assistant reference questions must retrieve their targets.
 *
 * `docs.q1/q2/q3` in every locale dict are the clickable starter questions on
 * #/docs-assistant. Each must retrieve the section it promises, in EVERY help
 * bundle, or the user lands on — and the model is grounded on — the wrong part
 * of the guide:
 *
 *   docs.q1 → §7  Scan         (top-1 title starts "7.")
 *   docs.q2 → §8  Pipeline     (top-1 title starts "8.")
 *   docs.q3 → §1  Quick start  (top-1 title starts "1.")
 *
 * The question TEXT is whatever the dict carries — this gate asserts the
 * retrieval contract, not the wording, so retargeting a question never needs a
 * test edit. Uses the exact retrieval pipeline the route runs
 * (stripGithubOnlyBlocks → splitSections → topSections) over this repo's own
 * docs/help/*.md, so it is CI-isolated by construction: no server boot, no
 * LLM, no network, no env.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

let splitSections;
let topSections;
let stripGithubOnlyBlocks;
let loadAssembledDict;
let I18N_LANGS;

const HELP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'help');

// The 19 shipped help bundles. The ko dict code maps to the ko-KR help file
// (same FILE_ALIASES cascade resolveHelpFile uses); every other code is 1:1.
const HELP_LOCALES = [
  'en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl',
  'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi',
];
const dictLangOf = (file) => (file === 'ko-KR' ? 'ko' : file);

// [dict key, required top-1 title prefix, human section name]
const QUESTIONS = [
  ['docs.q1', /^7\./, '7 Scan'],
  ['docs.q2', /^8\./, '8 Pipeline'],
  ['docs.q3', /^1\./, '1 Quick start'],
];

let dict;

before(async () => {
  ({ splitSections, topSections } = await import('../server/lib/routes/docs-assistant.mjs'));
  ({ stripGithubOnlyBlocks } = await import('../server/lib/help-markdown.mjs'));
  ({ loadAssembledDict, I18N_LANGS } = await import('./helpers/i18n-vm.mjs'));
  dict = loadAssembledDict();
});

test('sentinel: docs.q1/q2/q3 exist non-empty in all 19 locale dicts', () => {
  assert.equal(I18N_LANGS.length, HELP_LOCALES.length, '19 help files ↔ 19 dict locales');
  for (const file of HELP_LOCALES) {
    const lang = dictLangOf(file);
    for (const [key] of QUESTIONS) {
      const q = dict[key]?.[lang];
      assert.equal(typeof q, 'string', `${key} missing for ${lang} (${file})`);
      assert.ok(q.trim().length > 0, `${key} empty for ${lang} (${file})`);
    }
  }
});

for (const file of HELP_LOCALES) {
  test(`reference questions retrieve their targets (${file})`, () => {
    const lang = dictLangOf(file);
    const md = stripGithubOnlyBlocks(readFileSync(join(HELP_DIR, `${file}.md`), 'utf8'));
    const sections = splitSections(md);
    for (const [key, want, label] of QUESTIONS) {
      const question = dict[key][lang];
      const top = topSections(sections, question, 5);
      const got = top[0] ? top[0].title : '(no section scored)';
      assert.ok(top[0], `${file} ${key} ("${question}"): nothing retrieved`);
      assert.match(
        top[0].title,
        want,
        `${file} ${key} ("${question}") top-1 = "${got}", expected §${label}`
      );
    }
  });
}
