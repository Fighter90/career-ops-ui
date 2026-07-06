/**
 * softgarden adapter (registry contract). Parent career-ops parity (v1.117.0).
 *
 * Per-tenant: matches an explicit `provider: softgarden` OR a careers_url/api
 * on a *.softgarden.io host. The endpoint is the tenant's server-rendered
 * /{lang}/widgets/jobs page (lists every posting, no pagination); fetch +
 * parsing live in server/lib/sources/softgarden.mjs.
 *
 *   tracked_companies:
 *     - name: RENK
 *       provider: softgarden
 *       careers_url: https://renk-group.softgarden.io/de/widgets/jobs
 *       enabled: true
 */
import { fetchSoftgarden, resolveWidgetUrl } from '../../sources/softgarden.mjs';

export const softgardenAdapter = {
  id: 'softgarden',
  label: 'softgarden',
  matches(company) {
    if (company.provider === 'softgarden') return true;
    return resolveWidgetUrl(company) !== null;
  },
  buildEndpoint(company) {
    return resolveWidgetUrl(company);
  },
  fetch: fetchSoftgarden,
};
