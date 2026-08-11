/**
 * Eightfold AI adapter (registry contract). Parent career-ops
 * `providers/eightfold.mjs` parity (#2684).
 *
 * Eightfold is a per-tenant ATS: each company runs its own branded board at
 * `<tenant>.eightfold.ai`. It matches on either:
 *   - an explicit `provider: eightfold`, or
 *   - a `careers_url` / `api:` whose host matches the *.eightfold.ai pattern
 *     (mirroring the parent's host-pinned `detect`).
 *
 * The endpoint is the pinned `https://<tenant>.eightfold.ai/api/apply/v2/jobs`
 * built from the entry's own `api:`/careers_url. The override host is
 * re-validated against EIGHTFOLD_HOST_RE, so an off-host value falls back to
 * null and never reaches the fetch slot (parity with the a16z /
 * cryptocurrencyjobs adapters). The source-level assertEightfoldUrl is the hard
 * SSRF guard at fetch time. The branded CNAME (careers.<company>.com) is
 * deliberately NOT accepted — an entry must point at the eightfold.ai host.
 *
 *   tracked_companies:
 *     - name: Bayer
 *       careers_url: https://bayer.eightfold.ai/careers
 *       enabled: true
 *
 * The HTTP fetch + JSON parsing lives in server/lib/sources/eightfold.mjs.
 */
import { fetchEightfold, buildApiUrl, EIGHTFOLD_HOST_RE } from '../../sources/eightfold.mjs';

/** @param {unknown} value */
function isEightfoldHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && EIGHTFOLD_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

export const eightfoldAdapter = {
  id: 'eightfold',
  label: 'Eightfold',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'eightfold') return true;
    return isEightfoldHost(company.api) || isEightfoldHost(company.careers_url);
  },
  buildEndpoint(company) {
    if (!company || typeof company !== 'object') return null;
    for (const raw of [company.api, company.careers_url]) {
      if (typeof raw !== 'string' || !raw) continue;
      let u;
      try {
        u = new URL(raw);
      } catch {
        continue;
      }
      // Re-validate the override host — an off-host entry never reaches fetch.
      if (u.protocol !== 'https:' || !EIGHTFOLD_HOST_RE.test(u.hostname)) continue;
      const override = typeof company.domain === 'string' && company.domain.trim()
        ? company.domain.trim()
        : null;
      const fromUrl = u.searchParams.get('domain');
      const domain = override || (fromUrl && fromUrl.trim() ? fromUrl.trim() : null);
      return buildApiUrl({ host: u.hostname.toLowerCase(), domain }, 0);
    }
    return null;
  },
  fetch: fetchEightfold,
};
