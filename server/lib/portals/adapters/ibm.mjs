/**
 * IBM careers adapter (registry contract).
 *
 * Matches ONLY on `provider: ibm`. The base API URL is fixed (overridable via
 * `api:`); per-entry facet config lives in the `ibm:` block, which the source
 * reads from `opts.company`.
 */
import { fetchIbm, API_URL } from '../../sources/ibm.mjs';

export const ibmAdapter = {
  id: 'ibm',
  label: 'IBM',
  matches(company) {
    return company.provider === 'ibm';
  },
  buildEndpoint(company) {
    return company.api || API_URL;
  },
  fetch: fetchIbm,
};
