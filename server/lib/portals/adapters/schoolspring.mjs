/**
 * SchoolSpring adapter (registry contract).
 *
 * SchoolSpring hosts US K-12 districts at `<district>.schoolspring.com`, one
 * portal entry per district. It matches on either:
 *   - an explicit `provider: schoolspring`, or
 *   - a `careers_url` / `api:` on an https `<district>.schoolspring.com` host
 *     (mirroring the parent provider's `detect()`; the platform's own
 *     `www`/`api` hosts and look-alikes such as
 *     `x.schoolspring.com.evil.example` are not claimed).
 * An explicit, DIFFERENT provider always wins.
 *
 *   tracked_companies:
 *     - name: Example School District
 *       careers_url: https://example.schoolspring.com/
 *       max_pages: 20        # optional, 100 postings per page, capped at 100
 *       enabled: true
 *
 * `buildEndpoint` returns the district origin (`https://<district>/`), or null
 * when there is no district host to pin — an explicit provider on another host
 * still yields null. The source requests only the fixed api.schoolspring.com
 * list API, with the district as a query value. The fetch + parse lives in
 * server/lib/sources/schoolspring.mjs.
 */
import { fetchSchoolSpring, resolveDistrictHost } from '../../sources/schoolspring.mjs';

/** The entry's district host (`api:` first, then `careers_url`), or null. */
function districtHost(company) {
  if (!company || typeof company !== 'object') return null;
  for (const value of [company.api, company.careers_url]) {
    const host = resolveDistrictHost(value);
    if (host) return host;
  }
  return null;
}

export const schoolspringAdapter = {
  id: 'schoolspring',
  label: 'SchoolSpring',

  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider) return company.provider === 'schoolspring';
    return districtHost(company) !== null;
  },

  buildEndpoint(company) {
    const host = districtHost(company);
    return host ? `https://${host}/` : null;
  },

  fetch: fetchSchoolSpring,
};
