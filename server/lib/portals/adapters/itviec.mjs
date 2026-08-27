/**
 * ITviec adapter (registry contract).
 *
 * A board-wide aggregator (Vietnam's largest IT job board), so it matches
 * ONLY on an explicit `provider: itviec` field — never on careers_url. The
 * endpoint is the page-1 listing URL built from the entry's `searchKeywords` /
 * `searchLocation`, overridable via `itviec:` / `api:` (host-pinned to
 * itviec.com) for testing or a mirror. The source-level assertItviecUrl is the
 * hard SSRF guard; pinning the override here too keeps an off-host value out
 * of the fetch slot.
 *
 *   tracked_companies:
 *     - name: ITviec
 *       provider: itviec
 *       searchKeywords: backend      # optional, narrows the listing
 *       searchLocation: Ho Chi Minh  # optional, pins a city
 *       max_pages: 10                # optional cap (default 10, hard ceiling 50)
 *       enabled: true
 */
import { fetchItviec, buildListUrl } from '../../sources/itviec.mjs';

// Exact host match — mirrors the source's assertItviecUrl so an override the
// adapter accepts can never be rejected later by the fetch-time guard.
const ITVIEC_HOST_RE = /^itviec\.com$/i;

export const itviecAdapter = {
  id: 'itviec',
  label: 'ITviec',
  matches(company) {
    return !!company && company.provider === 'itviec';
  },
  buildEndpoint(company) {
    const override = company && (company.itviec || company.api);
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && ITVIEC_HOST_RE.test(u.hostname)) return override;
      } catch { /* fall through to the derived endpoint */ }
    }
    return buildListUrl(company, 1);
  },
  fetch: fetchItviec,
};
