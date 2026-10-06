/**
 * Taleo adapter (registry contract). Per-tenant ATS (Taleo Enterprise Edition).
 *
 * Matches an explicit `provider: taleo`, or any entry whose `api:` /
 * `careers_url` is a public TEE section URL
 * `https://<tenant>.taleo.net/careersection/<section>/jobsearch.ftl`
 * (HTTPS only; `tre.taleo.net` Business Edition is refused). The endpoint is
 * ALWAYS host-pinned: an explicit provider on a non-taleo host or a non-section
 * path yields a null endpoint.
 *
 *   tracked_companies:
 *     - name: ExampleCo
 *       careers_url: https://example.taleo.net/careersection/demo/jobsearch.ftl?lang=en
 *       taleo:
 *         fetchDetails: false  # optional JD enrichment
 *         detailLimit: 25      # 1..100
 *       enabled: true
 *
 * The HTTP fetch and normalization live in server/lib/sources/taleo.mjs.
 */
import { fetchTaleo, resolveBoard } from '../../sources/taleo.mjs';

export const taleoAdapter = {
  id: 'taleo',
  label: 'Taleo',
  matches(company) {
    if (!company) return false;
    if (company.provider === 'taleo') return true;
    return resolveBoard(company) !== null;
  },
  /**
   * @param {any} company
   * @returns {string|null} the public career-section URL, or null.
   */
  buildEndpoint(company) {
    const board = resolveBoard(company);
    return board ? board.url.href : null;
  },
  fetch: fetchTaleo,
};
