/**
 * Get on Board adapter (registry contract).
 *
 * A board-wide aggregator, so it matches ONLY on an explicit `provider: getonbrd`
 * field — never on careers_url. The endpoint is the fixed public category feed,
 * overridable via `getonbrd:` / `api:` (host-pinned to www.getonbrd.com) for
 * testing or a mirror. The source-level assertGetonbrdUrl is the hard SSRF guard;
 * pinning the override here too keeps an off-host value out of the fetch slot.
 *
 *   tracked_companies:
 *     - name: Get on Board
 *       provider: getonbrd
 *       enabled: true
 */
import { fetchGetonbrd, FEED_BASE } from '../../sources/getonbrd.mjs';

// Exact host match — mirrors the source's assertGetonbrdUrl so an override the
// adapter accepts can never be rejected later by the fetch-time guard.
const GETONBRD_HOST_RE = /^www\.getonbrd\.com$/i;

export const getonbrdAdapter = {
  id: 'getonbrd',
  label: 'Get on Board',
  matches(company) {
    return company.provider === 'getonbrd';
  },
  buildEndpoint(company) {
    const override = company.getonbrd || company.api;
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && GETONBRD_HOST_RE.test(u.hostname)) return override;
      } catch { /* fall through to the canonical feed */ }
    }
    return FEED_BASE;
  },
  fetch: fetchGetonbrd,
};
