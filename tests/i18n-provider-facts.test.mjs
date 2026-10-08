/**
 * Provider-order FACTS in user-facing strings (BACKLOG v1.243.0).
 *
 * Three strings were written when the auto order was 4 providers and
 * never updated after the tail grew to 18:
 *   - `config.hermesHint` claimed Hermes runs "last in the auto order" —
 *     false: AUTO_ORDER (server/lib/env-config.mjs) has Hermes 7th of 18;
 *   - `onboarding.noKey.title` listed only Anthropic/Gemini/OpenAI/Qwen;
 *   - `deep.tipManual` / `deep.needKey` listed only 7 of the 18 providers.
 *
 * The lists may stay partial (nobody wants 18 names in a hint) but must
 * not be WRONG: every list carries an explicit open-ended marker (…), and
 * no string claims Hermes is last. Locked across all 17 locales so a
 * translation can't quietly reintroduce the stale claim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { I18N_LANGS, loadAssembledDict } from './helpers/i18n-vm.mjs';

const DICT = loadAssembledDict();

test('hermesHint no longer claims Hermes is last in the auto order (any locale)', () => {
  for (const lang of I18N_LANGS) {
    const v = DICT['config.hermesHint'][lang];
    assert.ok(v, `config.hermesHint missing for ${lang}`);
    // The stale claim, in every language it shipped in ("last/última/
    // laatste/последний/最後/마지막/الأخير/अंतिम/sonuncu/…"). The honest
    // replacement says Hermes is *part of* the auto order — never its end.
    assert.doesNotMatch(v, /last in the auto order|últim\w* en el orden auto|últim\w* na ordem auto|sidst i auto|letzter in der auto|dernier dans l'ordre|ultima nell'ordine|ostatni w kolejności auto|последн\w+ в auto|останн\w+ у auto|auto 順の最後|auto 순서에서 마지막|auto 顺序中的最后|auto 順序中的最後|auto क्रम में अंतिम|الأخير في ترتيب auto|auto sırasında sonuncu/i,
      `config.hermesHint[${lang}] still claims Hermes is last in the auto order`);
    // And it keeps saying Hermes participates in the auto order at all —
    // dropping the claim entirely would under-document the integration.
    assert.match(v, /auto/i, `config.hermesHint[${lang}] lost its auto-order mention`);
  }
});

test('provider lists stay partial-but-open: … marker present in all 17 locales', () => {
  for (const lang of I18N_LANGS) {
    for (const key of ['onboarding.noKey.title', 'deep.tipManual', 'deep.needKey']) {
      const v = DICT[key][lang];
      assert.ok(v, `${key} missing for ${lang}`);
      assert.ok(v.includes('…'), `${key}[${lang}] enumerates a closed provider list — add an open-ended marker (…, locale-appropriate)`);
    }
  }
});

test('the four provider strings still name the classic providers (no over-trim)', () => {
  for (const lang of I18N_LANGS) {
    assert.ok(DICT['onboarding.noKey.title'][lang].includes('Anthropic'), `noKey.title[${lang}] lost Anthropic`);
    assert.ok(DICT['deep.tipManual'][lang].includes('Hermes'), `tipManual[${lang}] lost Hermes`);
    assert.ok(DICT['deep.needKey'][lang].includes('GitHub Models'), `needKey[${lang}] lost GitHub Models`);
  }
});
