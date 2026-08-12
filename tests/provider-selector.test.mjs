/**
 * WS8.2 (v1.39.0) — LLM_PROVIDER selector + init wizard.
 * providerOrder is the contract the 6 llm.mjs gate-sites consult;
 * buildUpdates/parseArgs back the `career-ops-ui init` wizard.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { providerOrder, LLM_PROVIDERS, KNOWN_KEYS, SECRET_KEYS } from '../server/lib/env-config.mjs';
import { parseArgs, buildUpdates, askSecret } from '../scripts/init.mjs';

test('providerOrder: auto/unset/unknown → full OR order (v1.57.0 + openrouter tail)', () => {
  const ALL = ['anthropic', 'gemini', 'openai', 'qwen', 'openrouter', 'github', 'hermes'];
  assert.deepEqual(providerOrder({}), ALL);
  assert.deepEqual(providerOrder({ LLM_PROVIDER: 'auto' }), ALL);
  assert.deepEqual(providerOrder({ LLM_PROVIDER: 'banana' }), ALL);
  assert.deepEqual(providerOrder({ LLM_PROVIDER: ' AUTO ' }), ALL);
});

test('providerOrder: each explicit value pins exactly that provider', () => {
  assert.deepEqual(providerOrder({ LLM_PROVIDER: 'claude' }), ['anthropic']);
  assert.deepEqual(providerOrder({ LLM_PROVIDER: 'Gemini' }), ['gemini']);
  assert.deepEqual(providerOrder({ LLM_PROVIDER: 'openai' }), ['openai']);
  assert.deepEqual(providerOrder({ LLM_PROVIDER: ' QWEN ' }), ['qwen']);
  assert.deepEqual(providerOrder({ LLM_PROVIDER: 'openrouter' }), ['openrouter']);
});

test('env-config exposes the full v1.57.0 provider surface', () => {
  for (const k of ['LLM_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_MODEL',
    'QWEN_API_KEY', 'QWEN_MODEL', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL',
    'GITHUB_MODELS_API_KEY', 'GITHUB_MODELS_MODEL']) {
    assert.ok(KNOWN_KEYS.includes(k), `KNOWN_KEYS missing ${k}`);
  }
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY',
    'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_API_KEY']) {
    assert.ok(SECRET_KEYS.has(k), `${k} must be secret`);
  }
  // model ids are NOT credentials → never masked
  for (const k of ['OPENAI_MODEL', 'QWEN_MODEL', 'OPENROUTER_MODEL', 'GITHUB_MODELS_MODEL', 'LLM_PROVIDER']) {
    assert.ok(!SECRET_KEYS.has(k), `${k} must NOT be secret`);
  }
  assert.deepEqual(LLM_PROVIDERS, ['auto', 'claude', 'gemini', 'openai', 'qwen', 'openrouter', 'github', 'hermes']);
});

test('config.js LLM_PROVIDER dropdown tracks LLM_PROVIDERS (no drift)', () => {
  // v1.151.1 — the `#/config` <select> options are a hand-maintained array; when
  // GitHub (v1.74.0) then Hermes (v1.151.0) were added they had to be appended
  // by hand, and Hermes was missed (review finding #1: the key field existed but
  // the provider was unforceable). This guard fails if the two ever diverge again.
  const d = dirname(fileURLToPath(import.meta.url));
  const cfg = readFileSync(resolve(d, '..', 'public', 'js', 'views', 'config.js'), 'utf8');
  const m = cfg.match(/key: 'LLM_PROVIDER'[\s\S]*?options: \[([^\]]+)\]/);
  assert.ok(m, 'could not locate the LLM_PROVIDER options array in config.js');
  const opts = m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  assert.deepEqual(opts, LLM_PROVIDERS,
    `dropdown options ${JSON.stringify(opts)} must match LLM_PROVIDERS ${JSON.stringify(LLM_PROVIDERS)}`);
});

test('init parseArgs: flag-driven', () => {
  const o = parseArgs(['--provider', 'CLAUDE', '--anthropic-key', 'sk-x', '--yes']);
  assert.equal(o.provider, 'claude');
  assert.equal(o.anthropic, 'sk-x');
  assert.equal(o.yes, true);
});

test('init askSecret: off a TTY, delegates to plain ask (no raw mode)', async () => {
  // stdin is injected (DI) — no mutation of the shared global, so this
  // is safe under concurrent `node --test`.
  let asked = '';
  const fakeRl = { question: (q, cb) => { asked = q; cb('  piped-key  '); } };
  const fakeStdin = { isTTY: false };
  const v = await askSecret(fakeRl, 'OPENAI_API_KEY: ', fakeStdin);
  assert.equal(asked, 'OPENAI_API_KEY: ');
  assert.equal(v, 'piped-key'); // trimmed, same contract as ask()
});

test('init buildUpdates: provider clamped, only non-empty keys written', () => {
  assert.deepEqual(
    buildUpdates({ provider: 'gemini', gemini: ' g-key ', anthropic: '', openai: '' }),
    { LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'g-key' });
  assert.deepEqual(
    buildUpdates({ provider: 'nonsense', anthropic: 'a', openai: 'o' }),
    { LLM_PROVIDER: 'auto', ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o' });
});

test('init buildUpdates: no keys → only LLM_PROVIDER (auto)', () => {
  assert.deepEqual(buildUpdates({ provider: '' }), { LLM_PROVIDER: 'auto' });
});

test('llm.mjs keeps the 6 Anthropic/Gemini gates + the v1.55.0 OpenAI/Qwen tail', () => {
  const src = require_src();
  const ag = (src.match(/_provGate\(\)\.want(Anthropic|Gemini) && has(Anthropic|Gemini)Key\(\)/g) || []);
  assert.equal(ag.length, 6, `expected 6 Anthropic/Gemini gated sites, got ${ag.length}`);
  // v1.55.0 — the OR tail: _tailProvider() consulted at the 3 eval
  // sites (evaluate / deep / mode) after Anthropic+Gemini.
  assert.match(src, /function _tailProvider\(\)/, '_tailProvider helper missing');
  assert.match(src, /wantOpenAI: o\.includes\('openai'\), wantQwen: o\.includes\('qwen'\)/,
    '_provGate must expose wantOpenAI/wantQwen');
  assert.equal((src.match(/_tailProvider\(\)/g) || []).length >= 4, true,
    'tail provider must be wired at all 3 eval sites (+ its definition)');
  assert.match(src, /import \{ runOpenAI, runQwen, runOpenRouter, runGitHubModels, runHermes, hasOpenAIKey, hasQwenKey, hasOpenRouterKey, hasGitHubModelsKey, hasHermesKey \} from '\.\.\/openai\.mjs'/);
  // v1.57.0 — OpenRouter in the auto tail; v1.151.0 — Hermes is now the last entry.
  assert.match(src, /g\.wantOpenRouter && hasOpenRouterKey\(\)/,
    '_tailProvider must consult OpenRouter');
  assert.match(src, /g\.wantHermes && hasHermesKey\(\)/,
    '_tailProvider must consult Hermes last');
});
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
function require_src() {
  const d = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(d, '..', 'server', 'lib', 'routes', 'llm.mjs'), 'utf8');
}
