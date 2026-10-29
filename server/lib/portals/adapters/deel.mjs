/**
 * Deel adapter (registry contract).
 *
 * The multi-tenant job board at `https://jobs.deel.com/<slug>` (Klarna and
 * others). Matches on the exact board host — `provider: deel` is accepted as
 * an explicit override; anything whose `careers_url`/`api:` names a tenant
 * slug on jobs.deel.com auto-detects (resolveSlug does the https + exact-host
 * + slug checks and null-guards the entry itself).
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Klarna
 *       careers_url: https://jobs.deel.com/klarna
 *       enabled: true
 *
 * buildEndpoint returns the board-root string (the landing page's Next.js
 * flight payload carries the whole inventory — the source parses it in one
 * request); an entry that does not name a board on the pinned host yields
 * null, which resolveAdapter treats as no endpoint (fail-soft per company).
 * Ported from the parent's providers/deel.mjs (upstream #6189).
 */
import { fetchDeel, resolveSlug, boardUrlFor } from '../../sources/deel.mjs';

export const deelAdapter = {
  id: 'deel',
  label: 'Deel',
  // `provider: deel` selects explicitly; a careers_url on the exact board
  // host auto-detects. A tenant that merely shares the name (www.deel.com,
  // *-jobs.deel.com) never matches — resolveSlug is strict.
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'deel') return true;
    return !!resolveSlug(company);
  },
  buildEndpoint(company) {
    const slug = resolveSlug(company);
    return slug ? boardUrlFor(slug) : null;
  },
  fetch: fetchDeel,
};
