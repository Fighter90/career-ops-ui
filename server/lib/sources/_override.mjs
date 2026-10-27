/**
 * Shared endpoint-override pin for board adapters (FULL-M3).
 *
 * The aggregator/board adapters accept a portals.yml endpoint override
 * (`api:` / `company.<id>`) for testing or a mirror. Before this module most
 * of them passed the override straight into the fetch slot — any http(s) URL
 * reached the scanner transport, pinned (if at all) only afterwards by the
 * source's own assert. portals.yml is API-writable (`POST /api/portals/track`),
 * so the override is attacker-influenced input and the pin belongs where the
 * URL is chosen, not only at the fetch.
 *
 * Contract (the established nodesk / larajobs / cryptocurrencyjobs pattern,
 * extracted so every board adapter shares one implementation):
 *   - a string that parses as an HTTPS URL whose hostname matches `hostRe`
 *     is returned (trimmed) as the endpoint;
 *   - anything else — off-host, an http downgrade, a trailing-dot FQDN, a
 *     non-string, garbage — is null, and the caller falls back to the
 *     canonical endpoint.
 *
 * `hostRe` must mirror the source's own fetch-time assert exactly, so an
 * override the adapter accepts can never be rejected by the fetch-time guard.
 *
 * Pure — no fetch, no network, no parent-project dependency. The sources
 * registry skips `_`-prefixed files, so this module is never loaded as a
 * source.
 */

/**
 * Validate a config-supplied endpoint override against its board's host rule.
 * @param {unknown} raw the override value (typically `company.api` / `company.<id>`)
 * @param {RegExp} hostRe exact-host allowlist (e.g. /^jobspresso\.co$/i)
 * @returns {string|null} the usable override, or null to fall back
 */
export function pinnedOverride(raw, hostRe) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!hostRe.test(parsed.hostname)) return null;
  return raw.trim();
}
