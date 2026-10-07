/**
 * Jobicy adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: jobicy`. Endpoint is
 * the fixed public JSON feed, overridable via `api:` / `jobicy:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Jobicy
 *       provider: jobicy
 *       enabled: true
 */
import { fetchJobicy, FEED_URL } from '../../sources/jobicy.mjs';

export const jobicyAdapter = {
  id: 'jobicy',
  label: 'Jobicy',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'jobicy';
  },
  // `string | null` contract: a non-string api falls back to the canonical
  // feed; garbage input never throws.
  buildEndpoint(company) {
    const api = company && typeof company === 'object' && typeof company.api === 'string'
      ? company.api
      : '';
    const override = company && typeof company === 'object' && typeof company.jobicy === 'string'
      ? company.jobicy
      : '';
    return override || api || FEED_URL;
  },
  fetch: fetchJobicy,
};
