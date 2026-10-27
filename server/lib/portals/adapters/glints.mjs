/**
 * Glints adapter (registry contract).
 *
 * Matches ONLY on `provider: glints`. The GraphQL endpoint is fixed
 * (overridable via `api:`, validated against the Glints host allowlist in the
 * source); per-entry search config lives in the `glints:` block, which the
 * source reads from `opts.company`.
 */
import { fetchGlints, DEFAULT_API } from '../../sources/glints.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact-host match — mirrors the source's ALLOWED_GLINTS_HOSTS assert so an
// override the adapter accepts is never rejected by the fetch-time guard.
const GLINTS_HOST_RE = /^(?:www\.glints\.com|glints\.com|glints\.id)$/i;

export const glintsAdapter = {
  id: 'glints',
  label: 'Glints',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'glints';
  },
  // The override is pinned to the allowlist (FULL-M3): an off-host or
  // non-https value falls back to the canonical endpoint; garbage never throws.
  buildEndpoint(company) {
    return pinnedOverride(company?.api, GLINTS_HOST_RE) || DEFAULT_API;
  },
  fetch: fetchGlints,
};
