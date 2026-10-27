/**
 * The Muse adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: themuse`. Endpoint is
 * the fixed public API base, overridable via `themuse:` / `api:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: The Muse
 *       provider: themuse
 *       enabled: true
 */
import { fetchTheMuse, FEED_BASE } from '../../sources/themuse.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host match — mirrors the source's assertTheMuseUrl.
const THEMUSE_HOST_RE = /^www\.themuse\.com$/i;

export const themuseAdapter = {
  id: 'themuse',
  label: 'The Muse',
  matches(company) {
    return company.provider === 'themuse';
  },
  buildEndpoint(company) {
    return pinnedOverride(company.themuse, THEMUSE_HOST_RE)
      || pinnedOverride(company.api, THEMUSE_HOST_RE)
      || FEED_BASE;
  },
  fetch: fetchTheMuse,
};
