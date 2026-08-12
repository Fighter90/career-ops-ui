/* global window */
/**
 * config/field-specs.js — static field-spec data for /#/config, extracted from
 * views/config.js (P-15 file-size split, v1.155.0). Pure, read-only data: the
 * curated per-provider model lists + the FIELDS descriptor table (API keys /
 * runtime / regional). Loaded via <script src> BEFORE views/config.js.
 */
(function () {
  // Curated model lists. The first entry per provider doubles as the
  // default when the user hasn't explicitly set the env var. Adding
  // a new model here is one-line — picks up automatically on the UI
  // dropdown.
  const ANTHROPIC_MODELS = [
    'claude-sonnet-4-6',
    'claude-opus-4-7',
    'claude-haiku-4-5',
    'claude-3-7-sonnet-latest',
    'claude-3-5-haiku-latest',
  ];
  const GEMINI_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
  ];
  // OpenAI (v1.55.0 — now a headless live-eval provider too, not just
  // the stored parent-Codex key). First entry = default when
  // OPENAI_MODEL is unset.
  const OPENAI_MODELS = [
    'gpt-5-codex',
    'gpt-5',
    'gpt-5-mini',
    'gpt-4.1',
    'o4-mini',
    'o3',
  ];
  // Qwen via DashScope OpenAI-compatible mode (v1.55.0). First entry =
  // default when QWEN_MODEL is unset.
  const QWEN_MODELS = [
    'qwen-max',
    'qwen-plus',
    'qwen-turbo',
    'qwen2.5-72b-instruct',
    'qwen2.5-coder-32b-instruct',
  ];
  // OpenRouter (v1.57.0) — one key fronts 300+ models. The live
  // catalogue is loaded from GET /api/openrouter/models (server-side
  // proxy; keeps the CSP connect-src 'self' envelope intact). This
  // curated list is the offline fallback + the first entry is the
  // default when OPENROUTER_MODEL is unset. Model ids are namespaced
  // `vendor/model`; `openrouter/auto` lets OpenRouter pick.
  const OPENROUTER_MODELS = [
    'openrouter/auto',
    'anthropic/claude-sonnet-4',
    'anthropic/claude-opus-4',
    'openai/gpt-5',
    'openai/gpt-5-mini',
    'google/gemini-3.6-flash',
    'google/gemini-2.5-pro',
    'meta-llama/llama-3.3-70b-instruct',
    'qwen/qwen-2.5-72b-instruct',
    'deepseek/deepseek-chat',
  ];
  // GitHub Models (v1.74.0) — GitHub Copilot CLI's developer API surface.
  // OpenAI-compatible; auth is a GitHub PAT with the `models` scope. Model
  // ids are publisher-namespaced. First entry = default when unset.
  const GITHUB_MODELS = [
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'openai/gpt-4.1',
    'meta/Llama-3.3-70B-Instruct',
    'mistral-ai/Mistral-Large-2411',
    'deepseek/DeepSeek-V3',
  ];
  const FIELDS = [
    {
      // v1.39.0 (WS8.2) — explicit provider preference.
      key: 'LLM_PROVIDER', secret: false, kind: 'select',
      options: ['auto', 'claude', 'gemini', 'openai', 'qwen', 'openrouter', 'github', 'hermes'], defaultValue: 'auto',
      labelKey: 'config.llmProvider', label: 'LLM_PROVIDER',
      hintKey: 'config.llmProviderHint',
      hintFallback: 'auto = use whichever key is set, preferring Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models → Hermes. claude / gemini / openai / qwen / openrouter / github / hermes = force that one. A forced provider with no key → manual-prompt fallback.',
    },
    {
      key: 'ANTHROPIC_API_KEY', secret: true,
      labelKey: 'config.anthropicKey', label: 'ANTHROPIC_API_KEY',
      hintKey: 'config.anthropicHint',
      hintFallback: 'Get one at console.anthropic.com → API keys. When set, the "⚡ Run live" button executes prompts via Claude.',
    },
    {
      key: 'ANTHROPIC_MODEL', secret: false, kind: 'select',
      options: ANTHROPIC_MODELS, defaultValue: 'claude-sonnet-4-6',
      labelKey: 'config.anthropicModel', label: 'ANTHROPIC_MODEL',
      hintKey: 'config.anthropicModelHint',
      hintFallback: 'Default: claude-sonnet-4-6. Heavier reasoning: claude-opus-4-7. Cheap & fast: claude-haiku-4-5.',
    },
    {
      key: 'GEMINI_API_KEY', secret: true,
      labelKey: 'config.geminiKey', label: 'GEMINI_API_KEY',
      hintKey: 'config.geminiHint',
      hintFallback: 'Free tier at aistudio.google.com/apikey. Used as fallback when Anthropic isn\'t set.',
    },
    {
      key: 'GEMINI_MODEL', secret: false, kind: 'select',
      options: GEMINI_MODELS, defaultValue: 'gemini-3.6-flash',
      labelKey: 'config.geminiModel', label: 'GEMINI_MODEL',
      hintKey: 'config.geminiModelHint',
      hintFallback: 'Default: gemini-3.6-flash. Lite: gemini-3.1-flash-lite. Reasoning: gemini-2.5-pro.',
    },
    {
      // v1.55.0 — OpenAI is now a headless live-eval provider too
      // (direct HTTPS, like Anthropic). Still also read by the parent
      // Codex/OpenAI CLI flow. Stored + masked like the other keys.
      key: 'OPENAI_API_KEY', secret: true,
      labelKey: 'config.openaiKey', label: 'OPENAI_API_KEY',
      hintKey: 'config.openaiHint',
      hintFallback: 'platform.openai.com → API keys. v1.55.0: also runs the web-ui ⚡ live eval (3rd in the auto order, after Anthropic & Gemini); still read by the parent Codex/OpenAI CLI flow too.',
    },
    {
      key: 'OPENAI_MODEL', secret: false, kind: 'select',
      options: OPENAI_MODELS, defaultValue: 'gpt-5-codex',
      labelKey: 'config.openaiModel', label: 'OPENAI_MODEL',
      hintKey: 'config.openaiModelHint',
      hintFallback: 'Default: gpt-5-codex. gpt-5 / gpt-5-mini for general use; o4-mini / o3 for reasoning. Used by the web-ui OpenAI live eval and the parent Codex/OpenAI CLI flow.',
    },
    {
      // v1.55.0 — Qwen via DashScope OpenAI-compatible mode. Headless
      // live-eval provider (4th in the auto order). Override the
      // endpoint with QWEN_BASE_URL in the raw .env if you need the
      // mainland-CN host.
      key: 'QWEN_API_KEY', secret: true,
      labelKey: 'config.qwenKey', label: 'QWEN_API_KEY',
      hintKey: 'config.qwenHint',
      hintFallback: 'Alibaba Model Studio / DashScope API key (dashscope.console.aliyun.com). When set, runs the web-ui ⚡ live eval (4th in the auto order, after OpenAI). OpenAI-compatible endpoint.',
    },
    {
      key: 'QWEN_MODEL', secret: false, kind: 'select',
      options: QWEN_MODELS, defaultValue: 'qwen-max',
      labelKey: 'config.qwenModel', label: 'QWEN_MODEL',
      hintKey: 'config.qwenModelHint',
      hintFallback: 'Default: qwen-max (strongest). qwen-plus / qwen-turbo for speed/cost; qwen2.5-coder-32b-instruct for code-heavy reasoning.',
    },
    {
      // v1.57.0 — OpenRouter: one key, 300+ models. 5th in the auto
      // order (tail), so it never silently re-routes an existing
      // Anthropic/Gemini/OpenAI/Qwen setup.
      key: 'OPENROUTER_API_KEY', secret: true,
      labelKey: 'config.openrouterKey', label: 'OPENROUTER_API_KEY',
      hintKey: 'config.openrouterHint',
      hintFallback: 'openrouter.ai/keys — one key fronts 300+ models (Anthropic, OpenAI, Google, Meta, Qwen, DeepSeek …). When set, runs the web-ui ⚡ live eval (5th in the auto order, after Qwen).',
    },
    {
      key: 'OPENROUTER_MODEL', secret: false, kind: 'select-remote',
      remote: '/api/openrouter/models', options: OPENROUTER_MODELS,
      defaultValue: 'openrouter/auto',
      labelKey: 'config.openrouterModel', label: 'OPENROUTER_MODEL',
      hintKey: 'config.openrouterModelHint',
      hintFallback: 'Default: openrouter/auto (OpenRouter picks). The full live catalogue loads from OpenRouter; pick any vendor/model id. Falls back to a curated list if the catalogue is unreachable.',
    },
    {
      // v1.74.0 — GitHub Models (GitHub Copilot CLI's API surface). A GitHub
      // PAT with the `models` scope; OpenAI-compatible endpoint. 6th in the
      // auto order (tail), after OpenRouter.
      key: 'GITHUB_MODELS_API_KEY', secret: true,
      labelKey: 'config.githubKey', label: 'GITHUB_MODELS_API_KEY',
      hintKey: 'config.githubHint',
      hintFallback: 'A GitHub personal-access token with the "models" scope (github.com/settings/tokens). This is GitHub Copilot CLI\'s API surface (GitHub Models). When set, runs the web-ui ⚡ live eval (6th in the auto order, after OpenRouter).',
    },
    {
      key: 'GITHUB_MODELS_MODEL', secret: false, kind: 'select',
      options: GITHUB_MODELS, defaultValue: 'openai/gpt-4o-mini',
      labelKey: 'config.githubModel', label: 'GITHUB_MODELS_MODEL',
      hintKey: 'config.githubModelHint',
      hintFallback: 'Default: openai/gpt-4o-mini. Publisher-namespaced ids — openai/gpt-4o, openai/gpt-4.1, meta/Llama-3.3-70B-Instruct, deepseek/DeepSeek-V3, …',
    },
    {
      // Hermes (v1.151.0) — Nous Research's local agent runtime exposes an
      // OpenAI-compatible API Server via `hermes gateway`. Last in the auto order.
      key: 'HERMES_API_KEY', secret: true,
      labelKey: 'config.hermesKey', label: 'HERMES_API_KEY',
      hintKey: 'config.hermesHint',
      hintFallback: 'The Bearer key of a running Hermes API Server (its API_SERVER_KEY, set in ~/.hermes/.env; start it with `hermes gateway`). Hermes is Nous Research\'s self-hosted agent — it exposes an OpenAI-compatible /v1/chat/completions locally. When set, runs the web-ui ⚡ live eval (last in the auto order). See docs/integrations/HERMES.md.',
    },
    {
      key: 'HERMES_BASE_URL', secret: false,
      labelKey: 'config.hermesBaseUrl', label: 'HERMES_BASE_URL',
      hintKey: 'config.hermesBaseUrlHint',
      hintFallback: 'Default: http://127.0.0.1:8642/v1 (Hermes API Server\'s loopback bind). Change the port here if you set API_SERVER_PORT. A full …/chat/completions URL also works.',
    },
    {
      key: 'HERMES_MODEL', secret: false,
      labelKey: 'config.hermesModel', label: 'HERMES_MODEL',
      hintKey: 'config.hermesModelHint',
      hintFallback: 'Default: hermes-agent. The Hermes profile / model id to send (Hermes routes it to whatever provider you configured inside it).',
    },
    // v1.19.0 — HH_USER_AGENT removed from the UI per user direction.
    // The server still honors the env var if a power user sets it via
    // career-ops/.env, but it's no longer advertised through #/config —
    // the bundled default UA in server/lib/sources/hh.mjs handles
    // non-RU IPs well enough for most users.
    {
      key: 'PORT', secret: false, defaultValue: '4317',
      labelKey: 'config.port', label: 'PORT',
      hintKey: 'config.portHint',
      hintFallback: 'Default 4317. Restart the server after changing.',
    },
    {
      key: 'HOST', secret: false, defaultValue: '127.0.0.1',
      labelKey: 'config.host', label: 'HOST',
      hintKey: 'config.hostHint',
      hintFallback: 'Default 127.0.0.1 (loopback). 0.0.0.0 exposes the UI to your LAN — only do that on a trusted network.',
    },
  ];
  window.ConfigFieldSpecs = { FIELDS };
})();
