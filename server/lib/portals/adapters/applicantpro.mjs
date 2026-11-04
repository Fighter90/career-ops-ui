/**
 * ApplicantPro adapter (registry contract). Ported with the parent's
 * providers/applicantpro.mjs (upstream #6252). ApplicantPro is now branded
 * "isolved Talent Acquisition"; the board hosts and payload shapes are
 * unchanged.
 *
 * Single-employer ATS: every customer tenant runs its listing page at
 * `https://<tenant>.applicantpro.com/jobs/`. Matches on the exact
 * tenant-host shape — `provider: applicantpro` is accepted as an explicit
 * override; a `careers_url`/`api:` naming a tenant auto-detects
 * (resolveOrigin does the https + anchored-host + non-platform-label checks
 * and null-guards the entry itself; `www.applicantpro.com` and
 * `feeds.applicantpro.com` are platform hosts and never match as tenants,
 * though a `www…/openings/<tenant>/…` link maps to its tenant).
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Acme Example
 *       careers_url: https://acme-example.applicantpro.com/
 *       # applicantpro:
 *       #   domainId: 70123        # optional pin — skips the /jobs/ read
 *       #   fetchDetails: true     # opt-in JSON-LD description enrichment
 *       #   detailLimit: 25        # default 25, max 100
 *       enabled: true
 *
 * buildEndpoint returns the tenant's `/jobs/` listing URL string (the source
 * reads the numeric site id off it, then fetches the public
 * `/core/jobs/<id>?getParams={}` JSON in one more request). An entry that
 * does not name a tenant host yields null, which resolveAdapter treats as no
 * endpoint (fail-soft per company).
 */
import { fetchApplicantpro, resolveOrigin, jobsUrlFor } from '../../sources/applicantpro.mjs';

export const applicantproAdapter = {
  id: 'applicantpro',
  label: 'ApplicantPro',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'applicantpro') return true;
    return !!resolveOrigin(company);
  },
  buildEndpoint(company) {
    const origin = resolveOrigin(company);
    return origin ? jobsUrlFor(origin) : null;
  },
  fetch: fetchApplicantpro,
};
