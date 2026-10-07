/**
 * Jobicy source — board-wide remote-jobs aggregator JSON API.
 *   GET https://jobicy.com/api/v2/remote-jobs?count=50
 *     → { jobs: [...], jobCount, nextCursor, hasMore }
 *
 * Implements the
 * web-ui source contract. The feed is walked with CURSOR pagination (the API
 * answers `hasMore: true` + an opaque `nextCursor` — measured live 2026-10-07
 * — which the single-request version ignored, so it ever only saw the first
 * page) until hasMore runs out or a page cap. The
 * en-scanner's title_filter can gate on configured titles.
 *
 * Used by the jobicy adapter (server/lib/portals/adapters/jobicy.mjs).
 */
import { requireArray, requireContainer } from './_shape.mjs';

const UA = 'career-ops-web-ui/1.0';

export const FEED_URL = 'https://jobicy.com/api/v2/remote-jobs?count=50';

/** Rows per request. 50 is the API maximum. */
export const PAGE_SIZE = 50;
/** Pages per sweep (50 × 50 = 2500 postings) when no max is configured. */
export const DEFAULT_MAX_PAGES = 50;
/** Hard ceiling on any configured max, so one entry cannot sweep forever. */
export const MAX_PAGES_CAP = 100;

export const meta = {
  value: 'jobicy',
  label: 'Jobicy',
  region: 'en',
};

/**
 * Validate that the URL targets jobicy.com over HTTPS (SSRF guard).
 * @param {string} u
 * @returns {string} the same URL if valid
 */
export function assertJobicyUrl(u) {
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error(`Jobicy: invalid URL: ${u}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Jobicy: URL must use HTTPS: ${u}`);
  }
  if (parsed.hostname !== 'jobicy.com' && parsed.hostname !== 'www.jobicy.com') {
    throw new Error(`Jobicy: untrusted hostname "${parsed.hostname}" — only jobicy.com is allowed`);
  }
  return u;
}

/** Positive-integer page cap from opts.maxPages / company.max_pages, clamped. */
function resolveMaxPages(company, opts) {
  const requested = opts.maxPages ?? (company && company.max_pages);
  if (Number.isInteger(requested) && requested > 0) return Math.min(requested, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/** One feed request: host-pinned, redirect-refusing, non-2xx → Error with .status. */
async function fetchOne(fetchImpl, url, signal) {
  const res = await fetchImpl(url, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Jobicy: HTTP ${res.status} (${url})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Fetch + normalize the Jobicy public JSON feed. Page 1 failure (HTTP or
 * shape) throws; a later-page failure keeps the pages already fetched and
 * logs. Pagination stops on the RAW page length (pre-filter).
 *
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object, maxPages?: number }} [opts]
 */
export async function fetchJobicy(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertJobicyUrl(feedUrl);
  const base = new URL(feedUrl);
  // Respect a caller's smaller `count`; the API caps at 50.
  const pageSize = Math.min(Math.max(Number(base.searchParams.get('count')) || PAGE_SIZE, 1), PAGE_SIZE);
  const maxPages = resolveMaxPages(opts.company, opts);

  const all = [];
  const seen = new Set();
  let cursor = null;
  for (let page = 1; page <= maxPages; page += 1) {
    const pageUrl = new URL(base.href);
    pageUrl.searchParams.set('count', String(pageSize));
    if (cursor) pageUrl.searchParams.set('cursor', cursor);

    let json;
    try {
      json = await fetchOne(fetchImpl, pageUrl.href, signal);
      requireContainer(json, 'Jobicy', 'jobs');
      requireArray(json.jobs, 'Jobicy jobs');
    } catch (err) {
      if (page === 1) throw err;
      console.warn(`jobicy: page ${page} failed — ${err.message} (keeping ${all.length} jobs fetched so far)`);
      break;
    }

    const raw = json.jobs;
    for (const j of raw) {
      if (!validRow(j)) continue;
      const job = normalize(j);
      if (!seen.has(job.url)) {
        seen.add(job.url);
        all.push(job);
      }
    }
    // The API's own `hasMore`/`nextCursor` pair is the authoritative end
    // signal — a short-but-nonempty page is NOT the end (the cursor walk is
    // not offset-keyed). Only an EMPTY raw page, a missing cursor, or an
    // explicit hasMore:false ends the sweep; the page cap bounds it regardless.
    if (raw.length === 0) break;
    cursor = typeof json.nextCursor === 'string' && json.nextCursor.trim() ? json.nextCursor.trim() : null;
    if (!cursor || json.hasMore === false) break;
  }
  return all;
}

/** A row is usable when it carries a title and an https jobicy.com URL. */
function validRow(j) {
  if (!j || typeof j !== 'object') return false;
  if (typeof j.jobTitle !== 'string' || j.jobTitle.trim() === '') return false;
  const rawUrl = typeof j.url === 'string' ? j.url.trim() : '';
  try {
    const p = new URL(rawUrl);
    return p.protocol === 'https:' && (p.hostname === 'jobicy.com' || p.hostname === 'www.jobicy.com');
  } catch {
    return false;
  }
}

function normalize(j) {
  const url = j.url.trim();

  // Build salary string from the feed's salaryMin/Max (+salaryCurrency,
  // verified live 2026-10-07). The old annualSalaryMin/Max names are still
  // read as a fallback so hand-written fixtures keep parsing.
  let salary = '';
  const min = j.salaryMin != null ? j.salaryMin : j.annualSalaryMin;
  const max = j.salaryMax != null ? j.salaryMax : j.annualSalaryMax;
  if (min != null || max != null) {
    const cur = typeof j.salaryCurrency === 'string' && j.salaryCurrency.trim() ? j.salaryCurrency.trim() : '';
    const sym = cur ? (cur === 'USD' ? '$' : `${cur} `) : '$';
    const fmt = (v) => `${sym}${Number(v).toLocaleString('en-US')}`;
    if (min != null && max != null && min !== 0 && max !== 0) {
      salary = `${fmt(min)}–${fmt(max)}`;
    } else if (min != null && min !== 0) {
      salary = `${fmt(min)}+`;
    } else if (max != null && max !== 0) {
      salary = `≤ ${fmt(max)}`;
    }
  }

  // Parse pubDate → 'YYYY-MM-DD' or ''
  let date = '';
  if (typeof j.pubDate === 'string' && j.pubDate.trim()) {
    const parsed = Date.parse(j.pubDate.trim());
    if (!Number.isNaN(parsed)) {
      date = new Date(parsed).toISOString().slice(0, 10);
    }
  }

  return {
    id: `jobicy-${j.id != null ? String(j.id) : url}`,
    title: j.jobTitle.trim(),
    company: typeof j.companyName === 'string' && j.companyName.trim() ? j.companyName.trim() : 'Jobicy',
    url,
    salary,
    location: typeof j.jobGeo === 'string' ? j.jobGeo.trim() : '',
    isRemote: true,
    workplaceType: 'Remote',
    relocates: false,
    date,
    snippet: '',
    source: 'jobicy',
  };
}
