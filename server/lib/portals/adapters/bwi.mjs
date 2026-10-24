/**
 * BWI adapter (registry contract).
 *
 * Single-company careers site (like hecklerkoch / rheinmetall) — matches on
 * an explicit `provider: bwi` OR a `careers_url`/`api:` on the pinned host
 * www.bwi.de. The endpoint is fixed: the listing page is the only board, so
 * any on-host careers_url resolves to the same listing URL.
 *
 *   tracked_companies:
 *     - name: BWI GmbH
 *       provider: bwi
 *       careers_url: https://www.bwi.de/karriere/stellenangebote
 *       enabled: true
 *       bwi:
 *         fetchDetails: true   # optional enrichment (see the source)
 *         detailLimit: 45
 *
 * Ported from the parent's providers/bwi.mjs (parity v1.253.0).
 */
import { fetchBwi, LIST_URL, ALLOWED_HOST } from '../../sources/bwi.mjs';

// Parsed-host check, so www.bwi.de.attacker.example can't spoof it.
function isBwiHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' && u.hostname === ALLOWED_HOST;
  } catch {
    return false;
  }
}

export const bwiAdapter = {
  id: 'bwi',
  label: 'BWI',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'bwi') return true;
    return isBwiHost(company.api) || isBwiHost(company.careers_url);
  },
  // One fixed, host-pinned endpoint: the listing page IS the board.
  buildEndpoint() {
    return LIST_URL;
  },
  fetch: fetchBwi,
};
