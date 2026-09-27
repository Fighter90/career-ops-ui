/**
 * PeopleSoft Fluid Candidate Gateway adapter (registry contract).
 *
 * PeopleSoft is self-hosted per institution on a branded domain
 * (recruit.uwo.ca, careers.torontomu.ca, …), so there is no vendor host to
 * detect on. It matches on either:
 *   - an explicit `provider: peoplesoft`, or
 *   - a `careers_url` / `api:` (api wins) whose PATH is the Fluid job-search
 *     component `/psc/{site}/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL`
 *     — a PeopleTools implementation signature, not a brand guess.
 *
 * buildEndpoint returns the canonical search URL rebuilt from the entry's
 * origin + site segment (HTTPS only), or null when the URL does not carry the
 * path signature — even with `provider: peoplesoft`, since the site segment
 * cannot be guessed. Every request the source makes is pinned to that origin.
 *
 *   tracked_companies:
 *     - name: Western University
 *       careers_url: https://recruit.uwo.ca/psc/uwo1/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?Page=HRS_APP_SCHJOB_FL&Action=U&FOCUS=Applicant&SiteId=1
 *       peoplesoft: { fetchDetails: true, detailLimit: 25 }   # optional
 *       enabled: true
 *
 * The session transport + HTML parsing live in server/lib/sources/peoplesoft.mjs.
 */
import { fetchPeoplesoft, resolveConfig } from '../../sources/peoplesoft.mjs';

export const peoplesoftAdapter = {
  id: 'peoplesoft',
  label: 'PeopleSoft Candidate Gateway',
  matches(company) {
    if (!company) return false;
    if (company.provider === 'peoplesoft') return true;
    return resolveConfig(company) !== null;
  },
  buildEndpoint(company) {
    const config = resolveConfig(company);
    return config ? config.searchUrl : null;
  },
  fetch: fetchPeoplesoft,
};
