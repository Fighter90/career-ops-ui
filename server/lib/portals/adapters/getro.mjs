/**
 * Getro adapter (registry contract). Parent career-ops parity.
 *
 * VC "talent network" portfolio boards (b2venture, Earlybird, Point Nine …),
 * each addressed by a numeric `getro_collection`. Board-wide / per-collection,
 * so it matches ONLY on an explicit `provider: getro` carrying a resolvable
 * collection id (like manfred, never on careers_url — the careers_url is
 * reference-only and does not encode the collection). The endpoint is the fixed
 * public search API for that collection; per-entry pagination/age config
 * (`getro_max_pages` / `getro_max_age_days`) is read by the source from
 * `opts.company`. The source-level assertGetroUrl is the hard SSRF guard.
 *
 *   tracked_companies:
 *     - name: b2venture (portfolio)
 *       provider: getro
 *       getro_collection: 4283
 *       careers_url: https://jobs.b2venture.vc   # reference only
 *       enabled: true
 */
import { fetchGetro, resolveCollection, API_BASE } from '../../sources/getro.mjs';

export const getroAdapter = {
  id: 'getro',
  label: 'Getro',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    return company.provider === 'getro' && resolveCollection(company) !== null;
  },
  buildEndpoint(company) {
    const id = resolveCollection(company);
    return id ? `${API_BASE}/${id}/search/jobs` : null;
  },
  fetch: fetchGetro,
};
