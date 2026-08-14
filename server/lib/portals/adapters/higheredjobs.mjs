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
    return company.provider === 'higheredjobs';
  },
  buildEndpoint(company) {
    return company.higheredjobs || company.api || feedUrlFor(company.cat_id);
  },
  fetch: fetchHigherEdJobs,
};
