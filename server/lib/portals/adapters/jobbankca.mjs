/**
 * Job Bank (Canada) adapter (registry contract).
 *
 * A national public job board (jobbank.gc.ca), so it matches on an explicit
 * `provider: jobbankca` OR a `careers_url`/`api:` whose host is jobbank.gc.ca.
 * The feed endpoint is fixed (overridable via `api:`, still SSRF-guarded by the
 * source); the per-entry keyword config lives in the `jobbankca:` block, which
 * the source reads from `opts.company`.
 *
 *   tracked_companies:
 *     - name: Job Bank Canada — Software
 *       provider: jobbankca
 *       jobbankca:
 *         keywords: ["software engineer"]   # optional — falls back to profile target_roles
 *       enabled: true
 */
import { fetchJobBankCa, FEED_URL } from '../../sources/jobbankca.mjs';

/** true when `careers_url`/`api:` points at jobbank.gc.ca over HTTPS. */
const JOBBANKCA_HOST_RE = /(^|\.)jobbank\.gc\.ca$/i;

function isJobBankHost(company) {
  const raw = String(company.api || company.careers_url || '').trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && JOBBANKCA_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

export const jobbankcaAdapter = {
  id: 'jobbankca',
  label: 'Job Bank (Canada)',
  matches(company) {
    if (company.provider === 'jobbankca') return true;
    return isJobBankHost(company);
  },
  buildEndpoint(company) {
    // Fixed national feed; `api:` may override for a mirror/test, still
    // host-pinned by the source's assertJobBankUrl.
    return company.api || FEED_URL;
  },
  fetch: fetchJobBankCa,
};
