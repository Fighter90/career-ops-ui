/**
 * Gem adapter (registry contract). Per-tenant career board on the shared,
 * public jobs.gem.com GraphQL batch endpoint.
 *
 * Detects a Gem board from a `careers_url`/`api:` whose host is exactly
 * `jobs.gem.com` (with a board id in the first path segment,
 * `https://jobs.gem.com/<boardId>`), or from an explicit `provider: gem` (which
 * still needs a resolvable `careers_url`/`api:` — there is no shared canonical
 * feed without a board id).
 *
 * Unlike the other per-tenant ATS adapters the origin is a single fixed host,
 * so the board id is threaded to the fetcher via the endpoint's `?board=`
 * query param. buildEndpoint returns null for anything it can't resolve to a
 * board id, so an off-host value never reaches the fetch slot. The HTTP fetch +
 * normalization live in server/lib/sources/gem.mjs.
 */
import { fetchGem, resolveBoardId, GEM_API_URL } from '../../sources/gem.mjs';

function boardId(company) {
  if (!company) return null;
  return resolveBoardId(String(company.api || company.careers_url || '').trim());
}

export const gemAdapter = {
  id: 'gem',
  label: 'Gem',
  matches(company) {
    if (!company) return false;
    if (company.provider === 'gem') return boardId(company) !== null;
    return boardId(company) !== null;
  },
  buildEndpoint(company) {
    const id = boardId(company);
    return id ? `${GEM_API_URL}?board=${id}` : null;
  },
  fetch: fetchGem,
};
