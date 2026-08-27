/**
 * CareerViet adapter (registry contract).
 *
 * A board-wide job feed for careerviet.vn, so it matches ONLY on an explicit
 * `provider: careerviet` field — never on careers_url. The page-1 endpoint is
 * built from the entry's `searchKeywords` / `searchLocation` via the source's
 * `buildListUrl`, overridable via `careerviet:` / `api:` (host-pinned to
 * careerviet.vn) for testing or a mirror. The source-level assertCareerVietUrl
 * is the hard SSRF guard; pinning the override here too keeps an off-host
 * value out of the fetch slot.
 *
 *   tracked_companies:
 *     - name: CareerViet
 *       provider: careerviet
 *       searchKeywords: backend        # optional — narrows the listing
 *       searchLocation: Ho Chi Minh    # optional — pins a recognized city
 *       max_pages: 10                  # optional
 *       enabled: true
 */
import { fetchCareerviet, buildListUrl } from '../../sources/careerviet.mjs';

// Exact host match — mirrors the source's assertCareerVietUrl so an override
// the adapter accepts can never be rejected later by the fetch-time guard.
const CAREERVIET_HOST_RE = /^careerviet\.vn$/i;

export const careervietAdapter = {
  id: 'careerviet',
  label: 'CareerViet',
  matches(company) {
    return !!company && company.provider === 'careerviet';
  },
  buildEndpoint(company) {
    const override = company && (company.careerviet || company.api);
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && CAREERVIET_HOST_RE.test(u.hostname)) return override;
      } catch { /* fall through to the derived endpoint */ }
    }
    return buildListUrl(company || {}, 1);
  },
  fetch: fetchCareerviet,
};
