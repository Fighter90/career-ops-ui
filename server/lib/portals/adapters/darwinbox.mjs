/**
 * Darwinbox adapter (registry contract).
 *
 * The multi-tenant careers platform behind `<tenant>.darwinbox.in`. Matches
 * on the tenant careers URL shape — `provider: darwinbox` is accepted as an
 * explicit override — and resolves the board only from a URL that carries
 * the company id (`https://<tenant>.darwinbox.in/ms/candidatev2/<companyId>/
 * careers/...`): a tenant asked with the wrong id answers with an empty
 * `success`, so a bare tenant host is NEVER claimed (resolveBoard does the
 * https + single-label-host + path checks and null-guards the entry).
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Example Darwinbox Co
 *       careers_url: https://exampleco.darwinbox.in/ms/candidatev2/main/careers/allJobs
 *       max_pages: 20          # optional page cap (50 jobs/page, default 20, max 200)
 *       enabled: true
 *
 * buildEndpoint returns the canonical allJobs careers URL string for a
 * resolvable board; an entry that does not carry a company id yields null,
 * which resolveAdapter treats as no endpoint (fail-soft per company). The
 * fetch itself rebuilds the API request from the host + id only. Ported
 * from the parent's providers/darwinbox.mjs (upstream #6416).
 */
import { fetchDarwinbox, resolveBoard } from '../../sources/darwinbox.mjs';

export const darwinboxAdapter = {
  id: 'darwinbox',
  label: 'Darwinbox',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'darwinbox') return true;
    return !!resolveBoard(company);
  },
  buildEndpoint(company) {
    const board = resolveBoard(company);
    return board ? `${board.origin}/ms/candidatev2/${board.companyId}/careers/allJobs` : null;
  },
  fetch: fetchDarwinbox,
};
