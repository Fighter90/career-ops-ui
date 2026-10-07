/**
 * SolidJobs adapter (registry contract).
 *
 * Matches when `careers_url` (or `api:`) is a SolidJobs public-api offers URL
 * (`https://solid.jobs/public-api/offers/<division>`). There is no canonical
 * default division, so a bare `provider: solidjobs` entry is NOT claimed — an
 * entry must carry one of those URLs. The HTTP fetch + normalization lives in
 * server/lib/sources/solidjobs.mjs.
 */
import { fetchSolidJobs, isSolidJobsUrl } from '../../sources/solidjobs.mjs';

function resolveApiUrl(company) {
  if (!company || typeof company !== 'object') return null;
  if (isSolidJobsUrl(company.careers_url)) return company.careers_url;
  if (isSolidJobsUrl(company.api)) return company.api;
  return null;
}

export const solidjobsAdapter = {
  id: 'solidjobs',
  label: 'SolidJobs',
  matches(company) {
    return resolveApiUrl(company) !== null;
  },
  buildEndpoint(company) {
    return resolveApiUrl(company);
  },
  fetch: fetchSolidJobs,
};
