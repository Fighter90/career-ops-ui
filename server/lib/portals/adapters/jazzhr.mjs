/**
 * JazzHR adapter (registry contract). Per-tenant ATS.
 *
 * Detects a JazzHR (ApplyToJob) tenant from a `careers_url`/`api:` whose host
 * matches `<tenant>.applytojob.com`, or from an explicit `provider: jazzhr`.
 * The endpoint is always the canonical board `https://<host>/apply`, rebuilt
 * from the hostname alone (path and port are discarded). There is no public
 * tenant directory, so this is driven purely from `tracked_companies:`.
 *
 *   tracked_companies:
 *     - name: Example Co
 *       provider: jazzhr
 *       careers_url: https://exampleco.applytojob.com/apply
 *       jazzhr:
 *         fetchDetails: false  # optional JSON-LD description + date
 *         detailLimit: 25      # 1..100
 *
 * The HTTP fetch and HTML parsing live in server/lib/sources/jazzhr.mjs.
 */
import { fetchJazzHR, resolveOrigin, boardUrl } from '../../sources/jazzhr.mjs';

export const jazzhrAdapter = {
  id: 'jazzhr',
  label: 'JazzHR',
  matches(company) {
    if (!company) return false;
    if (company.provider === 'jazzhr') return true;
    return resolveOrigin(company) !== null;
  },
  /**
   * @param {any} company
   * @returns {string|null} the board URL, or null when the host is untrusted.
   */
  buildEndpoint(company) {
    const origin = resolveOrigin(company);
    return origin ? boardUrl(origin) : null;
  },
  fetch: fetchJazzHR,
};
