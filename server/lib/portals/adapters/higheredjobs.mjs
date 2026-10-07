/**
 * HigherEdJobs adapter (registry contract).
 *
 * A board-wide aggregator, so it matches ONLY on an explicit
 * `provider: higheredjobs` field — never on careers_url. The endpoint is the
 * public RSS category feed, parameterized via `cat_id:` on the entry
 * (default 68 — Higher Education) and overridable via `api:` /
 * `higheredjobs:` for testing.
 *
 *   tracked_companies:
 *     - name: HigherEdJobs
 *       provider: higheredjobs
 *       cat_id: 68
 *       enabled: true
 */
import { fetchHigherEdJobs, feedUrlFor } from '../../sources/higheredjobs.mjs';

export const higheredjobsAdapter = {
  id: 'higheredjobs',
  label: 'HigherEdJobs',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'higheredjobs';
  },
  // `string | null` contract: a non-string api falls back to the category
  // feed; garbage input never throws.
  buildEndpoint(company) {
    const api = company && typeof company === 'object' && typeof company.api === 'string'
      ? company.api
      : '';
    const override = company && typeof company === 'object' && typeof company.higheredjobs === 'string'
      ? company.higheredjobs
      : '';
    const catId = company && typeof company === 'object' ? company.cat_id : undefined;
    return override || api || feedUrlFor(catId);
  },
  fetch: fetchHigherEdJobs,
};
