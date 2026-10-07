/**
 * 4 Day Week adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: 4dayweek`. Endpoint is
 * the fixed public JSON API, overridable via `4dayweek:` / `api:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: 4 Day Week
 *       provider: 4dayweek
 *       enabled: true
 */
import { fetch4DayWeek, FEED_BASE } from '../../sources/4dayweek.mjs';

export const fourDayWeekAdapter = {
  id: '4dayweek',
  label: '4 Day Week',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === '4dayweek';
  },
  // `string | null` contract: a non-string api (a misconfigured entry) falls
  // back to the canonical feed; garbage input never throws.
  buildEndpoint(company) {
    const api = company && typeof company === 'object' && typeof company.api === 'string'
      ? company.api
      : '';
    return company && typeof company === 'object' && typeof company['4dayweek'] === 'string' && company['4dayweek']
      ? company['4dayweek']
      : api || FEED_BASE;
  },
  fetch: fetch4DayWeek,
};
