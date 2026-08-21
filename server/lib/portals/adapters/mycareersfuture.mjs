/**
 * MyCareersFuture adapter (registry contract).
 *
 * Singapore's national public job bank, so it matches on an explicit
 * `provider: mycareersfuture` OR a `careers_url`/`api:` whose host is
 * mycareersfuture.gov.sg. The search endpoint is fixed (overridable via `api:`,
 * still SSRF-guarded by the source's assertApiUrl); the per-entry keyword config
 * lives in the `mycareersfuture:` block, which the source reads from
 * `opts.company`.
 *
 *   tracked_companies:
 *     - name: MyCareersFuture — Software
 *       provider: mycareersfuture
 *       mycareersfuture:
 *         keywords: ["software engineer"]   # optional — falls back to profile target_roles
 *       enabled: true
 */
import { fetchMyCareersFuture, API_URL } from '../../sources/mycareersfuture.mjs';

/** true when `careers_url`/`api:` points at mycareersfuture.gov.sg over HTTPS. */
const MCF_HOST_RE = /(^|\.)mycareersfuture\.gov\.sg$/i;

function isMcfHost(company) {
  const raw = String(company.api || company.careers_url || '').trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && MCF_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

export const mycareersfutureAdapter = {
  id: 'mycareersfuture',
  label: 'MyCareersFuture',
  matches(company) {
    if (company.provider === 'mycareersfuture') return true;
    return isMcfHost(company);
  },
  buildEndpoint(company) {
    // Fixed national search endpoint; `api:` may override for a mirror/test,
    // still host-pinned by the source's assertApiUrl.
    return company.api || API_URL;
  },
  fetch: fetchMyCareersFuture,
};
