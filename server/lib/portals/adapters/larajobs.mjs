/**
 * LaraJobs adapter (registry contract). Parent career-ops parity
 * (parent `providers/larajobs.mjs`).
 *
 * A board-wide aggregator (like nodesk / weworkremotely), so it matches ONLY
 * on an explicit `provider: larajobs` field — never on careers_url. The
 * endpoint is the fixed public RSS feed, overridable via `api:` / `larajobs:`
 * (host-pinned to larajobs.com) for testing or a mirror. The source-level
 * assertLarajobsUrl is the hard SSRF guard; pinning the override here too
 * keeps an off-host value out of the fetch slot entirely.
 *
 *   tracked_companies:
 *     - name: LaraJobs
 *       provider: larajobs
 *       enabled: true
 */
import { fetchLarajobs, FEED_URL, LARAJOBS_HOST_RE } from '../../sources/larajobs.mjs';

export const larajobsAdapter = {
  id: 'larajobs',
  label: 'LaraJobs',
  matches(company) {
    return company.provider === 'larajobs';
  },
  buildEndpoint(company) {
    const override = company.larajobs || company.api;
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && LARAJOBS_HOST_RE.test(u.hostname)) return override;
      } catch { /* fall through to the canonical feed */ }
    }
    return FEED_URL;
  },
  fetch: fetchLarajobs,
};
