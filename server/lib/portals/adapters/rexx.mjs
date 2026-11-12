/**
 * rexx Systems adapter (registry contract) — CAR-270, parent career-ops
 * PR #6946 parity (providers/rexx.mjs).
 *
 * Per-tenant, EXPLICIT-PIN ONLY: a rexx portal runs on the employer's own
 * branded host (jobs.<employer>.com, karriere.<employer>.de — a CNAME onto
 * rexx's cloud), so there is no URL pattern to auto-detect and this adapter
 * never claims an entry that did not opt in. Wire it with `provider: rexx`
 * and `careers_url` pointed at the portal's job list page:
 *
 *   tracked_companies:
 *     - name: ExampleCo
 *       careers_url: https://jobs.exampleco.com/stellenangebote.html
 *       provider: rexx
 *       enabled: true
 *     # optional:
 *     #   max_pages: 30   # pages walked (default 30, hard cap 200)
 *
 * buildEndpoint resolves the list URL (a bare host or a path ending in "/"
 * reads `stellenangebote.html`; query string, fragment, port and credentials
 * are discarded) and returns a STRING or null — resolveAdapter skips a
 * non-string endpoint, so an entry with an unusable careers_url resolves to
 * nothing instead of aborting a scan. The HTTP fetch + HTML walk lives in
 * server/lib/sources/rexx.mjs, which re-validates the entry and every request
 * URL it builds (assertRexxUrl) before any request.
 */
import { fetchRexx, resolveListUrl } from '../../sources/rexx.mjs';

export const rexxAdapter = {
  id: 'rexx',
  label: 'Rexx Systems',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'rexx';
  },
  buildEndpoint(company) {
    const cfg = resolveListUrl(company);
    return cfg ? cfg.listUrl : null;
  },
  fetch: fetchRexx,
};
