/**
 * Eploy adapter (registry contract). Per-tenant ATS.
 *
 * Eploy careers sites run on arbitrary branded domains (careers.example.com)
 * as well as `<tenant>.eploy.net`. Branded hosts share no suffix, so a URL
 * alone cannot tell an Eploy site from a lookalike. For that reason this
 * adapter is explicit-only, like the parent provider's `detect()`: it matches
 * `provider: eploy` and nothing else.
 *
 * The endpoint is the tenant's public `/live-jobs.xml` sitemap, built from the
 * entry's `careers_url` origin. `resolveEployOrigin` refuses anything that is
 * not a public HTTPS hostname (IP literals, loopback, internal names,
 * credentials, custom ports), so buildEndpoint returns null for those and an
 * unsafe value never reaches the fetch slot. The source re-checks the origin
 * before any I/O.
 *
 *   tracked_companies:
 *     - name: Example employer
 *       provider: eploy
 *       careers_url: https://careers.example.com/vacancies/
 *       eploy:
 *         fetchDetails: false  # optional detail enrichment
 *         detailLimit: 25      # 1..100
 *       enabled: true
 *
 * The HTTP fetch and XML/HTML parsing live in server/lib/sources/eploy.mjs.
 */
import { fetchEploy, resolveEployOrigin, buildFeedUrl } from '../../sources/eploy.mjs';

export const eployAdapter = {
  id: 'eploy',
  label: 'Eploy',
  matches(company) {
    return !!company && company.provider === 'eploy';
  },
  /**
   * @param {any} company
   * @returns {string|null} the live-jobs sitemap URL, or null when the
   *   careers_url is not a public HTTPS URL.
   */
  buildEndpoint(company) {
    const origin = resolveEployOrigin(company && company.careers_url);
    return origin ? buildFeedUrl(origin) : null;
  },
  fetch: fetchEploy,
};
