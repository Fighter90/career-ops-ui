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
import { pinnedOverride } from '../../sources/_override.mjs';

/** true when `careers_url`/`api:` points at mycareersfuture.gov.sg over HTTPS. */
const MCF_HOST_RE = /(^|\.)mycareersfuture\.gov\.sg$/i;

// Endpoint-override pin — the exact API host, mirroring the source's
// assertApiUrl so an override the adapter accepts is never rejected later.
const MCF_API_HOST_RE = /^api\.mycareersfuture\.gov\.sg$/i;

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
    // pinned to the API host here (FULL-M3) as well as by the source's
    // assertApiUrl.
    return pinnedOverride(company.api, MCF_API_HOST_RE) || API_URL;
  },
  fetch: fetchMyCareersFuture,
};
