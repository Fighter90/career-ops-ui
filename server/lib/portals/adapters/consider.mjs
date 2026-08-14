/**
 * Consider adapter (registry contract).
 *
 * getconsider.com VC portfolio "talent network" boards. Matches ONLY on an
 * explicit `provider: consider` field — never on careers_url alone — because
 * the board id (`consider_board`) is required and is NOT derivable from the
 * host (Founderful's board id is "wingman"). The endpoint is the board's
 * same-origin `{origin}/api-boards/search-jobs` JSON search API, with the
 * origin pinned to a public https host by the source-level structural SSRF
 * guard (`resolveOrigin`). buildEndpoint returns null unless both a public
 * https careers_url AND a consider_board id are present.
 *
 *   tracked_companies:
 *     - name: Founderful (portfolio)
 *       provider: consider
 *       consider_board: wingman
 *       careers_url: https://jobs.founderful.com/jobs
 *       enabled: true
 */
import { fetchConsider, resolveOrigin, ENDPOINT_PATH } from '../../sources/consider.mjs';

export const considerAdapter = {
  id: 'consider',
  label: 'Consider',
  matches(company) {
    return !!company && company.provider === 'consider';
  },
  buildEndpoint(company) {
    const origin = resolveOrigin(company || {});
    const board = company && company.consider_board;
    return origin && board ? `${origin}${ENDPOINT_PATH}` : null;
  },
  fetch: fetchConsider,
};
