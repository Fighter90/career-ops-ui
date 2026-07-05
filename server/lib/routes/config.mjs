/**
 * App-settings routes — reads and writes the parent project's .env so
 * career-ops Node scripts AND web-ui's dotenv loader pick up the same
 * source.
 *
 *   GET  /api/config → { envFile, keys, secretKeys, values }
 *   POST /api/config → writes KNOWN_KEYS only, applies live to process.env
 *
 * Secret keys are masked on read. Empty string deletes a key. Validation
 * via env-config.validateConfig — unknown keys are silently dropped to
 * prevent attacker-supplied env vars.
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PATHS } from '../paths.mjs';
import yaml from 'js-yaml';
import {
  KNOWN_KEYS,
  KEY_GROUPS,
  SECRET_KEYS,
  parseEnv,
  maskSecret,
  validateConfig,
  normalizeConfigValue,
  updateEnvFile,
} from '../env-config.mjs';

/**
 * F-013 — Is at least one regional source configured in portals.yml?
 * If not, the SPA hides the "Regional sources" group entirely. Read fresh
 * on every /api/config request so the user adding a regional source
 * doesn't require a restart.
 */
function regionalSourcesPresent() {
  try {
    if (!existsSync(PATHS.portals)) return false;
    const data = yaml.load(readFileSync(PATHS.portals, 'utf8')) || {};
    const rp = data.russian_portals;
    if (!rp || rp.enabled === false) return false;
    const sources = Array.isArray(rp.sources) ? rp.sources : [];
    return sources.length > 0;
  } catch { return false; }
}

export function registerConfigRoutes(app) {
  app.get('/api/config', (_req, res) => {
    let parsed = {};
    if (existsSync(PATHS.envFile)) {
      try { parsed = parseEnv(readFileSync(PATHS.envFile, 'utf8')); } catch {}
    }
    const out = {};
    for (const k of KNOWN_KEYS) {
      const live = process.env[k];
      // Prefer the on-disk value (what the user just saved); fall back
      // to whatever's currently in process.env (set via shell).
      const v = parsed[k] !== undefined ? parsed[k] : live;
      out[k] = SECRET_KEYS.has(k) ? maskSecret(v) : (v || '');
    }
    res.json({
      envFile: PATHS.envFile,
      keys: KNOWN_KEYS,
      secretKeys: [...SECRET_KEYS],
      groups: KEY_GROUPS,
      regionalActive: regionalSourcesPresent(),
      values: out,
    });
  });

  app.post('/api/config', (req, res) => {
    // v1.57.2 — the SPA's API client (public/js/api.js) auto-attaches a
    // `lang` field to EVERY JSON POST body so LLM-bound routes can pick
    // up the UI locale. /api/config is NOT an LLM route and `lang` is
    // not a config key, but validateConfig's (correct, security-relevant)
    // unknown-key rejection then 400'd every Save with
    // "validation failed — lang: not a known config key". That was the
    // real, browser-only "validation failed" users hit (curl/fetch
    // repros never sent `lang`, so it stayed hidden). `lang` is a
    // transport concern — strip it here BEFORE validating; the
    // KNOWN_KEYS write-filter below already drops anything unknown, so
    // the attacker-injection guard is unchanged for genuine stray keys.
    const body = { ...(req.body || {}) };
    delete body.lang;
    const v = validateConfig(body);
    if (!v.ok) return res.status(400).json({ error: 'validation failed', details: v.errors });
    // Filter to known keys only — never write attacker-supplied env
    // vars. Normalize (trim) every value so a key pasted with a
    // trailing newline / stray spaces is stored clean and authenticates
    // at runtime (v1.57.0 BF).
    const safe = {};
    for (const k of KNOWN_KEYS) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        safe[k] = normalizeConfigValue(body[k]);
      }
    }
    try {
      mkdirSync(dirname(PATHS.envFile), { recursive: true });
    } catch {}
    // BF-2 — wrap updateEnvFile so a permission-denied or read-only
    // filesystem returns a clean 500 with a useful message instead of
    // an unhandled rejection bubbling to the default Express handler.
    let written;
    try {
      written = updateEnvFile(PATHS.envFile, safe);
    } catch (e) {
      return res.status(500).json({
        error: 'failed to write parent .env',
        details: [e.message],
      });
    }
    // Apply to the running process so the change takes effect immediately
    // (no restart needed). Iterate the SAFE map (not just written) so
    // empty-string requests delete the corresponding process.env var
    // even though updateEnvFile reports them as "deleted" rather than
    // "written".
    for (const [k, val] of Object.entries(safe)) {
      // `safe` keys are allowlisted env names, but guard against prototype keys
      // defensively so a property write can never target the prototype chain.
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (val === '' || val == null) delete process.env[k];
      else process.env[k] = val;
    }
    res.json({ ok: true, written });
  });
}
