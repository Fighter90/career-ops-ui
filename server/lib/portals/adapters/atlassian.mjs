/**
 * Atlassian adapter (registry contract).
 *
 * Board-wide source — Atlassian fronts its iCIMS careers site with a single
 * public JSON feed of every open posting, so the endpoint is fixed. Matches
 * ONLY on `provider: atlassian` (provider-selected like the parent; the feed
 * is company-specific, so it is never auto-detected from a careers_url):
 *
 *   tracked_companies:
 *     - name: Atlassian
 *       provider: atlassian
 *       enabled: true
 *
 * Ported from the parent's providers/atlassian.mjs (parity v1.253.0).
 */
import {
  fetchAtlassian,
  assertAtlassianUrl,
  LISTINGS_URL,
} from '../../sources/atlassian.mjs';

export const atlassianAdapter = {
  id: 'atlassian',
  label: 'Atlassian',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    return company.provider === 'atlassian';
  },
  // One fixed, host-pinned endpoint: the whole board arrives in a single
  // request. The assert is defence-in-depth — it can only fail if the
  // LISTINGS_URL constant itself is edited to an off-host value.
  buildEndpoint() {
    return assertAtlassianUrl(LISTINGS_URL);
  },
  fetch: fetchAtlassian,
};
