/**
 * NEOGOV adapter (registry contract).
 *
 * Detects a NEOGOV agency from a `careers_url` on `www.schooljobs.com` or
 * `www.governmentjobs.com` (bare hosts normalised to `www.`, HTTPS only)
 * shaped `/careers/<agency>[/<folder>]`, or from an explicit
 * `provider: neogov` — but the endpoint is ALWAYS host-pinned: an explicit
 * provider on any other host still yields a null endpoint.
 *
 * The endpoint is page 1 of the agency's `/careers/home/index` HTML list; the
 * source re-parses and re-validates it before any I/O, then walks the pages.
 * The HTTP fetch + HTML parsing lives in server/lib/sources/neogov.mjs.
 *
 *   tracked_companies:
 *     - name: Example College
 *       careers_url: https://www.schooljobs.com/careers/exampleco/facultypositions
 *       max_pages: 30   # optional, 10 postings per page, capped at 200
 *       enabled: true
 */
import { fetchNeogov, resolveTarget, buildPageUrl } from '../../sources/neogov.mjs';

export const neogovAdapter = {
  id: 'neogov',
  label: 'NEOGOV (SchoolJobs / GovernmentJobs)',
  matches(company) {
    if (company && company.provider === 'neogov') return true;
    return resolveTarget(company) !== null;
  },
  /**
   * @param {any} company
   * @returns {string|null} the page-1 list URL, or null when the careers_url
   *   is not an HTTPS NEOGOV `/careers/<agency>` URL.
   */
  buildEndpoint(company) {
    const t = resolveTarget(company);
    return t ? buildPageUrl(t, 1) : null;
  },
  fetch: fetchNeogov,
};
