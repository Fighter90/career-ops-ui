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
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host match — mirrors the source's assertHejUrl.
const HIGHEREDJOBS_HOST_RE = /^www\.higheredjobs\.com$/i;

export const higheredjobsAdapter = {
  id: 'higheredjobs',
  label: 'HigherEdJobs',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'higheredjobs';
  },
  // The override is pinned to www.higheredjobs.com (FULL-M3): an off-host or
  // non-https value falls back to the category feed; garbage never throws.
  buildEndpoint(company) {
    const catId = company && typeof company === 'object' ? company.cat_id : undefined;
    return pinnedOverride(company?.higheredjobs, HIGHEREDJOBS_HOST_RE)
      || pinnedOverride(company?.api, HIGHEREDJOBS_HOST_RE)
      || feedUrlFor(catId);
  },
  fetch: fetchHigherEdJobs,
};
