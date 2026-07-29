/**
 * VDAB adapter (registry contract).
 *
 * Matches ONLY on `provider: vdab`. The base search API URL is host-pinned to
 * www.vdab.be (overridable via `api:`, still SSRF-guarded by the source); the
 * per-entry keyword config lives in the `vdab:` block, which the source reads
 * from `opts.company`.
 */
import { fetchVdab, API_URL } from '../../sources/vdab.mjs';

export const vdabAdapter = {
  id: 'vdab',
  label: 'VDAB',
  matches(company) {
    return company.provider === 'vdab';
  },
  buildEndpoint(company) {
    return company.api || API_URL;
  },
  fetch: fetchVdab,
};
