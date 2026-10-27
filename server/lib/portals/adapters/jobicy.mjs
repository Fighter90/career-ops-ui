/**
 * Jobicy adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: jobicy`. Endpoint is
 * the fixed public JSON feed, overridable via `api:` / `jobicy:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Jobicy
 *       provider: jobicy
 *       enabled: true
 */
import { fetchJobicy, FEED_URL } from '../../sources/jobicy.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host match — mirrors the source's assertJobicyUrl (both hosts allowed).
const JOBICY_HOST_RE = /^(?:www\.)?jobicy\.com$/i;

export const jobicyAdapter = {
  id: 'jobicy',
  label: 'Jobicy',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'jobicy';
  },
  // The override is pinned to jobicy.com (FULL-M3): an off-host or non-https
  // value falls back to the canonical feed; garbage never throws.
  buildEndpoint(company) {
    return pinnedOverride(company?.jobicy, JOBICY_HOST_RE)
      || pinnedOverride(company?.api, JOBICY_HOST_RE)
      || FEED_URL;
  },
  fetch: fetchJobicy,
};
