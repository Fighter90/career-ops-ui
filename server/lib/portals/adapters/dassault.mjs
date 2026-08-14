/**
 * Dassault Systèmes adapter (registry contract).
 *
 * Single global Exalead endpoint (like ibm / amazon), so a tracked_companies
 * entry selects it explicitly with `provider: dassault` OR via a careers_url/api
 * whose host is 3ds.com. The endpoint is
 * host-pinned to www.3ds.com; the source-level assertDassaultUrl is the hard
 * SSRF guard.
 *
 *   tracked_companies:
 *     - name: Dassault Systèmes
 *       provider: dassault
 */
import { fetchDassault, FEED_BASE } from '../../sources/dassault.mjs';

// Host match — `3ds.com` or any `*.3ds.com` subdomain. Matches on the host, not a
// path segment, so evil.com/x.3ds.com can't spoof it.
function isDassaultHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const host = new URL(value).host.toLowerCase();
    return host === '3ds.com' || host.endsWith('.3ds.com');
  } catch {
    return false;
  }
}

export const dassaultAdapter = {
  id: 'dassault',
  label: 'Dassault Systèmes',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'dassault') return true;
    return isDassaultHost(company.api) || isDassaultHost(company.careers_url);
  },
  buildEndpoint() {
    // Global endpoint — no per-tenant config. The source pins the host.
    return FEED_BASE;
  },
  fetch: fetchDassault,
};
