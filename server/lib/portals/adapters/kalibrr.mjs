/**
 * Kalibrr adapter (registry contract).
 *
 * Board-wide SEA job-board aggregator (Indonesia-heavy, Philippines and
 * Thailand behind it). Matches ONLY on `provider: kalibrr` — Kalibrr is an
 * aggregator, not a company ATS, so it is never auto-detected from a
 * careers_url (the parent's detect() returns null for every entry):
 *
 *   tracked_companies:
 *     - name: Kalibrr
 *       provider: kalibrr
 *       enabled: true
 *       searchKeywords: "engineer"   # optional server-side `text` filter
 *       api: https://www.kalibrr.com/kjs/job_board/search   # optional override
 *       pageSize: 100                # optional (cap 500)
 *       max_pages: 20                # optional (cap 200)
 *
 * buildEndpoint resolves the entry's `api` override (validated, https +
 * www.kalibrr.com only) or the default search endpoint; an invalid override
 * yields null, which resolveAdapter treats as no endpoint (fail-soft per
 * company). Ported from the parent's providers/kalibrr.mjs (parity v1.253.0).
 */
import { fetchKalibrr, assertKalibrrUrl, DEFAULT_API } from '../../sources/kalibrr.mjs';

export const kalibrrAdapter = {
  id: 'kalibrr',
  label: 'Kalibrr',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'kalibrr';
  },
  buildEndpoint(company) {
    const api = company?.api;
    if (typeof api !== 'string' || !api.trim()) return DEFAULT_API;
    try {
      return assertKalibrrUrl(api.trim());
    } catch {
      // an off-host / non-https override is no endpoint (fail-soft)
      return null;
    }
  },
  fetch: fetchKalibrr,
};
