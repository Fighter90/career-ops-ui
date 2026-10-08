/**
 * Untranslated (en-identical) labels on ru / uk / es (BACKLOG v1.243.0).
 *
 * These keys shipped with byte-identical English values in locales whose
 * neighbours translated them long ago — a user reading ru/uk/es still saw
 * "Runtime", "FAIL", "OPTIONAL", "Proof points", "Modes", "Target Roles",
 * "Exit story", "Dry run"… Each (locale, key) pair here must carry a real
 * translation: for the Cyrillic locales that means Cyrillic in the value;
 * for es it means differing from the en string with Spanish wording.
 *
 * Add a pair here whenever a label is found frozen in English; remove it
 * only when the locale value is genuinely localized.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const DICT = loadAssembledDict();

const CYRILLIC = /[\u0400-\u04FF]/;

/** [locale, key] pairs that must be localized (not en-identical). */
const PAIRS = [
  // ru — labels left in English
  ['ru', 'config.groupRuntime'],
  ['ru', 'auto.legit'],
  ['ru', 'health.badgeFail'],
  ['ru', 'health.badgeOptional'],
  ['ru', 'config.pfProofPoints'],
  ['ru', 'track.histFollowups'],
  ['ru', 'batch.dryRun'],
  // uk — labels left in English
  ['uk', 'top.doctor'],
  ['uk', 'scan.boosted'],
  ['uk', 'scan.boostedBy'],
  ['uk', 'config.tabModes'],
  ['uk', 'config.modesTargetRoles'],
  ['uk', 'config.modesCompTargets'],
  ['uk', 'config.pfExitStory'],
  ['uk', 'track.histFollowups'],
  // es — labels left in English
  ['es', 'batch.dryRun'],
];

test('every listed (locale, key) pair carries a real translation, not the en string', () => {
  const missing = [];
  for (const [lang, key] of PAIRS) {
    assert.ok(I18N_LANGS.includes(lang), `unknown locale ${lang}`);
    assert.ok(DICT[key], `unknown key ${key}`);
    const en = DICT[key].en;
    const v = DICT[key][lang];
    assert.ok(v, `${key} missing for ${lang}`);
    if (v === en) missing.push(`${lang}.${key} = "${v}" (byte-identical to en)`);
    if (lang === 'ru' || lang === 'uk') {
      if (!CYRILLIC.test(v)) missing.push(`${lang}.${key} = "${v}" (no Cyrillic — still English)`);
    }
  }
  assert.deepEqual(missing, [], 'untranslated labels:\n  ' + missing.join('\n  '));
});
