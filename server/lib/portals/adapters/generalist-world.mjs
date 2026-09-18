/**
 * Generalist World adapter (registry contract).
 *
 * Board-wide curated board of generalist / operator roles. Selected explicitly
 * with `provider: generalist-world`, and — mirroring the parent provider's
 * `detect()` — also claimed by an entry whose `careers_url:` / `api:` already
 * points at generalist.world. That auto-detect is safe here in a way it is not
 * for thehub / builtin: generalist.world is the BOARD's own domain, so the only
 * entries it can capture are entries for this board, not the many employers who
 * merely post to it.
 *
 *   tracked_companies:
 *     - name: Generalist World
 *       provider: generalist-world
 *       enabled: true
 *
 * `buildEndpoint` always returns a STRING (never an object, never null): the
 * canonical list URL, or an override that is itself pinned to https on
 * generalist.world. A foreign override falls back to the canonical URL rather
 * than reaching the fetch slot — the same stance the cryptocurrencyjobs adapter
 * takes. `assertGeneralistWorldUrl` in the source is still the hard SSRF guard,
 * checked before the request.
 */
import {
  fetchGeneralistWorld,
  LIST_URL,
  GENERALIST_WORLD_HOST_RE,
} from '../../sources/generalist-world.mjs';

export const generalistWorldAdapter = {
  id: 'generalist-world',
  label: 'Generalist World',

  matches(company) {
    if (!company || typeof company !== 'object') return false;
    // An explicit, DIFFERENT provider wins — never steal another adapter's
    // entry just because its careers_url happens to sit on this host.
    if (company.provider) return company.provider === 'generalist-world';
    return [company.careers_url, company.api].some((value) => {
      if (typeof value !== 'string') return false;
      try {
        const u = new URL(value);
        return u.protocol === 'https:' && GENERALIST_WORLD_HOST_RE.test(u.hostname);
      } catch {
        return false;
      }
    });
  },

  buildEndpoint(company) {
    const override = company && typeof company === 'object'
      ? company['generalist-world'] || company.generalistWorld || company.api || company.careers_url
      : null;
    if (typeof override === 'string' && override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && GENERALIST_WORLD_HOST_RE.test(u.hostname)) return override;
      } catch { /* fall through to the canonical list URL */ }
    }
    return LIST_URL;
  },

  fetch: fetchGeneralistWorld,
};
