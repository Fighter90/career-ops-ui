// @ts-check
/**
 * NEOGOV source — public-sector and education careers sites on
 * `www.schooljobs.com` and `www.governmentjobs.com` (community colleges, school
 * districts, cities, counties). One `tracked_companies:` entry = one agency.
 *
 * Ported from parent career-ops `providers/neogov.mjs` and rewritten to the
 * web-ui source contract (12-field job objects + `meta` for auto-discovery).
 *
 * The public page is an SPA, but it loads its list from a plain HTML endpoint,
 * paged 10 at a time:
 *
 *   GET https://www.{schooljobs|governmentjobs}.com/careers/home/index
 *       ?agency=<agency>[&departmentFolder=<folder>]&sort=PostingDate
 *       &isDescendingSort=true&page=<n>
 *   → <li class="list-item">…<a class="item-details-link" href="/careers/…/jobs/<id>/<slug>">…
 *
 * The careers_url is shaped `/careers/<agency>[/<folder>]`. An optional
 * `<folder>` (a custom careers page such as a college's `facultypositions`) is
 * sent as `departmentFolder`, scoping the list to that page; without one, every
 * posting for the agency is returned.
 *
 * SSRF: the host is pinned by an exact lookup table (no suffix or substring
 * match), HTTPS only, and agency/folder are checked against a slug charset, so
 * nothing from config can inject a path or query. The bare hosts
 * (`schooljobs.com`, `governmentjobs.com`) redirect to `www.`, which
 * `redirect:'error'` would refuse, so the target is normalised to the www host.
 * The fetch re-parses its endpoint with the same checks before any I/O.
 *
 * Dead-board contract: a wrong agency slug is answered with a redirect to the
 * site's home page, so it fails loudly instead of reading as an empty board.
 * Any page failure (after the retry budget) propagates: the parent returns no
 * partial list, and neither does this port. A page that adds no new posting is
 * the end — or the site ignoring `page` and repeating itself; either way the
 * walk stops instead of looping. DEFAULT_MAX_PAGES=30 (300 postings), capped at
 * 200 via `max_pages` on the entry; hitting the ceiling warns.
 *
 * Used by the neogov adapter (server/lib/portals/adapters/neogov.mjs).
 */
import {
  fetchText,
  delay,
  computeRetryDelayMs,
  REDIRECT_REFUSAL_CAUSE_MESSAGE,
  BROWSER_LIKE_USER_AGENT,
} from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

export const meta = {
  value: 'neogov',
  label: 'NEOGOV (SchoolJobs / GovernmentJobs)',
  region: 'en',
};

const NEOGOV_ORIGINS = new Map([
  ['schooljobs.com', 'https://www.schooljobs.com'],
  ['www.schooljobs.com', 'https://www.schooljobs.com'],
  ['governmentjobs.com', 'https://www.governmentjobs.com'],
  ['www.governmentjobs.com', 'https://www.governmentjobs.com'],
]);
const SEGMENT_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INDEX_PATH = '/careers/home/index';
const JOB_PATH_RE = /^\/careers\/[^/]+\/(?:[^/]+\/)?jobs\/\d+/;

export const PAGE_SIZE = 10;
export const DEFAULT_MAX_PAGES = 30; // 300 postings
export const MAX_PAGES_CAP = 200;
export const INTER_PAGE_DELAY_MS = 200;
// Matches the parent's fetchTextWithRetry budget: 1 attempt + 2 retries on a
// transient failure (429, 5xx, or a network error without a status).
const RETRIES = 2;
const RETRY_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 4000;

const HEADERS = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  accept: 'text/html, */*;q=0.8',
  'X-Requested-With': 'XMLHttpRequest',
};

/**
 * @typedef {{ origin: string, agency: string, folder: string }} NeogovTarget
 */

/** @param {any} company */
function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * `{ origin, agency, folder }` from an entry's careers_url, or null.
 * Non-string values, malformed URLs, non-https, hosts outside the pinned
 * table (including lookalikes and path-spoofed URLs), a non-`/careers/` path,
 * the site's own `/careers/home/…` path, and illegal segment characters → null.
 * Agency and folder are lower-cased. Exported for tests and for the adapter.
 * @param {any} company
 * @returns {NeogovTarget|null}
 */
export function resolveTarget(company) {
  const raw = typeof company?.careers_url === 'string' ? company.careers_url.trim() : '';
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const origin = NEOGOV_ORIGINS.get(parsed.hostname.toLowerCase());
  if (parsed.protocol !== 'https:' || !origin) return null;
  const [root, agency, folder = ''] = parsed.pathname.split('/').filter(Boolean);
  if (root !== 'careers' || !agency || !SEGMENT_RE.test(agency)) return null;
  // `careers/home/...` is the site's own path, not an agency.
  if (agency.toLowerCase() === 'home') return null;
  if (folder && !SEGMENT_RE.test(folder)) return null;
  return { origin, agency: agency.toLowerCase(), folder: folder.toLowerCase() };
}

/**
 * The list-endpoint URL for one page. Exported for tests and for the adapter.
 * @param {NeogovTarget} t
 * @param {number} page
 */
export function buildPageUrl(t, page) {
  const q = new URLSearchParams({ agency: t.agency });
  if (t.folder) q.set('departmentFolder', t.folder);
  q.set('sort', 'PostingDate');
  q.set('isDescendingSort', 'true');
  q.set('page', String(page));
  return `${t.origin}${INDEX_PATH}?${q}`;
}

/**
 * Parse an endpoint built by buildPageUrl back into its target, re-applying
 * every check: HTTPS, an exact www host from the table, the fixed index path,
 * no credentials or port, and slug-charset agency/folder. Throws otherwise.
 * Exported for tests.
 * @param {string} endpoint
 * @returns {NeogovTarget}
 */
export function parseEndpoint(endpoint) {
  let u;
  try {
    u = new URL(String(endpoint));
  } catch {
    throw new Error(`neogov: invalid endpoint URL: ${endpoint}`);
  }
  const host = u.hostname.toLowerCase();
  const origin = NEOGOV_ORIGINS.get(host);
  if (u.protocol !== 'https:' || !origin || origin !== `https://${host}` || u.username || u.password || u.port) {
    throw new Error(`neogov: untrusted endpoint "${endpoint}" — must be https://www.schooljobs.com or https://www.governmentjobs.com`);
  }
  if (u.pathname !== INDEX_PATH) throw new Error(`neogov: unexpected endpoint path "${u.pathname}"`);
  const agency = (u.searchParams.get('agency') || '').toLowerCase();
  const folder = (u.searchParams.get('departmentFolder') || '').toLowerCase();
  if (!SEGMENT_RE.test(agency) || agency === 'home' || (folder && !SEGMENT_RE.test(folder))) {
    throw new Error(`neogov: invalid agency/folder in endpoint "${endpoint}"`);
  }
  return { origin, agency, folder };
}

/** @param {string} s */
const text = (s) => decodeEntities(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/**
 * Parse one `/careers/home/index` HTML page. Exported for unit tests.
 *
 * Each posting is an `<li class="list-item">` holding an
 * `<a class="item-details-link" href="/careers/<agency>/[<folder>/]jobs/<id>/<slug>">`
 * and a `<ul class="list-meta">` whose first `<li>` is the work location.
 *
 * - Empty/blank body → [].
 * - A body with no list items but the page's own `jobs-not-found-container`
 *   (or an empty `search-results-listing-container`) → [] — an empty board, or
 *   a page past the last one.
 * - Any other non-empty body → throws (not the documented endpoint), so a
 *   changed page cannot read as an empty board forever.
 * - Hrefs that do not resolve to a `/careers/…/jobs/<id>` path on the same
 *   origin are skipped, so a page can never point a job off-site.
 *
 * @param {unknown} html
 * @param {string} companyName
 * @param {string} origin e.g. "https://www.schooljobs.com"
 */
export function parseNeogovPage(html, companyName, origin) {
  if (typeof html !== 'string' || !html.trim()) return [];
  const items = html.split(/<li class="list-item"/i).slice(1);
  if (!items.length) {
    // "No jobs at this time." / "No jobs found." (and every page past the
    // last) render this container instead of a list.
    if (html.includes('jobs-not-found-container') || html.includes('search-results-listing-container')) return [];
    throw new Error('neogov: response is not a NEOGOV job list (no list items, listing container or not-found container)');
  }
  const jobs = [];
  for (const item of items) {
    const link =
      item.match(/<a [^>]*class="item-details-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
      item.match(/<a [^>]*href="([^"]+)"[^>]*class="item-details-link"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const title = text(link[2]);
    let url;
    try {
      const u = new URL(decodeEntities(link[1]), origin);
      if (u.origin !== origin || !JOB_PATH_RE.test(u.pathname)) continue;
      u.hash = '';
      url = u.href;
    } catch {
      continue;
    }
    if (!title) continue;
    const listMeta = (item.match(/<ul class="list-meta">([\s\S]*?)<\/ul>/i) || [])[1] || '';
    const location = text((listMeta.match(/<li>([\s\S]*?)<\/li>/i) || [])[1] || '');
    const isRemote = /\bremote\b/i.test(location);
    jobs.push({
      id: `neogov-${url}`,
      title,
      company: companyName,
      url,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: '',
      snippet: '',
      source: 'neogov',
    });
  }
  return jobs;
}

/**
 * `fetchText` with the parent's retry budget. Only transient failures are
 * retried: HTTP 429, HTTP 5xx, and network errors that carry no status. A
 * permanent 4xx, and a refused redirect (undici's `unexpected redirect` — a
 * wrong agency slug), are rethrown at once.
 * @param {Function} fetchImpl
 * @param {string} url
 * @param {{ signal?: AbortSignal, sleep: (ms: number, signal?: AbortSignal) => Promise<void>,
 *           retryDelayMs: number }} o
 */
async function fetchTextWithRetry(fetchImpl, url, { signal, sleep, retryDelayMs }) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      return await fetchText(/** @type {any} */ (fetchImpl), url, { signal, headers: HEADERS, redirect: 'error' });
    } catch (err) {
      lastErr = err;
      const status = err && typeof err.status === 'number' ? err.status : undefined;
      const redirectRefusal = status === undefined
        && err instanceof TypeError
        && err?.cause?.message === REDIRECT_REFUSAL_CAUSE_MESSAGE;
      const transient = !redirectRefusal && (status === undefined || status === 429 || status >= 500);
      if (!transient || attempt === RETRIES || signal?.aborted) throw err;
      await sleep(computeRetryDelayMs({
        attempt, baseDelayMs: retryDelayMs, maxDelayMs: RETRY_MAX_DELAY_MS, retryAfter: err?.retryAfter,
      }), signal);
    }
  }
  throw lastErr;
}

/**
 * Fetch and normalize one NEOGOV agency with a sequential paged walk.
 *
 * The endpoint is re-validated before any I/O. Pages are fetched until one
 * adds no new posting, up to the entry's ceiling (`max_pages`, default 30,
 * cap 200). A positive integer `maxPages` (a bounded probe) lowers the
 * ceiling further and does not trigger the "raise max_pages" warning. Any
 * page failure propagates unwrapped — no partial board.
 *
 * @param {string} endpoint page-1 URL from the adapter's buildEndpoint
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any, maxPages?: number,
 *           sleep?: (ms: number, signal?: AbortSignal) => Promise<void>, retryDelayMs?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchNeogov(endpoint, opts = {}) {
  const {
    fetchImpl = fetch,
    signal,
    company = {},
    maxPages,
    sleep = delay,
    retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  const t = parseEndpoint(endpoint);
  const name = typeof company?.name === 'string' ? company.name : '';

  const probeMax = Number(maxPages);
  const ceiling = resolveMaxPages(company);
  const pagesToFetch = probeMax > 0 ? Math.min(ceiling, probeMax) : ceiling;

  const jobs = [];
  const seen = new Set();
  let stoppedOnEmpty = false;
  let pagesFetched = 0;
  for (let page = 1; page <= pagesToFetch; page++) {
    if (page > 1) await sleep(INTER_PAGE_DELAY_MS, signal);
    const html = await fetchTextWithRetry(fetchImpl, buildPageUrl(t, page), { signal, sleep, retryDelayMs });
    pagesFetched++;
    const found = parseNeogovPage(html, name, t.origin);
    // A page that adds nothing new is the end — or the site ignoring `page`
    // and repeating itself. Either way, stop instead of looping.
    let fresh = 0;
    for (const job of found) {
      if (seen.has(job.url)) continue;
      seen.add(job.url);
      jobs.push(job);
      fresh++;
    }
    if (fresh === 0) {
      stoppedOnEmpty = true;
      break;
    }
  }
  if (!stoppedOnEmpty && pagesFetched >= ceiling && !(probeMax > 0 && probeMax < ceiling)) {
    console.warn(`neogov: ${name || t.agency}: stopped at ${ceiling} pages (${ceiling * PAGE_SIZE} postings); raise max_pages on this entry`);
  }
  return jobs;
}
