/**
 * TKMS (thyssenkrupp Marine Systems) adapter (registry contract). Parent
 * career-ops parity (parent `providers/tkms.mjs`).
 *
 * Single-employer careers app on jobs.tkmsgroup.com (like ibm / dassault). A
 * tracked_companies entry selects it explicitly with `provider: tkms` OR via a
 * careers_url/api whose host is jobs.tkmsgroup.com (mirroring the parent's
 * detect). The endpoint is host-pinned; the source-level resolveConfig is the
 * hard SSRF guard. buildEndpoint returns the POST query API URL (a string) —
 * the subclient/locale/page POST body lives inside the fetcher, driven by
 * opts.company.
 *
 *   tracked_companies:
 *     - name: TKMS
 *       provider: tkms
 *       # or: careers_url: https://jobs.tkmsgroup.com/en
 *       # optional: tkms: { subclient: tkms, locale: en }
 */
import { fetchTkms, resolveConfig, TKMS_DEFAULT_ORIGIN } from '../../sources/tkms.mjs';

const DEFAULT_QUERY_API = `${TKMS_DEFAULT_ORIGIN}/api/filter/query`;

export const tkmsAdapter = {
  id: 'tkms',
  label: 'TKMS',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'tkms') return true;
    return resolveConfig(company) !== null;
  },
  buildEndpoint(company) {
    const cfg = resolveConfig(company);
    if (cfg) return cfg.queryApi;
    if (company && company.provider === 'tkms') return DEFAULT_QUERY_API;
    return null;
  },
  fetch: fetchTkms,
};
