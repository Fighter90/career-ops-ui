/**
 * WS8.2 (v1.39.0) — LLM_PROVIDER selector + init wizard.
 * providerOrder is the contract the 6 llm.mjs gate-sites consult;
 * buildUpdates/parseArgs back the `career-ops-ui init` wizard.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { providerOrder, LLM_PROVIDERS, KNOWN_KEYS, SECRET_KEYS } from '../server/lib/env-config.mjs';
import { parseArgs, buildUpdates, askSecret } from '../scripts/init.mjs';

test('providerOrder: auto/unset/unknown → full OR order (v1.57.0 + openrouter tail; v1.216.0 roster)', () => {
  const ALL = ['anthropic', 'gemini', 'openai', 'qwen', 'openrouter', 'github', 'hermes',
    'deepseek', 'zai', 'kimi', 'minimax', 'mistral', 'grok', 'together', 'fireworks', 'ollama', 'ark', 'arkcn'];
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
  assert.deepEqual(LLM_PROVIDERS, ['auto', 'claude', 'gemini', 'openai', 'qwen', 'openrouter', 'github', 'hermes',
    'deepseek', 'zai', 'kimi', 'minimax', 'mistral', 'grok', 'together', 'fireworks', 'ollama', 'ark', 'arkcn']);
});

test('env-config exposes the v1.216.0 extended roster keys', () => {
  for (const k of ['DEEPSEEK_API_KEY', 'ZAI_API_KEY', 'MOONSHOT_API_KEY', 'MINIMAX_API_KEY',
    'MISTRAL_API_KEY', 'XAI_API_KEY', 'TOGETHER_API_KEY', 'FIREWORKS_API_KEY', 'OLLAMA_BASE_URL']) {
    assert.ok(KNOWN_KEYS.includes(k), `KNOWN_KEYS missing ${k}`);
  }
  // The extended-roster API keys are secrets; base URLs and model ids are not.
  for (const k of ['DEEPSEEK_API_KEY', 'ZAI_API_KEY', 'MOONSHOT_API_KEY', 'MINIMAX_API_KEY',
    'MISTRAL_API_KEY', 'XAI_API_KEY', 'TOGETHER_API_KEY', 'FIREWORKS_API_KEY']) {
    assert.ok(SECRET_KEYS.has(k), `${k} must be secret`);
  }
  for (const k of ['OLLAMA_BASE_URL', 'ZAI_BASE_URL', 'MOONSHOT_BASE_URL', 'DEEPSEEK_MODEL', 'XAI_MODEL']) {
    assert.ok(!SECRET_KEYS.has(k), `${k} must NOT be secret`);
  }
  // each explicit roster value pins exactly itself
  for (const p of ['deepseek', 'zai', 'kimi', 'minimax', 'mistral', 'grok', 'together', 'fireworks', 'ollama', 'ark', 'arkcn']) {
    assert.deepEqual(providerOrder({ LLM_PROVIDER: p }), [p]);
  }
});

test('config.js LLM_PROVIDER dropdown tracks LLM_PROVIDERS (no drift)', () => {
  // v1.151.1 — the `#/config` <select> options are a hand-maintained array; when
  // GitHub (v1.74.0) then Hermes (v1.151.0) were added they had to be appended
  // by hand, and Hermes was missed (review finding #1: the key field existed but
  // the provider was unforceable). This guard fails if the two ever diverge again.
  const d = dirname(fileURLToPath(import.meta.url));
  // v1.155.0 (P-15 split) — the FIELDS descriptor table (incl. the LLM_PROVIDER
  // dropdown) moved from config.js to config/field-specs.js.
  const cfg = readFileSync(resolve(d, '..', 'public', 'js', 'views', 'config', 'field-specs.js'), 'utf8');
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

test('llm.mjs delegates the cascade to llm-dispatch (FULL-M5): one gate, no local copy', () => {
  const src = require_src();
  // FULL-M5 — the local cascade re-implementation is deleted; provider choice
  // is decided in exactly ONE place (llm-dispatch.mjs::resolveProvider).
  // (v1.241.0 moved /api/deep onto runActiveProvider; v1.241.0-era evaluate +
  // mode kept their own _provGate/_tailProvider copy — that copy is gone now.)
  assert.ok(!/function _provGate\b/.test(src), 'local _provGate must be deleted — one gate lives in llm-dispatch.mjs');
  assert.ok(!/function _tailProvider\b/.test(src), 'local _tailProvider must be deleted');
  assert.ok(!/function _hasKeyFor\b/.test(src), 'local _hasKeyFor must be deleted');
  assert.ok(!/function _anyProviderKey\b/.test(src), 'local _anyProviderKey must be deleted (use providerAvailable)');
  assert.ok(!src.includes("from '../openai.mjs'"), 'llm.mjs must not import provider runners — the dispatch owns the roster');
  assert.ok(!src.includes('providerOrder'), 'llm.mjs must not re-derive provider order');
  // Delegation: the evaluate Gemini subprocess intercepts through the SHARED
  // gate; every live run goes through runActiveProvider (evaluate + deep + mode).
  assert.match(src, /resolveProvider\(\)/, 'the Gemini subprocess must be intercepted via the shared resolveProvider gate');
  assert.equal((src.match(/await runActiveProvider\(/g) || []).length, 3,
    'evaluate + deep + mode must each run through the shared cascade');
});
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
function require_src() {
  const d = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(d, '..', 'server', 'lib', 'routes', 'llm.mjs'), 'utf8');
}
