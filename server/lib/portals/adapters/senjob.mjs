/**
 * Senjob adapter (registry contract).
 *
 * Board-wide Senegalese job feed at a single listing URL (like rheinmetall's
 * single-company SSR list), so a tracked_companies entry selects it explicitly
 * with `provider: senjob` OR via a careers_url/api whose host is senjob.com. The
 * endpoint is a plain list URL — the `?page=N` pagination lives inside the
 * fetcher, driven by opts.company (established repo rule). The source-level
 * assertSenjobUrl is the hard SSRF guard.
 *
 *   tracked_companies:
 *     - name: Senjob
 *       provider: senjob
 *       max_pages: 5        # optional walk cap (default 10, hard cap 50)
 */
import { fetchSenjob, resolveListUrl, DEFAULT_LIST_URL, SENJOB_HOST_RE } from '../../sources/senjob.mjs';

// Host match on api/careers_url — matches on the host, not a path segment, so
// evil.com/x.senjob.com can't spoof it.
function isSenjobHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    return SENJOB_HOST_RE.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

export const senjobAdapter = {
  id: 'senjob',
  label: 'Senjob',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'senjob') return true;
    return isSenjobHost(company.api) || isSenjobHost(company.careers_url);
  },
  buildEndpoint(company) {
    // Resolve an on-host URL to the canonical board listing; a provider-selected
    // entry without a usable URL gets the canonical default. Always a plain
    // string (or null for foreign hosts).
    const resolved = resolveListUrl(company || {});
    if (resolved) return resolved;
    return company && company.provider === 'senjob' ? DEFAULT_LIST_URL : null;
  },
  fetch: fetchSenjob,
};
