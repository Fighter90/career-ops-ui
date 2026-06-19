/**
 * Glints adapter (registry contract).
 *
 * Matches ONLY on `provider: glints`. The GraphQL endpoint is fixed
 * (overridable via `api:`, validated against the Glints host allowlist in the
 * source); per-entry search config lives in the `glints:` block, which the
 * source reads from `opts.company`.
 */
import { fetchGlints, DEFAULT_API } from '../../sources/glints.mjs';

export const glintsAdapter = {
  id: 'glints',
  label: 'Glints',
  matches(company) {
    return company.provider === 'glints';
  },
  buildEndpoint(company) {
    return company.api || DEFAULT_API;
  },
  fetch: fetchGlints,
};
