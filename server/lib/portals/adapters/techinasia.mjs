/**
 * Tech in Asia adapter (registry contract).
 *
 * A board aggregator (the techinasia.com jobs UI's own Algolia index), so it
 * matches ONLY on an explicit `provider: techinasia` field — never on a
 * careers_url. The endpoint is the fixed /jobs/search URL (it pins the host
 * the credential discovery runs against), overridable via `api:` /
 * `techinasia.api` host-pinned to www.techinasia.com for testing or a mirror.
 * The source-level assertTechinasiaHost is the hard SSRF guard; pinning the
 * override here too keeps an off-host value out of the fetch slot entirely.
 *
 *   tracked_companies:
 *     - name: Tech in Asia
 *       provider: techinasia
 *       enabled: true
 */
import { fetchTechInAsia, SEARCH_PAGE_URL, SITE_HOST } from '../../sources/techinasia.mjs';

export const techinasiaAdapter = {
  id: 'techinasia',
  label: 'Tech in Asia',
  matches(company) {
    if (!company) return false;
    return company.provider === 'techinasia';
  },
  buildEndpoint(company) {
    const override = company.api;
    if (typeof override === 'string' && override.trim()) {
      try {
        const u = new URL(override.trim());
        if (u.protocol === 'https:' && u.hostname === SITE_HOST) return u.href;
      } catch {
        /* fall through to the canonical search page */
      }
    }
    return SEARCH_PAGE_URL;
  },
  fetch: fetchTechInAsia,
};
