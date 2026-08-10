/**
 * Remotli adapter (registry contract). Parent career-ops parity.
 *
 * remotli.ch is a board-wide curated feed of remote roles at Swiss companies, so
 * a single tracked entry claims the whole board. Detection mirrors the parent's
 * host-based `detect`: a careers_url on remotli.ch, or an explicit
 * `provider: remotli`. The endpoint is the fixed, host-pinned first-page base
 * (`https://remotli.ch/api/jobs`); the source appends `?page=N&limit=50&remote=all`
 * itself, so the adapter's endpoint stays the bare base. assertRemotliUrl in the
 * source is the hard SSRF guard.
 *
 *   tracked_companies:
 *     - name: Remotli (Swiss remote board)
 *       provider: remotli
 *       careers_url: https://remotli.ch/
 *       enabled: true
 */
import { fetchRemotli, FEED_BASE } from '../../sources/remotli.mjs';

// Host-based claim mirroring the source's HOST_RE — a remotli.ch careers_url is
// enough; an explicit provider is the alternative for entries with no URL.
const REMOTLI_HOST_RE = /^(www\.)?remotli\.ch$/i;

/** @param {any} company */
function careersHostMatches(company) {
  const raw = typeof company?.careers_url === 'string' ? company.careers_url : '';
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && REMOTLI_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

export const remotliAdapter = {
  id: 'remotli',
  label: 'Remotli',
  matches(company) {
    if (!company) return false;
    return company.provider === 'remotli' || careersHostMatches(company);
  },
  buildEndpoint() {
    return FEED_BASE;
  },
  fetch: fetchRemotli,
};
