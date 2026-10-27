/**
 * Shared "run against the active LLM provider" helper (v1.90.0).
 *
 * The provider cascade (Anthropic → Gemini → OpenAI → Qwen → OpenRouter →
 * GitHub Models → manual) was previously inlined per-endpoint in
 * `routes/llm.mjs`. New live-LLM features (mock interview, …) need the exact
 * same cascade, so it lives here as one well-bounded unit. FULL-M5 —
 * `routes/llm.mjs` now delegates to it too: `resolveProvider()` is the ONE
 * gate (provider choice is decided exactly once) and every live run goes
 * through `runActiveProvider`, which forwards a route-level abort `signal`
 * (CAR-92) and an Anthropic `cachePrefix` (CAR-111) to the chosen runner.
 *
 * Honesty contract: the same soft size-cap and manual fallback the rest of
 * the app uses. No provider key ⇒ `{ mode: 'manual' }` and the caller returns
 * the copy-paste prompt — never a fabricated answer.
 */
import { runAnthropic, hasAnthropicKey, hasGeminiKey } from './anthropic.mjs';
import { runGemini } from './gemini.mjs';
import {
  runOpenAI, runQwen, runOpenRouter, runGitHubModels, runHermes,
  hasOpenAIKey, hasQwenKey, hasOpenRouterKey, hasGitHubModelsKey, hasHermesKey,
  runDeepSeek, runZai, runKimi, runMiniMax, runMistral, runGrok, runTogether, runFireworks, runOllama,
  hasDeepSeekKey, hasZaiKey, hasKimiKey, hasMiniMaxKey, hasMistralKey, hasGrokKey, hasTogetherKey, hasFireworksKey, hasOllamaKey,
  runArk, runArkCn, hasArkKey, hasArkCnKey,
} from './openai.mjs';
import { providerOrder, AUTO_ORDER } from './env-config.mjs';
import { recordUsage } from './llm-usage.mjs';

// Mirror llm.mjs BF-3 soft cap: 256 KB ≈ ~64K tokens.
export const PROMPT_SIZE_SOFT_CAP = 256 * 1024;

// v1.157.0 — a forced provider whose key isn't set falls back to the auto order
// among the configured keys (mirrors env-config.mjs::selectActiveProvider), so
// a stale `LLM_PROVIDER=claude` never dead-ends a user whose only key is e.g.
// OpenRouter. A forced provider that DOES have a key stays forced.
// slug → key-presence probe. One table, reused by _hasKeyFor / tailProvider /
// providerAvailable so a new provider is added in exactly one place here.
const HAS_KEY = {
  anthropic: hasAnthropicKey, gemini: hasGeminiKey,
  openai: hasOpenAIKey, qwen: hasQwenKey, openrouter: hasOpenRouterKey,
  github: hasGitHubModelsKey, hermes: hasHermesKey,
  deepseek: hasDeepSeekKey, zai: hasZaiKey, kimi: hasKimiKey, minimax: hasMiniMaxKey,
  mistral: hasMistralKey, grok: hasGrokKey, together: hasTogetherKey,
  fireworks: hasFireworksKey, ollama: hasOllamaKey,
  ark: hasArkKey, arkcn: hasArkCnKey,
};
// The auto tail (everything after Anthropic/Gemini get their own dedicated
// branches in runActiveProvider). Order mirrors AUTO_ORDER.
const TAIL_RUN = {
  openai: runOpenAI, qwen: runQwen, openrouter: runOpenRouter, github: runGitHubModels, hermes: runHermes,
  deepseek: runDeepSeek, zai: runZai, kimi: runKimi, minimax: runMiniMax,
  mistral: runMistral, grok: runGrok, together: runTogether, fireworks: runFireworks, ollama: runOllama,
  ark: runArk, arkcn: runArkCn,
};
function _hasKeyFor(p) {
  return typeof HAS_KEY[p] === 'function' && HAS_KEY[p]();
}
function gate() {
  let o = providerOrder();
  if (o.length === 1 && !_hasKeyFor(o[0])) {
    o = AUTO_ORDER;
  }
  const g = { wantAnthropic: o.includes('anthropic'), wantGemini: o.includes('gemini') };
  for (const slug of Object.keys(TAIL_RUN)) g[slug] = o.includes(slug);
  return g;
}

/** First keyed provider in the auto tail (OpenAI → Qwen → … → Ollama), or null. */
function tailProvider(g) {
  for (const slug of Object.keys(TAIL_RUN)) {
    if (g[slug] && _hasKeyFor(slug)) return { mode: slug, run: TAIL_RUN[slug] };
  }
  return null;
}

/** True when at least one provider key is configured (any provider). */
export function providerAvailable() {
  return Object.values(HAS_KEY).some((fn) => fn());
}

/**
 * FULL-M5 — the cascade's pick WITHOUT running it: `{ mode, run }` or `null`
 * when no provider is available. The ONE place provider choice is decided;
 * `runActiveProvider` resolves through it and `routes/llm.mjs` consults it to
 * intercept the Gemini evaluation subprocess (a CAR-92 gemini-eval.mjs run,
 * not a `runGemini` call) before the cascade would pick Gemini.
 */
export function resolveProvider() {
  const g = gate();
  if (g.wantAnthropic && hasAnthropicKey()) return { mode: 'anthropic', run: runAnthropic };
  if (g.wantGemini && hasGeminiKey()) return { mode: 'gemini', run: runGemini };
  return tailProvider(g);
}

/**
 * Run `fullPrompt` through the active provider cascade.
 *
 * @param {{ sizeCap?: number, maxTokens?: number, timeoutMs?: number, signal?: AbortSignal, cachePrefix?: string }} [opts]
 *   `maxTokens` / `timeoutMs` / `signal` are forwarded to the provider runner.
 *   `cachePrefix` (CAR-111) is forwarded ONLY to Anthropic — prompt caching is
 *   an Anthropic Messages-path feature; the OpenAI-compatible tail providers
 *   cache server-side automatically and are deliberately unchanged.
 * @returns one of:
 *   { mode, markdown, usage, truncated }   — success (`truncated`: the answer
 *                                            was cut off at the token limit)
 *   { mode, error }                        — the chosen provider errored
 *   { mode: 'manual' }                     — no provider available (caller
 *                                            returns the copy-paste prompt)
 *   { mode: 'too-large', size, cap }       — prompt exceeds the soft cap
 */
export async function runActiveProvider(fullPrompt, { sizeCap = PROMPT_SIZE_SOFT_CAP, maxTokens, timeoutMs, signal, cachePrefix } = {}) {
  if (typeof fullPrompt !== 'string' || !fullPrompt) return { mode: 'manual' };
  if (fullPrompt.length > sizeCap) return { mode: 'too-large', size: fullPrompt.length, cap: sizeCap };

  const chosen = resolveProvider();
  if (!chosen) return { mode: 'manual' };
  const runOpts = {};
  if (maxTokens) runOpts.maxTokens = maxTokens;
  if (timeoutMs) runOpts.timeoutMs = timeoutMs;
  // CAR-92 — a route-level abort (the SSE client hung up) must reach the
  // provider request, not die at the dispatch boundary.
  if (signal) runOpts.signal = signal;
  // CAR-111 — see the opts doc: the cache breakpoint is Anthropic-only.
  if (cachePrefix && chosen.mode === 'anthropic') runOpts.cachePrefix = cachePrefix;
  const r = await chosen.run(fullPrompt, runOpts);
  if (r.error) return { mode: chosen.mode, error: r.error };
  recordUsage(chosen.mode, r.usage);
  return { mode: chosen.mode, markdown: r.markdown, usage: r.usage, truncated: !!r.truncated };
}
