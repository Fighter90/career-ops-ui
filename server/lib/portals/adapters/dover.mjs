/**
 * Dover adapter (registry contract).
 *
 * Single-company ATS — matches on an explicit `provider: dover` OR a
 * `careers_url` on the Dover host naming a board:
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
  // `provider: dover` selects explicitly; a careers_url on app.dover.com whose
  // path names a `<Company>/careers/<uuid>` board auto-detects (the header
  // doc's "auto-detects a Dover-hosted careers page" — resolveBoard does the
  // https + host + shape checks and null-guards the entry itself).
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'dover') return true;
    return !!resolveBoard(company);
  },
  buildEndpoint(company) {
    const board = resolveBoard(company);
    return board ? apiUrlFor(board.board, 0) : null;
  },
  fetch: fetchDover,
};
