/**
 * Working Nomads adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: workingnomads`.
 * Endpoint is the fixed public feed, overridable via `api:` / `workingnomads:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Working Nomads
 *       provider: workingnomads
 *       enabled: true
 */
import { fetchWorkingNomads, FEED_URL } from '../../sources/workingnomads.mjs';

export const workingNomadsAdapter = {
  id: 'workingnomads',
  label: 'Working Nomads',
  matches(company) {
    return company.provider === 'workingnomads';
  },
  buildEndpoint(company) {
    return company.workingnomads || company.api || FEED_URL;
  },
  fetch: fetchWorkingNomads,
};
