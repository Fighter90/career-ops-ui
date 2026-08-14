// @ts-check
/**
 * a16z Speedrun talent-network source — board-wide, zero-auth JSON aggregator.
 * Covers the a16z speedrun cohort plus the wider a16z portfolio (~200 startups).
 *
 *   GET https://speedrun-talent-network.com/api/v1/jobs?page={n}&source=career-ops
 *   → { jobs: [ { id, title, company, url, location, remote, published_at, … } ],
 *       total, page, page_size, total_pages, facets }
 *
 * Pagination is **0-indexed** and 50/page; the response carries `total_pages`,
 * so iteration is bounded by min(total_pages, max_pages). The default cap is
 * modest — the board is several thousand roles, so raise `max_pages` on the
 * entry or narrow server-side with `q:` (the feed runs full-text search with
 * synonym expansion, e.g. "ml", "swe", "nyc").
 *
 * Every request carries `source=career-ops` — the feed's documented optional
 * attribution param, echoed back; it does not change results.
 *
 * Records are normalized into the SAME rich web-ui job shape the other
 * board-wide providers emit (id/title/company/url/salary/location/isRemote/
 * workplaceType/relocates/date/snippet/source). The host is pinned to
 * speedrun-talent-network.com and every request uses `redirect:'error'`
 * (SSRF-safe).
 *
 * Config comes from the tracked-company entry via `opts.company`:
 *
 *   tracked_companies:
 *     - name: a16z Speedrun
 *       provider: a16z-speedrun-talent
 *       q: "machine learning"        # optional full-text query
 *       max_pages: 5                 # optional page cap (default 3, hard cap 120)
 *       enabled: true
 *
 * Used by the a16z-speedrun-talent adapter
 * (server/lib/portals/adapters/a16z-speedrun-talent.mjs).
 */
import { fetchJsonWithRetry, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';

const SITE_ORIGIN = 'https://speedrun-talent-network.com';
const TRUSTED_HOST = 'speedrun-talent-network.com';

/**
 * Exact-match host guard (no subdomains). Single source of truth shared by
 * `assertSpeedrunUrl` (fetch-time SSRF guard) and the adapter's endpoint
 * re-validation, mirroring `CRYPTOCURRENCYJOBS_HOST_RE`.
 */
export const SPEEDRUN_TALENT_HOST_RE = /^speedrun-talent-network\.com$/i;

/** Canonical API listing URL (adapter default endpoint). */
export const FEED_URL = `${SITE_ORIGIN}/api/v1/jobs`;

const PER_PAGE = 50; // feed page size — the API caps a page at 50; PER_PAGE=100 made the `rawCount < PER_PAGE` guard stop after page 1, truncating to 50 jobs
const DEFAULT_MAX_PAGES = 6; // × PER_PAGE = the 300-job default scan (sized in 50-job pages)
// Runaway bound, not a coverage target: iteration already stops at the feed's
// reported total_pages (or a short page), so on an honest feed the cap costs
// nothing and full-board sweeps keep working as the board grows. It only bites a
// misbehaving feed or an absurd max_pages entry; the board was ~353 pages /
// ~17.6k jobs as of 2026-08, same policy as workday's cap.
const MAX_PAGES_CAP = 1000; // hard stop on request count regardless of max_pages
const PAGE_DELAY_MS = 0; // no documented rate limit; tunable via opts

/** Upper bound on jobs returned across all pages — bounds memory defensively. */
export const MAX_RESULTS = MAX_PAGES_CAP * PER_PAGE;

export const meta = {
  value: 'a16z-speedrun-talent',
  label: 'a16z Speedrun',
  region: 'en',
};

/**
 * Assert that `url` targets speedrun-talent-network.com over HTTPS. Throws on
 * failure. Defence-in-depth host check on the endpoint built by the adapter.
 * @param {string} url
 * @returns {string} the same URL if valid
 */
export function assertSpeedrunUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`a16z-speedrun-talent: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`a16z-speedrun-talent: URL must use HTTPS: ${url}`);
  if (!SPEEDRUN_TALENT_HOST_RE.test(parsed.hostname)) {
    throw new Error(`a16z-speedrun-talent: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/** Resolve the page cap: a positive integer `max_pages` on the entry, capped. */
function resolveMaxPages(company) {
  const v = company?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/** Optional server-side query: `q:` on the entry, else joined `keywords:`. */
function resolveQuery(company) {
  if (typeof company?.q === 'string' && company.q.trim()) return company.q.trim();
  if (Array.isArray(company?.keywords) && company.keywords.length > 0) {
    const joined = company.keywords.filter((k) => typeof k === 'string' && k.trim()).join(' ').trim();
    if (joined) return joined;
  }
  return null;
}

/** Convert an ISO `published_at` string to 'YYYY-MM-DD'; '' when absent/invalid. */
function publishedToDate(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return '';
  return new Date(parsed).toISOString().slice(0, 10);
}

/**
 * Normalize one raw speedrun-talent-network job into the rich web-ui job shape,
 * or null when a required field is missing. Field mapping:
 *   - title:    `title`, trimmed (postings without one are dropped).
 *   - url:      `url` — host-locked to speedrun-talent-network.com over HTTPS
 *               (the dedup key). An off-host / non-HTTPS / malformed url drops
 *               the posting.
 *   - company:  `company`, falling back to the entry name, then a constant.
 *   - location: `location`; "Remote" appended when `remote` is true.
 *   - isRemote / workplaceType: derived from the `remote` boolean.
 *   - date:     `published_at` ISO → 'YYYY-MM-DD' ('' when absent/unparseable).
 *
 * Exported for unit tests.
 * @param {any} j
 * @param {string} [fallbackCompany]
 * @returns {object|null}
 */
export function normalizeSpeedrunJob(j, fallbackCompany = '') {
  if (!j || typeof j !== 'object') return null;

  const title = typeof j.title === 'string' ? j.title.trim() : '';
  if (!title) return null;

  let url = '';
  const rawUrl = typeof j.url === 'string' ? j.url.trim() : '';
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'https:' && parsed.hostname === TRUSTED_HOST) url = parsed.href;
    } catch {
      // malformed URL → leave url = '' → dropped below
    }
  }
  if (!url) return null;

  const company =
    typeof j.company === 'string' && j.company.trim()
      ? j.company.trim()
      : typeof fallbackCompany === 'string' && fallbackCompany.trim()
        ? fallbackCompany.trim()
        : 'a16z speedrun talent network';

  const isRemote = j.remote === true;
  const base = typeof j.location === 'string' ? j.location.trim() : '';
  const location = [base, isRemote ? 'Remote' : ''].filter(Boolean).join(', ');

  return {
    id: `a16z-speedrun-talent-${j.id != null ? String(j.id) : url}`,
    title,
    company,
    url,
    salary: '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : 'Onsite',
    relocates: false,
    date: publishedToDate(j.published_at),
    snippet: '',
    source: 'a16z-speedrun-talent',
  };
}

/**
 * Map one page's API JSON (`{ jobs: [...] }`) into deduped web-ui jobs (dedup
 * key: url). Tolerates a missing/non-array `jobs` by returning []. Exported for
 * tests. The fetch loop performs its own cross-page dedup and its own explicit
 * response-shape check (so a malformed first page fails loudly).
 * @param {any} json parsed API response for a single page
 * @param {number} [maxResults] cap on returned jobs
 * @param {string} [fallbackCompany] company name used when a row omits `company`
 */
export function parseSpeedrunJobs(json, maxResults = MAX_RESULTS, fallbackCompany = '') {
  const records = Array.isArray(json?.jobs) ? json.jobs : [];
  const out = [];
  const seen = new Set();
  for (const rec of records) {
    if (out.length >= maxResults) break;
    const job = normalizeSpeedrunJob(rec, fallbackCompany);
    if (job && !seen.has(job.url)) {
      seen.add(job.url);
      out.push(job);
    }
  }
  return out;
}

/**
 * Build the `?page=N&source=career-ops[&q=...]` URL for a page off the base
 * endpoint, robust to a base that already carries query params (e.g. an
 * override). Pagination is 0-indexed.
 * @param {string} base
 * @param {number} page
 * @param {string|null} q
 */
function pageUrl(base, page, q) {
  const u = new URL(base);
  u.searchParams.set('page', String(page));
  u.searchParams.set('source', 'career-ops');
  if (q) u.searchParams.set('q', q);
  return u.toString();
}

/**
 * Fetch + normalize the a16z speedrun talent-network listing from the REST API.
 * Pages through `{base}?page=N` (0-indexed), dedups across pages, and stops at
 * the last page (short page or `total_pages` reached). Iteration is bounded by
 * min(total_pages, max_pages), with max_pages hard-capped at 120. The first
 * page is a shape-change canary (missing/non-array `jobs` throws); a later page
 * that fails or is malformed is fail-soft (returns whatever was collected).
 *
 * @param {string} feedUrl base jobs endpoint (adapter default: FEED_URL)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           pageDelayMs?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchSpeedrunTalent(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {}, pageDelayMs = PAGE_DELAY_MS } = opts;
  assertSpeedrunUrl(feedUrl);

  const maxPages = resolveMaxPages(company);
  const q = resolveQuery(company);
  const fallbackCompany = typeof company.name === 'string' ? company.name : '';

  const jobs = [];
  const seen = new Set();

  for (let page = 0; page < maxPages; page++) {
    if (page > 0 && pageDelayMs > 0) await delay(pageDelayMs, signal);
    const url = assertSpeedrunUrl(pageUrl(feedUrl, page, q));

    let json;
    try {
      // This board paginates into the hundreds of pages, so a single transient
      // upstream blip mid-sweep used to abort the whole provider and return
      // NOTHING. Retry transient failures (429/5xx/timeout);
      // a permanent 4xx is not retried. Once retries are exhausted the error
      // propagates here and the page-0-throw / later-page-keep-partials rule
      // below decides the outcome (web-ui dead-board contract).
      json = await fetchJsonWithRetry(fetchImpl, url, {
        signal,
        redirect: 'error',
        headers: { accept: 'application/json', 'user-agent': BROWSER_LIKE_USER_AGENT },
        retryDelayMs: pageDelayMs > 0 ? pageDelayMs : 500,
      });
    } catch (err) {
      if (page === 0) throw err;
      break; // later-page failure is non-fatal (per-page fail-soft)
    }

    if (!json || !Array.isArray(json.jobs)) {
      // First page: a missing/non-array `jobs` is a response-shape change — fail
      // loudly. A later page failing the same way is fail-soft: keep what we have.
      if (page === 0) {
        throw new Error(
          `a16z-speedrun-talent: unexpected API response on page ${page} — expected { jobs: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
        );
      }
      break;
    }

    const rawCount = json.jobs.length;
    for (const job of parseSpeedrunJobs(json, MAX_RESULTS, fallbackCompany)) {
      if (!seen.has(job.url)) {
        seen.add(job.url);
        jobs.push(job);
      }
    }

    if (jobs.length >= MAX_RESULTS) break;
    // Stop at the last page: a short page, or past the reported total_pages.
    if (rawCount < PER_PAGE) break;
    if (Number.isInteger(json.total_pages) && page + 1 >= json.total_pages) break;
    // Cap warning: the feed had more pages than we were allowed to read — surface
    // it with the fix (same pattern as jibeapply/workday).
    if (page + 1 >= maxPages && Number.isInteger(json.total_pages) && json.total_pages > maxPages) {
      const name = fallbackCompany || 'a16z speedrun talent network';
      console.error(
        `⚠️  a16z-speedrun-talent: ${name} truncated at max_pages=${maxPages} (${jobs.length} of ${Number.isInteger(json.total) ? json.total : 'many'} jobs) — raise max_pages on this entry or narrow with q: for more`,
      );
    }
  }

  return jobs.slice(0, MAX_RESULTS);
}
