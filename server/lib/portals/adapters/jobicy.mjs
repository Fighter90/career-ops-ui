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
import { fetchJobicy, jobicyFilters, FEED_URL } from '../../sources/jobicy.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host match — mirrors the source's assertJobicyUrl (both hosts allowed).
const JOBICY_HOST_RE = /^(?:www\.)?jobicy\.com$/i;

// CAR-255 parity (upstream #6612) — the entry's geo/industry/tag filters ride
// the endpoint too, so a probe/health check reads the same filtered feed the
// scan walks. A malformed filter falls back to the unfiltered feed here;
// fetch() is the one that throws, before any request.
function endpointWithFilters(company) {
  let filters;
  try {
    filters = jobicyFilters(company);
  } catch {
    filters = {};
  }
  const base = new URL(FEED_URL);
  for (const key of /** @type {const} */ (['geo', 'industry', 'tag'])) {
    if (filters[key]) base.searchParams.set(key, filters[key]);
  }
  return base.href;
}

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
      || endpointWithFilters(company);
  },
  fetch: fetchJobicy,
};
