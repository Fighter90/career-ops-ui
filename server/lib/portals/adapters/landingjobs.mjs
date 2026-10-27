/**
 * Landing.jobs adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: landingjobs`. Endpoint
 * is the fixed public feed, overridable via `api:` / `landingjobs:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Landing.jobs
 *       provider: landingjobs
 *       enabled: true
 */
import { fetchLandingjobs, FEED_URL } from '../../sources/landingjobs.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host match — mirrors the source's assertLandingjobsUrl.
const LANDINGJOBS_HOST_RE = /^landing\.jobs$/i;

export const landingjobsAdapter = {
  id: 'landingjobs',
  label: 'Landing.jobs',
  matches(c) {
    return c.provider === 'landingjobs';
  },
  buildEndpoint(c) {
    return pinnedOverride(c.landingjobs, LANDINGJOBS_HOST_RE)
      || pinnedOverride(c.api, LANDINGJOBS_HOST_RE)
      || FEED_URL;
  },
  fetch: fetchLandingjobs,
};
