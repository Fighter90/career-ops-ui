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
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host match — mirrors the source's assertFlowxtraUrl (endpoint host).
const FLOWXTRA_HOST_RE = /^app\.flowxtra\.com$/i;

export const flowxtraAdapter = {
  id: 'flowxtra',
  label: 'Flowxtra',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'flowxtra';
  },
  // The override is pinned to app.flowxtra.com (FULL-M3): an off-host or
  // non-https value falls back to the canonical endpoint; garbage never throws.
  buildEndpoint(company) {
    return pinnedOverride(company?.flowxtra, FLOWXTRA_HOST_RE)
      || pinnedOverride(company?.api, FLOWXTRA_HOST_RE)
      || JOBS_ENDPOINT;
  },
  fetch: fetchFlowxtra,
};
