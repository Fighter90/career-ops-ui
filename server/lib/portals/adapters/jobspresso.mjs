/**
 * Jobspresso adapter (registry contract).
 *
 * A board-wide aggregator, so it matches ONLY on an explicit
 * `provider: jobspresso` field — never on careers_url. The endpoint is the
 * fixed public RSS feed, overridable via `api:` / `jobspresso:` for testing
 * or a mirror.
 *
 *   tracked_companies:
 *     - name: Jobspresso
 *       provider: jobspresso
 *       enabled: true
 */
import { fetchJobspresso, FEED_URL } from '../../sources/jobspresso.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host match — mirrors the source's assertJobspressoUrl.
const JOBSPRESSO_HOST_RE = /^jobspresso\.co$/i;

export const jobspressoAdapter = {
  id: 'jobspresso',
  label: 'Jobspresso',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'jobspresso';
  },
  // The override is pinned to jobspresso.co (FULL-M3): an off-host or
  // non-https value falls back to the canonical feed; garbage never throws.
  buildEndpoint(company) {
    return pinnedOverride(company?.jobspresso, JOBSPRESSO_HOST_RE)
      || pinnedOverride(company?.api, JOBSPRESSO_HOST_RE)
      || FEED_URL;
  },
  fetch: fetchJobspresso,
};
