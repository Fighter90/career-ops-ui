/**
 * Remotive adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: remotive`. Endpoint is
 * the fixed public feed, overridable via `api:` / `remotive:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Remotive
 *       provider: remotive
 *       enabled: true
 */
import { fetchRemotive, FEED_URL, REMOTIVE_HOST_RE } from '../../sources/remotive.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

export const remotiveAdapter = {
  id: 'remotive',
  label: 'Remotive',
  matches(company) {
    return company.provider === 'remotive';
  },
  buildEndpoint(company) {
    return pinnedOverride(company.remotive, REMOTIVE_HOST_RE)
      || pinnedOverride(company.api, REMOTIVE_HOST_RE)
      || FEED_URL;
  },
  fetch: fetchRemotive,
};
