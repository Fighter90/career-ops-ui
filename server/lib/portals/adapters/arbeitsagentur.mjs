/**
 * Arbeitsagentur adapter (registry contract).
 *
 * Matches ONLY on `provider: arbeitsagentur`. The base API URL is fixed
 * (overridable via `api:`, pinned to the exact API host — the source does no
 * host assert of its own); per-entry keyword/location config lives in the
 * `arbeitsagentur:` block, which the source reads from `opts.company`.
 */
import { fetchArbeitsagentur, API_URL } from '../../sources/arbeitsagentur.mjs';

const API_HOST = 'rest.arbeitsagentur.de';

/** A usable `api:` override: https on the exact API host. */
function apiOverride(company) {
  const raw = company && typeof company === 'object' ? company.api : null;
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' && u.hostname.toLowerCase() === API_HOST ? raw : null;
  } catch {
    return null;
  }
}

export const arbeitsagenturAdapter = {
  id: 'arbeitsagentur',
  label: 'Arbeitsagentur',
  matches(company) {
    return !!company && company.provider === 'arbeitsagentur';
  },
  buildEndpoint(company) {
    return apiOverride(company) || API_URL;
  },
  fetch: fetchArbeitsagentur,
};
