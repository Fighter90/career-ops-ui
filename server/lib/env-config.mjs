/**
 * Read / write the parent project's .env file in place. Used by the
 * /api/config endpoint so the user can edit ANTHROPIC_API_KEY, GEMINI_API_KEY,
 * etc. through the UI and have BOTH career-ops scripts (read by node) AND
 * web-ui (read by dotenv-loader) pick them up.
 *
 * Preserves existing comments and ordering; only the keys we touch are
 * rewritten, everything else passes through unchanged.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/**
 * Keys we expose via /api/config. Order matters — it's how they appear
 * in the file when we have to bootstrap an empty .env.
 */
export const KNOWN_KEYS = [
  // ── LLM provider selection (v1.39.0, WS8.2) ──
  'LLM_PROVIDER',          // auto | claude | gemini | openai | qwen
  // ── LLM provider keys. `auto` runs whichever key is set, in this
  //    preferred order: Anthropic > Gemini > OpenAI > Qwen (v1.55.0). ──
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'OPENAI_API_KEY',        // headless live-eval (v1.55.0) + parent Codex/OpenAI CLI flow
  'OPENAI_MODEL',
  'QWEN_API_KEY',          // headless live-eval via DashScope OpenAI-compatible (v1.55.0)
  'QWEN_MODEL',
  'OPENROUTER_API_KEY',    // headless live-eval via OpenRouter (v1.57.0); one key → 300+ models
  'OPENROUTER_MODEL',
  // ── Server runtime ──
  'PORT',
  'HOST',
];

/**
 * Valid LLM_PROVIDER values. `auto` = first provider whose key is set,
 * preferring Anthropic → Gemini → OpenAI → Qwen. Explicit values pin
 * one provider; with no key it falls through to the manual-prompt
 * path exactly like the pre-v1.39 no-key behaviour.
 */
export const LLM_PROVIDERS = ['auto', 'claude', 'gemini', 'openai', 'qwen', 'openrouter'];

/**
 * Effective provider preference order from LLM_PROVIDER:
 *   auto (default/unset/unknown) → ['anthropic','gemini','openai','qwen']
 *   claude                       → ['anthropic']
 *   gemini                       → ['gemini']
 *   openai                       → ['openai']
 *   qwen                         → ['qwen']
 * The route gates walk this list and use the first provider whose key
 * is actually set (the user's "works via OR" requirement); a forced
 * provider with no key falls through to manual-prompt.
 */
export function providerOrder(env = process.env) {
  const v = String(env.LLM_PROVIDER || 'auto').trim().toLowerCase();
  if (v === 'claude') return ['anthropic'];
  if (v === 'gemini') return ['gemini'];
  if (v === 'openai') return ['openai'];
  if (v === 'qwen') return ['qwen'];
  if (v === 'openrouter') return ['openrouter'];
  // OpenRouter sits at the TAIL of the auto order: a user who already
  // had Anthropic/Gemini/OpenAI/Qwen working keeps that exact routing;
  // OpenRouter only kicks in when it's the sole configured key.
  return ['anthropic', 'gemini', 'openai', 'qwen', 'openrouter'];
}

/**
 * v1.55.3 (UX-2) — given the list of providers whose key is set,
 * return the one the OR-router would actually use: the first entry of
 * providerOrder(env) that is in `keysConfigured`, else null. Pure (no
 * I/O) so the /api/status/providers endpoint and its test share one
 * source of truth with the llm.mjs gate sites. An explicit
 * LLM_PROVIDER pin with no matching key correctly yields null (mirrors
 * the manual-prompt fall-through).
 */
export function selectActiveProvider(keysConfigured, env = process.env) {
  const set = new Set(keysConfigured || []);
  return providerOrder(env).find((p) => set.has(p)) || null;
}

/**
 * Group classification for the SPA config view (F-013). v1.19.0 collapsed
 * to two groups: `core` (LLM keys) and `runtime` (PORT/HOST). The
 * previous "regional" group (only HH_USER_AGENT) was removed in v1.19.0;
 * as of v1.65.0 hh.ru is scraped from its public website with a fixed
 * browser User-Agent and needs no env configuration at all.
 */
export const KEY_GROUPS = {
  LLM_PROVIDER: 'core',
  ANTHROPIC_API_KEY: 'core',
  ANTHROPIC_MODEL: 'core',
  GEMINI_API_KEY: 'core',
  GEMINI_MODEL: 'core',
  OPENAI_API_KEY: 'core',
  OPENAI_MODEL: 'core',
  QWEN_API_KEY: 'core',
  QWEN_MODEL: 'core',
  OPENROUTER_API_KEY: 'core',
  OPENROUTER_MODEL: 'core',
  PORT: 'runtime',
  HOST: 'runtime',
};

/** Keys whose values are secret and must never be returned in plain text. */
export const SECRET_KEYS = new Set(['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY']);

/**
 * Parse an .env file body into a plain object. Preserves the raw text
 * via a `__raw` field so updates can rewrite in place without breaking
 * comments or ordering.
 */
export function parseEnv(text) {
  const out = {};
  if (!text) return out;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s+|\s+$/g, '');
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/**
 * v1.54.9 — effective value of an env key for runtime LLM routing.
 *
 * The server reads keys from `process.env`, which is a SNAPSHOT taken
 * at boot. If the user later sets `ANTHROPIC_API_KEY` in the parent
 * `.env` (or it was added after the server started) the running
 * process never sees it → `hasAnthropicKey()` is false, evaluation
 * silently falls through to whatever stale key IS in process.env
 * (often an old/invalid `GEMINI_API_KEY`) and the user gets a
 * "Gemini API key not valid" error despite Anthropic being set.
 *
 * Resolution order, matching user expectation ("use whichever keys
 * are actually set"): a non-empty `process.env` value wins (covers
 * shell exports and the live-apply in POST /api/config), otherwise
 * the current parent `.env` file is consulted. This also removes the
 * asymmetry where the Gemini path (a parent Node subprocess) already
 * read the parent `.env` while the in-process Anthropic path did not.
 *
 * Never throws; returns undefined when the key is set nowhere.
 */
export function effectiveEnv(key, envFilePath) {
  const live = process.env[key];
  if (live !== undefined && live !== '') return live;
  try {
    if (envFilePath && existsSync(envFilePath)) {
      const v = parseEnv(readFileSync(envFilePath, 'utf8'))[key];
      if (v !== undefined && v !== '') return v;
    }
  } catch { /* unreadable .env → treat as unset */ }
  return undefined;
}

/**
 * Is `raw` a plausibly-real LLM API key — as opposed to unset, a
 * shipped-template placeholder, or obviously-too-short junk left in a
 * parent .env? Every supported provider's key is comfortably over 20
 * chars (Gemini `AIza…` ≈ 39, Anthropic `sk-ant-…` ≈ 100+, OpenAI
 * `sk-…` ≥ 40, Qwen/DashScope `sk-…` ≈ 35), so a conservative 20-char
 * floor never false-negatives a working key while killing the kind of
 * 10-char placeholder that (v1.56.3) a parent .env carried — it was
 * reported "✓ set" by the onboarding banner AND mis-selected as the
 * active provider over a valid ANTHROPIC key, so every live eval
 * silently failed against a dead provider. Pure; used by
 * has{Anthropic,Gemini,OpenAI,Qwen}Key() and the /api/health key rows
 * so every "is it configured?" answer agrees.
 */
export function isUsableKey(raw) {
  if (typeof raw !== 'string') return false;
  const v = raw.trim();
  if (v.length < 20) return false;                       // no real key is this short
  if (/^your_.*_here$/i.test(v)) return false;           // shipped-template form (matches maskSecret)
  if (/_here$/i.test(v)) return false;
  if (/^(your[_-]|changeme|placeholder|example|sk-xxx|todo$|none$|null$|test[_-]?key|enter[_-]|add[_-]your)/i.test(v)) return false;
  if (/^<.*>$/.test(v)) return false;                    // <your-key-here> angle form
  if (/^(.)\1+$/.test(v)) return false;                  // a single repeated char
  return true;
}

/**
 * Mask secret values: keep first 4 + last 4 chars, hide middle.
 * Returns null when the value is unset, the empty string, or a literal
 * placeholder like "your_*_here".
 */
export function maskSecret(value) {
  if (!value || /^your_.*_here$/i.test(value)) return null;
  const s = String(value);
  if (s.length <= 8) return '*'.repeat(s.length);
  return s.slice(0, 4) + '…' + s.slice(-4);
}

/**
 * v1.57.0 BF — normalize a single config value the way it will be
 * persisted: trim surrounding whitespace. Pasted API keys routinely
 * arrive with a trailing newline or stray spaces (OS clipboard, the
 * "copy" buttons on provider consoles); persisting that verbatim broke
 * runtime auth AND tripped validateConfig's newline guard, surfacing as
 * the reported "validation failed" on /#/config for EVERY provider.
 * Non-strings pass through untouched (validateConfig flags them).
 */
export function normalizeConfigValue(v) {
  return typeof v === 'string' ? v.trim() : v;
}

/**
 * Validate a config update. Returns { ok, errors: string[] }.
 * Empty values are allowed (they unset the key). Values are validated
 * AFTER normalization (trim) so the check matches what gets written.
 *
 * i18n decision (v1.58.0, AI-review rule 3): these `errors` strings are
 * intentionally English. They are server-emitted *diagnostic* detail —
 * the same class as every other server error in this codebase (`invalid
 * url`, HTTP statuses, `prompt too large`, runner stderr). The server
 * has no UI-locale binding at message-construction time and never has;
 * localizing only this one site would be inconsistent and misleading.
 * The SPA localizes its own chrome (toasts, labels, the network-error
 * sentence — see public/js/api.js `api.netError`/`api.netHint`); it
 * surfaces server diagnostics verbatim by design.
 */
export function validateConfig(body) {
  const errors = [];
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['body must be an object'] };
  }
  // v1.57.1 — every message says WHAT is wrong, in WHICH field, and HOW
  // to fix it. The offending value is echoed back ONLY for non-secret
  // keys (PORT/HOST/models/LLM_PROVIDER); for SECRET_KEYS we describe
  // the value's shape (length) but never echo it, so a mistyped real
  // key can't leak into a toast / log.
  const showVal = (key, val) => {
    if (SECRET_KEYS.has(key)) return `the ${val.length}-character value you entered`;
    const t = val.length > 60 ? val.slice(0, 60) + '…' : val;
    return `you entered "${t}"`;
  };
  for (const [k, raw] of Object.entries(body)) {
    if (!KNOWN_KEYS.includes(k)) {
      errors.push(`${k}: not a known config key — this setting is not recognized and was ignored. Recognized keys: ${KNOWN_KEYS.join(', ')}.`);
      continue;
    }
    if (raw === null || raw === '' || raw === undefined) continue;
    if (typeof raw !== 'string') {
      errors.push(`${k}: must be string — expected a text value but received ${Array.isArray(raw) ? 'an array' : typeof raw}.`);
      continue;
    }
    const v = normalizeConfigValue(raw);
    if (v === '') continue; // whitespace-only → treated as unset
    if (v.length > 4000) {
      errors.push(`${k}: value too long — it is ${v.length} characters but the maximum allowed is 4000. Shorten the value.`);
    }
    // Internal newlines are still rejected — that's a real .env
    // injection guard (a value spanning lines could smuggle a second
    // KEY=value pair). Leading/trailing newlines were already trimmed.
    if (/[\r\n]/.test(v)) {
      errors.push(`${k}: must not contain newlines — the value spans more than one line. Re-paste it as a single line (a stray line break is the usual cause).`);
    }
    // Anthropic sanity check — prefix + plausible length only. Real
    // keys are `sk-ant-…` with a base64url tail whose exact charset
    // and length Anthropic may change; a strict $-anchored class
    // regex false-rejected genuine keys (the v1.57.0 bug). isUsableKey
    // is the shared "is it real?" floor; here we just catch an
    // obviously-wrong paste (e.g. an OpenAI key in the Anthropic box).
    if (k === 'ANTHROPIC_API_KEY' && !/^sk-ant-\S{20,}$/.test(v) && !/^your_/i.test(v)) {
      errors.push(`${k}: expected sk-ant-… format — an Anthropic key starts with "sk-ant-" followed by at least 20 characters. ${showVal(k, v)}, which doesn't match. If you pasted an OpenAI / Gemini / Qwen / OpenRouter key, put it in that provider's field instead. Get an Anthropic key at console.anthropic.com → API keys.`);
    }
    if (k === 'PORT' && !/^\d{1,5}$/.test(v)) {
      errors.push(`PORT: must be 1-65535 — a whole number, digits only (the default is 4317); ${showVal(k, v)}.`);
    }
    if (k === 'PORT' && /^\d{1,5}$/.test(v) && (Number(v) < 1 || Number(v) > 65535)) {
      errors.push(`PORT: must be 1-65535 — ${v} is outside the valid TCP port range.`);
    }
    if (k === 'HOST' && !/^[a-zA-Z0-9.:_-]+$/.test(v)) {
      errors.push(`HOST: invalid hostname/ip — only letters, digits and the characters . : - _ are allowed (e.g. 127.0.0.1 for loopback, or 0.0.0.0 to expose on your LAN); ${showVal(k, v)}.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Update an .env file with the given key→value map. Preserves existing
 * order and comments; new keys append at the bottom under a marker.
 * Empty-string values DELETE the key from the file. Returns the list
 * of keys that were actually written.
 */
export function updateEnvFile(path, updates) {
  let text = '';
  if (existsSync(path)) {
    try { text = readFileSync(path, 'utf8'); } catch {}
  }
  const lines = text.split(/\r?\n/);
  const written = new Set();
  const toDelete = new Set();
  for (const [k, v] of Object.entries(updates)) {
    if (v === '' || v === null) toDelete.add(k);
  }

  const newLines = [];
  for (const line of lines) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!m) {
      newLines.push(line);
      continue;
    }
    const key = m[1];
    if (toDelete.has(key)) {
      // Drop the line entirely.
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      const v = updates[key];
      newLines.push(`${key}=${quoteIfNeeded(String(v))}`);
      written.add(key);
    } else {
      newLines.push(line);
    }
  }

  // Append any keys that weren't already in the file.
  const appended = [];
  for (const [k, v] of Object.entries(updates)) {
    if (toDelete.has(k)) continue;
    if (written.has(k)) continue;
    appended.push(`${k}=${quoteIfNeeded(String(v))}`);
    written.add(k);
  }
  if (appended.length) {
    if (newLines.length && newLines[newLines.length - 1] !== '') newLines.push('');
    newLines.push('# ── added via web-ui /#/config ──');
    newLines.push(...appended);
  }

  // Trim trailing blank lines but keep one final newline.
  while (newLines.length && newLines[newLines.length - 1] === '') newLines.pop();
  writeFileSync(path, newLines.join('\n') + '\n');
  return Array.from(written);
}

function quoteIfNeeded(v) {
  // Quote when the value has whitespace OR characters that confuse
  // shell-style env parsers.
  if (/[\s"'`$]/.test(v)) return '"' + v.replace(/"/g, '\\"') + '"';
  return v;
}
