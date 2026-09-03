/**
 * Built In adapter (registry contract).
 *
 * Board-wide US tech aggregator, like arbeitnow / thehub: employers post to
 * Built In directly and it does not index other boards. There is no detect() —
 * an entry reaches it only by asking for it explicitly.
 *
 *   tracked_companies:
 *     - name: Built In
 *       provider: builtin
 *       builtin:
 *         host: www.builtinseattle.com   # optional, allowlisted markets only
 *         queries: ["product manager"]   # or categories:
 *         max_pages: 3
 *
 * There is deliberately NO default query: a shared source must not ship one
 * user's search terms, so an entry with neither `queries:` nor `categories:`
 * scans nothing and says so. The source-level `assertHost` is the SSRF guard,
 * checked before every page fetch.
 */
import { fetchBuiltin } from '../../sources/builtin.mjs';

export const builtinAdapter = {
  id: 'builtin',
  label: 'Built In',
  matches(company) {
    // Explicit selection only — a board-wide aggregator must never be inferred
    // from a careers_url, or every employer that happens to post there would
    // pull the whole board.
    return !!company && typeof company === 'object' && company.provider === 'builtin';
  },
  buildEndpoint() {
    // Page URLs are composed per query/category inside the source, which also
    // re-checks the host against the allowlist before each fetch.
    return 'https://builtin.com/jobs';
  },
  fetch: fetchBuiltin,
};
