/**
 * Tiny OpenAI-compatible Chat Completions client. Zero dependencies —
 * direct fetch, same secure pattern as anthropic.mjs (no SDK, no
 * arbitrary CLI execution; key never logged; AbortController timeout).
 *
 * Covers the providers the user asked to run headless via "OR":
 *   - OpenAI     → https://api.openai.com/v1/chat/completions
 *   - Qwen       → Alibaba DashScope OpenAI-compatible endpoint
 *   - OpenRouter → https://openrouter.ai/api/v1 (v1.57.0) — one key,
 *                  300+ models from every major lab, OpenAI schema
 * All speak the identical request/response schema, so one core
 * (`runOpenAICompatible`) backs the thin wrappers.
 *
 * Key/model lookups go through effectiveEnv() (v1.54.9 contract): a
 * key set in the `.env` after boot is honoured without a
 * restart, and DETECTION (has*Key) matches the key the request SENDS.
 */
import { effectiveEnv, isUsableKey } from './env-config.mjs';
import { PATHS } from './paths.mjs';
import { cleanLlmMarkdown } from './llm-output.mjs';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
// DashScope's OpenAI-compatible mode. International endpoint — works
// from non-CN regions; CN users can override via QWEN_BASE_URL.
const QWEN_URL_DEFAULT =
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
// OpenRouter — OpenAI-compatible aggregator (v1.57.0). One API key
// fronts 300+ models (Anthropic, OpenAI, Google, Meta, Qwen, …); the
// model id is namespaced like `anthropic/claude-sonnet-4`.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

const envKey = (k) => effectiveEnv(k, PATHS.envFile);

/**
 * @returns {{ markdown: string, usage: object|null, error: string|null }}
 */
export async function runOpenAICompatible(prompt, opts = {}) {
  const { url, apiKey, model, label } = opts;
  if (!apiKey) {
    return { markdown: '', usage: null, error: `${label} key not set` };
  }
  const maxTokens = Math.min(Math.max(opts.maxTokens || 8192, 256), 16384);
  const timeoutMs = opts.timeoutMs || 180_000;
  const fetchImpl = opts.fetchImpl || fetch;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        // OpenRouter (and any provider) may want extra attribution
        // headers (HTTP-Referer / X-Title). Spread FIRST so the auth +
        // content-type below always win and can't be clobbered.
        ...(opts.extraHeaders || {}),
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) {
      const detail = json?.error?.message || json?.error?.type || `HTTP ${res.status}`;
      return { markdown: '', usage: null, error: `${label} API: ${detail}` };
    }
    // OpenAI-compatible: choices[].message.content (string or block[]).
    const choice = (json.choices || [])[0] || {};
    const content = choice.message && choice.message.content;
    const markdown = cleanLlmMarkdown(Array.isArray(content)
      ? content.filter((b) => b && (b.type === 'text' || b.text))
        .map((b) => b.text || '').join('\n')
      : String(content || ''));
    return { markdown, usage: json.usage || null, error: null };
  } catch (e) {
    return { markdown: '', usage: null, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

/** Run a prompt via the OpenAI API (model from OPENAI_MODEL). */
export async function runOpenAI(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: OPENAI_URL,
    apiKey: opts.apiKey || envKey('OPENAI_API_KEY'),
    model: opts.model || envKey('OPENAI_MODEL') || 'gpt-5-codex',
    label: 'OpenAI',
    ...opts,
  });
}

/** Run a prompt via Qwen (DashScope OpenAI-compatible mode). */
export async function runQwen(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || envKey('QWEN_BASE_URL') || QWEN_URL_DEFAULT,
    apiKey: opts.apiKey || envKey('QWEN_API_KEY'),
    model: opts.model || envKey('QWEN_MODEL') || 'qwen-max',
    label: 'Qwen',
    ...opts,
  });
}

/**
 * Run a prompt via OpenRouter (v1.57.0). OpenAI-compatible aggregator —
 * one key, 300+ namespaced models (`vendor/model`). OpenRouter asks
 * apps to send HTTP-Referer + X-Title for attribution / rankings; we
 * send a stable career-ops-ui identity (no PII, no secrets).
 */
export async function runOpenRouter(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: OPENROUTER_URL,
    apiKey: opts.apiKey || envKey('OPENROUTER_API_KEY'),
    model: opts.model || envKey('OPENROUTER_MODEL') || 'openrouter/auto',
    label: 'OpenRouter',
    ...opts,
    // After ...opts so the attribution headers are always present;
    // a caller's extraHeaders are still merged in (auth/content-type
    // in runOpenAICompatible win regardless of order).
    extraHeaders: {
      'HTTP-Referer': 'https://career-ops.org',
      'X-Title': 'career-ops-ui',
      ...(opts.extraHeaders || {}),
    },
  });
}

/** "Is the OpenAI key set?" — effectiveEnv view (process.env ∨ .env). */
export function hasOpenAIKey() {
  return isUsableKey(envKey('OPENAI_API_KEY'));
}

/** "Is the Qwen key set?" — same effectiveEnv view. */
export function hasQwenKey() {
  return isUsableKey(envKey('QWEN_API_KEY'));
}

/** "Is the OpenRouter key set?" — same effectiveEnv view (v1.57.0). */
export function hasOpenRouterKey() {
  return isUsableKey(envKey('OPENROUTER_API_KEY'));
}

// GitHub Models (v1.74.0) — GitHub Copilot CLI's developer API surface. The
// inference endpoint is OpenAI-compatible; auth is a GitHub PAT with the
// `models` scope. Model ids are publisher-namespaced (`openai/gpt-4o-mini`).
const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions';

/** Run a prompt via GitHub Models (Copilot). OpenAI-compatible. */
export async function runGitHubModels(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || envKey('GITHUB_MODELS_URL') || GITHUB_MODELS_URL,
    apiKey: opts.apiKey || envKey('GITHUB_MODELS_API_KEY'),
    model: opts.model || envKey('GITHUB_MODELS_MODEL') || 'openai/gpt-4o-mini',
    label: 'GitHub Models',
    ...opts,
  });
}

/** "Is the GitHub Models key set?" — same effectiveEnv view (v1.74.0). */
export function hasGitHubModelsKey() {
  return isUsableKey(envKey('GITHUB_MODELS_API_KEY'));
}

// Hermes (v1.151.0) — Nous Research's self-hosted agent runtime exposes an
// OpenAI-compatible API Server (`hermes gateway`): POST /v1/chat/completions,
// Bearer `API_SERVER_KEY`, default bind http://127.0.0.1:8642/v1. It's Shape A
// from docs/integrations/HERMES.md — just another OpenAI-compatible provider,
// reachable at a user-configured local base URL (loopback by default). This is
// a CONFIGURED provider endpoint (like OPENROUTER/QWEN), not a user-supplied
// job URL, so it does not — and must not — pass through the isValidJobUrl SSRF
// guard; that guard is for scanned job postings only.
const HERMES_BASE_DEFAULT = 'http://127.0.0.1:8642/v1';

/** Resolve the full chat/completions URL from a Hermes base (accepts a `…/v1`
 *  base per Hermes docs, or a full `…/chat/completions` URL).
 *  Defense-in-depth: `HERMES_BASE_URL` is user-writable via `#/config`, so this
 *  string reaches a server-side fetch — only `http(s):` is honoured; any other
 *  scheme (`file:`, `gopher:`, …) falls back to the loopback default rather than
 *  reaching `fetch`. (The provider endpoint is trusted config, not a scanned job
 *  URL, so it doesn't go through `isValidJobUrl`; this is the cheap belt.) */
export function hermesChatUrl(base) {
  const raw = String(base || HERMES_BASE_DEFAULT).trim();
  const safe = /^https?:\/\//i.test(raw) ? raw : HERMES_BASE_DEFAULT;
  const b = safe.replace(/\/+$/, '');
  if (b.endsWith('/chat/completions')) return b;
  // v1.151.1 — a bare host with no path (`http://127.0.0.1:8642`, a common
  // mis-paste that drops the `/v1`) needs the full `/v1/chat/completions`, not
  // just `/chat/completions` (which 404s). A base that already carries a path
  // (`…/v1`, `…/openai`) only needs `/chat/completions` appended.
  if (/^https?:\/\/[^/]+$/i.test(b)) return `${b}/v1/chat/completions`;
  return `${b}/chat/completions`;
}

/** Run a prompt via a local Hermes API Server (OpenAI-compatible). */
export async function runHermes(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || hermesChatUrl(envKey('HERMES_BASE_URL')),
    apiKey: opts.apiKey || envKey('HERMES_API_KEY'),
    model: opts.model || envKey('HERMES_MODEL') || 'hermes-agent',
    label: 'Hermes',
    ...opts,
  });
}

/** "Is the Hermes key set?" — same effectiveEnv view (v1.151.0). Unlike the
 *  cloud providers, a self-hosted `hermes gateway`'s `API_SERVER_KEY` is
 *  user-chosen and may be short (the Hermes docs' own example
 *  `change-me-local-dev` is 19 chars), so we relax `isUsableKey`'s 20-char floor
 *  to 8 here — still enough to reject empty/placeholder junk (v1.151.1). */
export function hasHermesKey() {
  return isUsableKey(envKey('HERMES_API_KEY'), 8);
}

// ── Extended provider roster (v1.216.0) — OpenAI-compatible vendors ──────────
// Each speaks the OpenAI Chat Completions schema, so they reuse
// runOpenAICompatible. Base URLs are the vendors' documented OpenAI-compatible
// endpoints (international where a region split exists; CN users override via
// `<PROVIDER>_BASE_URL`). Like OpenRouter/Qwen/Hermes these are CONFIGURED
// provider endpoints (trusted config), not scanned job URLs — the scheme guard
// in compatChatUrl is defense-in-depth, NOT the isValidJobUrl SSRF gate.

/** Generalized `hermesChatUrl`: resolve a `<base>` → full `/chat/completions`
 *  URL, honouring only `http(s):` (else the provider's default), and appending
 *  `/v1` for a bare host. Shared by the base-URL-configurable OpenAI-compatible
 *  providers (GLM/Kimi region split, local Ollama). */
export function compatChatUrl(base, fallback) {
  const raw = String(base || fallback).trim();
  const safe = /^https?:\/\//i.test(raw) ? raw : fallback;
  const b = safe.replace(/\/+$/, '');
  if (b.endsWith('/chat/completions')) return b;
  if (/^https?:\/\/[^/]+$/i.test(b)) return `${b}/v1/chat/completions`;
  return `${b}/chat/completions`;
}

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const ZAI_BASE_DEFAULT = 'https://api.z.ai/api/paas/v4';       // GLM (Z.ai); CN: https://open.bigmodel.cn/api/paas/v4
const MOONSHOT_BASE_DEFAULT = 'https://api.moonshot.ai/v1';    // Kimi (Moonshot); CN: https://api.moonshot.cn/v1
const MINIMAX_URL = 'https://api.minimax.io/v1/chat/completions';
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const XAI_URL = 'https://api.x.ai/v1/chat/completions';        // Grok (xAI)
const TOGETHER_URL = 'https://api.together.xyz/v1/chat/completions';
const FIREWORKS_URL = 'https://api.fireworks.ai/inference/v1/chat/completions';
const OLLAMA_BASE_DEFAULT = 'http://localhost:11434/v1';       // fully local, no key

/** DeepSeek — OpenAI-compatible. */
export async function runDeepSeek(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || DEEPSEEK_URL,
    apiKey: opts.apiKey || envKey('DEEPSEEK_API_KEY'),
    model: opts.model || envKey('DEEPSEEK_MODEL') || 'deepseek-chat',
    label: 'DeepSeek', ...opts,
  });
}
export function hasDeepSeekKey() { return isUsableKey(envKey('DEEPSEEK_API_KEY')); }

/** GLM (Z.ai) — OpenAI-compatible; base override for the CN endpoint. */
export async function runZai(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || compatChatUrl(envKey('ZAI_BASE_URL'), ZAI_BASE_DEFAULT),
    apiKey: opts.apiKey || envKey('ZAI_API_KEY'),
    model: opts.model || envKey('ZAI_MODEL') || 'glm-4.6',
    label: 'GLM (Z.ai)', ...opts,
  });
}
export function hasZaiKey() { return isUsableKey(envKey('ZAI_API_KEY')); }

/** Kimi (Moonshot) — OpenAI-compatible; base override for the CN endpoint. */
export async function runKimi(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || compatChatUrl(envKey('MOONSHOT_BASE_URL'), MOONSHOT_BASE_DEFAULT),
    apiKey: opts.apiKey || envKey('MOONSHOT_API_KEY'),
    model: opts.model || envKey('MOONSHOT_MODEL') || 'kimi-k2-0711-preview',
    label: 'Kimi (Moonshot)', ...opts,
  });
}
export function hasKimiKey() { return isUsableKey(envKey('MOONSHOT_API_KEY')); }

/** MiniMax — OpenAI-compatible. */
export async function runMiniMax(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || MINIMAX_URL,
    apiKey: opts.apiKey || envKey('MINIMAX_API_KEY'),
    model: opts.model || envKey('MINIMAX_MODEL') || 'MiniMax-Text-01',
    label: 'MiniMax', ...opts,
  });
}
export function hasMiniMaxKey() { return isUsableKey(envKey('MINIMAX_API_KEY')); }

/** Mistral — OpenAI-compatible. */
export async function runMistral(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || MISTRAL_URL,
    apiKey: opts.apiKey || envKey('MISTRAL_API_KEY'),
    model: opts.model || envKey('MISTRAL_MODEL') || 'mistral-large-latest',
    label: 'Mistral', ...opts,
  });
}
export function hasMistralKey() { return isUsableKey(envKey('MISTRAL_API_KEY')); }

/** Grok (xAI) — OpenAI-compatible. */
export async function runGrok(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || XAI_URL,
    apiKey: opts.apiKey || envKey('XAI_API_KEY'),
    model: opts.model || envKey('XAI_MODEL') || 'grok-4',
    label: 'Grok (xAI)', ...opts,
  });
}
export function hasGrokKey() { return isUsableKey(envKey('XAI_API_KEY')); }

/** Together AI — OpenAI-compatible reseller (open-weight models, incl. Inkling). */
export async function runTogether(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || TOGETHER_URL,
    apiKey: opts.apiKey || envKey('TOGETHER_API_KEY'),
    model: opts.model || envKey('TOGETHER_MODEL') || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    label: 'Together', ...opts,
  });
}
export function hasTogetherKey() { return isUsableKey(envKey('TOGETHER_API_KEY')); }

/** Fireworks AI — OpenAI-compatible reseller (open-weight models). */
export async function runFireworks(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || FIREWORKS_URL,
    apiKey: opts.apiKey || envKey('FIREWORKS_API_KEY'),
    model: opts.model || envKey('FIREWORKS_MODEL') || 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    label: 'Fireworks', ...opts,
  });
}
export function hasFireworksKey() { return isUsableKey(envKey('FIREWORKS_API_KEY')); }

/** Ollama — fully local, OpenAI-compatible at `<base>/v1`. No API key (auth is
 *  ignored; a placeholder Bearer keeps runOpenAICompatible happy). Opt-in: only
 *  "available" when OLLAMA_BASE_URL is set, so the auto-cascade never blindly
 *  dials localhost:11434 on a box without Ollama. */
export async function runOllama(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || compatChatUrl(envKey('OLLAMA_BASE_URL'), OLLAMA_BASE_DEFAULT),
    apiKey: opts.apiKey || envKey('OLLAMA_API_KEY') || 'ollama',
    model: opts.model || envKey('OLLAMA_MODEL') || 'llama3.2',
    label: 'Ollama', ...opts,
  });
}
export function hasOllamaKey() { return isUsableKey(envKey('OLLAMA_BASE_URL'), 3); }

// ─── v1.217.0 — Ark (ByteDance Volcano Engine), two regional deployments ──────
// Both expose an OpenAI-compatible Chat Completions surface at `<base>/chat/
// completions`, so they ride the same runOpenAICompatible() core with a
// region base-URL override. The `model` is the vendor's model name or an
// endpoint id (`ep-…`); users override via ARK_MODEL / ARK_CN_MODEL.
const ARK_BASE_DEFAULT = 'https://ark.ap-southeast.bytepluses.com/api/v3';  // BytePlus Ark (international)
const ARK_CN_BASE_DEFAULT = 'https://ark.cn-beijing.volces.com/api/v3';     // Volcengine Ark (China)

/** BytePlus Ark — OpenAI-compatible; ARK_BASE_URL switches region. */
export async function runArk(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || compatChatUrl(envKey('ARK_BASE_URL'), ARK_BASE_DEFAULT),
    apiKey: opts.apiKey || envKey('ARK_API_KEY'),
    model: opts.model || envKey('ARK_MODEL') || 'doubao-pro-32k',
    label: 'BytePlus Ark', ...opts,
  });
}
export function hasArkKey() { return isUsableKey(envKey('ARK_API_KEY')); }

/** Volcengine Ark (China) — OpenAI-compatible; ARK_CN_BASE_URL overrides. */
export async function runArkCn(prompt, opts = {}) {
  return runOpenAICompatible(prompt, {
    url: opts.url || compatChatUrl(envKey('ARK_CN_BASE_URL'), ARK_CN_BASE_DEFAULT),
    apiKey: opts.apiKey || envKey('ARK_CN_API_KEY'),
    model: opts.model || envKey('ARK_CN_MODEL') || 'doubao-pro-32k',
    label: 'Volcengine Ark', ...opts,
  });
}
export function hasArkCnKey() { return isUsableKey(envKey('ARK_CN_API_KEY')); }

/**
 * Curated fallback model list (v1.57.0) — used when the live
 * OpenRouter catalogue can't be fetched (offline, rate-limited, 5xx)
 * so the /#/config model dropdown is never empty. All ids are the
 * `vendor/model` form OpenRouter expects.
 */
export const OPENROUTER_FALLBACK_MODELS = [
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

/**
 * Fetch the OpenRouter model catalogue (v1.57.0). The /models endpoint
 * is PUBLIC — no API key needed — so the SPA model dropdown can be
 * populated before the user has saved a key. Never throws: any failure
 * (timeout, network, non-2xx, malformed) degrades to the curated
 * fallback list so the dropdown is always usable.
 *
 * @returns {{ models: {id,name,context_length}[], fallback: boolean }}
 */
export async function fetchOpenRouterModels(opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const timeoutMs = opts.timeoutMs || 8000;
  const fallback = () => ({
    models: OPENROUTER_FALLBACK_MODELS.map((id) => ({ id, name: id, context_length: null })),
    fallback: true,
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(OPENROUTER_MODELS_URL, {
      method: 'GET',
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return fallback();
    const json = await res.json();
    const raw = Array.isArray(json?.data) ? json.data : [];
    const models = raw
      .filter((m) => m && typeof m.id === 'string' && m.id.trim())
      .map((m) => ({
        id: m.id.trim(),
        name: (typeof m.name === 'string' && m.name.trim()) ? m.name.trim() : m.id.trim(),
        context_length: Number.isFinite(m.context_length) ? m.context_length : null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!models.length) return fallback();
    return { models, fallback: false };
  } catch {
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
