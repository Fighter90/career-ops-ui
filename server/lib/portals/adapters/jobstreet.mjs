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
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact-host match — mirrors the source's ALLOWED_JOBSTREET_HOSTS assert
// (SEEK's Hong Kong property hk.jobsdb.com included; the au/nz seek.com hosts
// cover the 2026-09 SEEK host migration).
const JOBSTREET_HOST_RE = /^(?:id\.jobstreet\.com|www\.jobstreet\.com|www\.jobstreet\.co\.id|jobstreet\.com|jobstreet\.co\.id|sg\.jobstreet\.com|my\.jobstreet\.com|hk\.jobsdb\.com|www\.seek\.com\.au|www\.seek\.co\.nz|au\.seek\.com|nz\.seek\.com)$/i;

export const jobstreetAdapter = {
  id: 'jobstreet',
  label: 'Jobstreet / SEEK',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'jobstreet';
  },
  // `api:` selects the MARKET by hostname, pinned to the SEEK allowlist
  // (FULL-M3); an off-host value falls back to the canonical endpoint.
  buildEndpoint(company) {
    return pinnedOverride(company?.api, JOBSTREET_HOST_RE) || DEFAULT_API;
  },
  fetch: fetchJobstreet,
};
