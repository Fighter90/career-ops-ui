/**
 * iCIMS adapter (registry contract). Parent career-ops parity.
 *
 * Targets the classic iCIMS hosted-portal search pages at
 * `careers-<tenant>.icims.com` — DISTINCT from the `jibeapply` adapter, which
 * targets JibeApply (iCIMS's apply product). Keep them separate.
 *
 * Matches either an explicit `provider: icims` OR a `careers_url`/`api:` whose
 * host is a literal `*.icims.com`. The endpoint is the tenant's portal search
 * URL (`{origin}/jobs/search?ss=1&in_iframe=1`), origin taken from the entry's
 * `api:`/careers_url and host-pinned. The HTTP fetch + search-page parsing
 * lives in server/lib/sources/icims.mjs.
 *
 *   tracked_companies:
 *     - name: AcmeFreight
 *       careers_url: https://careers-acmefreight.icims.com/jobs/search?ss=1
 *       enabled: true
 */
import { fetchIcims, resolveTenantOrigin, icimsSearchUrl, ICIMS_HOST_RE } from '../../sources/icims.mjs';

export const icimsAdapter = {
  id: 'icims',
  label: 'iCIMS',
  matches(company) {
    if (company.provider === 'icims') return true;
    const raw = String(company.api || company.careers_url || '').trim();
    if (!raw) return false;
    try {
      return ICIMS_HOST_RE.test(new URL(raw).hostname);
    } catch {
      return false;
    }
  },
  buildEndpoint(company) {
    const origin = resolveTenantOrigin(company);
    return origin ? icimsSearchUrl(origin) : null;
  },
  fetch: fetchIcims,
};
