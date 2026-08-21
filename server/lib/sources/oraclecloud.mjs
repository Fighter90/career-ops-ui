// @ts-check
/**
 * Oracle Recruiting Cloud (ORC) source — hits the public, zero-auth
 * recruitingCEJobRequisitions REST API of Oracle Fusion Candidate Experience
 * career sites. Large employers (JPMorgan Chase, Oracle, BNY Mellon, American
 * Express, Honeywell, …) run their careers site on ORC.
 *
 * Implements the web-ui
 * source contract (rich job objects + `meta` for auto-discovery).
 *
 * Host patterns (per-tenant, dynamic):
 *   <tenant>.fa.oraclecloud.com
 *   <tenant>.fa.<region>.oraclecloud.com   (e.g. us2)
 *   <tenant>.fa.ocs.oraclecloud.com
 *
 * Career page URL:
 *   https://<host>/hcmUI/CandidateExperience/<lang>/sites/<siteNumber>/jobs
 *   siteNumber is the segment after `sites/` (usually CX_1, CX_1002, …;
 *   default CX_1).
 *
 * JSON API (GET, zero-auth, no token/cookie):
 *   https://<host>/hcmRestApi/resources/latest/recruitingCEJobRequisitions
 *     ?onlyData=true
 *     &expand=requisitionList.workLocation,requisitionList.secondaryLocations
 *     &finder=findReqs;siteNumber=<site>,facetsList=…,limit=<n>,
 *             sortBy=POSTING_DATES_DESC,offset=<n>
 *     &limit=<n>&offset=<n>   (set in BOTH finder and top-level — some tenants
 *                              only honor one)
 *   The `expand` is REQUIRED: without it the API returns TotalJobsCount but an
 *   empty/absent requisitionList (verified live upstream against JPMC).
 *   Response: items[0].requisitionList[] (jobs), items[0].TotalJobsCount
 *   (total), top-level hasMore. Per item: Id, Title, PostedDate,
 *   PrimaryLocation, WorkplaceTypeCode, ShortDescriptionStr, and (sometimes)
 *   ExternalURL.
 *
 * Pagination NOTE: `hasMore` is unreliable on some tenants (JPMC returns
 * hasMore:false on EVERY page even with 7000+ jobs), so it is NOT used to
 * stop — trusting it caps the scan at one page. The authoritative signals are
 * the returned list length and TotalJobsCount.
 *
 * Known limitation: some tenants front the API with a WAF (e.g. Imperva) that
 * 403s datacenter/cloud egress IPs. That's an environment/IP issue, not a
 * source bug — the browser-like UA reduces (not eliminates) WAF friction.
 *
 * SSRF defence: `assertOraclecloudUrl` requires HTTPS + an ORC host (regex
 * host-pinned), and every fetch uses `redirect:'error'`. An off-host
 * ExternalURL is never emitted — the parser falls back to the tenant-built
 * job URL (anti-injection, same idiom as avature).
 *
 * Used by the oraclecloud adapter
 * (server/lib/portals/adapters/oraclecloud.mjs).
 */
import { fetchJson, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

// `oraclecloud(?:[1-9][0-9]?)?` = the unnumbered apex plus the numbered family
// oraclecloud1.com … oraclecloud99.com (some tenants live only on a numbered
// apex, e.g. `<tenant>.fa.ocs.oraclecloud26.com`, whose unnumbered sibling does
// not resolve). No leading zero and at most two digits
// keeps this a BOUNDED host pin, never a wildcard `oraclecloud<anything>.com`.
export const ORACLE_HOST_RE = /^[a-z0-9-]+\.fa\.(?:[a-z0-9-]+\.)?(?:ocs\.)?oraclecloud(?:[1-9][0-9]?)?\.com$/i;

export const PAGE_SIZE = 200;
export const MAX_PAGES = 25; // safety cap (~5000 jobs); hard ceiling like workday
const INTER_PAGE_DELAY_MS = 250; // WAF-aware spacing between same-host pages
const SNIPPET_CAP = 500;

// facetsList is a fixed constant on the finder; %3B is the encoded ';' separator.
const FACETS_LIST = 'LOCATIONS%3BWORK_LOCATIONS%3BWORKPLACE_TYPES%3BTITLES%3BCATEGORIES%3BORGANIZATIONS%3BPOSTING_DATES%3BFLEX_FIELDS';

export const meta = {
  value: 'oraclecloud',
  label: 'Oracle Cloud (ORC)',
  region: 'en',
};

/** Defence-in-depth host guard on every URL this source touches. @param {string} url */
export function assertOraclecloudUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`oraclecloud: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`oraclecloud: URL must use HTTPS: ${url}`);
  if (!ORACLE_HOST_RE.test(parsed.hostname)) {
    throw new Error(`oraclecloud: untrusted hostname "${parsed.hostname}" — must match *.fa[.<region>][.ocs].oraclecloud.com`);
  }
  return url;
}

/** Strip tags + collapse whitespace. @param {string} s */
function clean(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// NaN-safe Date.parse — `|| undefined` would also coerce a valid epoch 0.
// (shared with greenhouse.mjs)
function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Resolve ORC coordinates from a careers/api URL (+ optional company-entry
 * overrides). The URL is the host-pinned endpoint the adapter derived from the
 * entry's `api:`/careers_url. Honors optional `entry.siteNumber` /
 * `entry.locationId` overrides.
 *
 * @param {string} rawUrl host-pinned ORC careers URL
 * @param {{ siteNumber?: string, locationId?: string|number }} [entry]
 * @returns {{host:string, lang:string, siteNumber:string, locationId:(string|null)}|null}
 */
export function resolveSite(rawUrl, entry = {}) {
  if (typeof rawUrl !== 'string' || !rawUrl) return null;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!ORACLE_HOST_RE.test(parsed.hostname)) return null;

  const segs = parsed.pathname.split('/').filter(Boolean);
  // Path shape: /hcmUI/CandidateExperience/<lang>/sites/<siteNumber>/...
  const ceIdx = segs.findIndex((s) => s === 'CandidateExperience');
  const lang = ceIdx !== -1 && segs[ceIdx + 1] ? segs[ceIdx + 1] : 'en';
  const sitesIdx = segs.indexOf('sites');
  const siteFromUrl = sitesIdx !== -1 && segs[sitesIdx + 1] ? segs[sitesIdx + 1] : null;

  const overrideSite = typeof entry.siteNumber === 'string' && entry.siteNumber ? entry.siteNumber : null;
  const siteNumber = overrideSite || siteFromUrl || 'CX_1';
  const locationId = entry.locationId != null && `${entry.locationId}` !== ''
    ? `${entry.locationId}`
    : null;

  return { host: parsed.hostname, lang, siteNumber, locationId };
}

/**
 * Build the requisitions API URL. Params are set in BOTH the finder segment
 * and top-level (some tenants only honor one). facetsList uses %3B-encoded ';'.
 * Finder grammar: `findReqs;key=val,key=val,…` — a ';' after the finder name,
 * then comma-separated pairs. (A comma after findReqs 400s.)
 *
 * @param {{host:string, siteNumber:string, locationId?:(string|null)}} site
 * @param {number} [offset]
 * @param {number} [limit]
 */
export function buildApiUrl(site, offset = 0, limit = PAGE_SIZE) {
  const finderParams = [
    `siteNumber=${site.siteNumber}`,
    `facetsList=${FACETS_LIST}`,
    `limit=${limit}`,
    'sortBy=POSTING_DATES_DESC',
    `offset=${offset}`,
  ];
  if (site.locationId) finderParams.push(`locationId=${site.locationId}`);
  const finder = `findReqs;${finderParams.join(',')}`;
  const expand = 'requisitionList.workLocation,requisitionList.secondaryLocations';
  return `https://${site.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`
    + `?onlyData=true`
    + `&expand=${encodeURIComponent(expand)}`
    + `&finder=${finder}`
    + `&limit=${limit}&offset=${offset}`;
}

/**
 * Build the public posting URL for a requisition Id.
 * @param {{host:string, lang:string, siteNumber:string}} site
 * @param {string} id
 */
export function buildJobUrl(site, id) {
  return `https://${site.host}/hcmUI/CandidateExperience/${site.lang}/sites/${site.siteNumber}/job/${id}`;
}

/**
 * Assemble a location string for a requisition. Prefers PrimaryLocation; else
 * builds from the expanded workLocation object. Returns "" when nothing is
 * available. The remote/hybrid signal goes into workplaceType, not location.
 * @param {any} req
 */
function assembleLocation(req) {
  const primary = typeof req.PrimaryLocation === 'string' ? req.PrimaryLocation.trim() : '';
  if (primary) return primary;
  if (Array.isArray(req.workLocation) && req.workLocation.length) {
    const wl = req.workLocation[0] || {};
    return [wl.TownOrCity, wl.Region, wl.Country]
      .filter((v) => typeof v === 'string' && v.trim())
      .join(', ');
  }
  return '';
}

/** ORC WorkplaceTypeCode → web-ui workplaceType. @param {any} code */
function workplaceTypeOf(code) {
  if (code === 'ORA_REMOTE') return 'Remote';
  if (code === 'ORA_HYBRID') return 'Hybrid';
  if (code === 'ORA_ON_SITE' || code === 'ORA_ONSITE') return 'Onsite';
  return '';
}

/**
 * Pure normalizer for an ORC requisitions response page. Exported for unit
 * tests. Reads items[0].requisitionList[], maps each to the web-ui job shape,
 * drops rows with no resolvable URL. An ExternalURL is preferred, but only
 * when it stays on the tenant host — an off-host value falls back to the
 * built job URL (anti-injection). Returns { jobs: [], total, listLen } for
 * null / {} / non-array / {items:null}.
 *
 * @param {any} json
 * @param {{host:string, lang:string, siteNumber:string}} site
 * @param {string} companyName
 * @returns {{ jobs: object[], total: (number|null), listLen: number }}
 */
export function parseOraclecloud(json, site, companyName) {
  const item = Array.isArray(json?.items) ? json.items[0] : null;
  const list = item && Array.isArray(item.requisitionList) ? item.requisitionList : null;
  const total = item && typeof item.TotalJobsCount === 'number' ? item.TotalJobsCount : null;
  if (!list) return { jobs: [], total, listLen: 0 };

  const jobs = [];
  for (const req of list) {
    if (!req || typeof req !== 'object') continue;
    const id = req.Id != null ? String(req.Id)
      : (req.RequisitionNumber != null ? String(req.RequisitionNumber) : '');
    const builtUrl = id ? buildJobUrl(site, id) : '';

    // Prefer ExternalURL, but host-pin it: an absolute URL landing off the
    // tenant host is dropped in favour of the built job URL.
    let url = builtUrl;
    const externalUrl = typeof req.ExternalURL === 'string' ? req.ExternalURL.trim() : '';
    if (externalUrl) {
      try {
        if (new URL(externalUrl).hostname === site.host) url = externalUrl;
      } catch { /* malformed ExternalURL → keep builtUrl */ }
    }
    if (!url) continue; // dedup key — drop rows we can't link to

    const title = typeof req.Title === 'string' ? clean(req.Title) : '';
    const postedAt = toEpochMs(req.PostedDate);
    const workplaceType = workplaceTypeOf(req.WorkplaceTypeCode);
    jobs.push({
      id: `oraclecloud-${id || url}`,
      title,
      company: companyName,
      url,
      salary: '',
      location: assembleLocation(req),
      isRemote: workplaceType === 'Remote',
      workplaceType,
      relocates: false,
      date: postedAt !== undefined ? new Date(postedAt).toISOString() : '',
      snippet: typeof req.ShortDescriptionStr === 'string'
        ? clean(req.ShortDescriptionStr).slice(0, SNIPPET_CAP)
        : '',
      source: 'oraclecloud',
    });
  }
  return { jobs, total, listLen: list.length };
}

/** Resolve the page cap: a positive integer `max_pages` on the entry, capped. */
function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES);
  return MAX_PAGES;
}

/**
 * Fetch + normalize an ORC tenant's requisitions (paginated by offset in steps
 * of PAGE_SIZE). Stops on an empty/short page, once past TotalJobsCount, or at
 * the page cap — `hasMore` is deliberately ignored (unreliable, see header).
 * A first-page failure throws (dead board); a mid-run blip keeps what's
 * already collected (same idiom as tencent/workday).
 *
 * @param {string} endpoint host-pinned ORC careers URL (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchOraclecloud(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertOraclecloudUrl(endpoint);
  const site = resolveSite(endpoint, company);
  if (!site) throw new Error(`oraclecloud: cannot derive API URL from ${endpoint}`);
  const maxPages = resolveMaxPages(company);
  const companyName = (company && typeof company.name === 'string') ? company.name : '';

  /** @type {Map<string, object>} */
  const seen = new Map();
  let total = null;
  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * PAGE_SIZE;
    const apiUrl = buildApiUrl(site, offset, PAGE_SIZE);
    assertOraclecloudUrl(apiUrl); // SSRF guard before every fetch
    if (page > 0) await delay(INTER_PAGE_DELAY_MS, signal);

    let json;
    try {
      json = await fetchJson(fetchImpl, apiUrl, {
        signal,
        redirect: 'error',
        headers: { 'User-Agent': BROWSER_LIKE_USER_AGENT, Accept: 'application/json' },
      });
    } catch (err) {
      // A dead board should still read as a failure, but a mid-run blip must
      // not discard what's already collected.
      if (page === 0) throw err;
      console.error(`  ⚠ oraclecloud: page ${page} failed (${err.message}) — keeping the ${seen.size} jobs collected so far`);
      return [...seen.values()];
    }

    const { jobs, total: pageTotal, listLen } = parseOraclecloud(json, site, companyName);
    for (const job of jobs) {
      if (!seen.has(job.url)) seen.set(job.url, job);
    }
    if (total === null && pageTotal !== null) total = pageTotal;

    // Stop conditions — hasMore is NOT consulted (see module header):
    //   - an empty or short page means we've reached the end;
    //   - once we've paged past TotalJobsCount there's nothing left to fetch.
    if (listLen === 0 || listLen < PAGE_SIZE) break;
    if (total !== null && offset + PAGE_SIZE >= total) break;
  }
  return [...seen.values()];
}
