// @ts-check
/**
 * SchoolSpring source — US K-12 school districts, each hosted at
 * `https://<district>.schoolspring.com`. One `tracked_companies:` entry = one
 * district (per-tenant, like hiringroom/prevueaps — not an aggregator).
 *
 * Ported from parent career-ops `providers/schoolspring.mjs` and rewritten to
 * the web-ui source contract (12-field job objects + `meta` for
 * auto-discovery, pure exported helpers, an injected `fetchImpl`).
 *
 * ── The API ──────────────────────────────────────────────────────────────
 * The district board is an SPA over a public, unauthenticated JSON API on a
 * FIXED host that takes the district's hostname as `domainName`:
 *
 *   GET https://api.schoolspring.com/api/Jobs/GetPagedJobsWithSearch
 *       ?domainName=<district>.schoolspring.com&page=<n>&size=100&…
 *   → { success, message, value: { page, size, jobsList: [{ jobId, employer,
 *       title, location, displayDate }] } }
 *
 * The list endpoint carries id / title / employer / location / date only — pay
 * and description live behind a per-job request the zero-token scanner skips.
 * Posting links are rebuilt as `https://<district>/?jobid=<numeric id>`.
 *
 * ── Security ─────────────────────────────────────────────────────────────
 * Two hosts are pinned by anchored checks, never substring matching: the
 * district host must match `<label>.schoolspring.com` (HTTPS only, and never
 * the platform's own `www`/`api` hosts), and every request URL must be exactly
 * `https://api.schoolspring.com` (assertApiUrl). The district host reaches the
 * API only as a URL-encoded query value, so it cannot steer the request.
 * Every fetch uses `redirect:'error'`; `fetchJson` adds the DNS-rebinding
 * guard on the real network path.
 *
 * ── Caps / failure ───────────────────────────────────────────────────────
 * Paginated PAGE_SIZE (100) at a time under DEFAULT_MAX_PAGES (20), raised per
 * entry via `max_pages` up to MAX_PAGES_CAP (100). A page that adds no new
 * posting (end of board, or the API ignoring `page` and repeating itself)
 * stops the walk. A network/HTTP failure on ANY page — after the shared retry
 * budget — fails the whole company loudly rather than returning a silently
 * partial board; the scanner's per-company try/catch keeps the other
 * companies going (fail-soft across companies, fail-loud within one).
 *
 * Used by the schoolspring adapter (server/lib/portals/adapters/schoolspring.mjs).
 */
import { fetchJsonWithRetry, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

export const meta = {
  value: 'schoolspring',
  label: 'SchoolSpring',
  region: 'en',
};

export const API_HOST = 'api.schoolspring.com';
const API_PATH = '/api/Jobs/GetPagedJobsWithSearch';

/** One DNS label under schoolspring.com; anchored at both ends. */
export const SCHOOLSPRING_HOST_RE = /^[a-z0-9][a-z0-9-]*\.schoolspring\.com$/;
// `www` and `api` are the platform's own hosts, not districts.
const NON_DISTRICT = new Set(['www.schoolspring.com', 'api.schoolspring.com']);

export const PAGE_SIZE = 100;
export const DEFAULT_MAX_PAGES = 20; // 2,000 postings; a district never comes close
export const MAX_PAGES_CAP = 100;
const INTER_PAGE_DELAY_MS = 200;
const RETRY_DELAY_MS = 500;

const HEADERS = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  Accept: 'application/json',
};

/**
 * Whether a (lower-cased) hostname is a SchoolSpring district host.
 * @param {unknown} hostname
 */
export function isDistrictHost(hostname) {
  return typeof hostname === 'string'
    && SCHOOLSPRING_HOST_RE.test(hostname)
    && !NON_DISTRICT.has(hostname);
}

/**
 * District hostname from a URL string, or null. HTTPS only; the host is
 * lower-cased before the anchored check, so `Example.SchoolSpring.com` is
 * accepted and `example.schoolspring.com.evil.example` or a path-spoofed
 * `https://evil.example/example.schoolspring.com/` is not.
 * @param {unknown} value
 * @returns {string|null}
 */
export function resolveDistrictHost(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || !isDistrictHost(host)) return null;
  return host;
}

/**
 * Assert a request URL is the fixed SchoolSpring API over HTTPS. Throws.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertApiUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`schoolspring: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`schoolspring: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== API_HOST || parsed.port !== '' || parsed.username || parsed.password) {
    throw new Error(`schoolspring: untrusted hostname "${parsed.hostname}" — must be ${API_HOST}`);
  }
  return url;
}

/**
 * Entry `max_pages` → page ceiling (positive integers only, capped).
 * @param {any} company
 */
export function resolveMaxPages(company) {
  const v = company?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * The list URL for one page of one district. The empty filter params mirror
 * the SPA's own request shape.
 * @param {string} host district hostname
 * @param {number} page 1-based
 */
export function buildPageUrl(host, page) {
  const q = new URLSearchParams({
    domainName: host,
    keyword: '',
    location: '',
    category: '',
    gradelevel: '',
    jobtype: '',
    organization: '',
    swLat: '',
    swLon: '',
    neLat: '',
    neLon: '',
    page: String(page),
    size: String(PAGE_SIZE),
    sortDateAscending: 'false',
  });
  return `https://${API_HOST}${API_PATH}?${q}`;
}

/**
 * The API HTML-escapes titles and employer names ("Hudson&#x27;s Bay", "Grade 5
 * &#8211; Teacher"), so they go through the shared decoder.
 * @param {unknown} s
 */
const clean = (s) => decodeEntities(String(s ?? '')).trim();

/**
 * `displayDate` → `YYYY-MM-DD`, or '' when absent/unparseable (a fabricated
 * date would defeat the scanner's age filter). The API's timestamps carry no
 * zone, so the calendar date is taken as written rather than shifted to UTC.
 * @param {unknown} value
 */
function toDate(value) {
  if (!value) return '';
  const s = String(value).trim();
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return '';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : new Date(ms).toISOString().slice(0, 10);
}

/**
 * Parse one `GetPagedJobsWithSearch` page. Exported for unit tests.
 *
 * - `null`, `{}` and `[]` (contentless bodies) or `jobsList: []` (a real empty
 *   board) → empty.
 * - A bare primitive (string, number, boolean), any envelope without
 *   `success: true` (including an omitted `success`), or any body with no
 *   `jobsList` array (including `value: null` and `jobsList: null`) → throws,
 *   naming what it got.
 * - Rows with no numeric `jobId` or no title are skipped.
 *
 * @param {any} json
 * @param {string} companyName
 * @param {string} origin e.g. "https://acme.schoolspring.com"
 * @returns {{ jobs: object[], rawCount: number }}
 */
export function parseSchoolSpringPage(json, companyName, origin) {
  // Only the documented contentless bodies (null, {} and []) read as empty. Any
  // other primitive (a bare string or number) is not this API's envelope.
  if (json == null) return { jobs: [], rawCount: 0 };
  if (typeof json !== 'object') throw new Error(`schoolspring: unexpected response type ${typeof json}, expected a JSON object`);
  if (Object.keys(json).length === 0) return { jobs: [], rawCount: 0 };
  // The API always answers success:true on a good response, so require it
  // rather than treating only an explicit success:false as a failure.
  if (json.success !== true) throw new Error(`schoolspring: API error: ${json.message || 'response did not report success:true'}`);
  // A real empty board answers `jobsList: []`. No jobsList array at all is not
  // that, so it throws instead of silently reading as empty.
  const list = json.value?.jobsList;
  if (!Array.isArray(list)) {
    throw new Error(`schoolspring: unexpected response shape, no jobsList array (${json.value && typeof json.value === 'object' ? `value keys: ${Object.keys(json.value).join(', ') || 'none'}` : `top-level keys: ${Object.keys(json).join(', ')}`})`);
  }
  const host = new URL(origin).hostname;
  const jobs = [];
  for (const j of list) {
    const id = String(j?.jobId ?? '').trim();
    const title = clean(j?.title);
    // jobId is numeric; anything else is not a posting we can link to.
    if (!/^\d+$/.test(id) || !title) continue;
    const where = clean(j.location);
    const employer = clean(j.employer);
    const location = [where, employer].filter(Boolean).join(' - ');
    const isRemote = /\bremote\b/i.test(where) || /\bremote\b/i.test(title);
    jobs.push({
      id: `schoolspring-${host}-${id}`,
      title,
      company: companyName,
      url: `${origin}/?jobid=${id}`,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: toDate(j.displayDate),
      snippet: '',
      source: 'schoolspring',
    });
  }
  return { jobs, rawCount: list.length };
}

/**
 * Fetch + normalize one SchoolSpring district.
 *
 * `opts.maxPages` (a health-probe budget) lowers the page ceiling and never
 * triggers the "raise max_pages" warning. `opts.sleep` / `opts.retryDelayMs`
 * are test hooks for the inter-page pause and the retry backoff.
 *
 * @param {string} endpoint `https://<district>.schoolspring.com/` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any, maxPages?: number,
 *           sleep?: (ms: number, signal?: AbortSignal) => Promise<void>, retryDelayMs?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchSchoolSpring(endpoint, opts = {}) {
  const {
    fetchImpl = fetch,
    signal,
    company = {},
    sleep = delay,
    retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  const name = (company && typeof company.name === 'string') ? company.name : '';
  // Refused BEFORE any request: an off-host endpoint never reaches the network.
  const host = resolveDistrictHost(endpoint);
  if (!host) {
    throw new Error(`schoolspring: cannot derive district host for ${name || endpoint} (need an https://<district>.schoolspring.com careers_url)`);
  }
  const origin = `https://${host}`;

  const ceiling = resolveMaxPages(company);
  const probeCap = Number.isInteger(opts.maxPages) && Number(opts.maxPages) > 0 ? Number(opts.maxPages) : 0;
  const pagesToFetch = probeCap ? Math.min(ceiling, probeCap) : ceiling;

  const jobs = [];
  const seen = new Set();
  let lastPageFull = false;
  let stoppedOnRepeat = false;
  let pagesFetched = 0;
  for (let page = 1; page <= pagesToFetch; page++) {
    if (page > 1) await sleep(INTER_PAGE_DELAY_MS, signal);
    // No catch: a failure on any page (after retries) fails the company
    // instead of returning a partial list, and propagates unwrapped.
    const json = await fetchJsonWithRetry(/** @type {typeof fetch} */ (fetchImpl), assertApiUrl(buildPageUrl(host, page)), {
      signal,
      redirect: 'error',
      headers: HEADERS,
      retryDelayMs,
    });
    const { jobs: rows, rawCount } = parseSchoolSpringPage(json, name, origin);
    pagesFetched++;
    // A repeated or overlapping page must not add the same postings again. A
    // page that adds nothing new is the end of the board, or the API ignoring
    // `page`; either way, stop instead of looping to the ceiling.
    let fresh = 0;
    for (const job of rows) {
      if (seen.has(job.url)) continue;
      seen.add(job.url);
      jobs.push(job);
      fresh++;
    }
    lastPageFull = rawCount >= PAGE_SIZE;
    if (!lastPageFull) break;
    if (fresh === 0) {
      stoppedOnRepeat = true;
      break;
    }
  }
  // Warn only when OUR ceiling cut a board that had more — never for a probe
  // cap and never when the API just repeated itself.
  if (lastPageFull && !stoppedOnRepeat && pagesFetched >= ceiling && !(probeCap && probeCap < ceiling)) {
    console.warn(`  ⚠ schoolspring: ${name || host}: stopped at ${ceiling} pages (${ceiling * PAGE_SIZE} postings); raise max_pages on this entry`);
  }
  return jobs;
}
