/**
 * We Work Remotely adapter (registry contract).
 *
 * A board-wide aggregator, so it matches ONLY on an explicit
 * `provider: weworkremotely` field — never on careers_url. The endpoint is the
 * fixed public RSS feed, overridable via `api:` / `weworkremotely:` for testing
 * or a mirror.
 *
 *   tracked_companies:
 *     - name: We Work Remotely
 *       provider: weworkremotely
 *       enabled: true
 */
import { fetchWeWorkRemotely, FEED_URL } from '../../sources/weworkremotely.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host match — mirrors the source's assertWwrUrl.
const WEWORKREMOTELY_HOST_RE = /^weworkremotely\.com$/i;

export const weworkremotelyAdapter = {
  id: 'weworkremotely',
  label: 'We Work Remotely',
  matches(company) {
    return company.provider === 'weworkremotely';
  },
  buildEndpoint(company) {
    return pinnedOverride(company.weworkremotely, WEWORKREMOTELY_HOST_RE)
      || pinnedOverride(company.api, WEWORKREMOTELY_HOST_RE)
      || FEED_URL;
  },
  fetch: fetchWeWorkRemotely,
};
