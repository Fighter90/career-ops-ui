/**
 * Welcome to the Jungle adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: wttj` (the board is
 * global, so it is never auto-detected by URL). The fetch always bootstraps
 * from the fixed /api/env endpoint; per-entry search config lives in the
 * `wttj:` block, which the source reads from `opts.company`. The `api:` key
 * may override the env endpoint (host-pinned in the source's SSRF guard);
 * `company.wttj` is the config object and is never used as an endpoint.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Welcome to the Jungle
 *       provider: wttj
 *       wttj:
 *         queries: ["finops", "data platform engineer"]
 *       enabled: true
 */
import { fetchWttj, ENV_URL } from '../../sources/wttj.mjs';

export const wttjAdapter = {
  id: 'wttj',
  label: 'Welcome to the Jungle',
  matches(company) {
    if (!company) return false;
    return company.provider === 'wttj';
  },
  buildEndpoint(company) {
    return company.api || ENV_URL;
  },
  fetch: fetchWttj,
};
