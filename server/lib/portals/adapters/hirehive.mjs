/**
 * HireHive adapter (registry contract). Ported with the parent's
 * providers/hirehive.mjs (upstream #6503).
 *
 * HireHive is a single-company ATS: every employer tenant runs its board at
 * `https://<tenant>.hirehive.com`. Matches on the exact tenant-host shape —
 * `provider: hirehive` is accepted as an explicit override; anything whose
 * `careers_url`/`api:` names a tenant under hirehive.com auto-detects
 * (resolveOrigin does the https + anchored-host + vendor-label checks and
 * null-guards the entry itself). The vendor's own service hosts (www / app /
 * accounts / apply) are not boards and never match.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Acme
 *       careers_url: https://acme.hirehive.com/
 *       enabled: true
 *
 * buildEndpoint returns the tenant's public jobs-API string (paginated
 * `?page=&page_size=100`; the source derives the origin from it). An entry
 * that does not name a tenant host yields null, which resolveAdapter treats
 * as no endpoint (fail-soft per company).
 */
import { fetchHireHive, resolveOrigin, jobsApiFor } from '../../sources/hirehive.mjs';

export const hirehiveAdapter = {
  id: 'hirehive',
  label: 'HireHive',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'hirehive') return true;
    return !!resolveOrigin(company);
  },
  buildEndpoint(company) {
    const origin = resolveOrigin(company);
    return origin ? jobsApiFor(origin) : null;
  },
  fetch: fetchHireHive,
};
