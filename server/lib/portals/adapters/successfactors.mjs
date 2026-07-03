/**
 * SAP SuccessFactors (RMK) adapter (registry contract). Parent career-ops parity.
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
import { fetchSuccessfactors, SF_HOST_RE } from '../../sources/successfactors.mjs';

/** Resolve + host-pin the tenant origin from the entry, or null. */
function tenantOrigin(company) {
  const raw = String(company.api || company.careers_url || '').trim();
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (!u.hostname) return null;
  return u.origin;
}

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
    const origin = tenantOrigin(company);
    return origin ? `${origin}/tile-search-results/` : null;
  },
  fetch: fetchSuccessfactors,
};
