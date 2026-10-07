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
import {
  fetchWorkingNomads,
  assertWorkingNomadsUrl,
  FEED_URL,
} from '../../sources/workingnomads.mjs';

export const workingNomadsAdapter = {
  id: 'workingnomads',
  label: 'Working Nomads',
  matches(company) {
    return company.provider === 'workingnomads';
  },
  // Host-pinned (v1.242.0 Phase 2, paired with the source's own assert): an
  // on-host https override is honored verbatim; anything else falls back to
  // the canonical feed, so an SSRF `api:` never reaches fetchWorkingNomads.
  buildEndpoint(company) {
    const override = company.workingnomads || company.api;
    if (typeof override === 'string' && override.trim()) {
      try {
        return assertWorkingNomadsUrl(override.trim());
      } catch {
        // off-host / non-https override → canonical feed
      }
    }
    return FEED_URL;
  },
  fetch: fetchWorkingNomads,
};
