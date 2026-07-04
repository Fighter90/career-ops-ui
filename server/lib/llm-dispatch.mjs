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
  runOpenAI, runQwen, runOpenRouter, runGitHubModels,
  hasOpenAIKey, hasQwenKey, hasOpenRouterKey, hasGitHubModelsKey,
} from './openai.mjs';
import { providerOrder } from './env-config.mjs';

// Mirror llm.mjs BF-3 soft cap: 200 KB ≈ ~50K tokens.
export const PROMPT_SIZE_SOFT_CAP = 200 * 1024;

function gate() {
  const o = providerOrder();
  return {
    wantAnthropic: o.includes('anthropic'), wantGemini: o.includes('gemini'),
    wantOpenAI: o.includes('openai'), wantQwen: o.includes('qwen'),
    wantOpenRouter: o.includes('openrouter'), wantGitHub: o.includes('github'),
  };
}

/** First keyed provider in the auto tail (OpenAI → Qwen → OpenRouter → GitHub), or null. */
function tailProvider(g) {
  if (g.wantOpenAI && hasOpenAIKey()) return { mode: 'openai', run: runOpenAI };
  if (g.wantQwen && hasQwenKey()) return { mode: 'qwen', run: runQwen };
  if (g.wantOpenRouter && hasOpenRouterKey()) return { mode: 'openrouter', run: runOpenRouter };
  if (g.wantGitHub && hasGitHubModelsKey()) return { mode: 'github', run: runGitHubModels };
  return null;
}

/** True when at least one provider key is configured (any provider). */
export function providerAvailable() {
  return hasAnthropicKey() || hasGeminiKey() || hasOpenAIKey()
    || hasQwenKey() || hasOpenRouterKey() || hasGitHubModelsKey();
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
    return r.error ? { mode: 'anthropic', error: r.error } : { mode: 'anthropic', markdown: r.markdown, usage: r.usage };
  }
  if (g.wantGemini && hasGeminiKey()) {
    const r = await runGemini(fullPrompt);
    return r.error ? { mode: 'gemini', error: r.error } : { mode: 'gemini', markdown: r.markdown, usage: r.usage };
  }
  const tp = tailProvider(g);
  if (tp) {
    const r = await tp.run(fullPrompt);
    return r.error ? { mode: tp.mode, error: r.error } : { mode: tp.mode, markdown: r.markdown, usage: r.usage };
  }
  return { mode: 'manual' };
}
