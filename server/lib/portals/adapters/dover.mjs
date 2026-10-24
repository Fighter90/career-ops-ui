/**
 * Dover adapter (registry contract).
 *
 * Single-company ATS — matches ONLY on `provider: dover`, with `careers_url`
 * on the Dover host:
 *   https://app.dover.com/<Company>/careers/<board-uuid>
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Acme
 *       provider: dover
 *       careers_url: https://app.dover.com/Acme/careers/0f0e9d8c-7b6a-5432-1098-76543210fedc
 *       enabled: true
 *       max_pages: 5          # optional, capped at 20
 *
 * buildEndpoint resolves the board from the careers_url and returns the
 * page-0 list API URL; a careers_url that does not name a
 * `<Company>/careers/<uuid>` path yields null, which resolveAdapter treats
 * as no endpoint (fail-soft per company). Ported from the parent's
 * providers/dover.mjs (parity v1.253.0).
 */
import {
  fetchDover,
  resolveBoard,
  apiUrlFor,
} from '../../sources/dover.mjs';

export const doverAdapter = {
  id: 'dover',
  label: 'Dover',
  matches(company) {
    return company.provider === 'dover';
  },
  buildEndpoint(company) {
    const board = resolveBoard(company);
    return board ? apiUrlFor(board.board, 0) : null;
  },
  fetch: fetchDover,
};
