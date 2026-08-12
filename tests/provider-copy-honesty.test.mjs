/**
 * FIX-2 (v1.160.0) — provider copy must not contradict the 7-provider promise.
 *
 * `#/config` used to say the web-ui live eval "uses your Anthropic or Gemini
 * API key" and that "the OpenAI key … [is] not used by the web UI itself",
 * and `#/dashboard`'s Evaluate card said "Anthropic-first scoring" — all false
 * since the OpenRouter/7-provider cascade shipped (v1.157.0). These canaries
 * lock the honest copy across all 17 locales.
 *
 * CI-isolated: reads the assembled dict via the vm helper; no server/network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAssembledDict, I18N_LANGS } from './helpers/i18n-vm.mjs';

const D = loadAssembledDict();
const PROVIDERS = ['Anthropic', 'Gemini', 'OpenAI', 'Qwen', 'OpenRouter', 'GitHub Models', 'Hermes'];

test('FIX-2: config.providerModelNote lists ≥5 provider names in every locale', () => {
  const note = D['config.providerModelNote'];
  assert.ok(note, 'key exists');
  for (const lang of I18N_LANGS) {
    const v = note[lang];
    assert.ok(v, `note present for ${lang}`);
    const hits = PROVIDERS.filter((p) => v.includes(p)).length;
    assert.ok(hits >= 5, `${lang}: expected ≥5 provider names, got ${hits}`);
  }
});

test('FIX-2: EN config.providerModelNote drops the stale Anthropic/Gemini-only claims', () => {
  const en = D['config.providerModelNote'].en;
  assert.doesNotMatch(en, /not used by the web UI/i, 'the false "OpenAI not used" sentence is gone');
  assert.doesNotMatch(en, /uses your Anthropic or Gemini API key/i, 'no Anthropic/Gemini-exclusive claim');
});

test('FIX-2: dash.quick.evaluateSub carries no vendor name in any locale', () => {
  const sub = D['dash.quick.evaluateSub'];
  assert.ok(sub, 'key exists');
  for (const lang of I18N_LANGS) {
    const v = sub[lang] || '';
    assert.doesNotMatch(
      v,
      /anthropic|openai|gemini|qwen|openrouter|hermes/i,
      `${lang}: Evaluate subtitle must be vendor-neutral, got "${v}"`,
    );
  }
});
