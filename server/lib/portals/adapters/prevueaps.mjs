/**
 * PrevueAPS adapter (registry contract).
 *
 * Detects a PrevueAPS tenant from a `careers_url`/`api:` whose host matches
 * `<tenant>.prevueaps.ca` (HTTPS only), or from an explicit `provider: prevueaps`
 * — but the endpoint is ALWAYS host-pinned: an explicit provider on a
 * non-prevueaps host still yields a null endpoint.
 *
 * The endpoint is the tenant's `/jobs/` page; the fetch resolves the numeric
 * domainId from it and then calls `/core/jobs/{domainId}`. The HTTP fetch +
 * normalization lives in server/lib/sources/prevueaps.mjs.
 *
 *   tracked_companies:
 *     - name: ExampleCo
 *       careers_url: https://exampleco.prevueaps.ca/jobs/
 *       enabled: true
 */
import { fetchPrevueaps, resolveOrigin } from '../../sources/prevueaps.mjs';

export const prevueapsAdapter = {
  id: 'prevueaps',
  label: 'PrevueAPS',
  matches(company) {
    if (company && company.provider === 'prevueaps') return true;
    return resolveOrigin(company) !== null;
  },
  buildEndpoint(company) {
    const origin = resolveOrigin(company);
    return origin ? `${origin}/jobs/` : null;
  },
  fetch: fetchPrevueaps,
};
