/**
 * Himalayas adapter (registry contract).
 *
 * Board-wide remote-only aggregator — matches ONLY on `provider: himalayas`.
 * Endpoint is the fixed public feed, overridable via `api:` / `himalayas:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Himalayas
 *       provider: himalayas
 *       enabled: true
 */
import { fetchHimalayas, FEED_URL } from '../../sources/himalayas.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host match — mirrors the source's assertHimalayasUrl.
const HIMALAYAS_HOST_RE = /^himalayas\.app$/i;

export const himalayasAdapter = {
  id: 'himalayas',
  label: 'Himalayas',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'himalayas';
  },
  // The override is pinned to himalayas.app (FULL-M3): an off-host or
  // non-https value falls back to the canonical feed; garbage never throws.
  buildEndpoint(company) {
    return pinnedOverride(company?.himalayas, HIMALAYAS_HOST_RE)
      || pinnedOverride(company?.api, HIMALAYAS_HOST_RE)
      || FEED_URL;
  },
  fetch: fetchHimalayas,
};
