// @ts-check
/**
 * Tes source — UK and international teaching jobs (https://www.tes.com/jobs),
 * for a `job_boards:` entry with `provider: tes`. Parent career-ops
 * `providers/tes.mjs` parity (#6685, CAR-257).
 *
 * Tes publishes no API. Its search page fills itself from one public,
 * unauthenticated tRPC query on the same host, which this source reads:
 *
 *   GET https://www.tes.com/jobs/api/trpc/jobs.search?batch=1&input=<json>
 *
 * The input is the shape the page sends (captured upstream 2026-11-09):
 * `limit`, `siteCountry: "gb"` and a `filters` object whose every key is
 * required — the endpoint answers HTTP 400 with a zod error naming a missing
 * one. The endpoint is internal and undocumented, so the response envelope is
 * checked and a change fails loudly instead of reading as an empty board.
 *
 * Live behaviour this source is built around (upstream, 2026-11-09):
 *   - `limit` is validated up to 100, but any value above 50 returns a
 *     well-formed response with zero jobs. The page size is therefore 50.
 *   - `sort: "date"` gives a stable order to walk: 5,682 postings came back as
 *     114 pages of 50, the last one short, and page 115 empty. A posting added
 *     mid-walk can only push rows down a page, and the id dedup absorbs that.
 *   - `keywords` narrows the board server-side ("maths": 601 of 5,682).
 *     `locations` is ignored by the endpoint (the page's own location search
 *     sends it and still gets the whole board), so location is left to the
 *     scan's location_filter.
 *   - `siteCountry: "us"` returns nothing; "gb" is the board.
 *
 * Every posting is an identifiable school or employer; the walk covers the
 * inventory in date order. Promoted postings carry `promoted: true` and are
 * kept where the date order puts them, never moved or filtered. Rows carry no
 * external application URL, so the Tes vacancy page is the posting URL.
 *
 * Optional entry keys:
 *   keywords: maths   # Tes's own keyword search, applied server-side
 *   max_pages: 40     # pages of 50 per scan (default 150, capped at 400)
 *
 * SSRF defence: `assertTesUrl` requires HTTPS + the exact `www.tes.com` host,
 * and every fetch uses `redirect:'error'`. A row's `canonicalUrl` is accepted
 * only when it is a site-relative Tes vacancy path (`tesVacancyUrl`) — a
 * foreign, protocol-relative or traversal value drops the row rather than
 * injecting an off-host link into the dedup key.
 *
 * Used by the tes adapter (server/lib/portals/adapters/tes.mjs).
 */
import { fetchJsonWithRetry, delay } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
import { closesAtIso } from '../posting-close.mjs';
import { markTruncated } from '../board-truncation.mjs';

export const ORIGIN = 'https://www.tes.com';
export const SEARCH_URL = `${ORIGIN}/jobs/api/trpc/jobs.search`;
export const BOARD_URL = `${ORIGIN}/jobs/`;
const PAGE_SIZE = 50; // the largest limit that returns rows (see header)
export const PAGE_DELAY_MS = 250;
const DEFAULT_MAX_PAGES = 150; // 7,500 postings; the whole board was 114 pages upstream on 2026-11-09
const MAX_PAGES_CAP = 400;
const MAX_KEYWORDS_LENGTH = 100;
const SNIPPET_CAP = 500;
const VACANCY_PATH_RE = /^\/jobs\/vacancy\/[a-z0-9][a-z0-9-]*-\d+$/;

// Exact host match — used by the adapter's override pinning too.
export const TES_HOST_RE = /^www\.tes\.com$/i;

export const meta = {
  value: 'tes',
  label: 'Tes',
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertTesUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`tes: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`tes: URL must use HTTPS: ${url}`);
  if (!TES_HOST_RE.test(parsed.hostname)) {
    throw new Error(`tes: untrusted hostname "${parsed.hostname}" — must be www.tes.com`);
  }
  return url;
}

const hasControlChar = (text) => [...text].some((c) => c < ' ' || c === '\u007f');

/**
 * The entry's optional `keywords`, validated. Throws on a malformed value:
 * a config error, raised before any request. Exported for unit tests.
 * @param {any} entry
 * @returns {string} the keywords, or '' for the whole board
 */
export function tesKeywords(entry) {
  const raw = entry?.keywords;
  if (raw === undefined || raw === null || raw === '') return '';
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text || text.length > MAX_KEYWORDS_LENGTH || hasControlChar(text)) {
    throw new Error(`tes: keywords in entry "${entry?.name ?? '?'}" must be one line of 1-${MAX_KEYWORDS_LENGTH} characters`);
  }
  return text;
}

/**
 * One page's request URL. Exported for unit tests.
 * @param {string} keywords from tesKeywords()
 * @param {number} page 1-based
 */
export function buildTesSearchUrl(keywords, page) {
  const input = {
    0: {
      json: {
        limit: PAGE_SIZE,
        filters: {
          keywords,
          locations: [],
          excludedLocations: [],
          filters: {
            contractTerms: [],
            contractTypes: [],
            subjects: [],
            workplaces: [],
            positions: [],
            location: { distance: 30, distanceUnit: 'mi' },
          },
          sort: 'date',
          page,
        },
        siteCountry: 'gb',
      },
    },
  };
  return `${SEARCH_URL}?${new URLSearchParams({ batch: '1', input: JSON.stringify(input) })}`;
}

/**
 * Resolve the page cap: a positive integer `max_pages` on the entry, capped at
 * MAX_PAGES_CAP; the default otherwise. Exported for unit tests.
 * @param {any} entry
 */
export function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/** Strip control characters, collapse whitespace, cap at 300. */
function clean(value) {
  if (typeof value !== 'string') return '';
  return [...value].filter((c) => c >= ' ' && c !== '\u007f').join('').replace(/\s+/g, ' ').trim().slice(0, 300);
}

/** Decode HTML entities and collapse whitespace; '' for a non-string. */
function text(value) {
  return typeof value === 'string' ? decodeEntities(value).replace(/\s+/g, ' ').trim() : '';
}

// NaN-safe epoch parse for the row's ISO advert startDate.
function toEpochMs(value) {
  if (typeof value !== 'string' || !value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * The page payload out of a tRPC batch response: `[{ result: { data: { json } } }]`.
 * Throws a descriptive error when the envelope is not that shape, or when the
 * payload carries no `jobs` array. Exported for unit tests.
 * @param {any} body
 * @returns {{ jobs: any[], totalPages?: number }}
 */
export function tesPayload(body) {
  const first = Array.isArray(body) ? body[0] : null;
  const error = first && typeof first === 'object' ? first.error : null;
  if (error) {
    throw new Error(`tes: the search endpoint returned an error: ${clean(error?.json?.message) || 'no message'}`);
  }
  const json = first?.result?.data?.json;
  if (!json || typeof json !== 'object' || !Array.isArray(json.jobs)) {
    const got = json && typeof json === 'object'
      ? `keys [${Object.keys(json).join(', ')}]`
      : Array.isArray(body) ? `a batch of ${body.length}` : typeof body;
    throw new Error(`tes: unexpected search response — expected [{ result: { data: { json: { jobs: [...] } } } }], got ${got}`);
  }
  return json;
}

/**
 * Tes answers a bad input with HTTP 400. Name the rejection, so a changed
 * schema reads as one rather than "HTTP 400". The web-ui transport
 * (`fetchJsonWithRetry`) carries the status but not the response body, so the
 * zod message itself is not available here — the named 400 class is.
 * @param {any} err
 * @returns {string|null}
 */
function tesRejection(err) {
  if (err?.status !== 400) return null;
  return 'tes: the search endpoint rejected the request input (HTTP 400)';
}

// One amount: a currency sign or ISO code, then a figure. A bare "$" is not
// read: on Tes it is USD, AUD, SGD and more, and the row does not say which.
const AMOUNT = String.raw`(£|€|HK\$|[A-Z]{3}\s*)([\d,]+(?:\.\d+)?)`;
const SALARY_RE = new RegExp(String.raw`^${AMOUNT}(?:\s*-\s*${AMOUNT})?\s+per\s+(?:year|annum)$`, 'i');
const CURRENCY_SIGNS = { '£': 'GBP', '€': 'EUR', 'HK$': 'HKD' };

/** @param {string} sign */
function currencyOf(sign) {
  const s = sign.trim();
  return CURRENCY_SIGNS[s.toUpperCase() === 'HK$' ? 'HK$' : s] || s.toUpperCase();
}

/**
 * An annual salary as Tes writes it: "£31,650 - £49,084 per year",
 * "£42,000 per year", "AED 9,000 - AED 12,000 per year". One currency, a sign
 * or ISO code. Anything else (per month, per hour, pro rata, a bare "$",
 * "Competitive", two currencies) is left off, never inferred. A single figure
 * is both bounds. Exported for unit tests.
 * @param {any} range
 * @returns {{min: number, max: number, currency: string}|undefined}
 */
export function tesSalary(range) {
  const m = SALARY_RE.exec(text(range));
  if (!m) return undefined;
  const currency = currencyOf(m[1]);
  if (m[3] !== undefined && currencyOf(m[3]) !== currency) return undefined;
  const min = Number(m[2].replace(/,/g, ''));
  const max = m[4] === undefined ? min : Number(m[4].replace(/,/g, ''));
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) return undefined;
  return { min, max, currency };
}

/** web-ui salary string (justjoin convention): `from–to CURRENCY`. */
function salaryString(salary) {
  return `${salary.min}–${salary.max} ${salary.currency}`;
}

/**
 * The posting URL from a row's site-relative `canonicalUrl`, or null when it
 * is not a Tes vacancy path. Exported for unit tests.
 * @param {any} canonicalUrl
 * @returns {string|null}
 */
export function tesVacancyUrl(canonicalUrl) {
  if (typeof canonicalUrl !== 'string' || !VACANCY_PATH_RE.test(canonicalUrl)) return null;
  const url = new URL(canonicalUrl, ORIGIN);
  return url.origin === ORIGIN ? url.href : null;
}

/**
 * Normalize one page's rows into the web-ui rich job shape. Rows without a
 * title or a vacancy URL are dropped. Exported for unit tests.
 * @param {any[]} rows
 * @param {string} fallbackCompany
 */
export function parseTesJobs(rows, fallbackCompany = 'Tes') {
  const jobs = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const title = text(r.title);
    const url = tesVacancyUrl(r.canonicalUrl);
    if (!title || !url) continue;
    const company = text(r.employer?.name) || fallbackCompany;
    const location = text(r.displayLocation);
    const postedAt = toEpochMs(r.advert?.startDate);
    const closesAt = closesAtIso(r.application?.closeDate);
    const snippet = text(r.shortDescription).slice(0, SNIPPET_CAP);
    const salary = tesSalary(r.salary?.range);
    const id = Number.isSafeInteger(r.id) && r.id > 0 ? String(r.id) : url;
    const isRemote = /remote/i.test(location) || /remote/i.test(title);
    jobs.push({
      id: `tes-${id}`,
      title,
      company,
      url,
      salary: salary ? salaryString(salary) : '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : (/hybrid/i.test(location) ? 'Hybrid' : ''),
      relocates: false,
      date: postedAt !== undefined ? new Date(postedAt).toISOString().slice(0, 10) : '',
      snippet,
      source: 'tes',
      ...(closesAt ? { closesAt } : {}),
      // Kept for the walk's dedup key parity with the parent (externalId
      // first, url second) — consumed by fetchTes, harmless to filters.
      externalId: Number.isSafeInteger(r.id) && r.id > 0 ? String(r.id) : undefined,
    });
  }
  return jobs;
}

/**
 * Walk the board in date order, PAGE_SIZE rows a page, to its natural end.
 * A first-page failure throws (dead board ≠ empty board); a mid-run blip keeps
 * what's already collected and tags the board partial (canonical
 * `truncated` shape, board-truncation.mjs). `opts.maxPages` is the
 * liveness-probe budget: honor it as a ceiling so a probe costs one request,
 * and never let a probe read as a cap stop.
 *
 * @param {string} endpoint host-pinned board URL (from the adapter)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           maxPages?: number, sleep?: Function, retries?: number }} [opts]
 */
export async function fetchTes(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {}, maxPages: probeBudget, sleep: sleepOpt, retries } = opts;
  const sleep = sleepOpt || ((ms) => delay(ms, signal));
  assertTesUrl(endpoint);
  const name = company?.name || 'Tes';
  const keywords = tesKeywords(company);
  const entryMaxPages = resolveMaxPages(company);
  const probing = Number.isInteger(probeBudget) && probeBudget > 0;
  const maxPages = probing ? Math.min(entryMaxPages, probeBudget) : entryMaxPages;

  const jobs = [];
  const seen = new Set();
  // Why the walk stopped: 'complete' (a short or empty page, or the last page
  // the board reports), 'cap' (max_pages ran out on a full page),
  // 'fetch-error' or 'unrecognised-page'.
  let stopReason = 'complete';
  let lastPageFull = false;
  for (let page = 1; page <= maxPages; page += 1) {
    if (page > 1) await sleep(PAGE_DELAY_MS);
    let body;
    try {
      assertTesUrl(buildTesSearchUrl(keywords, page)); // SSRF guard before every fetch
      // redirect:'error' prevents SSRF via server-side redirects; transient
      // 429/5xx/timeouts retry, a 400 never does (parent parity).
      body = await fetchJsonWithRetry(fetchImpl, buildTesSearchUrl(keywords, page), {
        signal,
        redirect: 'error',
        headers: { Accept: 'application/json' },
        ...(retries !== undefined ? { retries } : {}),
      });
    } catch (err) {
      if (page === 1) {
        // Nothing read yet: the endpoint, or its schema, changed. An empty
        // result would read as "no postings", so fail loud.
        const rejection = tesRejection(err);
        throw rejection ? new Error(`${rejection}`, { cause: err }) : err;
      }
      console.error(`⚠️  tes: ${name} truncated at page ${page} (${jobs.length} jobs kept): ${tesRejection(err) || err.message}`);
      stopReason = 'fetch-error';
      break;
    }

    let payload;
    try {
      payload = tesPayload(body);
    } catch (err) {
      if (page === 1) throw err;
      console.error(`⚠️  tes: ${name} truncated at page ${page} (${jobs.length} jobs kept): ${err.message}`);
      stopReason = 'unrecognised-page';
      break;
    }

    for (const job of parseTesJobs(payload.jobs, name)) {
      const key = job.externalId || job.url;
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(job);
    }

    // The walk's own end, judged on the rows the source returned for this
    // page, not on how many survived parsing or dedup.
    lastPageFull = payload.jobs.length >= PAGE_SIZE;
    const reported = Number(payload.totalPages);
    if (!lastPageFull || (Number.isInteger(reported) && reported > 0 && page >= reported)) {
      lastPageFull = false;
      break;
    }
  }

  // Out of pages on a full page: our own cap truncated the board. Say so
  // (canonical partial-read shape, board-truncation.mjs) instead of returning
  // a silent prefix, and tell the operator what to do next.
  if (stopReason === 'complete' && lastPageFull && !probing) {
    stopReason = 'cap';
    console.error(`⚠️  tes: ${name} truncated at max_pages=${maxPages} (${jobs.length} jobs) — raise max_pages on this entry, or narrow it with keywords`);
  }
  if (stopReason !== 'complete') {
    // The endpoint reports no trustworthy board total the walk can cite (the
    // envelope's counts are per-page), so the tag carries `fetched` only.
    markTruncated(jobs, stopReason === 'cap' ? 'page-cap' : stopReason, { fetched: jobs.length });
  }
  return jobs;
}
