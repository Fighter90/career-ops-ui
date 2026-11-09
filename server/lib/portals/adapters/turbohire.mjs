/**
 * TurboHire adapter (registry contract). Ported with the parent's
 * providers/turbohire.mjs (upstream #6712, CAR-254).
 *
 * TurboHire is a single-company ATS: every employer tenant runs its careers
 * site at `https://<tenant>.turbohire.co`. Matches on the exact tenant-host
 * shape — `provider: turbohire` is accepted as an explicit override;
 * anything whose `careers_url`/`api:` names a tenant under turbohire.co
 * auto-detects (resolveTenant does the https + anchored-host + vendor-label
 * checks and null-guards the entry itself). The vendor's own service hosts
 * (app / api / www) are not boards and never match.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Acme
 *       careers_url: https://acme.turbohire.co/
 *       enabled: true
 *
 * buildEndpoint returns the tenant careers origin rebuilt from the tenant
 * label (the input's path, query and port are never read), or null when the
 * entry names no tenant — resolveAdapter treats null as no endpoint
 * (fail-soft per company). The source re-checks the origin before any I/O.
 *
 * The HTTP fetch and parsing live in server/lib/sources/turbohire.mjs.
 */
import { fetchTurbohire, resolveOrigin } from '../../sources/turbohire.mjs';

export const turbohireAdapter = {
  id: 'turbohire',
  label: 'TurboHire',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'turbohire') return true;
    return !!resolveOrigin(company);
  },
  /**
   * @param {any} company
   * @returns {string|null} the tenant careers origin, or null when the
   *   entry names no TurboHire tenant.
   */
  buildEndpoint(company) {
    return resolveOrigin(company);
  },
  fetch: fetchTurbohire,
};
