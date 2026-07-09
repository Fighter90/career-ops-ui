/**
 * Cornerstone OnDemand (CSOD) adapter (registry contract). Per-tenant ATS.
 *
 * Detects a CSOD tenant from a `careers_url`/`api:` on a *.csod.com host that
 * carries the careersite path shape (/ux/ats/careersite/{siteId}/…), or from
 * an explicit `provider: csod`. The endpoint is the tenant's careersite home
 * URL — the anonymous-token bootstrap + the POST-paged search walk live in
 * server/lib/sources/csod.mjs.
 *
 *   tracked_companies:
 *     - name: OHB
 *       api: https://career-ohb.csod.com/ux/ats/careersite/4/home?c=career-ohb
 *       enabled: true
 */
import { fetchCsod, resolveConfig } from '../../sources/csod.mjs';

export const csodAdapter = {
  id: 'csod',
  label: 'Cornerstone',
  matches(company) {
    if (company.provider === 'csod') return true;
    return resolveConfig(company) !== null;
  },
  buildEndpoint(company) {
    const cfg = resolveConfig(company);
    return cfg ? cfg.homeUrl : null;
  },
  fetch: fetchCsod,
};
