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
 * key set in the parent `.env` after boot is honoured without a
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
  'google/gemini-2.5-pro',
  'google/gemini-2.0-flash-001',
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
