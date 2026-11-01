/**
 * Bulldogjob adapter (registry contract). Ported with the parent's
 * providers/bulldogjob.mjs (upstream #6253).
 *
 * The Polish tech board `bulldogjob.pl` is a job_boards-style source: the
 * entry's `careers_url` is the site search the user built (filters live in
 * the path), e.g.
 *
 *   tracked_companies:
 *     - name: Bulldogjob — DevOps PL
 *       careers_url: https://bulldogjob.pl/companies/jobs/s/role,devops/city,Remote
 *       max_pages: 25
 *       enabled: true
 *
 * `provider: bulldogjob` selects explicitly; a `careers_url`/`api:` under the
 * pinned hosts on the /companies/jobs listing path auto-detects
 * (parseListingUrl does the https + host + path checks). The endpoint is the
 * listing URL string — the source rebuilds the filter path from its own
 * segments and pages `/page,N` itself. Anything else yields null, which
 * resolveAdapter treats as no endpoint (fail-soft per company).
 */
import { fetchBulldogjob, parseListingUrl } from '../../sources/bulldogjob.mjs';

export const bulldogjobAdapter = {
  id: 'bulldogjob',
  label: 'Bulldogjob',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'bulldogjob') return true;
    return !!parseListingUrl(company.careers_url || company.api);
  },
  buildEndpoint(company) {
    const parsed = parseListingUrl(company?.careers_url || company?.api);
    return parsed ? parsed.href : null;
  },
  fetch: fetchBulldogjob,
};
