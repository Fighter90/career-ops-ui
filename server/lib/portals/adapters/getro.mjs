/**
 * Getro adapter (registry contract).
 *
 * VC "talent network" portfolio boards (b2venture, Earlybird, Point Nine …).
 * Board-wide / per-collection, so it matches ONLY on an explicit
 * `provider: getro` that carries EITHER a resolvable numeric `getro_collection`
 * OR an https `careers_url` (the collection id auto-resolves from the board
 * page at scan time via the SSRF-safe safeGet). It never matches on a
 * careers_url alone without `provider: getro`. Per-entry pagination/age config
 * (`getro_max_pages` / `getro_max_age_days`) is read by the source from
 * `opts.company`. The source-level assertGetroUrl is the hard SSRF guard.
 *
 *   tracked_companies:
 *     - name: b2venture (portfolio)
 *       provider: getro
 *       getro_collection: 4283                    # explicit id
 *       careers_url: https://jobs.b2venture.vc
 *       enabled: true
 *     - name: earlybird (portfolio)
 *       provider: getro
 *       careers_url: https://jobs.earlybird.com   # id auto-resolves from here
 *       enabled: true
 */
import { fetchGetro, resolveCollection, httpsCareersUrl, API_BASE } from '../../sources/getro.mjs';

export const getroAdapter = {
  id: 'getro',
  label: 'Getro',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider !== 'getro') return false;
    return resolveCollection(company) !== null || httpsCareersUrl(company) !== null;
  },
  buildEndpoint(company) {
    const id = resolveCollection(company);
    if (id) return `${API_BASE}/${id}/search/jobs`;
    // No explicit id: the board page URL is the informational probe endpoint.
    // fetchGetro re-resolves the numeric collection id from it at scan time via
    // the SSRF-safe safeGet. Must be truthy so the registry dispatches here.
    return httpsCareersUrl(company);
  },
  fetch: fetchGetro,
};
