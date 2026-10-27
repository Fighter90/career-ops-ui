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
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host match — mirrors the source's assert4DayWeekUrl.
const FOUR_DAY_WEEK_HOST_RE = /^4dayweek\.io$/i;

export const fourDayWeekAdapter = {
  id: '4dayweek',
  label: '4 Day Week',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === '4dayweek';
  },
  // The override is pinned to 4dayweek.io (FULL-M3): an off-host or non-https
  // value (a misconfigured entry) falls back to the canonical feed; garbage
  // input never throws.
  buildEndpoint(company) {
    return pinnedOverride(company?.['4dayweek'], FOUR_DAY_WEEK_HOST_RE)
      || pinnedOverride(company?.api, FOUR_DAY_WEEK_HOST_RE)
      || FEED_BASE;
  },
  fetch: fetch4DayWeek,
};
