/**
 * SolidJobs adapter (registry contract). Parent career-ops parity.
 *
 * Matches when `careers_url` (or `api:`) is a SolidJobs public-api offers URL, or
 * on an explicit `provider: solidjobs`. The HTTP fetch + normalization lives in
 * server/lib/sources/solidjobs.mjs.
 */
import { fetchSolidJobs, isSolidJobsUrl } from '../../sources/solidjobs.mjs';

function resolveApiUrl(company) {
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
