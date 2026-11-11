/**
 * Tes adapter (registry contract) — UK and international teaching jobs
 * (tes.com/jobs), parent career-ops `providers/tes.mjs` parity (#6685,
 * CAR-257).
 *
 * Board-wide source — matches ONLY on `provider: tes`. Endpoint is the fixed
 * board URL, overridable via `tes:` / `api:`.
 *
 * Example portals.yml entry:
 *
 *   job_boards:
 *     - name: Tes
 *       provider: tes
 *       enabled: true
 *     # optional:
 *     #   keywords: maths   # Tes's own keyword search, applied server-side
 *     #   max_pages: 40     # pages of 50 per scan (default 150, capped at 400)
 */
import { fetchTes, TES_HOST_RE, BOARD_URL } from '../../sources/tes.mjs';
import { pinnedOverride } from '../../sources/_override.mjs';

export const tesAdapter = {
  id: 'tes',
  label: 'Tes',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'tes';
  },
  // The override is pinned to www.tes.com (FULL-M3): an off-host or non-https
  // value falls back to the canonical board URL; garbage never throws. The
  // endpoint is re-pinned inside the source itself (assertTesUrl) before every
  // request.
  buildEndpoint(company) {
    return pinnedOverride(company?.tes, TES_HOST_RE)
      || pinnedOverride(company?.api, TES_HOST_RE)
      || BOARD_URL;
  },
  fetch: fetchTes,
};
