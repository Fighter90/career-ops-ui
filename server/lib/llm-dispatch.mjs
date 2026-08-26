/**
 * Shared "run against the active LLM provider" helper (v1.90.0).
 *
 * The provider cascade (Anthropic → Gemini → OpenAI → Qwen → OpenRouter →
 * GitHub Models → manual) was previously inlined per-endpoint in
 * `routes/llm.mjs`. New live-LLM features (mock interview, …) need the exact
 * same cascade, so it lives here as one well-bounded unit. `routes/llm.mjs`
 * keeps its own copy for now (adopting this is a separate refactor); this
 * module is the single source of truth for any NEW live-LLM route.
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
} from './openai.mjs';
import { providerOrder, AUTO_ORDER } from './env-config.mjs';
import { recordUsage } from './llm-usage.mjs';

// Mirror llm.mjs BF-3 soft cap: 200 KB ≈ ~50K tokens.
export const PROMPT_SIZE_SOFT_CAP = 200 * 1024;

// v1.157.0 — a forced provider whose key isn't set falls back to the auto order
// among the configured keys (mirrors env-config.mjs::selectActiveProvider +
// routes/llm.mjs::_provGate), so a stale `LLM_PROVIDER=claude` never dead-ends a
// user whose only key is e.g. OpenRouter. A forced provider that DOES have a key
// stays forced.
// slug → key-presence probe. One table, reused by _hasKeyFor / tailProvider /
// providerAvailable so a new provider is added in exactly one place here.
const HAS_KEY = {
  anthropic: hasAnthropicKey, gemini: hasGeminiKey,
  openai: hasOpenAIKey, qwen: hasQwenKey, openrouter: hasOpenRouterKey,
  github: hasGitHubModelsKey, hermes: hasHermesKey,
  deepseek: hasDeepSeekKey, zai: hasZaiKey, kimi: hasKimiKey, minimax: hasMiniMaxKey,
  mistral: hasMistralKey, grok: hasGrokKey, together: hasTogetherKey,
  fireworks: hasFireworksKey, ollama: hasOllamaKey,
};
// The auto tail (everything after Anthropic/Gemini get their own dedicated
// branches in runActiveProvider). Order mirrors AUTO_ORDER.
const TAIL_RUN = {
  openai: runOpenAI, qwen: runQwen, openrouter: runOpenRouter, github: runGitHubModels, hermes: runHermes,
  deepseek: runDeepSeek, zai: runZai, kimi: runKimi, minimax: runMiniMax,
  mistral: runMistral, grok: runGrok, together: runTogether, fireworks: runFireworks, ollama: runOllama,
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
 * Run `fullPrompt` through the active provider cascade.
 *
 * @returns one of:
 *   { mode, markdown, usage }              — success
 *   { mode, error }                        — the chosen provider errored
 *   { mode: 'manual' }                     — no provider available (caller
 *                                            returns the copy-paste prompt)
 *   { mode: 'too-large', size, cap }       — prompt exceeds the soft cap
 */
export async function runActiveProvider(fullPrompt, { sizeCap = PROMPT_SIZE_SOFT_CAP } = {}) {
  if (typeof fullPrompt !== 'string' || !fullPrompt) return { mode: 'manual' };
  if (fullPrompt.length > sizeCap) return { mode: 'too-large', size: fullPrompt.length, cap: sizeCap };

  const g = gate();
  if (g.wantAnthropic && hasAnthropicKey()) {
    const r = await runAnthropic(fullPrompt);
    if (!r.error) recordUsage('anthropic', r.usage);
    return r.error ? { mode: 'anthropic', error: r.error } : { mode: 'anthropic', markdown: r.markdown, usage: r.usage };
  }
  if (g.wantGemini && hasGeminiKey()) {
    const r = await runGemini(fullPrompt);
    if (!r.error) recordUsage('gemini', r.usage);
    return r.error ? { mode: 'gemini', error: r.error } : { mode: 'gemini', markdown: r.markdown, usage: r.usage };
  }
  const tp = tailProvider(g);
  if (tp) {
    const r = await tp.run(fullPrompt);
    if (!r.error) recordUsage(tp.mode, r.usage);
    return r.error ? { mode: tp.mode, error: r.error } : { mode: tp.mode, markdown: r.markdown, usage: r.usage };
  }
  return { mode: 'manual' };
}
