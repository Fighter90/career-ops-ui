/**
 * Source registry — single source of truth for every scanner adapter the
 * SPA and the regional dispatcher know about.
 *
 * Why this exists (v1.29.0):
 *   • Pre-v1.29 the source list was hardcoded in THREE places:
 *     - `public/js/views/scan.js` <option> elements for the filter dropdown
 *     - `server/lib/ru-scanner.mjs` if/then dispatcher block per source
 *     - the `default` for `russian_portals.sources` in `loadConfig()`
 *     Adding a fourth source (e.g. Trudvsem) meant three edits + the risk
 *     of forgetting one. The registry consolidates to one edit per new
 *     adapter.
 *
 * v1.69.0 (P-14) — DYNAMIC auto-discovery. Pre-v1.69 the SOURCES array
 * was a static hand-maintained list — adding a new adapter required
 * editing both `<id>.mjs` AND this file. Now every `*.mjs` in this
 * folder (other than `registry.mjs` itself) is auto-loaded at module
 * boot; each adapter contributes via its own `export const meta = {…}`
 * declaration. Drop a new file in `server/lib/sources/`, give it a
 * `meta` export, and it is instantly visible to the scanner, the SPA
 * dropdown, and the dispatcher — no edit to this file required.
 *
 * Backwards compatibility:
 *   - The public API (`SOURCES`, `SOURCES_BY_REGION`, `RU_CONFIG_KEYS`,
 *     `getRegionalSources`) is unchanged. Every existing import keeps
 *     working with no edit.
 *   - Discovery uses `readdirSync` + dynamic `import()` resolved at module
 *     evaluation via top-level await (Node 18+ ESM standard). The module
 *     consumers (en-scanner, ru-scanner, scan route) already handle the
 *     async module graph.
 *   - If an adapter file lacks a valid `meta` export it is silently
 *     skipped (warned once to stderr). This keeps `registry.mjs`
 *     resilient to half-migrated branches and lets contributors add
 *     helper-only files (e.g. a future `_test-fixtures.mjs`) without
 *     polluting the registry.
 *
 * Adapter `meta` contract (per-file `export const meta = {…}`):
 *   - value     : the user-visible source label that every adapter writes
 *                 to `job.source` after normalization. ALSO the value the
 *                 `#/scan` filter dropdown uses for `option.value`.
 *                 (Filter is `r.source === fs`, so these MUST match.)
 *   - label     : display label in the dropdown.
 *   - region    : 'en' (ATS sweep) | 'ru' (regional portals).
 *   - configKey : the key used in `portals.yml::russian_portals.sources`.
 *                 Required for RU sources, ignored for EN sources.
 *
 * Public API (unchanged):
 *   - SOURCES              — full array, ordered by region then label.
 *   - SOURCES_BY_REGION    — convenience indexed view.
 *   - RU_CONFIG_KEYS       — list of `configKey` strings for RU sources.
 *   - getRegionalSources() — same, but as `[{ value, label, configKey }]`.
 *   - discoverSources()    — NEW (v1.69.0). Exposed so tests can re-run
 *                            discovery against a custom directory and
 *                            verify drop-in behaviour without restarting
 *                            the process.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Sort sources: 'en' region first then 'ru', alphabetical by label inside
 * each region. Matches the pre-v1.69.0 hand-maintained ordering so the
 * dropdown order stays stable for users.
 */
function sortSources(arr) {
  return arr.slice().sort((a, b) => {
    if (a.region !== b.region) return a.region === 'en' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Validate one `meta` payload. Returns null if the shape is invalid;
 * the caller logs a warning and skips the file.
 */
function validateMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  if (typeof meta.value !== 'string' || !meta.value) return null;
  if (typeof meta.label !== 'string' || !meta.label) return null;
  if (meta.region !== 'en' && meta.region !== 'ru') return null;
  // RU sources MUST carry a configKey (russian_portals.sources references it).
  if (meta.region === 'ru' && (typeof meta.configKey !== 'string' || !meta.configKey)) {
    return null;
  }
  return {
    value: meta.value,
    label: meta.label,
    region: meta.region,
    ...(meta.configKey ? { configKey: meta.configKey } : {}),
  };
}

/**
 * Scan a directory for adapter modules and collect every valid `meta`
 * export. Exposed for tests so they can validate auto-discovery on a
 * temp directory with fixture adapters without restarting the server.
 *
 * @param {string} dir absolute path to the adapters directory.
 * @returns {Promise<Array<{ value, label, region, configKey? }>>}
 */
export async function discoverSources(dir = HERE) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  // Deterministic order before dynamic import so warnings are
  // reproducible across runs and CI logs diff cleanly.
  const files = entries
    // Underscore-prefixed files are shared helpers, not sources — the same
    // convention the parent's providers/ directory uses (`_safe-url.mjs`,
    // `_registry.mjs`). Skipping them here keeps a helper from being imported
    // as a candidate source and logged as "no valid meta" on every boot.
    .filter((f) => f.endsWith('.mjs') && f !== 'registry.mjs' && !f.startsWith('_'))
    .sort();
  for (const f of files) {
    let mod;
    try {
      // Convert the absolute path to a file:// URL so Windows + POSIX
      // both produce a valid, cacheable ESM specifier.
      mod = await import(pathToFileURL(join(dir, f)).href);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[sources/registry] failed to import ${f}: ${e.message}`);
      continue;
    }
    const valid = validateMeta(mod.meta);
    if (!valid) {
      // eslint-disable-next-line no-console
      console.warn(`[sources/registry] ${f} has no valid \`export const meta\` — skipped`);
      continue;
    }
    out.push(valid);
  }
  return sortSources(out);
}

export const SOURCES = await discoverSources();

export const SOURCES_BY_REGION = {
  en: SOURCES.filter((s) => s.region === 'en'),
  ru: SOURCES.filter((s) => s.region === 'ru'),
};

/** Config-key strings for RU sources, in registry order. Used as the
 *  fallback when `russian_portals.sources` is missing from portals.yml. */
export const RU_CONFIG_KEYS = SOURCES_BY_REGION.ru.map((s) => s.configKey);

/** Returns the RU sub-array with just the fields the dispatcher cares about. */
export function getRegionalSources() {
  return SOURCES_BY_REGION.ru.map(({ value, label, configKey }) => ({
    value, label, configKey,
  }));
}
