/* global window */
/**
 * provider-status.js — single source of truth for "can we run LLM evals live in
 * the browser, and which engine would run?".
 *
 * It reads `GET /api/status/providers`, whose `activeProvider` honors **all**
 * configured providers (Anthropic, Gemini, OpenAI, Qwen, OpenRouter, GitHub
 * Models, Hermes) plus the `LLM_PROVIDER` force-pick — the same effective-env
 * view the server's dispatch cascade uses. This replaced the old per-view
 * `/api/health` probe that only looked at `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`
 * and wrongly forced manual mode for anyone whose only key was, say, OpenRouter.
 *
 * Loaded via <script src> AFTER api.js and BEFORE the views that use it.
 */
(function () {
  const LABELS = {
    anthropic: 'Anthropic', gemini: 'Gemini', openai: 'OpenAI', qwen: 'Qwen',
    openrouter: 'OpenRouter', github: 'GitHub Models', hermes: 'Hermes',
    // v1.216.0 — extended OpenAI-compatible roster.
    deepseek: 'DeepSeek', zai: 'GLM (Z.ai)', kimi: 'Kimi (Moonshot)', minimax: 'MiniMax',
    mistral: 'Mistral', grok: 'Grok (xAI)', together: 'Together', fireworks: 'Fireworks', ollama: 'Ollama',
  };
  window.ProviderStatus = {
    LABELS,
    /** Display label for a provider id ('openrouter' → 'OpenRouter'). */
    label(id) { return LABELS[id] || id || ''; },
    /**
     * Resolve live-eval availability + the engine that would run.
     * @returns {Promise<{available:boolean, engine:string, activeProvider:(string|null), keysConfigured:string[]}>}
     */
    async live() {
      try {
        const st = await window.API.get('/api/status/providers');
        const p = st && st.activeProvider;
        return {
          available: !!p,
          engine: p ? (LABELS[p] || p) : '',
          activeProvider: p || null,
          keysConfigured: (st && Array.isArray(st.keysConfigured)) ? st.keysConfigured : [],
        };
      } catch {
        return { available: false, engine: '', activeProvider: null, keysConfigured: [] };
      }
    },
  };
})();
