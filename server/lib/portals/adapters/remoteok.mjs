/**
 * RemoteOK adapter (registry contract).
 *
 * A board-wide aggregator, so it matches ONLY on an explicit
 * `provider: remoteok` field — never on careers_url. The endpoint is the
 * fixed public feed, overridable via `api:` / `remoteok:` for testing or
 * a mirror.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: RemoteOK
 *       provider: remoteok
 *       enabled: true
 */
import { fetchRemoteOk, FEED_URL } from '../../sources/remoteok.mjs';

export const remoteokAdapter = {
  id: 'remoteok',
  label: 'RemoteOK',
  matches(company) {
    return company.provider === 'remoteok';
  },
  buildEndpoint(company) {
    return company.remoteok || company.api || FEED_URL;
  },
  fetch: fetchRemoteOk,
};
