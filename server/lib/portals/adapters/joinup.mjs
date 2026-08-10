/**
 * joinup.ch adapter (registry contract). Parent career-ops parity.
 *
 * joinup is a board-wide feed of Swiss startup jobs, auto-detected from a
 * `careers_url` whose host is joinup.ch (mirrors the parent provider's
 * hostname-anchored `detect`). The endpoint is the fixed, host-pinned browse
 * page (BROWSE_URL); the source fetches that constant regardless, so the
 * adapter simply gates on the host match.
 *
 *   tracked_companies:
 *     - name: JOINUP
 *       careers_url: https://joinup.ch/browse/jobs   # auto-detected
 *       enabled: true
 */
import { fetchJoinup, BROWSE_URL, JOINUP_HOST_RE } from '../../sources/joinup.mjs';

/**
 * Host-anchored match on careers_url — rejects path-spoofed / off-host URLs.
 * @param {any} company
 * @returns {boolean}
 */
function matchesJoinup(company) {
  if (!company) return false;
  const raw = String(company.careers_url || '').trim();
  if (!raw) return false;
  try {
    return JOINUP_HOST_RE.test(new URL(raw).hostname);
  } catch {
    return false;
  }
}

export const joinupAdapter = {
  id: 'joinup',
  label: 'JOINUP',
  matches: matchesJoinup,
  buildEndpoint(company) {
    return matchesJoinup(company) ? BROWSE_URL : null;
  },
  fetch: fetchJoinup,
};
