/**
 * Torre adapter (registry contract).
 *
 * A board-wide aggregator (the public opportunity search behind torre.ai), so
 * it matches ONLY on an explicit `provider: torre` field — never on careers_url.
 * The endpoint is the fixed public search endpoint, overridable via `torre:` /
 * `api:` (host-pinned to search.torre.co) for testing or a mirror. The
 * source-level assertTorreUrl is the hard SSRF guard; pinning the override here
 * too keeps an off-host value out of the fetch slot.
 *
 *   tracked_companies:
 *     - name: Torre
 *       provider: torre
 *       search: engineering manager   # → skill/role filter (recommended)
 *       experience: 1-plus-year       # required companion to search
 *       remote_only: true             # optional
 *       enabled: true
 */
import { fetchTorre, SEARCH_ENDPOINT } from '../../sources/torre.mjs';

// Exact host match — mirrors the source's assertTorreUrl so an override the
// adapter accepts can never be rejected later by the fetch-time guard.
const TORRE_HOST_RE = /^search\.torre\.co$/i;

export const torreAdapter = {
  id: 'torre',
  label: 'Torre',
  matches(company) {
    return !!company && company.provider === 'torre';
  },
  buildEndpoint(company) {
    const override = company && (company.torre || company.api);
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && TORRE_HOST_RE.test(u.hostname)) return override;
      } catch { /* fall through to the canonical endpoint */ }
    }
    return SEARCH_ENDPOINT;
  },
  fetch: fetchTorre,
};
