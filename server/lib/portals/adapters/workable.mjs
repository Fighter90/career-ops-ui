/**
 * Workable adapter (v1.14.0 registry contract).
 *
 * Detects Workable boards from a `careers_url` like
 * `apply.workable.com/<account>/...` or `<account>.workable.com/...`,
 * also honours an explicit `api:` field pointing at the v3 endpoint.
 *
 * Both fields are validated on the PARSED URL — never
 * `includes('workable.com')`, which any query param satisfies. Workable's own
 * site labels (`www` / `jobs` / …) are not tenant accounts, so a legacy-host
 * careers_url is only claimed for a plausible account subdomain.
 */
import { fetchWorkable } from '../../sources/workable.mjs';

// apply.workable.com hosts every customer and the v3 jobs API.
const API_HOST = 'apply.workable.com';
// Legacy shape: <account>.workable.com (single label). These labels are
// Workable's own site — www/jobs/careers pages name no tenant account.
const LEGACY_HOST_RE = /^([a-z0-9-]+)\.workable\.com$/;
const RESERVED_LABELS = new Set([
  'www', 'jobs', 'job', 'apply', 'career', 'careers', 'api',
  'docs', 'blog', 'help', 'support', 'resources', 'about', 'workable',
]);

// An account is spliced into the v3 API path, so a plain identifier only.
const SLUG_RE = /^\w[\w.-]*$/;

/** Parse a careers URL; tolerates the scheme-less `apply.workable.com/<acct>`. */
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

/** True when `api` is a real Workable API URL (https + apply.workable.com). */
function isWorkableApi(api) {
  if (typeof api !== 'string' || !api) return false;
  try {
    const u = new URL(api.trim());
    return u.protocol === 'https:' && u.hostname.toLowerCase() === API_HOST;
  } catch { return false; }
}

/** Tenant account from a Workable careers_url, or null. */
function accountFromCareersUrl(careersUrl) {
  const u = parseCareersUrl(careersUrl);
  if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:')) return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  let account = '';
  if (host === API_HOST) {
    account = u.pathname.split('/').filter(Boolean)[0] || '';
  } else {
    const m = LEGACY_HOST_RE.exec(host);
    account = m && !RESERVED_LABELS.has(m[1]) ? m[1] : '';
  }
  return SLUG_RE.test(account) ? account : null;
}

export const workableAdapter = {
  id: 'workable',
  label: 'Workable',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    return isWorkableApi(company.api) || accountFromCareersUrl(company.careers_url) !== null;
  },
  buildEndpoint(company) {
    if (!company || typeof company !== 'object') return null;
    if (isWorkableApi(company.api)) return company.api;
    const account = accountFromCareersUrl(company.careers_url);
    if (!account) return null;
    return `https://${API_HOST}/api/v3/accounts/${account}/jobs?details=true`;
  },
  fetch: fetchWorkable,
};
