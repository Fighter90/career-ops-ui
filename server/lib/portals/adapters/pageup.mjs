/**
 * PageUp adapter (registry contract).
 *
 * Single-company vendor-hosted careers site — matches ONLY on
 * `provider: pageup`, with `careers_url` on the vendor host:
 *   https://careers.pageuppeople.com/{tenant}/{site}/{lang}/…
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Example University
 *       provider: pageup
 *       careers_url: https://careers.pageuppeople.com/932/cw/en/all-jobs
 *       enabled: true
 *       max_pages: 5          # optional, capped at 200
 *
 * A branded domain (jobs.hku.hk) is deliberately not claimed — point the
 * entry at the vendor-host URL.
 */
import {
  fetchPageup,
  assertPageupUrl,
  ORIGIN,
} from '../../sources/pageup.mjs';

export const pageupAdapter = {
  id: 'pageup',
  label: 'PageUp',
  matches(company) {
    return company.provider === 'pageup';
  },
  // Host-pinned, paired with the source's own assert: an on-host https
  // careers_url is honoured verbatim; anything else falls back to null and
  // fetch() rejects with the "cannot derive a tenant URL" message (fail-soft
  // per company, named in the scan result).
  buildEndpoint(company) {
    // First VALID candidate wins: an off-host override (a branded domain)
    // must not swallow an on-host careers_url that follows it.
    for (const candidate of [company.pageup, company.api, company.careers_url]) {
      if (typeof candidate !== 'string' || !candidate.trim()) continue;
      try {
        return assertPageupUrl(candidate.trim());
      } catch {
        // off-host / non-https → try the next candidate
      }
    }
    return ORIGIN;
  },
  fetch: fetchPageup,
};
