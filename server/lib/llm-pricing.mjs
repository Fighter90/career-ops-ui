/**
 * Approximate LLM pricing (v1.105.0) — USD per 1,000,000 tokens.
 *
 * These are ROUGH, human-editable list prices for a representative model of
 * each provider, used only to turn the recorded token counts into an
 * *estimated* dollar figure in the Usage page. They are not billed and not
 * authoritative — prices change and vary by model/tier. **Edit the numbers
 * below to match your actual plan.** If a provider is missing, its cost shows
 * as 0 (tokens are still counted).
 *
 * Keyed by the provider `mode` used across the app: anthropic, gemini, openai,
 * qwen, openrouter, github.
 */
export const PRICES = {
  //            input $/1M   output $/1M   (representative model)
  anthropic:  { in: 3.00,    out: 15.00 }, // Claude Sonnet-class
  gemini:     { in: 0.30,    out: 2.50 },  // Gemini Flash/Pro-class
  openai:     { in: 2.50,    out: 10.00 }, // GPT-4o-class
  qwen:       { in: 0.40,    out: 1.20 },  // Qwen-Plus-class
  openrouter: { in: 1.00,    out: 3.00 },  // varies wildly by routed model
  github:     { in: 0.00,    out: 0.00 },  // GitHub Models free tier
  hermes:     { in: 0.00,    out: 0.00 },  // local gateway — the real cost is billed by whatever provider you configured INSIDE Hermes, outside this app's view
  // v1.216.0 — extended OpenAI-compatible roster (rough list prices for a
  // representative model of each; edit to match your plan).
  deepseek:   { in: 0.28,    out: 0.42 },  // DeepSeek-V3-class
  zai:        { in: 0.60,    out: 2.20 },  // GLM-4.6-class (Z.ai)
  kimi:       { in: 0.60,    out: 2.50 },  // Kimi K2-class (Moonshot)
  minimax:    { in: 0.30,    out: 1.20 },  // MiniMax-Text-class
  mistral:    { in: 2.00,    out: 6.00 },  // Mistral-Large-class
  grok:       { in: 3.00,    out: 15.00 }, // Grok-class (xAI)
  together:   { in: 0.88,    out: 0.88 },  // varies by open-weight model routed
  fireworks:  { in: 0.90,    out: 0.90 },  // varies by open-weight model routed
  ollama:     { in: 0.00,    out: 0.00 },  // local — no per-token cost
};

/** Estimated USD for a call. `inTok`/`outTok` are token counts. */
export function priceFor(provider, inTok, outTok) {
  const p = PRICES[provider];
  if (!p) return 0;
  return ((Number(inTok) || 0) * p.in + (Number(outTok) || 0) * p.out) / 1_000_000;
}
