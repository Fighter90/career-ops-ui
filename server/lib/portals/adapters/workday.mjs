/**
 * Workday CXS adapter (v1.14.0 registry contract, BETA).
 *
 * Workday hosts each customer on `<tenant>.wd<N>.myworkdayjobs.com/<site>`.
 * The unauthenticated jobs feed for a given site is at
 *   /wday/cxs/<tenant>/<site>/jobs
 *
 * Detection from `careers_url`:
 *   https://<tenant>.wd5.myworkdayjobs.com/en-US/External
 *   →  tenant=<tenant>, wdN=wd5, site=External
 *   →  endpoint:  https://<tenant>.wd5.myworkdayjobs.com/wday/cxs/<tenant>/External/jobs
 *
 * If the customer's site lives behind a CAPTCHA or non-standard path,
 * the adapter throws — we recommend falling back to `/career-ops scan`
 * (drives a real browser via Playwright).
 */
import { fetchWorkday } from '../../sources/workday.mjs';

// Matches any Workday careers host — <tenant>.wd<N>.myworkdayjobs.com — and
// captures the tenant, the wdN cell, and the raw path (up to a ? or #). The
// site is derived from the path STRUCTURALLY in buildEndpoint (see below), not
// by a fixed two-segment regex, so single-segment site URLs parse correctly.
const HOST_PATTERN = /https?:\/\/([^./]+)\.(wd\d+)\.myworkdayjobs\.com(\/[^?#]*)?/i;
// A Workday locale prefix looks like `en-US`, `fr-FR`, `zh-CN`, etc.
const LOCALE = /^[a-z]{2}-[a-z]{2}$/i;

// True only when `api` is a real Workday API endpoint. The hostname is PARSED
// and checked (exact `myworkdayjobs.com` or a `.myworkdayjobs.com` subdomain) —
// not substring-matched — so `https://evil.com/?x=myworkdayjobs.com` and
// `https://myworkdayjobs.com.evil.com/…` are rejected, and buildEndpoint never
// hands such a URL back as a fetchable endpoint (#443). Empty / unparseable → false.
function isWorkdayApi(api) {
  if (typeof api !== 'string' || !api) return false;
  try {
    const u = new URL(api);
    // http(s) only (mirrors HOST_PATTERN for careers_url) and no embedded
    // credentials — `https://user:pass@host` would otherwise ride into fetch.
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    if (u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    return host === 'myworkdayjobs.com' || host.endsWith('.myworkdayjobs.com');
  } catch { return false; }
}

export const workdayAdapter = {
  id: 'workday',
  label: 'Workday',
  matches(company) {
    if (isWorkdayApi(company.api)) return true;
    return HOST_PATTERN.test(company.careers_url || '');
  },
  buildEndpoint(company) {
    if (isWorkdayApi(company.api)) return company.api;
    const m = (company.careers_url || '').match(HOST_PATTERN);
    if (!m) return null;
    // HOST_PATTERN is case-insensitive (hostnames are), but Workday's CXS path
    // segments are case-sensitive — canonicalise the tenant/cell to lowercase.
    const tenant = m[1].toLowerCase();
    const wdN = m[2].toLowerCase();
    const pathPart = m[3] || '';
    // The path is /<locale>?/<site>[/job/…], /<site>, or just /. Take the FIRST
    // non-empty, non-locale path segment as the site — so a single-segment URL
    // (/Search) uses that segment (fixes #255) AND a deep posting link
    // (/en-US/External/job/<city>/<title>) still resolves to `External`, not the
    // job slug. A locale segment (en-US) is skipped; default `External` when the
    // path carries no site segment. (Site names that look like a locale are
    // treated as a locale — a deliberate, harmless trade-off; Workday sites are
    // named External/Careers/… not xx-XX.)
    const segments = pathPart.split('/').filter(Boolean).filter((s) => !LOCALE.test(s));
    const siteName = segments.length ? segments[0] : 'External';
    return `https://${tenant}.${wdN}.myworkdayjobs.com/wday/cxs/${tenant}/${siteName}/jobs`;
  },
  fetch: fetchWorkday,
};
