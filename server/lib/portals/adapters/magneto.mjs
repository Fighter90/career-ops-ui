/**
 * Magneto365 adapter (registry contract).
 *
 * Board-wide source — Colombia's general job board. Matches on an explicit
 * `provider: magneto` OR a `careers_url`/`api:` on the pinned host, where the
 * search URL the user would open in a browser IS the endpoint (the query
 * lives in the URL path):
 *
 *   tracked_companies:
 *     - name: Magneto365 Tecnologia
 *       careers_url: https://www.magneto365.com/co/trabajos/buscar/tecnologia
 *       enabled: true
 *       max_pages: 5          # optional, capped at 20
 *       max_jobs: 100         # optional, capped at 500
 *
 * buildEndpoint validates and normalizes the URL (https only, magneto365.com
 * only, port/credentials dropped); an entry that carries no valid search URL
 * yields null, which resolveAdapter treats as no endpoint (fail-soft per
 * company). Ported from the parent's providers/magneto.mjs (parity v1.253.0).
 */
import { fetchMagneto, resolveListUrl } from '../../sources/magneto.mjs';

export const magnetoAdapter = {
  id: 'magneto',
  label: 'Magneto365',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'magneto') return true;
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
  fetch: fetchMagneto,
};
