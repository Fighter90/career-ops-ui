/**
 * Jobvite adapter (registry contract). Parent career-ops `providers/jobvite.mjs`
 * parity.
 *
 * Jobvite is a per-tenant ATS behind ONE fixed host: every company's board and
 * jobs API live on `jobs.jobvite.com`, keyed by a tenant slug. It matches on
 * either:
 *   - an explicit `provider: jobvite` (with `api:` pointing at the
 *     jobs.jobvite.com API URL for custom slugs), or
 *   - a `careers_url` / `api:` on jobs.jobvite.com the slug can be read from.
 *
 * buildEndpoint re-derives the slug and returns the CANONICAL API URL built
 * from it (`https://jobs.jobvite.com/api/company/<slug>/jobs`) — never a
 * user-supplied path — and null for anything it can't slug-pin, so an
 * off-host value never reaches the fetch slot. The source-level
 * assertJobviteUrl is the hard SSRF guard.
 *
 *   tracked_companies:
 *     - name: Acme
 *       careers_url: https://jobs.jobvite.com/acme
 *       enabled: true
 *
 * The HTTP fetch + JSON parsing lives in server/lib/sources/jobvite.mjs.
 */
import { fetchJobvite, resolveCompanyId, buildApiUrl } from '../../sources/jobvite.mjs';

export const jobviteAdapter = {
  id: 'jobvite',
  label: 'Jobvite',
  matches(company) {
    if (!company) return false;
    if (company.provider === 'jobvite') return true;
    return resolveCompanyId(company) !== null;
  },
  buildEndpoint(company) {
    const companyId = resolveCompanyId(company || {});
    return companyId ? buildApiUrl(companyId) : null;
  },
  fetch: fetchJobvite,
};
