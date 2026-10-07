/**
 * SmartRecruiters adapter (v1.14.0 registry contract).
 *
 * Detects SmartRecruiters boards from a `careers_url` like
 * `jobs.smartrecruiters.com/<slug>` or `careers.smartrecruiters.com/<slug>`
 * (the oneclick careers site `/oneclick-ui/company/<Name>` names the company
 * in its third segment), also honours an explicit `api:` field pointing at
 * api.smartrecruiters.com.
 *
 * Both fields are validated on the PARSED URL — never
 * `includes('smartrecruiters.com')`. An `api:` that actually points at the
 * careers/jobs PAGE is an HTML document, not an endpoint, so it is refused
 * rather than fetched.
 */
import { fetchSmartRecruiters } from '../../sources/smartrecruiters.mjs';

const API_HOST = 'api.smartrecruiters.com';
const CAREERS_HOST_RE = /^(?:jobs|careers)\.smartrecruiters\.com$/;

// A company slug is spliced into the API path, so a plain identifier only.
const SLUG_RE = /^\w[\w.-]*$/;

/** Parse a careers URL; tolerates the scheme-less `jobs.smartrecruiters.com/<slug>`. */
function parseCareersUrl(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try { return new URL(trimmed); } catch { /* maybe scheme-less */ }
  if (/^[\w.-]+\//.test(trimmed)) {
    try { return new URL(`https://${trimmed}`); } catch { /* fall through */ }
  }
  return null;
}

/** True when `api` is a real API URL (https + api.smartrecruiters.com). */
function isSmartRecruitersApi(api) {
  if (typeof api !== 'string' || !api) return false;
  try {
    const u = new URL(api.trim());
    return u.protocol === 'https:' && u.hostname.toLowerCase() === API_HOST;
  } catch { return false; }
}

/**
 * Company slug for a SmartRecruiters careers_url, or null.
 * `/oneclick-ui/company/<Name>/…` names the company in the segment after
 * `company/` — not the literal `oneclick-ui`.
 * @param {string} careersUrl
 */
export function smartRecruitersSlugFromUrl(careersUrl) {
  const u = parseCareersUrl(careersUrl);
  if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:')) return null;
  if (u.username || u.password) return null;
  if (!CAREERS_HOST_RE.test(u.hostname.toLowerCase())) return null;
  const segments = u.pathname.split('/').filter(Boolean);
  const oneclick = segments.indexOf('oneclick-ui');
  const slug = oneclick !== -1 ? (segments[oneclick + 2] || '') : (segments[0] || '');
  return SLUG_RE.test(slug) ? slug : null;
}

export const smartRecruitersAdapter = {
  id: 'smartrecruiters',
  label: 'SmartRecruiters',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    return isSmartRecruitersApi(company.api)
      || smartRecruitersSlugFromUrl(company.careers_url) !== null;
  },
  buildEndpoint(company) {
    if (!company || typeof company !== 'object') return null;
    if (isSmartRecruitersApi(company.api)) return company.api;
    const slug = smartRecruitersSlugFromUrl(company.careers_url);
    if (!slug) return null;
    return `https://${API_HOST}/v1/companies/${slug}/postings`;
  },
  fetch: fetchSmartRecruiters,
};
