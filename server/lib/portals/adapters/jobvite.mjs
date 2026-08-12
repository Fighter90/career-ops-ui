/**
 * Jobvite adapter (registry contract). Parent career-ops `providers/jobvite.mjs`
 * (#2623 XML-feed migration) parity.
 *
 * Jobvite is a per-tenant ATS across TWO fixed hosts: the board lives on
 * `jobs.jobvite.com` (keyed by a vanity slug) and the public jobs feed on
 * `app.jobvite.com` (keyed by an opaque `companyEId`). It matches on either:
 *   - an explicit `provider: jobvite` (with `company_eid:` or an `api:` XML-feed
 *     URL carrying `?c=<companyEId>`), or
 *   - a `careers_url` on `jobs.jobvite.com` whose slug can be read for discovery.
 *
 * buildEndpoint returns the CANONICAL feed URL when the companyEId is known up
 * front (config), otherwise the board URL so the source can discover the eId at
 * fetch time — and null for anything it can't pin, so an off-host value never
 * reaches the fetch slot. The source-level assertJobviteUrl is the hard SSRF
 * guard (both hosts pinned, https-only, no redirect followed).
 *
 *   tracked_companies:
 *     - name: Acme
 *       careers_url: https://jobs.jobvite.com/acme
 *       company_eid: q6NaVfwI      # optional — skips a discovery request
 *       enabled: true
 *
 * The HTTP fetch + XML parsing lives in server/lib/sources/jobvite.mjs. The
 * `company_eid` is threaded through the existing `opts.company` full-entry that
 * en-scanner already passes to every fetcher — no scanner change needed.
 */
import {
  fetchJobvite,
  resolveConfiguredEid,
  resolveSlug,
  buildFeedUrl,
  buildBoardUrl,
} from '../../sources/jobvite.mjs';

export const jobviteAdapter = {
  id: 'jobvite',
  label: 'Jobvite',
  matches(company) {
    if (!company) return false;
    if (company.provider === 'jobvite') return true;
    return resolveConfiguredEid(company) !== null || resolveSlug(company) !== null;
  },
  buildEndpoint(company) {
    const entry = company || {};
    const eid = resolveConfiguredEid(entry);
    if (eid) return buildFeedUrl(eid);
    const slug = resolveSlug(entry);
    return slug ? buildBoardUrl(slug) : null;
  },
  fetch: fetchJobvite,
};
