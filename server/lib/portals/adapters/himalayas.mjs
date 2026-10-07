/**
 * Himalayas adapter (registry contract).
 *
 * Board-wide remote-only aggregator — matches ONLY on `provider: himalayas`.
 * Endpoint is the fixed public feed, overridable via `api:` / `himalayas:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Himalayas
 *       provider: himalayas
 *       enabled: true
 */
import { fetchHimalayas, FEED_URL } from '../../sources/himalayas.mjs';

export const himalayasAdapter = {
  id: 'himalayas',
  label: 'Himalayas',
  matches(company) {
    return !!company && typeof company === 'object' && company.provider === 'himalayas';
  },
  // `string | null` contract: a non-string api falls back to the canonical
  // feed; garbage input never throws.
  buildEndpoint(company) {
    const api = company && typeof company === 'object' && typeof company.api === 'string'
      ? company.api
      : '';
    const override = company && typeof company === 'object' && typeof company.himalayas === 'string'
      ? company.himalayas
      : '';
    return override || api || FEED_URL;
  },
  fetch: fetchHimalayas,
};
