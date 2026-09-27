/**
 * HiringRoom adapter (registry contract).
 *
 * HiringRoom is a per-tenant LATAM ATS: every employer runs its own
 * `<company>.hiringroom.com` microsite, so there is one portal entry per
 * employer (like greenhouse/lever). It matches on either:
 *   - an explicit `provider: hiringroom`, or
 *   - a `careers_url` / `api:` on https `hiringroom.com` or a subdomain
 *     (mirroring the parent provider's `detect()`; a look-alike host such as
 *     `evil-hiringroom.com` is not claimed).
 * An explicit, DIFFERENT provider always wins.
 *
 *   tracked_companies:
 *     - name: Grow UP HR
 *       careers_url: https://growuphr.hiringroom.com/jobs          # legacy layout
 *       enabled: true
 *     - name: Acme
 *       careers_url: https://acme.hiringroom.com/portal/jobs       # JSON-LD layout
 *       enabled: true
 *
 * `buildEndpoint` returns the entry's own host-pinned URL, or null when there
 * is nothing it can pin (no shared canonical feed exists). The source-level
 * `assertHiringRoomUrl` is still the hard SSRF guard before the request. The
 * fetch + parse lives in server/lib/sources/hiringroom.mjs.
 */
import { fetchHiringRoom, isHiringRoomHost } from '../../sources/hiringroom.mjs';

/** The entry's https HiringRoom URL (`api:` first, then `careers_url`), or null. */
function tenantUrl(company) {
  if (!company || typeof company !== 'object') return null;
  for (const value of [company.api, company.careers_url]) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const raw = value.trim();
    try {
      const u = new URL(raw);
      if (u.protocol === 'https:' && isHiringRoomHost(u.hostname)) return raw;
    } catch { /* not a URL — try the next field */ }
  }
  return null;
}

export const hiringroomAdapter = {
  id: 'hiringroom',
  label: 'HiringRoom',

  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider) return company.provider === 'hiringroom';
    return tenantUrl(company) !== null;
  },

  buildEndpoint(company) {
    return tenantUrl(company);
  },

  fetch: fetchHiringRoom,
};
