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
    return company.provider === 'flowxtra';
  },
  buildEndpoint(company) {
    return company.flowxtra || company.api || JOBS_ENDPOINT;
  },
  fetch: fetchFlowxtra,
};
