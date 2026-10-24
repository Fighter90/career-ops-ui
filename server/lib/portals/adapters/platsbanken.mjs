/**
 * Platsbanken adapter (registry contract).
 *
 * Sweden's national job board read through the public JobTech Dev JobSearch
 * API — a board aggregator, not a company ATS, so it matches ONLY on an
 * explicit `provider: platsbanken` (never on a careers_url). The search
 * endpoint is fixed, overridable via `api:` host-pinned to
 * jobsearch.api.jobtechdev.se (the source re-asserts it as defence-in-depth);
 * the per-entry keyword config lives in the `platsbanken:` block, which the
 * source reads from `opts.company`.
 *
 *   tracked_companies:
 *     - name: Platsbanken — Backend
 *       provider: platsbanken
 *       platsbanken:
 *         keywords: ["backend developer"]   # optional — falls back to profile
 *       enabled: true
 */
import { fetchPlatsbanken, SEARCH_URL, API_HOST } from '../../sources/platsbanken.mjs';

/** A usable `api:` override: https on the exact API host. */
function apiOverride(company) {
  const raw = company && typeof company === 'object' ? company.api : null;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' && u.hostname === API_HOST ? raw.trim() : null;
  } catch {
    return null;
  }
}

export const platsbankenAdapter = {
  id: 'platsbanken',
  label: 'Platsbanken',
  matches(company) {
    return !!company && company.provider === 'platsbanken';
  },
  buildEndpoint(company) {
    return apiOverride(company) || SEARCH_URL;
  },
  fetch: fetchPlatsbanken,
};
