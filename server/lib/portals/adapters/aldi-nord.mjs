/**
 * ALDI Nord adapter (registry contract). Ported with the parent's
 * providers/aldi-nord.mjs (upstream #6529).
 *
 * A single-company provider: the ALDI Nord group runs its job search on its
 * own country sites (www.aldi-nord.de, www.aldi.nl, www.aldi.be, … — the
 * confirmed list in the source's SITES). Matches on one of those exact hosts
 * — `provider: aldi-nord` is accepted as an explicit override; anything whose
 * `careers_url`/`api:` names a confirmed country site auto-detects
 * (resolveSiteHost does the https + exact-host + www-normalization checks and
 * null-guards the input itself). Look-alikes (aldi-sued.de, aldi.dk,
 * aldi-nord.de.evil.example) never match.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: ALDI Nord
 *       careers_url: https://www.aldi-nord.de/karriere/jobs.html
 *       enabled: true
 *
 * buildEndpoint returns the canonical site URL rebuilt from the pinned host
 * (the source POSTs to /api/job/hr/query on that host and reads the entry's
 * `aldi_nord.locales` / `aldi_nord.categories` config from opts.company);
 * an entry that does not name a confirmed host yields null, which
 * resolveAdapter treats as no endpoint (fail-soft per company).
 */
import { fetchAldiNord, resolveSiteHost } from '../../sources/aldi-nord.mjs';

export const aldiNordAdapter = {
  id: 'aldi-nord',
  label: 'ALDI Nord',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'aldi-nord') return true;
    // The parent's entry order: careers_url wins over api.
    return !!resolveSiteHost(company.careers_url) || !!resolveSiteHost(company.api);
  },
  buildEndpoint(company) {
    const host = resolveSiteHost(company?.careers_url) || resolveSiteHost(company?.api);
    return host ? `https://${host}/` : null;
  },
  fetch: fetchAldiNord,
};
