/**
 * Read / write the career-ops project's .env file in place. Used by the
 * /api/config endpoint so the user can edit ANTHROPIC_API_KEY, GEMINI_API_KEY,
 * etc. through the UI and have BOTH the CLI scripts (read by node) AND
 * web-ui (read by dotenv-loader) pick them up.
 *
 * Preserves existing comments and ordering; only the keys we touch are
 * rewritten, everything else passes through unchanged.
 */
import { readFileSync, existsSync, openSync, fchmodSync, writeSync, closeSync } from 'node:fs';
import { parseEnvLine } from './dotenv.mjs';
import { isPrivateOrLoopbackHost } from './security.mjs';

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
  'GITHUB_MODELS_API_KEY', // headless live-eval via GitHub Models (v1.74.0) — GitHub Copilot CLI's API surface; a GitHub PAT with the `models` scope, OpenAI-compatible
  'GITHUB_MODELS_MODEL',
  'HERMES_API_KEY',        // headless live-eval via a local Hermes API Server (v1.151.0) — Nous Research's `hermes gateway` exposes an OpenAI-compatible /v1/chat/completions (Bearer API_SERVER_KEY)
  'HERMES_BASE_URL',       // Hermes API Server base (default http://127.0.0.1:8642/v1); change if you set API_SERVER_PORT
  'HERMES_MODEL',          // Hermes profile / model id (default `hermes-agent`)
  // ── Extended provider roster (v1.216.0) — OpenAI-compatible vendors, one
  //    key each; all reach the shared runOpenAICompatible core. ──
  'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL',
  'ZAI_API_KEY', 'ZAI_MODEL', 'ZAI_BASE_URL',               // GLM (Z.ai); BASE_URL for the CN endpoint
  'MOONSHOT_API_KEY', 'MOONSHOT_MODEL', 'MOONSHOT_BASE_URL', // Kimi (Moonshot); BASE_URL for the CN endpoint
  'MINIMAX_API_KEY', 'MINIMAX_MODEL',
  'MISTRAL_API_KEY', 'MISTRAL_MODEL',
  'XAI_API_KEY', 'XAI_MODEL',                                // Grok (xAI)
  'TOGETHER_API_KEY', 'TOGETHER_MODEL',                      // Together AI (open-weight, incl. Inkling)
  'FIREWORKS_API_KEY', 'FIREWORKS_MODEL',                    // Fireworks AI (open-weight)
  'OLLAMA_BASE_URL', 'OLLAMA_MODEL', 'OLLAMA_API_KEY',       // fully local; OLLAMA_BASE_URL is the opt-in signal (no key)
  'ARK_API_KEY', 'ARK_MODEL', 'ARK_BASE_URL',                // v1.217.0 — BytePlus Ark (intl)
  'ARK_CN_API_KEY', 'ARK_CN_MODEL', 'ARK_CN_BASE_URL',       // v1.217.0 — Volcengine Ark (China)
  // ── Server runtime ──
  'PORT',
  'HOST',
];

// The auto-cascade tail after the built-in seven (v1.216.0). A pinned
// LLM_PROVIDER returns just `[slug]`; `auto` walks the whole order and uses the
// first provider whose key is set. Ollama is last — it's local/opt-in.
export const AUTO_ORDER = [
  'anthropic', 'gemini', 'openai', 'qwen', 'openrouter', 'github', 'hermes',
  'deepseek', 'zai', 'kimi', 'minimax', 'mistral', 'grok', 'together', 'fireworks', 'ollama',
  'ark', 'arkcn',
];
// Slugs whose LLM_PROVIDER pin value equals the internal provider name
// (unlike `claude`→`anthropic`). Pinning any of these returns just itself.
const SELF_NAMED_PINS = new Set([
  'openai', 'qwen', 'openrouter', 'github', 'hermes',
  'deepseek', 'zai', 'kimi', 'minimax', 'mistral', 'grok', 'together', 'fireworks', 'ollama',
  'ark', 'arkcn',
]);

/**
 * Valid LLM_PROVIDER values. `auto` = first provider whose key is set,
 * preferring Anthropic → Gemini → OpenAI → Qwen. Explicit values pin
 * one provider; with no key it falls through to the manual-prompt
 * path exactly like the pre-v1.39 no-key behaviour.
 */
export const LLM_PROVIDERS = ['auto', 'claude', 'gemini', 'openai', 'qwen', 'openrouter', 'github', 'hermes', 'deepseek', 'zai', 'kimi', 'minimax', 'mistral', 'grok', 'together', 'fireworks', 'ollama', 'ark', 'arkcn'];

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
  if (v === 'claude') return ['anthropic'];       // pin value ≠ internal name
  if (v === 'gemini') return ['gemini'];
  if (SELF_NAMED_PINS.has(v)) return [v];         // openai/qwen/…/ollama pin to themselves
  // Everything after Anthropic/Gemini/OpenAI/Qwen sits at the TAIL of the auto
  // order: a user who already had one of those working keeps that exact routing;
  // the rest only kick in when one is the sole configured key. Ollama is last
  // (a local gateway you opt into by setting OLLAMA_BASE_URL).
  return AUTO_ORDER;
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
  const order = providerOrder(env);
  const pick = order.find((p) => set.has(p));
  if (pick) return pick;
  // v1.157.0 — a pinned LLM_PROVIDER whose key isn't configured must NOT dead-end
  // when OTHER providers ARE configured. A user who ran `init` with Claude Code
  // gets `LLM_PROVIDER=claude`; if they later add only, say, OPENROUTER_API_KEY,
  // the stale pin used to force manual mode. Fall back to the auto order among
  // the configured keys so "set any provider key and it works" holds.
  if (order.length === 1) {
    return AUTO_ORDER.find((p) => set.has(p)) || null;
  }
  return null;
}

/**
 * Group classification for the SPA config view (F-013). v1.19.0 collapsed
 * to two groups: `core` (LLM keys) and `runtime` (PORT/HOST). The
 * previous "regional" group (only HH_USER_AGENT) was removed in v1.19.0;
 * as of v1.65.0 hh.ru is scraped from its public website with a fixed
 * browser User-Agent and needs no env configuration at all.
 */
/**
 * CONFIG-1 (v1.232.0) — fields whose value set is CLOSED, i.e. owned by this
 * codebase rather than by a vendor. Only these are enforced on write.
 *
 * `LLM_PROVIDER` is the whole list today, and `LLM_PROVIDERS` above has always
 * held it — the validator simply never consulted it, which is how
 * `LLM_PROVIDER=not-a-provider` came to be written to a user's .env and
 * answered with 200. The model dropdowns are deliberately NOT here: their real
 * domain is the vendor's catalogue, which moves between our releases, so
 * enforcing our curated list would block a model the provider already serves.
 * A wrong model also fails loudly at call time; a wrong provider fails
 * silently, because the resolver just falls back.
 */
const CLOSED_DOMAINS = { LLM_PROVIDER: LLM_PROVIDERS };

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
  GITHUB_MODELS_API_KEY: 'core',
  GITHUB_MODELS_MODEL: 'core',
  HERMES_API_KEY: 'core',
  HERMES_BASE_URL: 'core',
  HERMES_MODEL: 'core',
  PORT: 'runtime',
  HOST: 'runtime',
};
// v1.216.0 — every provider key added above is a `core` (LLM) key. Assign them
// here so the roster stays maintainable (PORT/HOST keep their explicit
// 'runtime' group; anything already classified is left untouched).
for (const k of KNOWN_KEYS) {
  if (!(k in KEY_GROUPS)) KEY_GROUPS[k] = 'core';
}

/** Keys whose values are secret and must never be returned in plain text.
 *  Ollama has no key (OLLAMA_BASE_URL is a shown URL, not a secret); its
 *  optional OLLAMA_API_KEY is still treated as secret in case a proxied Ollama
 *  needs one. */
export const SECRET_KEYS = new Set([
  'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY',
  'OPENROUTER_API_KEY', 'GITHUB_MODELS_API_KEY', 'HERMES_API_KEY',
  'DEEPSEEK_API_KEY', 'ZAI_API_KEY', 'MOONSHOT_API_KEY', 'MINIMAX_API_KEY',
  'MISTRAL_API_KEY', 'XAI_API_KEY', 'TOGETHER_API_KEY', 'FIREWORKS_API_KEY',
  'OLLAMA_API_KEY',
  'ARK_API_KEY',
  'ARK_CN_API_KEY',
]);

/**
 * Parse an .env file body into a plain object, line by line with the
 * dotenv-compatible rules in parseEnvLine (comments, `export`, quotes).
 */
export function parseEnv(text) {
  const out = {};
  if (!text) return out;
  for (const raw of text.split(/\r?\n/)) {
    const entry = parseEnvLine(raw);
    if (entry) out[entry.key] = entry.value;
  }
  return out;
}

/**
 * v1.54.9 — effective value of an env key for runtime LLM routing.
 *
 * The server reads keys from `process.env`, which is a SNAPSHOT taken
 * at boot. If the user later sets `ANTHROPIC_API_KEY` in the
 * `.env` (or it was added after the server started) the running
 * process never sees it → `hasAnthropicKey()` is false, evaluation
 * silently falls through to whatever stale key IS in process.env
 * (often an old/invalid `GEMINI_API_KEY`) and the user gets a
 * "Gemini API key not valid" error despite Anthropic being set.
 *
 * Resolution order, matching user expectation ("use whichever keys
 * are actually set"): a non-empty `process.env` value wins (covers
 * shell exports and the live-apply in POST /api/config), otherwise
 * the current `.env` file is consulted. This also removes the
 * asymmetry where the Gemini path (a Node subprocess) already
 * read the `.env` while the in-process Anthropic path did not.
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
export function isUsableKey(raw, minLen = 20) {
  if (typeof raw !== 'string') return false;
  const v = raw.trim();
  // v1.151.1 — `minLen` defaults to 20 (cloud keys are comfortably longer), but
  // a self-hosted Hermes gateway key (`API_SERVER_KEY`) is user-chosen and may be
  // short (the Hermes docs' own example `change-me-local-dev` is 19 chars), so
  // `hasHermesKey` passes a lower floor. The placeholder rejections below still apply.
  if (v.length < minLen) return false;                   // too short to be a real key
  if (/^your_.*_here$/i.test(v)) return false;           // shipped-template form (matches maskSecret)
  if (/_here$/i.test(v)) return false;
  if (/^(your[_-]|changeme|placeholder|example|sk-xxx|todo$|none$|null$|test[_-]?key|enter[_-]|add[_-]your)/i.test(v)) return false;
  if (/^<.*>$/.test(v)) return false;                    // <your-key-here> angle form
  if (/^(.)\1+$/.test(v)) return false;                  // a single repeated char
  return true;
}

/**
 * Where each user-settable `*_BASE_URL` may point. These URLs receive the
 * provider's API key as a Bearer token, and POST /api/config writes them — so
 * an arbitrary value would let anyone who can reach the config form (or edit
 * .env) redirect the key to their own server.
 *   vendor — https, and the host is one of the vendor's registrable domains
 *            (or a subdomain); the region split (intl vs CN) stays possible.
 *   local  — a self-hosted gateway (Hermes, Ollama): loopback, a private /
 *            CGNAT address, or a LAN-style name (single label, .local, .lan,
 *            .internal, .home.arpa). Link-local (169.254/16, fe80::/10, which
 *            includes cloud metadata) is refused.
 */
export const BASE_URL_POLICIES = {
  ZAI_BASE_URL: { vendor: ['z.ai', 'bigmodel.cn'] },
  MOONSHOT_BASE_URL: { vendor: ['moonshot.ai', 'moonshot.cn'] },
  ARK_BASE_URL: { vendor: ['bytepluses.com', 'volces.com'] },
  ARK_CN_BASE_URL: { vendor: ['volces.com', 'bytepluses.com'] },
  HERMES_BASE_URL: { local: true },
  OLLAMA_BASE_URL: { local: true },
};

const LAN_SUFFIXES = ['.local', '.lan', '.internal', '.home.arpa', '.localhost'];

function isLocalGatewayHost(hostname) {
  const h = hostname.replace(/^\[|\]$/g, '');
  if (/^169\.254\./.test(h) || /^fe[89ab][0-9a-f]:/i.test(h)) return false;
  if (isPrivateOrLoopbackHost(h)) return true;
  if (/^[\d.]+$/.test(h) || h.includes(':')) return false; // a public IP literal
  return !h.includes('.') || LAN_SUFFIXES.some((s) => h.endsWith(s));
}

/**
 * Why `value` is not an acceptable `key` base URL — or null when it is (or when
 * the key has no policy, or the value is empty = "use the default").
 * @param {string} key
 * @param {unknown} value
 * @returns {string|null}
 */
export function checkBaseUrl(key, value) {
  const policy = BASE_URL_POLICIES[key];
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!policy || !raw) return null;
  let u;
  try { u = new URL(raw); } catch { return 'not a valid URL'; }
  if (u.username || u.password) return 'must not contain credentials';
  const host = u.hostname.toLowerCase().replace(/\.+$/, '');
  if (policy.vendor) {
    if (u.protocol !== 'https:') return 'must use https://';
    if (!policy.vendor.some((d) => host === d || host.endsWith('.' + d))) {
      return `host ${host} is not an official endpoint (allowed: ${policy.vendor.map((d) => '*.' + d).join(', ')})`;
    }
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'must use http:// or https://';
  if (!isLocalGatewayHost(host)) {
    return `host ${host} is not local — a self-hosted gateway must be on this machine or your private network`;
  }
  return null;
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
export function validateConfig(body, current = {}) {
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
    if (!isEnvRepresentable(v)) {
      errors.push(`${k}: cannot be saved — the value contains all three quote characters (" ' \`), which a .env file cannot represent. Remove one kind of quote.`);
    }
    const baseUrlProblem = checkBaseUrl(k, v);
    if (baseUrlProblem) {
      errors.push(`${k}: ${baseUrlProblem} — ${showVal(k, v)}. This URL receives the provider API key, so it is restricted.`);
    }
    if (/[\r\n]/.test(v)) {
      errors.push(`${k}: must not contain newlines — the value spans more than one line. Re-paste it as a single line (a stray line break is the usual cause).`);
    }
    // CONFIG-1 (v1.232.0) — a closed-domain field may only carry one of its own
    // values. Before this the validator knew the key NAMES but not their
    // domains, so `LLM_PROVIDER=not-a-provider` was written straight to .env
    // and answered with 200, after which the resolver fell back silently and
    // the user's chosen provider had no effect while everything looked fine.
    //
    // A value that is ALREADY stored is grandfathered. The config form resends
    // every non-secret field on every Save, touched or not, so rejecting a
    // pre-existing bad value outright would freeze the whole page: the user
    // could no longer change anything else until they fixed a field they never
    // touched. Refusing only CHANGES still blocks the reported defect — a new
    // bad value cannot get in — while leaving an existing one repairable
    // through the dropdown, which offers valid options only.
    const domain = CLOSED_DOMAINS[k];
    if (domain && !domain.includes(v) && v !== current[k]) {
      errors.push(`${k}: not an allowed value — ${showVal(k, v)}, which is not one of the options for this setting. Choose one of: ${domain.join(', ')}.`);
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
    const m = line.match(/^(\s*export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!m) {
      newLines.push(line);
      continue;
    }
    const exportPrefix = m[1] ? 'export ' : '';
    const key = m[2];
    if (toDelete.has(key)) {
      // Drop the line entirely.
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      const v = updates[key];
      newLines.push(`${exportPrefix}${key}=${quoteIfNeeded(String(v))}`);
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
  // The file holds API keys: owner-only. `mode` applies when the file is
  // created; chmod tightens an existing 0644 .env on the next Save.
  // One descriptor for mode + content: chmod-by-path after the write was a
  // check-then-act race (the path could be swapped between the two calls).
  const fd = openSync(path, 'w', 0o600);
  try {
    try { fchmodSync(fd, 0o600); } catch { /* e.g. a filesystem without POSIX modes */ }
    writeSync(fd, newLines.join('\n') + '\n');
  } finally {
    closeSync(fd);
  }
  return Array.from(written);
}

/**
 * Quote a value so the parent's dotenv (and parseEnvLine) read it back
 * unchanged. dotenv has no escape for a quote inside quotes (`"a\"b"` reads as
 * `a\"b`) and expands `\n` inside double quotes, so instead of escaping we pick
 * a quote character the value does not contain: double, then single, then
 * backtick. A value holding all three cannot be represented — validateConfig
 * refuses it before it gets here.
 */
function quoteIfNeeded(v) {
  // Quote when the value has whitespace, a comment marker, a quote, `$` or a
  // backslash — anything a dotenv-style reader would not take literally.
  if (!/[\s"'`$#\\]/.test(v)) return v;
  if (!v.includes('"') && !v.includes('\\')) return `"${v}"`;
  if (!v.includes("'")) return `'${v}'`;
  if (!v.includes('`')) return `\`${v}\``;
  throw new Error('value contains all three quote characters and cannot be written to .env');
}

/** True when quoteIfNeeded can represent `v` (see above). */
export function isEnvRepresentable(v) {
  return !(v.includes('"') && v.includes("'") && v.includes('`'));
}
