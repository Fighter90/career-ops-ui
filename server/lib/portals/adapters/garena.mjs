/**
 * Garena adapter (registry contract).
 *
 * Single fixed host, no per-tenant discovery, so an entry selects it with
 * `provider: garena` OR via a careers_url/api pointing at careers.garena.com.
 *
 *   tracked_companies:
 *     - name: Garena
 *       provider: garena
 *       garena: { office: singapore }   # optional — shapes the job LINKS only
 *
 * `office` does not filter the listing (verified upstream: every code, invented
 * ones included, returns the same board), but it is part of the public job
 * page's path, so a wrong value breaks the links rather than the results.
 *
 * The source-level `assertGarenaUrl` is the hard SSRF guard.
 */
import { fetchGarena, buildGarenaUrl } from '../../sources/garena.mjs';

const HOST = 'careers.garena.com';

// Host equality, not a suffix test: `careers.garena.com.evil.test` must not match.
function isGarenaHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    return new URL(value).host.toLowerCase() === HOST;
  } catch {
    return false;
  }
}

export const garenaAdapter = {
  id: 'garena',
  label: 'Garena',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'garena') return true;
    return isGarenaHost(company.api) || isGarenaHost(company.careers_url);
  },
  buildEndpoint(company) {
    return buildGarenaUrl(company);
  },
  fetch: fetchGarena,
};
