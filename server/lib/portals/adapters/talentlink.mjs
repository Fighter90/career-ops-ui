/**
 * Talentlink adapter (registry contract). Ported with the parent's
 * providers/talentlink.mjs (upstream PR #6790, CAR-258) — Lumesse TalentLink
 * (Cornerstone) "FO widget" career sites.
 *
 * Auto-detects a tenant career page on the vendor host,
 * `https://<tenant>.recruitmentplatform.com/[<site path>/][<page>.html]` — a
 * posting's `details.html?jobId=<id>` link is claimed too and read as its
 * site's board (the page file is dropped, the site path is kept). An
 * employer-branded domain backed by the platform is never auto-detected: set
 * `provider: talentlink` explicitly (the FO host read off the page must still
 * be a TalentLink host, whatever the entry's own domain is).
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Example TalentLink Co
 *       careers_url: https://exampleco.recruitmentplatform.com/   # keep the site path your link has
 *       max_pages: 20          # optional page cap (100 jobs/page, default 20, max 200)
 *       enabled: true
 *
 * buildEndpoint returns the raw careers_url / api (the source re-resolves the
 * board from it — page file dropped, directory kept — and refuses junk before
 * any request), or null when the entry names no TalentLink board.
 * resolveAdapter treats null as no endpoint (fail-soft per company).
 *
 * The HTTP fetch and parsing live in server/lib/sources/talentlink.mjs.
 */
import { fetchTalentlink, resolveBoard } from '../../sources/talentlink.mjs';

export const talentlinkAdapter = {
  id: 'talentlink',
  label: 'TalentLink',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    const explicit = company.provider === 'talentlink';
    if (explicit) return true;
    return [company.api, company.careers_url].some((v) => typeof v === 'string' && !!resolveBoard(v));
  },
  /**
   * @param {any} company
   * @returns {string|null} the raw board URL, or null when the entry names no
   *   TalentLink board.
   */
  buildEndpoint(company) {
    if (!company || typeof company !== 'object') return null;
    const explicit = company.provider === 'talentlink';
    const raw = [company.api, company.careers_url]
      .find((v) => typeof v === 'string' && !!resolveBoard(v, { vendorOnly: !explicit }));
    return typeof raw === 'string' ? raw : null;
  },
  fetch: fetchTalentlink,
};
