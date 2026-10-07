/**
 * Himalayas source — board-wide remote-jobs public JSON API.
 *   GET https://himalayas.app/jobs/api?limit=50  → { jobs: [...], totalCount, offset }
 *
 * Implements the
 * web-ui source contract. The feed is walked with OFFSET pagination (the API
 * silently clamps `limit` to 20 server-side — measured 2026-10-07: a
 * `limit=50|100` request still answers `limit: 20, jobs: 20` of a
 * totalCount ≈ 115k — so a single request ever only saw the newest ~20 rows)
 * until a short page or a page cap. Himalayas is a remote-only board so
 * isRemote is always true and workplaceType is always 'Remote'.
 *
 * Used by the himalayas adapter (server/lib/portals/adapters/himalayas.mjs).
 */
import { requireArray, requireContainer } from './_shape.mjs';

const UA = 'career-ops-web-ui/1.0';
const TRUSTED_HOST = 'himalayas.app';

export const FEED_URL = 'https://himalayas.app/jobs/api?limit=50';

/** Rows per page. The API clamps `limit` to exactly this, so the walk sends it explicitly. */
export const PAGE_SIZE = 20;
/** Pages per sweep (50 × 20 = ~1000 postings) when no max is configured. */
export const DEFAULT_MAX_PAGES = 50;
/** Hard ceiling on any configured max, so one entry cannot sweep forever. */
export const MAX_PAGES_CAP = 100;

export const meta = {
  value: 'himalayas',
  label: 'Himalayas',
  region: 'en',
};

/**
 * Assert that `url` points to himalayas.app over HTTPS. Throws on failure.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertHimalayasUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`himalayas: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`himalayas: URL must use HTTPS: ${url}`);
  }
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`himalayas: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/** Positive-integer page cap from opts.maxPages / company.max_pages, clamped. */
function resolveMaxPages(company, opts) {
  const requested = opts.maxPages ?? (company && company.max_pages);
  if (Number.isInteger(requested) && requested > 0) return Math.min(requested, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/** One feed request: SSRF-pinned, redirect-refusing, non-2xx → Error with .status. */
async function fetchOne(fetchImpl, url, signal) {
  const res = await fetchImpl(url, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Himalayas: HTTP ${res.status} (${url})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Fetch + normalize the Himalayas public feed. Page 1 failure (HTTP or shape)
 * throws; a later-page failure keeps the pages already fetched and logs.
 * Pagination stops on the RAW page length (pre-filter), same convention as
 * jobbankca/senjob.
 *
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object, maxPages?: number }} [opts]
 */
export async function fetchHimalayas(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertHimalayasUrl(feedUrl);
  const base = new URL(feedUrl);
  const maxPages = resolveMaxPages(opts.company, opts);

  const all = [];
  const seen = new Set();
  for (let offset = 0, page = 1; page <= maxPages; offset += PAGE_SIZE, page += 1) {
    const pageUrl = new URL(base.href);
    pageUrl.searchParams.set('limit', String(PAGE_SIZE));
    pageUrl.searchParams.set('offset', String(offset));

    let json;
    try {
      json = await fetchOne(fetchImpl, pageUrl.href, signal);
      requireContainer(json, 'Himalayas', 'jobs');
      requireArray(json.jobs, 'Himalayas jobs');
    } catch (err) {
      if (page === 1) throw err;
      console.warn(`himalayas: page ${page} failed — ${err.message} (keeping ${all.length} jobs fetched so far)`);
      break;
    }

    const raw = json.jobs;
    for (const j of raw) {
      if (!j || typeof j !== 'object') continue;
      const job = normalize(j);
      if (job && !seen.has(job.url)) {
        seen.add(job.url);
        all.push(job);
      }
    }
    if (raw.length < PAGE_SIZE) break; // short page — end of the feed
  }
  return all;
}

// Himalayas pubDate is epoch seconds. Accept milliseconds and parseable
// date strings too so the parser survives small API shape changes.
function toDateString(value) {
  let ms;
  if (typeof value === 'number' && Number.isFinite(value)) {
    ms = value < 1_000_000_000_000 ? value * 1000 : value;
  } else if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    } else {
      const parsed = Date.parse(value);
      ms = Number.isNaN(parsed) ? undefined : parsed;
    }
  }
  if (ms == null) return '';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Salary string from the API's minSalary/maxSalary/currency (verified live
 * 2026-10-07; the old scalar `salary` is read only as a fallback). USD gets
 * the bare `$`; any other currency is named, so `45,000` never reads as USD.
 */
function salaryText(j) {
  const min = j.minSalary;
  const max = j.maxSalary;
  if (min != null || max != null) {
    const cur = cleanText(j.currency);
    const sym = cur ? (cur === 'USD' ? '$' : `${cur} `) : '$';
    const fmt = (v) => `${sym}${Number(v).toLocaleString('en-US')}`;
    if (min != null && max != null && min !== 0 && max !== 0) return `${fmt(min)}–${fmt(max)}`;
    if (min != null && min !== 0) return `${fmt(min)}+`;
    if (max != null && max !== 0) return `≤ ${fmt(max)}`;
  }
  return cleanText(j.salary);
}

function cleanHimalayasUrl(value) {
  const raw = cleanText(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const trusted = host === TRUSTED_HOST || host.endsWith(`.${TRUSTED_HOST}`);
    return parsed.protocol === 'https:' && trusted ? parsed.href : '';
  } catch {
    return '';
  }
}

function locationText(value) {
  if (!Array.isArray(value)) return '';
  return value
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim())
    .join(', ');
}

/**
 * Map a raw Himalayas job object to the 12-field web-ui normalized shape.
 * Returns null for rows that cannot produce a valid title + url.
 */
function normalize(j) {
  const title = cleanText(j.title);
  if (!title) return null;

  const url = cleanHimalayasUrl(j.applicationLink) || cleanHimalayasUrl(j.guid);
  if (!url) return null;

  return {
    id: `himalayas-${j.id != null ? String(j.id) : url}`,
    title,
    company: cleanText(j.companyName),
    url,
    salary: salaryText(j),
    location: locationText(j.locationRestrictions),
    isRemote: true,
    workplaceType: 'Remote',
    relocates: false,
    date: toDateString(j.pubDate),
    snippet: '',
    source: 'himalayas',
  };
}
