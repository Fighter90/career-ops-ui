/**
 * Paylocity adapter (registry contract).
 *
 * Single-company ATS — matches on an explicit `provider: paylocity` OR a
 * `careers_url`/`api:` on the hosted board host naming a board GUID:
 *   https://recruiting.paylocity.com/Recruiting/Jobs/All/<guid>
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Acme
 *       provider: paylocity
 *       careers_url: https://recruiting.paylocity.com/Recruiting/Jobs/All/0f0e9d8c-7b6a-5432-1098-76543210fedc
 *       enabled: true
 *       max_jobs: 2000        # optional, capped at 10000
 *
 * buildEndpoint resolves the board from the careers_url and returns the
 * canonical board URL (rebuilt on the fixed host — a trailing company slug or
 * query string is dropped); a URL that does not name a `<guid>` board on the
 * Paylocity host yields null, which resolveAdapter treats as no endpoint
 * (fail-soft per company). Ported from the parent's providers/paylocity.mjs
 * (parity v1.253.2).
 */
import { fetchPaylocity, resolveBoardUrl } from '../../sources/paylocity.mjs';

export const paylocityAdapter = {
  id: 'paylocity',
  label: 'Paylocity',
  // `provider: paylocity` selects explicitly; a careers_url on
  // recruiting.paylocity.com whose path names a /Recruiting/Jobs/All/<guid>
  // board auto-detects (resolveBoardUrl does the https + host + GUID checks
  // and null-guards the entry itself).
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'paylocity') return true;
    return !!resolveBoardUrl(company);
  },
  buildEndpoint(company) {
    const url = resolveBoardUrl(company);
    return url || null;
  },
  fetch: fetchPaylocity,
};
