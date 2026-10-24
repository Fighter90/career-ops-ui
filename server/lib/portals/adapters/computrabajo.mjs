/**
 * Computrabajo adapter (registry contract).
 *
 * Board-wide LATAM aggregator with one host per country. Matches on an
 * explicit `provider: computrabajo` OR a `careers_url`/`api:` on a country
 * host (co.computrabajo.com, mx.computrabajo.com, …), where the search URL
 * the user would open in a browser IS the endpoint:
 *
 *   tracked_companies:
 *     - name: Computrabajo Colombia
 *       careers_url: https://co.computrabajo.com/trabajo-de-sistemas
 *       enabled: true
 *
 * buildEndpoint validates and normalizes the URL (https only, a two-letter
 * country host only, port/credentials dropped); an entry that carries no
 * valid search URL yields null, which resolveAdapter treats as no endpoint
 * (fail-soft per company). The candidate host (`candidato.co.computrabajo.com`,
 * the applicant backend) is never claimed — HOST_RE pins the bare country
 * host. Ported from the parent's providers/computrabajo.mjs (parity
 * v1.253.0, the #2650 encoding-fixed version).
 */
import { fetchComputrabajo, resolveListUrl } from '../../sources/computrabajo.mjs';

export const computrabajoAdapter = {
  id: 'computrabajo',
  label: 'Computrabajo',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'computrabajo') return true;
    for (const candidate of [company.api, company.careers_url]) {
      if (typeof candidate !== 'string' || !candidate) continue;
      try {
        resolveListUrl(candidate);
        return true;
      } catch {
        // not an on-host https search URL — keep looking
      }
    }
    return false;
  },
  // The validated search URL; null (never a throw) when the entry carries no
  // valid one. resolveListUrl drops port and credentials.
  buildEndpoint(company) {
    for (const candidate of [company?.api, company?.careers_url]) {
      if (typeof candidate !== 'string' || !candidate) continue;
      try {
        return resolveListUrl(candidate).href;
      } catch {
        // off-host / non-https → try the next candidate
      }
    }
    return null;
  },
  fetch: fetchComputrabajo,
};
