/**
 * Jobstreet / SEEK adapter (registry contract).
 *
 * Matches ONLY on `provider: jobstreet`. The chalice-search endpoint is fixed
 * (overridable via `api:`, validated against the Jobstreet/SEEK host allowlist
 * in the source); per-entry search config lives in the `jobstreet:` block,
 * which the source reads from `opts.company`.
 */
import { fetchJobstreet, DEFAULT_API } from '../../sources/jobstreet.mjs';

export const jobstreetAdapter = {
  id: 'jobstreet',
  label: 'Jobstreet / SEEK',
  matches(company) {
    return company.provider === 'jobstreet';
  },
  buildEndpoint(company) {
    return company.api || DEFAULT_API;
  },
  fetch: fetchJobstreet,
};
