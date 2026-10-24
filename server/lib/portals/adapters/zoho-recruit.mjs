/**
 * Zoho Recruit adapter (registry contract).
 *
 * Per-tenant ATS — matches on an explicit `provider: zoho-recruit` OR a
 * `careers_url`/`api:` on any `<tenant>.zohorecruit.com` host (parsed-host
 * check, so a spoofed full URL cannot claim the vendor suffix). Only the
 * hostname is used: the board is always read from the fixed /jobs/Careers
 * list path, whatever path the configured URL carries:
 *
 *   tracked_companies:
 *     - name: Example Zoho Recruit Co
 *       careers_url: https://exampleco.zohorecruit.com/jobs/Careers
 *       enabled: true
 *       zohoRecruit:
 *         fetchDetails: true   # optional per-posting detail enrichment
 *         detailLimit: 25      # optional (1..100, default 25)
 *
 * buildEndpoint resolves the board from the careers_url (host only) and
 * returns the fixed list URL; anything that is not an https
 * <tenant>.zohorecruit.com URL yields null, which resolveAdapter treats as no
 * endpoint (fail-soft per company). Ported from the parent's
 * providers/zoho-recruit.mjs (parity v1.253.0).
 */
import { fetchZohoRecruit, resolveZohoBoard } from '../../sources/zoho-recruit.mjs';

export const zohoRecruitAdapter = {
  id: 'zoho-recruit',
  label: 'Zoho Recruit',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'zoho-recruit') return true;
    return !!resolveZohoBoard(company);
  },
  // The fixed list URL on the tenant host; null (never a throw) when the
  // entry carries no valid tenant URL.
  buildEndpoint(company) {
    const board = resolveZohoBoard(company);
    return board ? board.boardUrl : null;
  },
  fetch: fetchZohoRecruit,
};
