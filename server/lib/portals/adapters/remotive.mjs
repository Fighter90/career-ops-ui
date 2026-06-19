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
import { fetchRemotive, FEED_URL } from '../../sources/remotive.mjs';

export const remotiveAdapter = {
  id: 'remotive',
  label: 'Remotive',
  matches(company) {
    return company.provider === 'remotive';
  },
  buildEndpoint(company) {
    return company.remotive || company.api || FEED_URL;
  },
  fetch: fetchRemotive,
};
