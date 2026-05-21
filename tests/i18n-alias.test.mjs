/**
 * I18N-CL3 (v1.59.13) — alias mechanism. A duplicate-CONCEPT key whose
 * value is `{ '@alias': 'canonical.key' }` resolves to the canonical
 * key's translation via i18n.t(). This test locks:
 *   1. integrity — every @alias target exists and is not itself an alias
 *   2. behaviour — t(aliasKey) === t(canonicalKey) in every locale
 *   3. the specific true-duplicate set collapsed in v1.59.13
 *
 * Loads the split per-locale tables + assembler + i18n.js in a vm sandbox
 * (via tests/helpers/i18n-vm.mjs, same path the browser uses) so we
 * exercise the REAL t() resolver.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { I18N_LANGS as LANGS, loadI18n } from './helpers/i18n-vm.mjs';

const I18n = loadI18n();
const DICT = I18n._DICT;

const EXPECTED_ALIASES = {
  'nav.help': 'help.title',
  'dash.quick.helpCta': 'help.title',
  'nav.cv': 'cv.title',
  'nav.health': 'health.title',
  'dash.quick.healthCta': 'health.title',
  'nav.reports': 'rep.title',
  'dash.reports': 'rep.title',
  'dash.quick.reportsCta': 'rep.title',
  'nav.apply': 'apply.title',
  'nav.interviewPrep': 'interviewPrep.title',
};

test('alias integrity: every @alias target exists and is not itself an alias', () => {
  for (const [key, row] of Object.entries(DICT)) {
    const target = row['@alias'];
    if (!target) continue;
    assert.ok(DICT[target], `${key} aliases missing target "${target}"`);
    assert.ok(!DICT[target]['@alias'],
      `${key} → "${target}" which is itself an alias — chains are forbidden (keeps t() O(1))`);
  }
});

test('alias behaviour: t(aliasKey) === t(canonicalKey) in every locale', () => {
  for (const [aliasKey, canon] of Object.entries(EXPECTED_ALIASES)) {
    assert.equal(DICT[aliasKey]?.['@alias'], canon,
      `${aliasKey} must be an @alias to ${canon}`);
    for (const code of LANGS) {
      I18n.setLang(code);
      assert.equal(I18n.t(aliasKey), I18n.t(canon),
        `t('${aliasKey}') must equal t('${canon}') in ${code}`);
      // And it must be a real translated string, never the raw key.
      assert.notEqual(I18n.t(aliasKey), aliasKey,
        `t('${aliasKey}') resolved to the raw key in ${code} — alias broken`);
    }
  }
  I18n.setLang('en');
});

test('alias coverage: a NON-aliased duplicate (nav.config) stays distinct from config.title', () => {
  // Guard against an over-eager future dedup. nav.config and config.title
  // are both "App settings" in EN but DIVERGE in Spanish — they must NOT
  // be aliased together.
  assert.ok(!DICT['nav.config']?.['@alias'],
    'nav.config must NOT be an alias — it diverges from config.title in es');
  I18n.setLang('es');
  assert.notEqual(I18n.t('nav.config'), I18n.t('config.title'),
    'nav.config (es) must differ from config.title (es) — short sidebar vs full page title');
  I18n.setLang('en');
});
