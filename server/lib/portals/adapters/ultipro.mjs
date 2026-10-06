/**
 * UKG Pro / UltiPro Recruiting adapter (registry contract). Per-tenant ATS.
 *
 * Matches an explicit `provider: ultipro`, or a `careers_url` / `api:` on a
 * `recruiting[N].ultipro.{com,ca}` host whose path carries
 * `/{tenant}/JobBoard/{boardId}`. An explicit, DIFFERENT provider always wins.
 * Look-alike hosts (`recruiting.ultipro.com.evil.com`) are not claimed.
 *
 *   tracked_companies:
 *     - name: Example
 *       careers_url: https://recruiting.ultipro.ca/EXA5001EXCO/JobBoard/<guid>/
 *       ultipro:
 *         fetchDetails: false  # optional full-JD enrichment
 *         detailLimit: 25      # 1..100
 *       enabled: true
 *
 * `buildEndpoint` returns the tenant's LoadSearchResults URL on the tenant's
 * own host (never rewritten to a canonical host), or null when the URL cannot
 * be pinned. The source re-asserts the host before any I/O. The paged POST walk
 * and the detail-page parsing live in server/lib/sources/ultipro.mjs.
 */
import { fetchUltipro, resolveTenant, buildListUrl } from '../../sources/ultipro.mjs';

export const ultiproAdapter = {
  id: 'ultipro',
  label: 'UKG Pro (UltiPro)',

  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider) return company.provider === 'ultipro';
    return resolveTenant(company) !== null;
  },

  /**
   * @param {any} company
   * @returns {string|null}
   */
  buildEndpoint(company) {
    const tenant = resolveTenant(company);
    return tenant ? buildListUrl(tenant) : null;
  },

  fetch: fetchUltipro,
};
