/**
 * Arbeitnow adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: arbeitnow`. Endpoint is
 * the fixed public feed, overridable via `api:` / `arbeitnow:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Arbeitnow
 *       provider: arbeitnow
 *       enabled: true
 */
import { fetchArbeitnow, FEED_URL } from '../../sources/arbeitnow.mjs';

export const arbeitnowAdapter = {
  id: 'arbeitnow',
  label: 'Arbeitnow',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'arbeitnow';
  },
  // `string | null` contract: a non-string api falls back to the canonical
  // feed; garbage input never throws.
  buildEndpoint(company) {
    const api = company && typeof company === 'object' && typeof company.api === 'string'
      ? company.api
      : '';
    const override = company && typeof company === 'object' && typeof company.arbeitnow === 'string'
      ? company.arbeitnow
      : '';
    return override || api || FEED_URL;
  },
  fetch: fetchArbeitnow,
};
