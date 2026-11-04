/**
 * Keka adapter (registry contract). Ported with the parent's providers/keka.mjs
 * (upstream #6199).
 *
 * Keka is a multi-tenant HR/ATS platform — every customer tenant runs its
 * careers board at `https://<tenant>.keka.com/careers`. Matches on the exact
 * tenant-host shape — `provider: keka` is accepted as an explicit override;
 * anything whose `careers_url`/`api:` names a tenant on *.keka.com
 * auto-detects (resolveOrigin does the https + anchored-host + reserved-label
 * checks and null-guards the entry itself; `www.keka.com` and the vendor's
 * own subdomains never match).
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Acme India
 *       careers_url: https://acme.keka.com/careers
 *       enabled: true
 *
 * buildEndpoint returns the canonical careers-shell string (the shell names
 * the tenant's feed identifier; the source reads the identifier then fetches
 * the zero-auth embedjobs JSON in one more request). An entry that does not
 * name a tenant host yields null, which resolveAdapter treats as no endpoint
 * (fail-soft per company).
 */
import { fetchKeka, resolveOrigin, careersUrlFor } from '../../sources/keka.mjs';

export const kekaAdapter = {
  id: 'keka',
  label: 'Keka',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'keka') return true;
    return !!resolveOrigin(company);
  },
  buildEndpoint(company) {
    const origin = resolveOrigin(company);
    return origin ? careersUrlFor(origin) : null;
  },
  fetch: fetchKeka,
};
