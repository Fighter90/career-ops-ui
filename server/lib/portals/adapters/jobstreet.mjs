/**
 * Jobstreet / SEEK adapter (registry contract).
 *
 * Matches ONLY on `provider: jobstreet`. The v5 JobSearch endpoint is fixed;
 * `api:` selects the MARKET by hostname (validated against the Jobstreet/SEEK
 * allowlist in the source — SEEK's Hong Kong property hk.jobsdb.com included,
 * with siteKey: HK-Main). Per-entry search config lives in the `jobstreet:`
 * block, which the source reads from `opts.company`.
 */
import { fetchJobstreet, DEFAULT_API } from '../../sources/jobstreet.mjs';

export const jobstreetAdapter = {
  id: 'jobstreet',
  label: 'Jobstreet / SEEK',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'jobstreet';
  },
  // `string | null` contract: a non-string api falls back to the canonical
  // endpoint; garbage input never throws.
  buildEndpoint(company) {
    const api = company && typeof company === 'object' && typeof company.api === 'string'
      ? company.api
      : '';
    return api || DEFAULT_API;
  },
  fetch: fetchJobstreet,
};
