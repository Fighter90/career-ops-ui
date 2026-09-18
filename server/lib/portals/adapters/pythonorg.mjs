/**
 * Python.org Jobs adapter (registry contract).
 *
 * A board-wide feed (the official Python Software Foundation job board), so it
 * matches on an explicit `provider: pythonorg` field — AND, for parent
 * career-ops parity, on a `careers_url` that points at the board's own
 * `/jobs` page. Most board-wide adapters here match on `provider` only; this
 * one keeps the careers_url path because the parent provider's `detect()` has
 * it, hardened twice (7283db62, 6032f86d): the URL is parsed rather than
 * regex-matched, HTTPS is required, the host must be python.org / www.python.org
 * itself, and the path is matched with a boundary — so neither
 * `https://evil.com/?r=https://python.org/jobs` nor `https://python.org/jobs-archive`
 * is mistaken for the board. That predicate lives in the source
 * (`matchesPythonOrgCareersUrl`) so the adapter and the tests share one copy.
 *
 * The endpoint is the fixed public RSS feed, overridable via `pythonorg:` /
 * `api:` (host-pinned to python.org) for testing or a mirror. The source-level
 * `assertPythonOrgUrl` is the hard SSRF guard; pinning the override here too
 * keeps an off-host value out of the fetch slot in the first place.
 *
 *   tracked_companies:
 *     - name: Python.org Jobs
 *       provider: pythonorg
 *       enabled: true
 */
import {
  fetchPythonOrg,
  matchesPythonOrgCareersUrl,
  FEED_URL,
} from '../../sources/pythonorg.mjs';

// Anchored host allowlist for an endpoint override — mirrors the source's
// assertPythonOrgUrl so an override the adapter accepts can never be rejected
// later by the fetch-time guard. Unanchored, it would admit `evilpython.org`
// and `python.org.evil.com` alike.
const PYTHONORG_HOST_RE = /(^|\.)python\.org$/i;

export const pythonorgAdapter = {
  id: 'pythonorg',
  label: 'Python.org Jobs',
  matches(company) {
    if (!company) return false;
    if (company.provider === 'pythonorg') return true;
    return matchesPythonOrgCareersUrl(company.careers_url);
  },
  /**
   * @param {any} company
   * @returns {string} the feed endpoint — always a string, never an object.
   */
  buildEndpoint(company) {
    const override = (company && (company.pythonorg || company.api)) || '';
    if (typeof override === 'string' && override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && PYTHONORG_HOST_RE.test(u.hostname)) return override;
      } catch {
        /* fall through to the canonical feed */
      }
    }
    return FEED_URL;
  },
  fetch: fetchPythonOrg,
};
