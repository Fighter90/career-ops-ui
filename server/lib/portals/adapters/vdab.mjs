/**
 * VDAB adapter (registry contract).
 *
 * Matches ONLY on `provider: vdab`. The base search API URL is host-pinned to
 * www.vdab.be (overridable via `api:`, still SSRF-guarded by the source); the
 * per-entry keyword config lives in the `vdab:` block, which the source reads
 * from `opts.company`.
 */
import { fetchVdab, API_URL } from '../../sources/vdab.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

// Exact host match — mirrors the source's assertVdabUrl.
const VDAB_HOST_RE = /^www\.vdab\.be$/i;

export const vdabAdapter = {
  id: 'vdab',
  label: 'VDAB',
  matches(company) {
    return company.provider === 'vdab';
  },
  buildEndpoint(company) {
    return pinnedOverride(company.api, VDAB_HOST_RE) || API_URL;
  },
  fetch: fetchVdab,
};
