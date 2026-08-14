// @ts-check
/**
 * Cornerstone OnDemand (CSOD) source — the hosted career-site boards at
 *   https://{tenant}.csod.com/ux/ats/careersite/{siteId}/home?c={corpName}
 * (e.g. OHB: career-ohb.csod.com/ux/ats/careersite/4/home?c=career-ohb).
 *
 * Implements the web-ui source
 * contract (rich job objects + `meta` for auto-discovery). The search API is
 * public but wants a bearer token; the career-site home page is a small
 * (~5 KB) bootstrap document that embeds an ANONYMOUS JWT as `"token":"eyJ…"`
 * — no login, no session cookies. Flow per fetch:
 *
 *   1. GET  {origin}/ux/ats/careersite/{siteId}/home?c={corpName}  → extract token
 *   2. POST {origin}/services/x/career-site/v1/search              → page through
 *      → {data: {totalCount, requisitions: [{requisitionId, displayJobTitle,
 *          postingEffectiveDate: "M/D/YYYY", locations: [{city,state,country}]}]}}
 *
 * Job detail URL:
 *   {origin}/ux/ats/careersite/{siteId}/home/requisition/{id}?c={corpName}
 *
 * SSRF defence: host is pinned to `csod.com` / `*.csod.com` via CSOD_HOST_RE
 * (checked in resolveConfig AND re-asserted on the endpoint in the fetcher),
 * HTTPS only, `redirect:'error'` on every request. Safety caps: PAGE_SIZE=25,
 * MAX_PAGES=40, MAX_JOBS=1000.
 *
 * Used by the csod adapter (server/lib/portals/adapters/csod.mjs).
 */
import { fetchJson, fetchResponse, delay } from '../http-json.mjs';

/**
 * v1.177.0 — build a `Cookie` request header from the bootstrap
 * response's `Set-Cookie` headers. Only the leading `name=value` pair is
 * meaningful on a request; attributes (Path/HttpOnly/Secure/SameSite/Expires)
 * describe browser-jar storage and are dropped. A repeated name takes its last
 * definition (jar semantics). Returns '' when nothing usable was set — the
 * caller then sends no cookie header at all.
 * @param {string[]} setCookies @returns {string}
 */
export function cookieHeaderFrom(setCookies) {
  const jar = new Map();
  for (const raw of Array.isArray(setCookies) ? setCookies : []) {
    if (typeof raw !== 'string') continue;
    const pair = raw.split(';', 1)[0].trim();
    const eq = pair.indexOf('=');
    if (eq <= 0) continue; // no '=', or an empty name — not a cookie
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

export const CSOD_HOST_RE = /(?:^|\.)csod\.com$/i;

export const meta = {
  value: 'csod',
  label: 'Cornerstone',
  region: 'en',
};

const PAGE_SIZE = 25; // server default; OHB serves exactly 25/page
const MAX_PAGES = 40; // safety cap on request count (40*25 = 1000 postings)
const MAX_JOBS = 1000; // cap total postings pulled per site
const PAGE_DELAY_MS = 120; // polite pacing between search requests

const REMOTE_RE = /remote|anywhere|distributed|home\s*office/i;

/**
 * Parse tenant/site/corp out of a careersite URL, or null when not CSOD.
 * Host check (not a path substring) so evil.com/x.csod.com can't spoof it,
 * and the URL must carry the careersite path shape we know how to drive.
 * @param {any} company portals.yml entry (api:/careers_url + optional max_pages)
 */
export function resolveConfig(company) {
  const raw = String(company.api || company.careers_url || '').trim();
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null; // https only (web-ui hardening)
  if (!CSOD_HOST_RE.test(u.hostname)) return null;
  const m = u.pathname.match(/\/ux\/ats\/careersite\/(\d+)(?:\/|$)/i);
  if (!m) return null;
  const siteId = Number(m[1]);
  const corpName = u.searchParams.get('c') || u.hostname.split('.')[0];
  return {
    origin: u.origin,
    siteId,
    corpName,
    homeUrl: `${u.origin}/ux/ats/careersite/${siteId}/home?c=${encodeURIComponent(corpName)}`,
    searchApi: `${u.origin}/services/x/career-site/v1/search`,
  };
}

/**
 * Defence-in-depth host check on the endpoint built by the adapter.
 * @param {string} url
 */
export function assertCsodUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`csod: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`csod: URL must use HTTPS: ${url}`);
  if (!CSOD_HOST_RE.test(parsed.hostname)) {
    throw new Error(`csod: untrusted hostname "${parsed.hostname}" — must match *.csod.com`);
  }
  return url;
}

/**
 * Pull the anonymous bearer token out of the bootstrap home page.
 * @param {string} html @returns {string}
 */
export function extractToken(html) {
  const m = typeof html === 'string' ? html.match(/"token"\s*:\s*"([A-Za-z0-9._-]+)"/) : null;
  return m ? m[1] : '';
}

// postingEffectiveDate is US-format M/D/YYYY ("7/3/2026") → ISO "YYYY-MM-DD"
// for the rich job shape ('' when unparseable / out-of-range).
/** @param {unknown} raw @returns {string} */
export function parseCsodDate(raw) {
  const m = typeof raw === 'string' ? raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) : null;
  if (!m) return '';
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const ms = Date.UTC(year, month - 1, day);
  if (new Date(ms).getUTCDate() !== day) return ''; // catches 4/31, 2/30, etc.
  return new Date(ms).toISOString().slice(0, 10);
}

// locations is an array of {city, state, country}. City is the useful part;
// append the country code when present ("Bremen, DE"). Multiple work locations
// join with " / ".
/** @param {unknown} raw @returns {string} */
export function cleanLocations(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const loc of list) {
    if (!loc || typeof loc !== 'object') continue;
    const city = String(loc.city || '').trim();
    const country = String(loc.country || '').trim();
    const s = city ? (country ? `${city}, ${country}` : city) : country;
    if (s && !out.includes(s)) out.push(s);
  }
  return out.join(' / ');
}

/**
 * Map one search response page to { total, jobs } (rich job shape). Records
 * without an id or a title are skipped (no stable dedup key / no meaningful
 * listing). Exported for unit tests.
 * @param {any} json
 * @param {{origin:string, siteId:number, corpName:string}} cfg
 * @param {string} [companyName]
 */
export function parseRequisitions(json, cfg, companyName = '') {
  const data = json && json.data;
  const total = typeof (data && data.totalCount) === 'number' ? data.totalCount : null;
  const list = Array.isArray(data && data.requisitions) ? data.requisitions : [];
  const jobs = [];
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    const id = r.requisitionId != null ? String(r.requisitionId) : '';
    const title = String(r.displayJobTitle || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!id || !title) continue;
    const location = cleanLocations(r.locations);
    const isRemote = REMOTE_RE.test(title) || REMOTE_RE.test(location);
    jobs.push({
      id: `csod-${id}`,
      title,
      company: companyName,
      url: `${cfg.origin}/ux/ats/careersite/${cfg.siteId}/home/requisition/${id}?c=${encodeURIComponent(cfg.corpName)}`,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: parseCsodDate(r.postingEffectiveDate),
      snippet: '',
      source: 'csod',
    });
  }
  return { total, jobs };
}

/** Resolve the page cap: positive integer `max_pages`, else default. */
function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES);
  return MAX_PAGES;
}

/**
 * Fetch + normalize a CSOD tenant's postings with a bounded paged
 * walk: token from the home page, then POST-paginate the search API until
 * totalCount, an empty page, a no-fresh-ids page, or MAX_JOBS. A missing token
 * is a hard error (never a silent empty scan).
 * @param {string} endpoint careersite home URL (from buildEndpoint, host-pinned)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchCsod(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertCsodUrl(endpoint);
  const cfg = resolveConfig(company) || resolveConfig({ api: endpoint });
  if (!cfg) throw new Error(`csod: cannot resolve careersite URL for ${company.name || endpoint}`);
  const name = (company && typeof company.name === 'string' && company.name.trim()) ? company.name.trim() : 'Cornerstone';

  // The bootstrap page yields two things, not one: the anonymous bearer token,
  // and — on some tenants — the session cookies the search API demands (it
  // answers "401 CSOD Unauthorized" until they come back with it).
  // Read the response through fetchResponse to see Set-Cookie, then replay it as
  // a Cookie header on the search POST. Same-origin only (assertCsodUrl pins the
  // host; redirect:'error' keeps a 3xx from moving the cookies to another host),
  // so this can never send session cookies to a third party.
  const res = await fetchResponse(fetchImpl, cfg.homeUrl, {
    signal,
    redirect: 'error',
    headers: { accept: 'text/html' },
  });
  const cookie = cookieHeaderFrom(
    typeof res?.headers?.getSetCookie === 'function' ? res.headers.getSetCookie() : [],
  );
  const html = await res.text();
  const token = extractToken(html);
  if (!token) throw new Error(`csod: no anonymous token on ${cfg.homeUrl}`);

  const maxPages = resolveMaxPages(company);
  const jobs = [];
  const seen = new Set();
  let total = null;

  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) await delay(PAGE_DELAY_MS, signal);
    const json = await fetchJson(fetchImpl, cfg.searchApi, {
      method: 'POST',
      signal,
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({
        careerSiteId: cfg.siteId,
        careerSitePageId: cfg.siteId,
        pageNumber: page,
        pageSize: PAGE_SIZE,
        cultureId: 1,
        cultureName: 'en-US',
        searchText: '',
        states: [],
        countryCodes: [],
        cities: [],
        placeID: '',
        radius: null,
        postingsWithinDays: null,
        customFieldCheckboxKeys: [],
        customFieldDropdowns: [],
        customFieldRadios: [],
      }),
    });
    const { total: pageTotal, jobs: rows } = parseRequisitions(json, cfg, name);
    if (total === null) total = pageTotal;
    if (rows.length === 0) break;

    let fresh = 0;
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      fresh++;
      jobs.push(row);
      if (jobs.length >= MAX_JOBS) break;
    }
    // No new ids → server ignored the page number (or we've looped). Stop.
    if (fresh === 0) break;
    if (jobs.length >= MAX_JOBS) break;
    if (total !== null && page * PAGE_SIZE >= total) break;
    if (rows.length < PAGE_SIZE) break; // short page = last page
  }
  return jobs;
}
