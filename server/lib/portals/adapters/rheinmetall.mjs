/**
 * Rheinmetall adapter (registry contract). Parent career-ops parity
 * (parent `providers/rheinmetall.mjs`).
 *
 * Single-company SSR list (like dassault / hecklerkoch), so a tracked_companies
 * entry selects it explicitly with `provider: rheinmetall` OR via a
 * careers_url/api whose host is rheinmetall.com (mirroring the parent's
 * `detect`). The endpoint is a plain list URL — the `?page=N` pagination lives
 * inside the fetcher, driven by opts.company (established repo rule). The
 * source-level assertRheinmetallUrl is the hard SSRF guard.
 *
 *   tracked_companies:
 *     - name: Rheinmetall
 *       careers_url: https://www.rheinmetall.com/en/career/vacancies
 *       max_pages: 30        # optional walk cap (default 150)
 */
import { fetchRheinmetall, resolveListUrl, DEFAULT_LIST_URL, RHEINMETALL_HOST_RE } from '../../sources/rheinmetall.mjs';

// Host match on api/careers_url — matches on the host, not a path segment, so
// evil.com/x.rheinmetall.com can't spoof it.
function isRheinmetallHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    return RHEINMETALL_HOST_RE.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

export const rheinmetallAdapter = {
  id: 'rheinmetall',
  label: 'Rheinmetall',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'rheinmetall') return true;
    return isRheinmetallHost(company.api) || isRheinmetallHost(company.careers_url);
  },
  buildEndpoint(company) {
    // Keep an explicit /{lang}/career/vacancies URL, default any other on-host
    // URL to the EN list; a provider-selected entry without a usable URL gets
    // the canonical default. Always a plain string (or null for foreign hosts).
    const resolved = resolveListUrl(company || {});
    if (resolved) return resolved;
    return company && company.provider === 'rheinmetall' ? DEFAULT_LIST_URL : null;
  },
  fetch: fetchRheinmetall,
};
