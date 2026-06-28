/**
 * We Work Remotely adapter (registry contract). Parent career-ops v1.14.0 parity.
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

export const weworkremotelyAdapter = {
  id: 'weworkremotely',
  label: 'We Work Remotely',
  matches(company) {
    return company.provider === 'weworkremotely';
  },
  buildEndpoint(company) {
    return company.weworkremotely || company.api || FEED_URL;
  },
  fetch: fetchWeWorkRemotely,
};
