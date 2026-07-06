/**
 * beesite (milch & zucker GJB) adapter (registry contract). Parent parity (v1.117.0).
 *
 * Per-tenant: matches an explicit `provider: beesite` OR a careers_url/api on a
 * *.beesite.de host (the search backend behind branded portals like
 * jobs.mercedes-benz.com — the tenant runs at {slug}.app.beesite.de). The
 * endpoint is the tenant's public /search JSON API; fetch + the bounded
 * newest-first paged walk live in server/lib/sources/beesite.mjs.
 *
 *   tracked_companies:
 *     - name: Mercedes-Benz
 *       provider: beesite
 *       api: https://global-jobboard-api.app.beesite.de/
 *       beesite:
 *         searchCriteria:
 *           - { CriterionName: PositionLocation.Country, CriterionValue: [329] }
 *       enabled: true
 */
import { fetchBeesite, resolveConfig } from '../../sources/beesite.mjs';

export const beesiteAdapter = {
  id: 'beesite',
  label: 'beesite (GJB)',
  matches(company) {
    if (company.provider === 'beesite') return true;
    return resolveConfig(company) !== null;
  },
  buildEndpoint(company) {
    const cfg = resolveConfig(company);
    return cfg ? cfg.searchApi : null;
  },
  fetch: fetchBeesite,
};
