/**
 * Arbeitnow adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: arbeitnow`. Endpoint is
 * the fixed public feed, overridable via `api:` / `arbeitnow:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Arbeitnow
 *       provider: arbeitnow
 *       enabled: true
 */
import { fetchArbeitnow, FEED_URL } from '../../sources/arbeitnow.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host match — mirrors the source's assertArbeitnowUrl.
const ARBEITNOW_HOST_RE = /^www\.arbeitnow\.com$/i;

export const arbeitnowAdapter = {
  id: 'arbeitnow',
  label: 'Arbeitnow',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'arbeitnow';
  },
  // The override is pinned to www.arbeitnow.com (FULL-M3): an off-host or
  // non-https value falls back to the canonical feed; garbage never throws.
  buildEndpoint(company) {
    return pinnedOverride(company?.arbeitnow, ARBEITNOW_HOST_RE)
      || pinnedOverride(company?.api, ARBEITNOW_HOST_RE)
      || FEED_URL;
  },
  fetch: fetchArbeitnow,
};
