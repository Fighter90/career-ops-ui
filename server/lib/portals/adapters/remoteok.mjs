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
import { fetchRemoteOk, FEED_URL, REMOTEOK_HOST_RE } from '../../sources/remoteok.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

export const remoteokAdapter = {
  id: 'remoteok',
  label: 'RemoteOK',
  matches(company) {
    return company.provider === 'remoteok';
  },
  buildEndpoint(company) {
    return pinnedOverride(company.remoteok, REMOTEOK_HOST_RE)
      || pinnedOverride(company.api, REMOTEOK_HOST_RE)
      || FEED_URL;
  },
  fetch: fetchRemoteOk,
};
