/**
 * Gem adapter (registry contract). Per-tenant career board on the shared,
 * public jobs.gem.com GraphQL batch endpoint.
 *
 * Detects a Gem board from a `careers_url`/`api:` whose host is exactly
 * `jobs.gem.com` (with a board id in the first path segment,
 * `https://jobs.gem.com/<boardId>`), or from an explicit `provider: gem` (which
 * still needs a resolvable `careers_url`/`api:` — there is no shared canonical
 * feed without a board id). An entry that instead pins Gem's documented REST
 * surface — `https://api.gem.com/job_board/v0/<board>/job_posts` in `api:` —
 * is claimed too and its URL handed to the fetcher verbatim (the source's
 * opt-in REST mode).
 *
 * Both shapes are validated on the PARSED URL, so buildEndpoint returns null
 * for anything it can't resolve and an off-host value never reaches the fetch
 * slot. An unusable `api:` never hides a usable `careers_url`. The HTTP fetch +
 * normalization live in server/lib/sources/gem.mjs.
 */
import {
  fetchGem,
  resolveBoardId,
  resolveGemRestUrl,
  GEM_API_URL,
} from '../../sources/gem.mjs';

/** Board id for a jobs.gem.com URL: explicit `api:` first, then careers_url. */
function boardId(company) {
  if (!company) return null;
  for (const raw of [company.api, company.careers_url]) {
    if (typeof raw !== 'string') continue;
    const id = resolveBoardId(raw.trim());
    if (id) return id;
  }
  return null;
}

/** The opt-in REST URL the entry pinned in `api:`, or null. */
function restUrl(company) {
  if (!company || typeof company !== 'object') return null;
  return resolveGemRestUrl(company);
}

export const gemAdapter = {
  id: 'gem',
  label: 'Gem',
  matches(company) {
    return restUrl(company) !== null || boardId(company) !== null;
  },
  buildEndpoint(company) {
    const rest = restUrl(company);
    if (rest) return rest.href;
    const id = boardId(company);
    return id ? `${GEM_API_URL}?board=${id}` : null;
  },
  fetch: fetchGem,
};
