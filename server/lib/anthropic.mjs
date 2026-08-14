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
  try {
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
        messages: [{ role: 'user', content: prompt }],
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
    return { markdown, usage: json.usage || null, error: null };
  } catch (e) {
    return { markdown: '', usage: null, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timer);
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
