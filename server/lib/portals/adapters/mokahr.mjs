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

export const mokahrAdapter = {
  id: 'mokahr',
  label: 'MokaHR',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'mokahr') return true;
    return !!parseTenantUrl(company.careers_url) || !!parseTenantUrl(company.api);
  },
  buildEndpoint(company) {
    return buildMokaHrUrl(company);
  },
  fetch: fetchMokaHr,
};
