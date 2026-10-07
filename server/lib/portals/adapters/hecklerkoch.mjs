/**
 * Heckler & Koch adapter (registry contract).
 *
 * Single-company SSR list (like dassault / rheinmetall), so a tracked_companies
 * entry selects it explicitly with `provider: hecklerkoch` OR via a
 * careers_url/api on the vacancy-LIST host (www.heckler-koch.com or the apex,
 * which 301s to www). Subdomains are not the list — karriere.* is the apply
 * backend and 404s as a listing — so they are never claimed. The endpoint is
 * host-pinned; the source-level
 * assertHecklerkochUrl is the hard SSRF guard.
 *
 *   tracked_companies:
 *     - name: Heckler & Koch
 *       careers_url: https://www.heckler-koch.com/de/Karriere/Stellenangebote
 */
import { fetchHecklerkoch, resolveListUrl, DEFAULT_LIST_URL } from '../../sources/hecklerkoch.mjs';

// Only these hosts serve the SSR vacancy list. Parsed-host check, so
// evil.com/x.heckler-koch.com can't spoof it.
const LIST_HOSTS = new Set(['www.heckler-koch.com', 'heckler-koch.com']);

function isListHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' && LIST_HOSTS.has(u.hostname.toLowerCase());
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
    return isListHost(company.api) || isListHost(company.careers_url);
  },
  buildEndpoint(company) {
    if (!company || typeof company !== 'object') return null;
    // resolveListUrl defaults any other path on the trusted host to the DE
    // list and pins the apex to www; a resolved URL on some OTHER subdomain
    // (karriere.*) is not a listing, so it is ignored, never fetched.
    const resolved = resolveListUrl(company);
    if (resolved && LIST_HOSTS.has(new URL(resolved).hostname.toLowerCase())) return resolved;
    return company.provider === 'hecklerkoch' ? DEFAULT_LIST_URL : null;
  },
  fetch: fetchHecklerkoch,
};
