/**
 * Gupy adapter (registry contract). Board-wide, keyword-driven.
 *
 * Gupy hosts thousands of Brazilian employers (`<tenant>.gupy.io`) and exposes
 * one public search across all of them. This adapter searches the whole
 * platform, so it matches `provider: gupy` OR a `careers_url`/`api:` on a
 * platform-wide host (`portal.gupy.io`, and the retired API host
 * `employability-portal.gupy.io`) and deliberately NOT a single tenant's
 * career page, which would silently ignore the tenant.
 *
 * The endpoint is fixed to the API the portal's own job search calls
 * (overridable via `api:`, mapped back to it when it is a platform-wide URL —
 * the source fetch is host-pinned, so fetch only ever calls API_BASE, exactly
 * as the parent provider does); search keys live in the `gupy:` block the
 * source reads from `opts.company`.
 *
 *   tracked_companies:
 *     - name: Gupy — Brasil
 *       provider: gupy
 *       gupy:
 *         keywords: ["Desenvolvedor"]  # optional — falls back to profile target_roles
 *         since_days: 14
 *       max_pages: 5
 *       enabled: true
 */
import { fetchGupy, isGupyPlatformUrl, API_BASE } from '../../sources/gupy.mjs';

export const gupyAdapter = {
  id: 'gupy',
  label: 'Gupy',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'gupy') return true;
    return isGupyPlatformUrl(company.careers_url) || isGupyPlatformUrl(company.api);
  },
  // `string | null` contract: a non-string api falls back to the canonical
  // endpoint; garbage input never throws. A platform-wide `api:` — including
  // an entry still pointing at the retired API host — maps back to the
  // canonical endpoint, so such an entry resolves here AND fetches; any other
  // string passes through (the source's SSRF pin rejects off-host values).
  buildEndpoint(company) {
    const api = company && typeof company === 'object' && typeof company.api === 'string'
      ? company.api
      : '';
    if (api && isGupyPlatformUrl(api)) return API_BASE;
    return api || API_BASE;
  },
  fetch: fetchGupy,
};
