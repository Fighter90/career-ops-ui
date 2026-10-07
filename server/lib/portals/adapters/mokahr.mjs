/**
 * MokaHR adapter (registry contract).
 *
 * Per-tenant; the careers_url carries both the org slug and the numeric site
 * ID, which the request body needs:
 *
 *   tracked_companies:
 *     - name: Acme
 *       provider: mokahr
 *       careers_url: https://app.mokahr.com/social-recruitment/acme/12345
 *       keywords: ["产品经理"]   # optional — server-side search
 *
 * The source-level `parseTenantUrl` is the SSRF guard: HTTPS-only, host pinned
 * to app.mokahr.com, a positive site ID, and two tenants refused outright
 * because their robots.txt excludes the careers path.
 */
import { fetchMokaHr, buildMokaHrUrl, parseTenantUrl } from '../../sources/mokahr.mjs';

/**
 * The entry with `careers_url` set to the first of careers_url / api that is a
 * valid tenant URL. matches() accepts the tenant URL in either field, but the
 * source reads `careers_url ?? api`, so an unrelated careers_url (the company
 * homepage) used to hide a valid api and throw.
 * @param {any} company
 */
function withTenantUrl(company) {
  if (!company || typeof company !== 'object') return company;
  if (parseTenantUrl(company.careers_url) || !parseTenantUrl(company.api)) return company;
  return { ...company, careers_url: company.api };
}

export const mokahrAdapter = {
  id: 'mokahr',
  label: 'MokaHR',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'mokahr') return true;
    return !!parseTenantUrl(company.careers_url) || !!parseTenantUrl(company.api);
  },
  // `string | null` contract: a refused entry is "no endpoint", never a throw
  // that aborts the whole scan.
  buildEndpoint(company) {
    try {
      return buildMokaHrUrl(withTenantUrl(company));
    } catch {
      return null;
    }
  },
  // The source reads `careers_url ?? api`, so hand it the entry with the URL
  // that actually parses — matches() accepts either.
  fetch(url, opts = {}) {
    return fetchMokaHr(url, { ...opts, company: withTenantUrl(opts.company) });
  },
};
