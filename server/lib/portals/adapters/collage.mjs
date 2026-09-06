/**
 * Collage adapter (registry contract).
 *
 * Per-tenant. An entry selects it with `provider: collage` plus either the
 * exact API URL or a public careers URL:
 *
 *   tracked_companies:
 *     - name: Acme
 *       provider: collage
 *       careers_url: https://secure.collage.co/jobs/acme
 *       # or: api: https://api.collage.co/v1/positions/acme
 *
 * The job-site address is never derived from the company name — it is a value
 * the tenant chose, and guessing it would scan somebody else's board.
 *
 * The source-level `assertCollageApiUrl` is the hard SSRF guard.
 */
import { fetchCollage, buildCollageUrl } from '../../sources/collage.mjs';

const API_HOST = 'api.collage.co';
const SITE_HOST = 'secure.collage.co';

// Host equality, not a suffix test: `api.collage.co.evil.test` must not match.
function isCollageHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const h = new URL(value).host.toLowerCase();
    return h === API_HOST || h === SITE_HOST;
  } catch {
    return false;
  }
}

export const collageAdapter = {
  id: 'collage',
  label: 'Collage',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'collage') return true;
    return isCollageHost(company.api) || isCollageHost(company.careers_url);
  },
  buildEndpoint(company) {
    return buildCollageUrl(company);
  },
  fetch: fetchCollage,
};
