/**
 * Flowxtra adapter (registry contract).
 *
 * Board-wide, no-auth, cross-tenant aggregator — matches ONLY on
 * `provider: flowxtra`. Endpoint is the fixed public API base, overridable
 * via `api:` / `flowxtra:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Flowxtra
 *       provider: flowxtra
 *       enabled: true
 */
import { fetchFlowxtra, JOBS_ENDPOINT } from '../../sources/flowxtra.mjs';

export const flowxtraAdapter = {
  id: 'flowxtra',
  label: 'Flowxtra',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'flowxtra';
  },
  // `string | null` contract: a non-string api falls back to the canonical
  // endpoint; garbage input never throws.
  buildEndpoint(company) {
    const api = company && typeof company === 'object' && typeof company.api === 'string'
      ? company.api
      : '';
    const override = company && typeof company === 'object' && typeof company.flowxtra === 'string'
      ? company.flowxtra
      : '';
    return override || api || JOBS_ENDPOINT;
  },
  fetch: fetchFlowxtra,
};
