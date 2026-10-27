/**
 * The Hub adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: thehub`. Endpoint is
 * the fixed public API, overridable via `thehub:` / `api:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: The Hub
 *       provider: thehub
 *       enabled: true
 */
import { fetchTheHub, FEED_BASE } from '../../sources/thehub.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host match — mirrors the source's assertTheHubUrl so an override the
// adapter accepts can never be rejected later by the fetch-time guard.
const THEHUB_HOST_RE = /^thehub\.io$/i;

export const thehubAdapter = {
  id: 'thehub',
  label: 'The Hub',
  matches(company) {
    return company.provider === 'thehub';
  },
  buildEndpoint(company) {
    return pinnedOverride(company.thehub, THEHUB_HOST_RE)
      || pinnedOverride(company.api, THEHUB_HOST_RE)
      || FEED_BASE;
  },
  fetch: fetchTheHub,
};
