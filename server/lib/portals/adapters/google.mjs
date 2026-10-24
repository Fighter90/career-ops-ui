/**
 * Google adapter (registry contract).
 *
 * Board-wide source — Google Careers' server-rendered results pages. Matches
 * on an explicit `provider: google` OR the presence of a `google:` config
 * block (the parent's auto-detect: the block carries the queries and the
 * location, so naming it IS the intent to scan Google):
 *
 *   tracked_companies:
 *     - name: Google
 *       provider: google
 *       enabled: true
 *       google:
 *         location: "United States"      # optional
 *         queries: ["business strategy", ...]
 *
 * buildEndpoint returns the FIRST query's results URL — detectApi's provenance
 * link; fetchGoogle rebuilds one URL per query from the fixed BASE (one
 * first-page request per query, robots.txt-bounded — see the source).
 * Ported from the parent's providers/google.mjs (parity v1.253.0).
 */
import {
  fetchGoogle,
  assertGoogleUrl,
  buildQueryUrl,
  parseGoogleConfig,
} from '../../sources/google.mjs';

export const googleAdapter = {
  id: 'google',
  label: 'Google',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'google') return true;
    return !!company.google && typeof company.google === 'object';
  },
  // The first query's first-page results URL on the pinned host. The assert is
  // defence-in-depth — it can only fail if buildQueryUrl's BASE constant is
  // edited to an off-host value.
  buildEndpoint(company) {
    const { queries, location } = parseGoogleConfig(company);
    return assertGoogleUrl(buildQueryUrl(queries[0], location));
  },
  fetch: fetchGoogle,
};
