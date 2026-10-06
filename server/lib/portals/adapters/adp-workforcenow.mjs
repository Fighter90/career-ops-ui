/**
 * ADP Workforce Now adapter (registry contract). Per-tenant ATS.
 *
 * Every tenant's recruitment page lives on the single host
 * `workforcenow.adp.com` and is identified by its `cid` + `ccId` query params:
 *   https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=...&ccId=...
 *
 * Matches an explicit `provider: adp-workforcenow`, or (when no provider is
 * set) a `careers_url` / `api:` on the exact ADP host over HTTPS carrying both
 * `cid` and `ccId`. An explicit, DIFFERENT provider always wins. A look-alike
 * host (`workforcenow.adp.com.evil.com`) is never claimed.
 *
 *   tracked_companies:
 *     - name: Example employer
 *       careers_url: https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=...&ccId=...
 *       adpWorkforcenow:
 *         fetchDetails: false
 *         detailLimit: 25
 *       enabled: true
 *
 * `buildEndpoint` returns the first list-page API URL (host-pinned), or null
 * when cid/ccId cannot be derived. Fetch + parse live in
 * server/lib/sources/adp-workforcenow.mjs.
 */
import { fetchAdpWorkforcenow, resolveTenant, buildListUrl } from '../../sources/adp-workforcenow.mjs';

export const adpWorkforcenowAdapter = {
  id: 'adp-workforcenow',
  label: 'ADP Workforce Now',

  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider) return company.provider === 'adp-workforcenow';
    return resolveTenant(company) !== null;
  },

  /** @param {any} company @returns {string|null} */
  buildEndpoint(company) {
    const tenant = resolveTenant(company);
    return tenant ? buildListUrl(tenant.cid, tenant.ccId, 1) : null;
  },

  fetch: fetchAdpWorkforcenow,
};
