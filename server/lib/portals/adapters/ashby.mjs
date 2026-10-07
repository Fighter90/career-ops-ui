/**
 * Ashby adapter (v1.13.0 registry contract).
 *
 * Detects Ashby boards from `careers_url` like `jobs.ashbyhq.com/<slug>`,
 * also honours an explicit `api:` field. The HTTP fetcher in
 * server/lib/sources/ashby.mjs already requests `?includeCompensation=true`
 * so salary information surfaces in the SPA where the board exposes it.
 *
 * An explicit `api:` is honoured only for the real API host — checked on the
 * PARSED URL, never `includes('ashbyhq')`, which any query param satisfies.
 */
import { fetchAshby } from '../../sources/ashby.mjs';

const URL_PATTERN = /jobs\.ashbyhq\.com\/([^/?#]+)/;
const API_HOST = 'api.ashbyhq.com';

/** True when `api` is a real Ashby API URL (https + api.ashbyhq.com). */
function isAshbyApi(api) {
  if (typeof api !== 'string' || !api) return false;
  try {
    const u = new URL(api.trim());
    return u.protocol === 'https:' && u.hostname.toLowerCase() === API_HOST;
  } catch { return false; }
}

export const ashbyAdapter = {
  id: 'ashby',
  label: 'Ashby',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    return isAshbyApi(company.api) || URL_PATTERN.test(company.careers_url || '');
  },
  buildEndpoint(company) {
    if (!company || typeof company !== 'object') return null;
    if (isAshbyApi(company.api)) return company.api;
    const m = (company.careers_url || '').match(URL_PATTERN);
    if (!m) return null;
    return `https://${API_HOST}/posting-api/job-board/${m[1]}?includeCompensation=true`;
  },
  fetch: fetchAshby,
};
