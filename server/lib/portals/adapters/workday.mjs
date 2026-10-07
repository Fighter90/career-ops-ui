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
 * A myworkdaysite.com tenant (same product, tenant in the PATH, not the host):
 *   https://<instance>.myworkdaysite.com/recruiting/<tenant>/<site>
 *   →  endpoint:  https://<instance>.myworkdaysite.com/wday/cxs/<tenant>/<site>/jobs
 *
 * If the customer's site lives behind a CAPTCHA or non-standard path,
 * the adapter throws — we recommend falling back to `/career-ops scan`
 * (drives a real browser via Playwright).
 */
import { fetchWorkday } from '../../sources/workday.mjs';

// Matches a Workday careers HOST — <tenant>.wd<N>.myworkdayjobs.com — checked
// on the PARSED URL's hostname (never a regex over the raw string, which also
// found the host inside another site's query or path). The site is derived
// from the pathname STRUCTURALLY in buildEndpoint (see below), not by a fixed
// two-segment regex, so single-segment site URLs parse correctly.
const WDJOBS_HOST_RE = /^([\w-]+)\.(wd\d+)\.myworkdayjobs\.com$/;
// myworkdaysite tenant path: /recruiting/<tenant>/<site>[/…]. Applied to the
// PARSED pathname only, after the hostname has been checked exactly.
const SITE_PATH = /^\/recruiting\/([\w-]+)\/([^/?#]+)/;
// A Workday locale prefix looks like `en-US`, `fr-FR`, `zh-CN`, etc.
const LOCALE = /^[a-z]{2}-[a-z]{2}$/i;

// Workday's two public host families. A hostname is accepted only when it IS
// the apex or ends with `.<apex>` — checked on the PARSED hostname, never by
// substring — so `myworkdaysite.com.evil.com` and `evil.com/?x=myworkdaysite.com`
// are rejected exactly like their myworkdayjobs look-alikes.
function isHostUnder(host, apex) {
  return host === apex || host.endsWith(`.${apex}`);
}

// True only when `api` is a real Workday API endpoint. The hostname is PARSED
// and checked (exact `myworkdayjobs.com` / `myworkdaysite.com` or a subdomain
// of either) — not substring-matched — so `https://evil.com/?x=myworkdayjobs.com`
// and `https://myworkdayjobs.com.evil.com/…` are rejected, and buildEndpoint never
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
    if (isHostUnder(host, 'myworkdayjobs.com')) return true;
    // myworkdaysite is new surface with no http legacy: HTTPS only.
    return u.protocol === 'https:' && isHostUnder(host, 'myworkdaysite.com');
  } catch { return false; }
}

/**
 * CXS endpoint for a myworkdaysite.com careers_url, or null.
 *   https://<instance>.myworkdaysite.com/recruiting/<tenant>/<site>
 *   → https://<instance>.myworkdaysite.com/wday/cxs/<tenant>/<site>/jobs
 * HTTPS only, no credentials, exact `.myworkdaysite.com` suffix on the parsed
 * hostname with a single-label instance (parent 3e028d9 SITE_RE).
 * @param {string} careersUrl
 */
export function myworkdaysiteEndpoint(careersUrl) {
  if (typeof careersUrl !== 'string' || !careersUrl) return null;
  let u;
  try { u = new URL(careersUrl); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  if (!/^[\w-]+\.myworkdaysite\.com$/.test(host)) return null;
  const m = u.pathname.match(SITE_PATH);
  if (!m) return null;
  const [, tenant, site] = m;
  return `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
}

/**
 * Parsed {tenant, wdN, path} for a myworkdayjobs.com careers_url, or null.
 * http(s) accepted (myworkdayjobs has an http legacy); no embedded credentials.
 * @param {string} careersUrl
 */
function myworkdayjobsBoard(careersUrl) {
  if (typeof careersUrl !== 'string' || !careersUrl) return null;
  let u;
  try { u = new URL(careersUrl.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  const m = WDJOBS_HOST_RE.exec(u.hostname.toLowerCase());
  if (!m) return null;
  return { tenant: m[1], wdN: m[2], path: u.pathname };
}

export const workdayAdapter = {
  id: 'workday',
  label: 'Workday',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    return isWorkdayApi(company.api)
      || myworkdaysiteEndpoint(company.careers_url) !== null
      || myworkdayjobsBoard(company.careers_url) !== null;
  },
  buildEndpoint(company) {
    if (!company || typeof company !== 'object') return null;
    if (isWorkdayApi(company.api)) return company.api;
    const site = myworkdaysiteEndpoint(company.careers_url);
    if (site) return site;
    const board = myworkdayjobsBoard(company.careers_url);
    if (!board) return null;
    // Workday's CXS path segments are case-sensitive — canonicalise the
    // tenant/cell to lowercase.
    const tenant = board.tenant;
    const wdN = board.wdN;
    const pathPart = board.path;
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
