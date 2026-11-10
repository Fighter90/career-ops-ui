/**
 * ADP myjobs adapter (registry contract). Ported with the parent's
 * providers/adp-myjobs.mjs (upstream #6678, CAR-254).
 *
 * ADP Recruiting Management career sites live at
 * `https://myjobs.adp.com/{site}/cx/...` and auto-detect from any
 * myjobs.adp.com URL whose first path segment is the career-site slug
 * (`resolveSite` does the https + exact-host + reserved-segment checks and
 * null-guards the entry itself). `provider: adp-myjobs` is accepted as an
 * explicit override. Distinct from adp-workforcenow, a different ADP
 * product on a different host.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: ExampleCo
 *       careers_url: https://myjobs.adp.com/examplesite/cx/job-listing
 *       # optional: skip the orgoid lookup, or enrich from detail pages
 *       adpMyjobs:
 *         orgoid: 0F18AC8F6B800272
 *         fetchDetails: false
 *         detailLimit: 25
 *       enabled: true
 *
 * buildEndpoint returns the page-0 list API URL (the source re-derives the
 * site slug from the entry and re-asserts the host), or null when no site
 * slug can be derived — resolveAdapter treats null as no endpoint
 * (fail-soft per company).
 *
 * The HTTP fetch and parsing live in server/lib/sources/adp-myjobs.mjs.
 */
import { fetchAdpMyjobs, resolveSite, buildListUrl } from '../../sources/adp-myjobs.mjs';

export const adpMyjobsAdapter = {
  id: 'adp-myjobs',
  label: 'ADP myjobs',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'adp-myjobs') return true;
    return !!resolveSite(company);
  },
  /**
   * @param {any} company
   * @returns {string|null} the page-0 list API URL, or null when no
   *   career-site slug can be derived.
   */
  buildEndpoint(company) {
    return resolveSite(company) ? buildListUrl(0) : null;
  },
  fetch: fetchAdpMyjobs,
};
