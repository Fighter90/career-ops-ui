/**
 * Cryptocurrency Jobs adapter (registry contract).
 *
 * A board-wide aggregator, so it matches ONLY on an explicit
 * `provider: cryptocurrencyjobs` field — never on careers_url. The endpoint is
 * the fixed public RSS feed, overridable via `api:` / `cryptocurrencyjobs:`
 * (host-pinned to cryptocurrencyjobs.co) for testing or a mirror. The
 * source-level assertCryptocurrencyJobsUrl is the hard SSRF guard; pinning the
 * override here too keeps an off-host value out of the fetch slot entirely.
 *
 *   tracked_companies:
 *     - name: Cryptocurrency Jobs
 *       provider: cryptocurrencyjobs
 *       enabled: true
 */
import { fetchCryptocurrencyJobs, FEED_URL, CRYPTOCURRENCYJOBS_HOST_RE } from '../../sources/cryptocurrencyjobs.mjs';

export const cryptocurrencyjobsAdapter = {
  id: 'cryptocurrencyjobs',
  label: 'Cryptocurrency Jobs',
  matches(company) {
    return company.provider === 'cryptocurrencyjobs';
  },
  buildEndpoint(company) {
    const override = company.cryptocurrencyjobs || company.api;
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && CRYPTOCURRENCYJOBS_HOST_RE.test(u.hostname)) return override;
      } catch { /* fall through to the canonical feed */ }
    }
    return FEED_URL;
  },
  fetch: fetchCryptocurrencyJobs,
};
