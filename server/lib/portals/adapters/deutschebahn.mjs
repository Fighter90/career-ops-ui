/**
 * Deutsche Bahn adapter (registry contract). Parent career-ops parity
 * (parent `providers/deutschebahn.mjs`).
 *
 * Single-company careers board on db.jobs (like ibm / dassault / tkms). A
 * tracked_companies entry selects it explicitly with `provider: deutschebahn`
 * OR via a careers_url/api whose host is db.jobs (mirroring the parent's
 * detect). The endpoint is host-pinned to db.jobs; the source-level
 * resolveConfig is the hard SSRF guard.
 *
 *   tracked_companies:
 *     - name: Deutsche Bahn
 *       provider: deutschebahn
 *       # or: careers_url: https://db.jobs/service/search/de-de/5441588
 */
import { fetchDeutschebahn, resolveConfig, DEFAULT_SEARCH_ID } from '../../sources/deutschebahn.mjs';

const DEFAULT_SEARCH_BASE = `https://db.jobs/service/search/de-de/${DEFAULT_SEARCH_ID}`;

export const deutschebahnAdapter = {
  id: 'deutschebahn',
  label: 'Deutsche Bahn',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'deutschebahn') return true;
    return resolveConfig(company) !== null;
  },
  buildEndpoint(company) {
    const cfg = resolveConfig(company);
    if (cfg) return cfg.searchBase;
    if (company && company.provider === 'deutschebahn') return DEFAULT_SEARCH_BASE;
    return null;
  },
  fetch: fetchDeutschebahn,
};
