/**
 * IBM careers adapter (registry contract).
 *
 * Matches ONLY on `provider: ibm`. The base API URL is fixed (overridable via
 * `api:`, pinned to the exact API host — the source does no host assert of its
 * own); per-entry facet config lives in the `ibm:` block, which the source
 * reads from `opts.company`.
 */
import { fetchIbm, API_URL } from '../../sources/ibm.mjs';

const API_HOST = 'www-api.ibm.com';

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

export const ibmAdapter = {
  id: 'ibm',
  label: 'IBM',
  matches(company) {
    return !!company && company.provider === 'ibm';
  },
  buildEndpoint(company) {
    return apiOverride(company) || API_URL;
  },
  fetch: fetchIbm,
};
