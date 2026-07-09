/**
 * Radancy (TalentBrew) adapter (registry contract). Per-tenant ATS.
 *
 * Branded hosts carry no stable Radancy token in the URL, so there is NO
 * auto-detection (parent parity) — tenants are wired with an explicit
 * `provider: radancy` plus a search-jobs `api:`/careers_url. The endpoint is
 * the tenant's SSR /{lang}/search-jobs list URL; the ?p=N paged HTML walk
 * lives in server/lib/sources/radancy.mjs.
 *
 *   tracked_companies:
 *     - name: Munich Re
 *       provider: radancy
 *       careers_url: https://careers.munichre.com/en/search-jobs
 *       enabled: true
 */
import { fetchRadancy, resolveListUrl } from '../../sources/radancy.mjs';

export const radancyAdapter = {
  id: 'radancy',
  label: 'Radancy',
  matches(company) {
    // Explicit wiring only — branded hosts are indistinguishable by URL.
    return company.provider === 'radancy';
  },
  buildEndpoint(company) {
    return resolveListUrl(company); // plain string URL or null
  },
  fetch: fetchRadancy,
};
