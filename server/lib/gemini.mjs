/**
 * Tiny generic Gemini client. Zero dependencies — direct fetch, same
 * secure pattern as anthropic.mjs / openai.mjs (no SDK, no CLI execution;
 * key sent via the `x-goog-api-key` header so it never lands in a URL or
 * log; AbortController timeout). Returns the SAME shape as the other
 * provider runners — `{ markdown, usage, error }` — so the llm.mjs router
 * treats every provider identically.
 *
 * Why this exists (v1.73.0): the parent `gemini-eval.mjs` is a purpose-built
 * *oferta-evaluation* script — it reads cv.md/profile.yml and forces the A–G
 * scoring flow, treating its `--file` arg as a JD. Routing the GENERIC mode
 * and deep-research prompts through it produced an evaluation instead of the
 * requested artifact (cover letter, outreach, brief…). This runGemini lets
 * `/api/mode/:slug` and `/api/deep` send the real prompt — with cv.md +
 * profile.yml inlined by `bundleProjectContext` — exactly like the Anthropic
 * and OpenAI-compatible branches. `/api/evaluate` keeps using the oferta-tuned
 * gemini-eval.mjs.
 *
 * Key/model lookups go through effectiveEnv() (v1.54.9 contract): a key set in
 * the parent `.env` after boot is honoured without a restart.
 */
import { effectiveEnv, isUsableKey } from './env-config.mjs';
import { PATHS } from './paths.mjs';
import { cleanLlmMarkdown } from './llm-output.mjs';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const envKey = (k) => effectiveEnv(k, PATHS.envFile);

/**
 * Run a prompt via the Gemini generateContent REST API.
 * @returns {{ markdown: string, usage: object|null, error: string|null }}
 */
export async function runGemini(prompt, opts = {}) {
  const apiKey = opts.apiKey || envKey('GEMINI_API_KEY');
  if (!apiKey) return { markdown: '', usage: null, error: 'Gemini key not set' };
  const model = opts.model || envKey('GEMINI_MODEL') || 'gemini-2.5-pro';
  const maxTokens = Math.min(Math.max(opts.maxTokens || 8192, 256), 16384);
  const timeoutMs = opts.timeoutMs || 180_000;
  const fetchImpl = opts.fetchImpl || fetch;
  const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) {
      const detail = json?.error?.message || json?.error?.status || `HTTP ${res.status}`;
      return { markdown: '', usage: null, error: `Gemini API: ${detail}` };
    }
    // generateContent: candidates[0].content.parts[].text
    const cand = (json.candidates || [])[0] || {};
    const parts = (cand.content && cand.content.parts) || [];
    const raw = Array.isArray(parts)
      ? parts.map((p) => (p && typeof p.text === 'string') ? p.text : '').join('')
      : '';
    const markdown = cleanLlmMarkdown(String(raw || ''));
    if (!markdown) {
      // A blocked / empty completion (safety, recitation, MAX_TOKENS with no
      // text) must surface as an error, not a silent blank artifact.
      const reason = cand.finishReason || json?.promptFeedback?.blockReason;
      return { markdown: '', usage: json.usageMetadata || null, error: `Gemini returned no text${reason ? ` (${reason})` : ''}` };
    }
    return { markdown, usage: json.usageMetadata || null, error: null };
  } catch (e) {
    return { markdown: '', usage: null, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

/** "Is the Gemini key set?" — effectiveEnv view (process.env ∨ .env). */
export function hasGeminiKey() {
  return isUsableKey(envKey('GEMINI_API_KEY'));
}
