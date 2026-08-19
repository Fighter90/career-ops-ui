/**
 * Yourator adapter (registry contract).
 *
 * A board-wide Taiwanese aggregator. Matches on an explicit
 * `provider: yourator` OR a careers_url/api whose host is yourator.co. The API
 * list endpoint is fixed, overridable via `yourator:` / `api:` (host-pinned to
 * yourator.co) for testing or a mirror — an off-host override is ignored in
 * favour of the canonical feed. The source-level assertYouratorUrl is the hard
 * SSRF guard.
 *
 *   tracked_companies:
 *     - name: Yourator (Taiwan startup board)
 *       provider: yourator
 *       careers_url: https://www.yourator.co/jobs
 *       enabled: true
 */
import { fetchYourator, FEED_URL, YOURATOR_HOST_RE } from '../../sources/yourator.mjs';

function isYouratorHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    return YOURATOR_HOST_RE.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

export const youratorAdapter = {
  id: 'yourator',
  label: 'Yourator',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'yourator') return true;
    return isYouratorHost(company.api) || isYouratorHost(company.careers_url);
  },
  buildEndpoint(company) {
    const override = company?.yourator || company?.api;
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && YOURATOR_HOST_RE.test(u.hostname)) return override;
      } catch {
        // fall through to the canonical feed
      }
    }
    return FEED_URL;
  },
  fetch: fetchYourator,
};
