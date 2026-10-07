/**
 * Landing.jobs source — board-wide tech/Europe-focused aggregator feed.
 *   GET https://landing.jobs/api/v1/jobs?limit=50&offset=N → JSON array
 *
 * Implements the
 * web-ui source contract.
 *
 * v1.242.0: the fetch was a single un-parameterized GET, which the API caps
 * at the first 50 postings. The walk now pages `?limit=50&offset=N` until a
 * short page, a page that adds no fresh URL, or the page cap. A first-page
 * failure throws (dead board); a mid-walk failure keeps what's already
 * collected.
 *
 * NOTE: the v1 feed carries no company-name field — the employer slug only
 * appears in the posting URL path (`https://landing.jobs/at/<slug>/<job>`),
 * so `company` is derived best-effort from that slug (humanized) and falls
 * back to 'Landing.jobs'.
 *
 * Used by the landingjobs adapter (server/lib/portals/adapters/landingjobs.mjs).
 */
import { requireArray } from './_shape.mjs';

const UA = 'career-ops-web-ui/1.0';

export const FEED_URL = 'https://landing.jobs/api/v1/jobs';

const TRUSTED_HOST = 'landing.jobs';
const PAGE_SIZE = 50;  // the API's hard page size
const MAX_PAGES = 25;  // safety cap (1250 postings), same ceiling as oraclecloud

export const meta = {
  value: 'landingjobs',
  label: 'Landing.jobs',
  region: 'en',
};

/**
 * SSRF guard — throws unless host is landing.jobs over HTTPS.
 * @param {string} u
 * @returns {string} the same URL if valid
 */
export function assertLandingjobsUrl(u) {
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error(`landingjobs: invalid URL: ${u}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`landingjobs: URL must use HTTPS: ${u}`);
  }
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(
      `landingjobs: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`,
    );
  }
  return u;
}

/**
 * Derive a best-effort company name from a Landing.jobs posting URL.
 * Posting URLs are `https://landing.jobs/at/<slug>/<job>`; the `<slug>` is
 * humanized (hyphens/underscores → spaces, title-cased).
 * Returns '' when the URL is not the expected `/at/<slug>/…` shape.
 * @param {string} url
 * @returns {string}
 */
export function companyFromUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return '';
  }
  const segs = parsed.pathname.split('/').filter(Boolean);
  if (segs[0] !== 'at' || !segs[1]) return '';
  return segs[1]
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// NaN-safe ISO-date → 'YYYY-MM-DD' string, or '' on failure.
function toDateStr(value) {
  if (typeof value !== 'string' || !value) return '';
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Normalize a single Landing.jobs job object to the 12-field shape.
 * Returns null for rows that are missing required fields (title, url).
 * @param {any} j
 * @returns {object|null}
 */
function normalize(j) {
  if (!j || typeof j !== 'object') return null;

  const title = typeof j.title === 'string' ? j.title.trim() : '';
  if (!title) return null;

  // Host-lock the posting URL; drop rows with missing/off-host URLs.
  let url = '';
  const rawUrl = typeof j.url === 'string' ? j.url.trim() : '';
  if (rawUrl) {
    try {
      const p = new URL(rawUrl);
      if (p.protocol === 'https:' && p.hostname === TRUSTED_HOST) url = p.href;
    } catch {
      // malformed — leave url = '' → dropped below
    }
  }
  if (!url) return null;

  const company = companyFromUrl(url) || 'Landing.jobs';

  // Build location string from first location entry + remote flag.
  const first =
    Array.isArray(j.locations) &&
    j.locations[0] &&
    typeof j.locations[0] === 'object'
      ? j.locations[0]
      : {};
  const city = typeof first.city === 'string' ? first.city.trim() : '';
  const country =
    typeof first.country_code === 'string' ? first.country_code.trim() : '';
  const base = [city, country].filter(Boolean).join(', ');
  const isRemote = j.remote === true;
  const location = [base, isRemote ? 'Remote' : ''].filter(Boolean).join(', ');

  // Salary — only if the feed exposes gross_salary_low/high.
  let salary = '';
  if (
    typeof j.gross_salary_low === 'number' &&
    typeof j.gross_salary_high === 'number'
  ) {
    salary = `${j.gross_salary_low}–${j.gross_salary_high}`;
  }

  return {
    id: `landingjobs-${j.id != null ? String(j.id) : url}`,
    title,
    company,
    url,
    salary,
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : 'Onsite',
    relocates: false,
    date: toDateStr(j.published_at) || toDateStr(j.created_at),
    snippet: '',
    source: 'landingjobs',
  };
}

/**
 * The feed URL for one page, with the paging params pinned (the bare GET is
 * capped at the first 50 postings server-side).
 * @param {string} feedUrl
 * @param {number} offset
 */
export function buildFeedPageUrl(feedUrl, offset = 0) {
  const parsed = new URL(assertLandingjobsUrl(feedUrl));
  parsed.searchParams.set('limit', String(PAGE_SIZE));
  parsed.searchParams.set('offset', String(offset));
  return parsed.href;
}

/**
 * Fetch + normalize the Landing.jobs public feed, walking ?offset= until a
 * short page, a page that adds no fresh URL, or MAX_PAGES.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 */
export async function fetchLandingjobs(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertLandingjobsUrl(feedUrl);

  /** @type {Set<string>} */
  const seen = new Set();
  const jobs = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = buildFeedPageUrl(feedUrl, page * PAGE_SIZE);
    let rows;
    try {
      const res = await fetchImpl(url, {
        signal,
        redirect: 'error',
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });
      if (!res.ok) {
        const err = new Error(`landingjobs: HTTP ${res.status} (${url})`);
        err.status = res.status;
        throw err;
      }
      rows = requireArray(await res.json(), 'Landing.jobs jobs');
    } catch (err) {
      // Nothing collected yet means the endpoint is wrong — surface it. After
      // a success, a later failure is a partial result worth keeping.
      if (page === 0) throw err;
      console.error(`  ⚠ landingjobs: page ${page + 1} failed (${err.message}) — keeping the ${jobs.length} jobs collected so far`);
      return jobs;
    }

    let fresh = 0;
    for (const j of rows) {
      const job = normalize(j);
      if (job && !seen.has(job.url)) {
        seen.add(job.url);
        jobs.push(job);
        fresh += 1;
      }
    }
    // Stop on the RAW page length; a page that adds no fresh URL (the API
    // ignoring offset) is the end too.
    if (rows.length < PAGE_SIZE || fresh === 0) break;
  }
  return jobs;
}
