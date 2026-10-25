/**
 * Tiny Anthropic API client. Zero dependencies — direct fetch to
 * api.anthropic.com/v1/messages. Used as a Gemini-equivalent execution
 * path for /api/deep and /api/mode/:slug, so users with an
 * ANTHROPIC_API_KEY can run modes live in the browser.
 *
 * Model defaults to claude-sonnet-4-6 (current best mid-tier balance);
 * override via ANTHROPIC_MODEL env var.
 *
 * v1.54.9 — key/model lookups go through effectiveEnv() so a key set
 * in the `.env` after boot is honoured without a server
 * restart, and key DETECTION (hasAnthropicKey) stays consistent with
 * the key the request actually SENDS. This removes the asymmetry that
 * routed evaluations to a stale/invalid Gemini key when Anthropic was
 * the configured provider.
 *
 * CAR-111 — prompt caching is implemented on THIS Anthropic Messages path
 * only: `opts.cachePrefix` marks the byte-stable head of `prompt` (project
 * context + instructions) and ships as the first content block of the single
 * user message with a `cache_control: { type: 'ephemeral' }` breakpoint at
 * its end; the volatile tail (the JD) rides the last block uncached. The
 * OpenAI-compatible providers (the llm-dispatch tail — Hermes, OpenRouter,
 * DeepSeek, …) cache prefixes server-side automatically and are deliberately
 * left unchanged.
 */
import { effectiveEnv, isUsableKey } from './env-config.mjs';
import { PATHS } from './paths.mjs';
import { cleanLlmMarkdown } from './llm-output.mjs';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/** Effective value of an LLM env key: live process.env, else parent .env. */
const envKey = (k) => effectiveEnv(k, PATHS.envFile);

/**
 * @returns {{ markdown: string, usage: object|null, error: string|null }}
 */
export async function runAnthropic(prompt, opts = {}) {
  const apiKey = opts.apiKey || envKey('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return { markdown: '', usage: null, error: 'ANTHROPIC_API_KEY not set' };
  }
  const model = opts.model || envKey('ANTHROPIC_MODEL') || 'claude-sonnet-4-6';
  const maxTokens = Math.min(Math.max(opts.maxTokens || 8192, 256), 16384);
  const timeoutMs = opts.timeoutMs || 180_000;
  const fetchImpl = opts.fetchImpl || fetch;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  // CAR-92 — a caller-supplied signal (the SSE route's req-close controller)
  // is linked into the runner's own controller, so a client disconnect kills
  // the upstream request instead of burning tokens to nobody. Removed in the
  // `finally` so the caller's signal never holds this runner's listener.
  const extSignal = opts.signal || null;
  const onExtAbort = extSignal ? () => ctrl.abort() : null;
  if (extSignal && onExtAbort) {
    if (extSignal.aborted) ctrl.abort();
    else extSignal.addEventListener('abort', onExtAbort);
  }
  try {
    // CAR-111 — with a valid cachePrefix the single user message becomes two
    // content blocks: the byte-stable prefix with an ephemeral breakpoint at
    // its end (Anthropic reuses it across calls — cache reads bill at a
    // fraction of input price), and the volatile tail uncached after it.
    // Anything else (no prefix, empty, or not actually a prefix of `prompt`)
    // fails open to the plain single-string request — never an error.
    let content = prompt;
    const cachePrefix = opts.cachePrefix;
    if (typeof cachePrefix === 'string' && cachePrefix && prompt.startsWith(cachePrefix)) {
      const tail = prompt.slice(cachePrefix.length);
      content = tail
        ? [
            { type: 'text', text: cachePrefix, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: tail },
          ]
        : [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }];
    }
    const res = await fetchImpl(ANTHROPIC_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content }],
      }),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) {
      const detail = json?.error?.message || json?.error?.type || `HTTP ${res.status}`;
      return { markdown: '', usage: null, error: `Anthropic API: ${detail}` };
    }
    // Concatenate all `text` blocks. Anthropic returns content[] of typed
    // blocks (text, tool_use, etc.); we only render the text ones.
    const markdown = cleanLlmMarkdown((json.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n'));
    // `max_tokens` means the answer was cut off; callers that validate a
    // format (evaluate) report it instead of a vague shape warning.
    const truncated = json.stop_reason === 'max_tokens';
    if (!markdown) {
      // A 200 with no text (refusal, tool_use only, cut off before any text)
      // is a failure: callers would otherwise save an empty report.
      const reason = json.stop_reason ? ` (${json.stop_reason})` : '';
      return { markdown: '', usage: json.usage || null, error: `Anthropic returned no text${reason}`, truncated };
    }
    return { markdown, usage: json.usage || null, error: null, truncated };
  } catch (e) {
    return { markdown: '', usage: null, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timer);
    if (extSignal && onExtAbort) extSignal.removeEventListener('abort', onExtAbort);
  }
}

/**
 * "Is the Anthropic key set?" — effective view: live process.env OR
 * the `.env` file. v1.54.9: previously process.env-only, which
 * went stale when the key was added after boot and mis-routed
 * evaluations to Gemini.
 */
export function hasAnthropicKey() {
  return isUsableKey(envKey('ANTHROPIC_API_KEY'));
}

/**
 * "Is the Gemini key set?" — same effective view as hasAnthropicKey
 * so the two never drift (REVIEW-B2). The Gemini exec path is a
 * Node subprocess that already reads the `.env`, so detecting
 * the key the same way keeps routing decisions consistent with what
 * actually runs.
 */
export function hasGeminiKey() {
  return isUsableKey(envKey('GEMINI_API_KEY'));
}
