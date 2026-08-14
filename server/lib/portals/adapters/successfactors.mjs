/**
 * SAP SuccessFactors (RMK) adapter (registry contract).
 *
 * Matches either an explicit `provider: successfactors` OR a `careers_url`/`api:`
 * whose host is a literal *.successfactors.(eu|com) / jobs2web.com — the branded
 * RMK portals (jobs.zf.com, jobs.schaeffler.com …) carry no "successfactors"
 * string, so those are wired with an explicit `provider: successfactors`.
 *
 * The endpoint is the tenant's public RMK tile-search fragment,
 * `{origin}/tile-search-results/`, with the origin taken from the entry's
 * `api:`/careers_url and host-pinned. The HTTP fetch + tile parsing lives in
 * server/lib/sources/successfactors.mjs.
 *
 *   tracked_companies:
 *     - name: ZF
 *       provider: successfactors
 *       careers_url: https://jobs.zf.com/
 *       enabled: true
 */
import { fetchSuccessfactors, SF_HOST_RE, resolveTenantBase } from '../../sources/successfactors.mjs';

export const successfactorsAdapter = {
  id: 'successfactors',
  label: 'SAP SuccessFactors',
  matches(company) {
    if (company.provider === 'successfactors') return true;
    const raw = String(company.api || company.careers_url || '').trim();
    if (!raw) return false;
    try {
      return SF_HOST_RE.test(new URL(raw).hostname);
    } catch {
      return false;
    }
  },
  buildEndpoint(company) {
    // Keep a brand/tenant path prefix (multi-brand RMK
    // holdings) — resolveTenantBase strips only trailing endpoint segments.
    const base = resolveTenantBase(company);
    return base ? `${base}/tile-search-results/` : null;
  },
  fetch: fetchSuccessfactors,
};
