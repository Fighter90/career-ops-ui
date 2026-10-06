/**
 * Gupy adapter (registry contract). Board-wide, keyword-driven.
 *
 * Gupy hosts thousands of Brazilian employers (`<tenant>.gupy.io`) and exposes
 * one public search across all of them. This adapter searches the whole
 * platform, so it matches `provider: gupy` OR a `careers_url`/`api:` on a
 * platform-wide host (`portal.gupy.io`, `employability-portal.gupy.io`) and
 * deliberately NOT a single tenant's career page, which would silently ignore
 * the tenant.
 *
 * The endpoint is fixed (overridable via `api:`, still host-pinned by the
 * source); search keys live in the `gupy:` block the source reads from
 * `opts.company`.
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
    if (!company) return false;
    if (company.provider === 'gupy') return true;
    return isGupyPlatformUrl(company.careers_url) || isGupyPlatformUrl(company.api);
  },
  buildEndpoint(company) {
    return (company && company.api) || API_BASE;
  },
  fetch: fetchGupy,
};
