// @ts-check
/**
 * Bulldogjob source (job_boards:) — Polish tech job board, bulldogjob.pl.
 * Ported from the parent's providers/bulldogjob.mjs (upstream #6253).
 *
 * There is no public JSON API: the listing pages are server-rendered by
 * Next.js and carry the postings in the embedded `__NEXT_DATA__` blob
 * (props.pageProps.jobs, 50 per page, with props.pageProps.totalCount).
 * Filters live in the path, so the entry's careers_url is the search the user
 * built on the site, e.g.
 *   https://bulldogjob.pl/companies/jobs/s/role,devops/experienceLevel,medium/city,Remote
 * and pagination is a trailing `/page,N` segment on that same path. The bare
 * search root `/companies/jobs/s` answers 404 and `/companies/jobs` answers
 * 403, so every request carries an explicit `/page,N` (page 1 included).
 * Observed live (2026-10): the whole board is ~930 postings over 19 pages.
 *
 * robots.txt (checked 2026-10) disallows /auth, /page, /feeds, /account,
 * /salaryBrackets and a few other root paths under `User-agent: *` — none of
 * them covers the /companies/jobs listing paths this source reads.
 *
 * The parent's per-row `language` (locale) is deliberately NOT mapped: the
 * web-ui scanner job shape has no language field (the personio language
 * fan-out is a deferred decision), so the row keeps the board default.
 */
import { fetchTextWithRetry } from '../http-json.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';

const ORIGIN = 'https://bulldogjob.pl';
const ALLOWED_HOSTS = new Set(['bulldogjob.pl', 'www.bulldogjob.pl']);
const LISTING_ROOT = '/companies/jobs';
const JOB_BASE = `${ORIGIN}/companies/jobs/`;

const PAGE_SIZE = 50; // what the site serves per listing page (slugState.perPage)
const DEFAULT_MAX_PAGES = 25; // 25 * 50 = 1,250 postings, above the whole board today
const MAX_PAGES_CAP = 100; // hard ceiling even for an explicit max_pages
const PAGE_DELAY_MS = 250; // polite pacing between listing pages

export const meta = {
  value: 'bulldogjob',
  label: 'Bulldogjob',
  region: 'en',
};

/**
 * Parse and validate a Bulldogjob listing URL from portals.yml.
 * @param {unknown} raw
 * @returns {URL | null}
 */
export function parseListingUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) return null;
  const path = parsed.pathname.replace(/\/+$/, '');
  if (path !== LISTING_ROOT && !path.startsWith(`${LISTING_ROOT}/`)) return null;
  return parsed;
}

/**
 * Build the filter part of the search path from a listing URL: the segments
 * after `/companies/jobs/s/`, minus any `page,N` segment the user copied along.
 * Any other path under /companies/jobs (the root, a single posting) maps to the
 * whole board. Only the host is a trust boundary; the path is rebuilt here from
 * its own segments under the fixed origin.
 * @param {URL} parsed
 * @returns {string} e.g. `/companies/jobs/s/role,devops`
 */
export function buildSearchPath(parsed) {
  const segments = parsed.pathname.split('/').filter(Boolean);
  // ['companies', 'jobs', 's', 'role,devops', ...]
  const filters = segments[2] === 's'
    ? segments.slice(3).filter((seg) => seg !== '.' && seg !== '..' && !/^page,\d+$/i.test(seg))
    : [];
  return [`${LISTING_ROOT}/s`, ...filters].join('/');
}

/**
 * @param {string} searchPath
 * @param {number} page 1-based
 */
export function pageUrl(searchPath, page) {
  return `${ORIGIN}${searchPath}/page,${page}`;
}

/** @param {unknown} html */
export function extractNextData(html) {
  if (typeof html !== 'string') return null;
  const match = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/** @param {unknown} value */
function safeHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/** @param {any} job */
function jobLocation(job) {
  const parts = [];
  if (job?.remote === true) parts.push('Remote');
  const city = String(job?.city || '').trim();
  if (city) parts.push(city);
  return parts.join(', ');
}

/**
 * Parse one listing page. Throws when the page is not the documented shape
 * (no __NEXT_DATA__, or pageProps.jobs is not an array); returns rows: []
 * for a well-formed page with no postings.
 * @param {unknown} html
 * @returns {{ total: number | null, rawCount: number, rows: object[] }}
 */
export function parseBulldogjobPage(html) {
  const data = extractNextData(html);
  const pageProps = data?.props?.pageProps;
  const list = pageProps && Array.isArray(pageProps.jobs) ? pageProps.jobs : null;
  if (!list) {
    const got = pageProps && typeof pageProps === 'object'
      ? `pageProps keys: [${Object.keys(pageProps).join(', ')}]`
      : (data ? 'no props.pageProps' : 'no __NEXT_DATA__ block');
    throw new Error(`bulldogjob: unexpected listing page — expected props.pageProps.jobs[], got ${got}`);
  }
  const total = Number.isInteger(pageProps.totalCount) ? pageProps.totalCount : null;
  const rows = [];
  for (const job of list) {
    if (!job || typeof job !== 'object') continue;
    const id = typeof job.id === 'string' ? job.id.trim() : '';
    const title = typeof job.position === 'string' ? job.position.trim() : '';
    if (!id || !title) continue;
    const encodedId = safeEncodeURIComponent(id);
    if (encodedId === null) continue;
    const location = jobLocation(job);
    const url = safeHttpsUrl(job.redirectTo) || `${JOB_BASE}${encodedId}`;
    rows.push({
      id: `bulldogjob-${id}`,
      title,
      // An external apply link, when the posting has one, is the employer's
      // own page; the board page is the fallback.
      url,
      company: String(job?.company?.name || '').trim(),
      salary: '',
      location,
      isRemote: /\bremote\b/i.test(location),
      workplaceType: /\bremote\b/i.test(location) ? 'Remote' : '',
      relocates: false,
      date: '', // the listing payload carries no publication date
      snippet: '',
      source: 'bulldogjob',
    });
  }
  return { total, rawCount: list.length, rows };
}

/** Resolve the page cap: a positive integer `max_pages` on the entry, capped. */
export function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * Fetch + normalize Bulldogjob postings.
 * @param {string} apiUrl base endpoint (from buildEndpoint — the listing URL)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchBulldogjob(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const parsed = parseListingUrl(apiUrl);
  if (!parsed) {
    throw new Error('bulldogjob: careers_url must be an https://bulldogjob.pl/companies/jobs… listing URL');
  }
  signal?.throwIfAborted();
  const searchPath = buildSearchPath(parsed);

  const maxPages = resolveMaxPages(company);
  // Test seam; the default honors the abort signal while pacing between pages.
  const sleep = opts.sleep || ((ms) => new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason ?? new Error('aborted')); }, { once: true });
  }));

  const jobs = [];
  const seen = new Set();
  let total = null;
  let stopReason = 'complete';
  let lastRawCount = 0;
  let page = 1;
  for (; page <= maxPages; page++) {
    if (page > 1) await sleep(PAGE_DELAY_MS);
    let html;
    try {
      html = await fetchTextWithRetry(fetchImpl, pageUrl(searchPath, page), { redirect: 'error', signal });
    } catch (err) {
      // The first page failing is the board's real state: propagate it unwrapped.
      if (page === 1) throw err;
      console.error(`⚠️  bulldogjob: ${company.name || 'Bulldogjob'} stopped at page ${page} (${jobs.length} jobs kept): ${err.message}`);
      stopReason = 'fetch-error';
      break;
    }
    const parsedPage = parseBulldogjobPage(html);
    if (total === null) total = parsedPage.total;
    lastRawCount = parsedPage.rawCount;
    for (const row of parsedPage.rows) {
      if (seen.has(row.url)) continue;
      seen.add(row.url);
      jobs.push(row);
    }
    // Short or empty page (counted on what the source returned, not on rows
    // kept), or the reported total reached: the board ended on its own.
    if (parsedPage.rawCount < PAGE_SIZE) break;
    if (total !== null && page * PAGE_SIZE >= total) break;
  }
  if (stopReason === 'complete' && page > maxPages && lastRawCount >= PAGE_SIZE) {
    stopReason = 'cap';
  }

  if (stopReason === 'cap') {
    const summary = `${jobs.length}${total !== null ? ` of ${total}` : ''} jobs`;
    console.error(`⚠️  bulldogjob: ${company.name || 'Bulldogjob'} truncated at max_pages=${maxPages} (${summary}) — raise max_pages on this entry for more`);
  }
  // Tag a partial board (the workdayTruncated convention) so a caller can
  // tell without reading stderr; the warning above says why.
  if (stopReason === 'cap' || stopReason === 'fetch-error') jobs.bulldogjobTruncated = true;
  return jobs;
}
