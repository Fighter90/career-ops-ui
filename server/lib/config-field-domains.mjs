/**
 * config-field-domains.mjs — the allowed VALUES for every `select` config key.
 *
 * CONFIG-1 (v1.232.0). `validateConfigBody` knew the key NAMES (KNOWN_KEYS) but
 * not their domains, so `{"LLM_PROVIDER":"not-a-provider"}` returned 200 and was
 * written straight into the user's `.env`. Nothing then errored — the provider
 * resolver silently fell back to whatever key was configured, so the app looked
 * healthy while the setting the user chose had no effect. It would only surface
 * later, when the fallback stopped matching intent.
 *
 * The option lists used to exist ONLY in the browser, in
 * `public/js/views/config/field-specs.js`, which the server cannot import: the
 * client has no module system at all (0 `type="module"`), and that file is an
 * IIFE assigning `window.ConfigFieldSpecs`. So the server owns the domains here
 * and the client mirrors them — the same shape as `FALLBACK_SOURCES` in
 * `public/js/views/scan.js`, which mirrors the source registry with
 * `tests/scan-fallback-sources.test.mjs` as the drift gate. Here that gate is
 * `tests/config-select-domains.test.mjs`: it evaluates the browser file in a
 * `node:vm` and fails if either side gains, loses or reorders a value.
 *
 * `select-remote` is deliberately absent. Its list is fetched from the provider
 * at runtime, so there is no domain to check against; membership validation for
 * OPENROUTER_MODEL would reject legitimate models the moment OpenRouter adds
 * one. It keeps the generic guards (known key, no newlines, length).
 */
/**
 * CURATED domains — the model dropdowns. These are NOT enforced, and that is
 * deliberate: the lists are a convenience ("adding a new model here is
 * one-line", says field-specs.js), while the real domain belongs to the vendor
 * and changes without our releases. Enforcing them would mean a user could not
 * select a model the provider already serves until we cut a release — this
 * repo's own suites already configure `gemini-2.0-flash`, which the curated
 * list dropped. A wrong model also fails LOUDLY (the vendor rejects the call),
 * so it carries none of the silent-fallback risk that LLM_PROVIDER does.
 *
 * They are kept here anyway so the drift gate can prove the server and the
 * browser never disagree about what the dropdown offers.
 */
export const CURATED_DOMAINS = Object.freeze({
  ANTHROPIC_MODEL: Object.freeze(["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5", "claude-3-7-sonnet-latest", "claude-3-5-haiku-latest"]),
  GEMINI_MODEL: Object.freeze(["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-2.5-pro"]),
  OPENAI_MODEL: Object.freeze(["gpt-5-codex", "gpt-5", "gpt-5-mini", "gpt-4.1", "o4-mini", "o3"]),
  QWEN_MODEL: Object.freeze(["qwen-max", "qwen-plus", "qwen-turbo", "qwen2.5-72b-instruct", "qwen2.5-coder-32b-instruct"]),
  GITHUB_MODELS_MODEL: Object.freeze(["openai/gpt-4o-mini", "openai/gpt-4o", "openai/gpt-4.1", "meta/Llama-3.3-70B-Instruct", "mistral-ai/Mistral-Large-2411", "deepseek/DeepSeek-V3"]),
  DEEPSEEK_MODEL: Object.freeze(["deepseek-chat", "deepseek-reasoner"]),
  ZAI_MODEL: Object.freeze(["glm-4.6", "glm-4.5", "glm-4.5-air", "glm-4-plus"]),
  MOONSHOT_MODEL: Object.freeze(["kimi-k2-0711-preview", "moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k"]),
  MINIMAX_MODEL: Object.freeze(["MiniMax-Text-01", "abab6.5s-chat"]),
  MISTRAL_MODEL: Object.freeze(["mistral-large-latest", "mistral-small-latest", "open-mistral-nemo", "codestral-latest"]),
  XAI_MODEL: Object.freeze(["grok-4", "grok-3", "grok-3-mini", "grok-2-latest"]),
  TOGETHER_MODEL: Object.freeze(["meta-llama/Llama-3.3-70B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct-Turbo", "mistralai/Mixtral-8x7B-Instruct-v0.1", "thinkingmachines/Inkling"]),
  FIREWORKS_MODEL: Object.freeze(["accounts/fireworks/models/llama-v3p3-70b-instruct", "accounts/fireworks/models/deepseek-v3", "accounts/fireworks/models/qwen2p5-72b-instruct", "accounts/fireworks/models/mixtral-8x22b-instruct-hf"]),
  OLLAMA_MODEL: Object.freeze(["llama3.2", "llama3.3", "llama3.1", "qwen2.5", "deepseek-r1", "mistral", "gemma3"]),
  ARK_MODEL: Object.freeze(["doubao-pro-32k", "doubao-pro-4k", "doubao-1.5-pro-32k", "doubao-lite-32k"]),
  ARK_CN_MODEL: Object.freeze(["doubao-pro-32k", "doubao-pro-4k", "doubao-1.5-pro-32k", "doubao-lite-32k"]),
});

export const REMOTE_SELECT_KEYS = Object.freeze(new Set(["OPENROUTER_MODEL"]));
