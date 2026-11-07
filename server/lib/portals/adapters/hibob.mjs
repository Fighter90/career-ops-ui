/**
 * HiBob adapter (registry contract). Ported with the parent's
 * providers/hibob.mjs (upstream #6502).
 *
 * HiBob ("Bob" hiring module) hosts one careers board per customer tenant at
 * `https://<tenant>.careers.hibob.com`. Matches on the exact tenant-host
 * shape — `provider: hibob` is accepted as an explicit override; anything
 * whose `careers_url`/`api:` names a tenant under careers.hibob.com
 * auto-detects (resolveTenant does the https + suffix + label checks and
 * null-guards the entry itself). Any path on the tenant host is claimed, so a
 * posting link or an apply link resolves to its board; `careers.hibob.com`
 * itself, `www.hibob.com` and look-alike suffix/prefix hosts never match.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Acme
 *       careers_url: https://acme.careers.hibob.com/jobs
 *       enabled: true
 *
 * buildEndpoint returns the tenant's JSON endpoint string (one request serves
 * the whole board — the source reads the tenant label back out of it and
 * sends the `companyidentifier` header). An entry that does not name a tenant
 * host yields null, which resolveAdapter treats as no endpoint (fail-soft per
 * company).
 */
import { fetchHibob, resolveTenant, apiOriginFor } from '../../sources/hibob.mjs';

export const hibobAdapter = {
  id: 'hibob',
  label: 'HiBob',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'hibob') return true;
    return !!resolveTenant(company);
  },
  buildEndpoint(company) {
    const tenant = resolveTenant(company);
    return tenant ? apiOriginFor(tenant) : null;
  },
  fetch: fetchHibob,
};
