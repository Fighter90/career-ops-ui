/**
 * Polymer Hire adapter (registry contract).
 *
 * A tenant's public board at `https://jobs.polymer.co/<slug>` — matched on
 * the exact board host (a deeper path reduces to the first-segment slug) or
 * on the board's own API host `api.polymer.co/v1/hire/organizations/<slug>/…`;
 * `provider: polymer` is accepted as an explicit override.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Acme
 *       careers_url: https://jobs.polymer.co/acme
 *       enabled: true
 *
 * buildEndpoint returns the API walk-root string (the source paginates it
 * with `?page=N`); an entry that does not name a Polymer board or API yields
 * null, which resolveAdapter treats as no endpoint (fail-soft per company).
 * Ported from the parent's providers/polymer.mjs (upstream #6128).
 */
import { fetchPolymer, resolveSlug, API_HOST } from '../../sources/polymer.mjs';

export const polymerAdapter = {
  id: 'polymer',
  label: 'Polymer',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'polymer') return true;
    return !!resolveSlug(company);
  },
  buildEndpoint(company) {
    const slug = resolveSlug(company);
    return slug ? `https://${API_HOST}/v1/hire/organizations/${slug}/jobs` : null;
  },
  fetch: fetchPolymer,
};
