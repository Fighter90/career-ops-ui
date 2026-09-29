/**
 * OCC Mundial adapter (registry contract).
 *
 * A board-wide job feed for occ.com.mx (Mexico), so it matches ONLY on an
 * explicit `provider: occ` field — never on careers_url, or every employer
 * that happens to post there would pull the whole board. Search URLs are
 * composed per query/state inside the source; the endpoint is the fixed board
 * root, overridable via `occ_url:` / `api:` (host-pinned to www.occ.com.mx,
 * HTTPS only) for testing. The source-level assertOccUrl is the hard SSRF
 * guard, re-checked before every page fetch; pinning the override here too
 * keeps an off-host value out of the fetch slot.
 *
 *   tracked_companies:
 *     - name: OCC Mundial
 *       provider: occ
 *       occ:
 *         queries: ["automatizacion", "robotica"]  # REQUIRED
 *         states: ["nuevo-leon"]                   # optional
 *         max_pages: 3                             # optional, hard cap 10
 *       enabled: true
 *
 * The HTTP fetch and HTML parsing live in server/lib/sources/occ.mjs.
 */
import { fetchOcc, BASE_URL } from '../../sources/occ.mjs';

// Exact host match — mirrors the source's assertOccUrl so an override the
// adapter accepts can never be rejected later by the fetch-time guard.
const OCC_HOST_RE = /^www\.occ\.com\.mx$/i;

export const occAdapter = {
  id: 'occ',
  label: 'OCC Mundial',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'occ';
  },
  buildEndpoint(company) {
    const override = company && (company.occ_url || company.api);
    if (typeof override === 'string' && override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && OCC_HOST_RE.test(u.hostname)
          && !u.username && !u.password && !u.port) return u.href;
      } catch { /* fall through to the fixed board root */ }
    }
    return BASE_URL;
  },
  fetch: fetchOcc,
};
