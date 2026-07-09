/**
 * Heckler & Koch adapter (registry contract). Parent career-ops parity
 * (parent `providers/hecklerkoch.mjs`).
 *
 * Single-company SSR list (like dassault / rheinmetall), so a tracked_companies
 * entry selects it explicitly with `provider: hecklerkoch` OR via a
 * careers_url/api whose host is heckler-koch.com (mirroring the parent's
 * `detect`). The endpoint is host-pinned; the source-level
 * assertHecklerkochUrl is the hard SSRF guard.
 *
 *   tracked_companies:
 *     - name: Heckler & Koch
 *       careers_url: https://www.heckler-koch.com/de/Karriere/Stellenangebote
 */
import { fetchHecklerkoch, resolveListUrl, DEFAULT_LIST_URL, HECKLERKOCH_HOST_RE } from '../../sources/hecklerkoch.mjs';

// Host match on api/careers_url — matches on the host, not a path segment, so
// evil.com/x.heckler-koch.com can't spoof it.
function isHecklerkochHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    return HECKLERKOCH_HOST_RE.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

export const hecklerkochAdapter = {
  id: 'hecklerkoch',
  label: 'Heckler & Koch',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'hecklerkoch') return true;
    return isHecklerkochHost(company.api) || isHecklerkochHost(company.careers_url);
  },
  buildEndpoint(company) {
    // Keep an explicit Stellenangebote URL, default any other on-host URL to
    // the DE list; a provider-selected entry without a usable URL gets the
    // canonical default. Always a plain string (or null for foreign hosts).
    const resolved = resolveListUrl(company || {});
    if (resolved) return resolved;
    return company && company.provider === 'hecklerkoch' ? DEFAULT_LIST_URL : null;
  },
  fetch: fetchHecklerkoch,
};
