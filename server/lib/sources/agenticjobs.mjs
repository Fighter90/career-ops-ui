// @ts-check
/**
 * Agentic Jobs source — the site's public, documented REST API (parity with
 * parent career-ops `providers/agentic-jobs.mjs`, #2143/#2167).
 *
 *   GET {API_BASE}/jobs?page={n}   — 1-based paging, PAGE_SIZE per page
 *   → { data: [{ title, companyName|company, slug|url, location,
 *                countries: string[], description (HTML), postedAt (ISO),
 *                salaryMin/Max/Currency, geoRegion, … }],
 *       meta: { total, page, per_page } }
 *
 * The previous integration scraped the server-rendered HTML listing
 * (`data-impression-slug` card containers). The site markup changed and the
 * containers no longer exist, breaking the scraper outright (#2143). The API is
 * the stable, CORS-enabled, auth-free integration point the site itself
 * recommends for programmatic access.
 *
 * Records are normalized into the SAME rich web-ui job shape the HTML scraper
 * emitted (id/title/company/url/salary/location/isRemote/workplaceType/
 * relocates/date/snippet/source) so nothing downstream changes:
 *   - `url` is host-pinned by construction — built from the validated `slug`
 *     (`{SITE_ORIGIN}/jobs/{slug}`), or a same-host HTTPS `url` field as a
 *     fallback. Never trusts an off-host or non-HTTPS URL.
 *   - `salary` stays a STRING (rendered from the flat salaryMin/Max/Currency,
 *     null bounds omitted — never coerced to 0).
 *   - `date` is the `postedAt` ISO timestamp reduced to YYYY-MM-DD.
 *   - `snippet` is the HTML `description`, tag-stripped + entity-decoded.
 *
 * The host is pinned to agentic-engineering-jobs.com and every request uses
 * `redirect:'error'` (SSRF-safe). Rate limit: 30 requests/60s per IP —
 * PAGE_DELAY_MS paces requests comfortably under that; MAX_PAGES is a hard stop.
 *
 * Used by the agenticjobs adapter (server/lib/portals/adapters/agenticjobs.mjs).
 */
import { fetchJson, delay } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

const SITE_ORIGIN = 'https://agentic-engineering-jobs.com';
const API_BASE = `${SITE_ORIGIN}/api/v1`;
const TRUSTED_HOST = 'agentic-engineering-jobs.com';

/** Canonical API listing URL (adapter default endpoint). */
export const FEED_URL = `${API_BASE}/jobs`;

/** Upper bound on jobs returned across all pages — bounds memory defensively. */
export const MAX_RESULTS = 200;

const PAGE_SIZE = 50; // API default (meta.per_page)
const MAX_PAGES = 40; // hard safety stop on request count regardless of totals
const PAGE_DELAY_MS = 2100; // stays under the documented 30 req/60s limit

export const meta = {
  value: 'agenticjobs',
  label: 'Agentic Jobs',
  region: 'en',
};

/**
 * Assert that `url` targets agentic-engineering-jobs.com over HTTPS. Throws on
 * failure. Defence-in-depth host check on the endpoint built by the adapter.
 * @param {string} url
 * @returns {string} the same URL if valid
 */
export function assertAgenticUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`agenticjobs: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`agenticjobs: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`agenticjobs: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

// Minimal HTML entity decoder (inlined from parent career-ops
// providers/_html-entities.mjs). Named entities + numeric (&#252; / &#xfc;),
// with a codepoint-range guard so a malformed/adversarial entity can't throw a

/** @param {string} s */

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/**
 * Resolve a two-letter ISO country code to an English name. Returns '' for
 * anything that isn't a resolvable two-letter code. Exported for tests.
 * @param {unknown} code
 */
export function countryName(code) {
  if (typeof code !== 'string' || !/^[A-Za-z]{2}$/.test(code)) return '';
  try {
    const name = regionNames.of(code.toUpperCase());
    return name && name !== code.toUpperCase() ? name : '';
  } catch {
    return '';
  }
}

/**
 * Strip tags (dropping script/style content entirely) and decode entities,
 * collapsing whitespace. Descriptions arrive as HTML. Exported for tests.
 * @param {unknown} html
 */
export function stripHtml(html) {
  if (typeof html !== 'string' || !html) return '';
  const noMedia = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  return decodeEntities(noMedia.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Derive a human-readable location string. Prefers the API's own `location`
 * string, then decoded `countries`, then `geoRegion`. Exported for tests.
 * @param {any} j
 */
export function normalizeAgenticLocation(j) {
  if (typeof j?.location === 'string' && j.location.trim()) return j.location.trim();
  const countries = Array.isArray(j?.countries) ? j.countries : [];
  const names = [...new Set(countries.map(countryName).filter(Boolean))];
  if (names.length) return names.join(' / ');
  return typeof j?.geoRegion === 'string' ? j.geoRegion.trim() : '';
}

/**
 * Extract {min, max, currency} from the API's flat salaryMin/salaryMax/
 * salaryCurrency fields, omitting a bound the API left null (never coerced to 0
 * — a 0 min/max would read as real comp data downstream). Returns null when
 * neither bound is present. Exported for tests.
 * @param {any} j
 */
export function normalizeAgenticSalary(j) {
  const hasMin = typeof j?.salaryMin === 'number' && Number.isFinite(j.salaryMin);
  const hasMax = typeof j?.salaryMax === 'number' && Number.isFinite(j.salaryMax);
  if (!hasMin && !hasMax) return null;
  /** @type {{min?: number, max?: number, currency?: string}} */
  const salary = {};
  if (hasMin) salary.min = j.salaryMin;
  if (hasMax) salary.max = j.salaryMax;
  const currency = typeof j?.salaryCurrency === 'string' ? j.salaryCurrency.trim().toUpperCase() : '';
  if (currency) salary.currency = currency;
  return salary;
}

/**
 * Render the normalized salary into the web-ui shape's STRING `salary` field.
 * '' when there is no comp data. Exported for tests.
 * @param {{min?: number, max?: number, currency?: string}|null} salary
 */
export function salaryToString(salary) {
  if (!salary) return '';
  const cur = salary.currency ? ` ${salary.currency}` : '';
  const hasMin = typeof salary.min === 'number';
  const hasMax = typeof salary.max === 'number';
  if (hasMin && hasMax) return `${salary.min}–${salary.max}${cur}`;
  if (hasMin) return `from ${salary.min}${cur}`;
  if (hasMax) return `up to ${salary.max}${cur}`;
  return '';
}

/**
 * Build the host-pinned detail URL for a record. Prefers the validated `slug`
 * (`{SITE_ORIGIN}/jobs/{slug}`); falls back to a same-host HTTPS `url` field.
 * Returns '' when neither yields a safe URL.
 * @param {any} j
 */
function jobUrlFrom(j) {
  const slug = typeof j?.slug === 'string' ? j.slug.trim() : '';
  // The slug feeds straight into a URL path — keep it to safe path characters.
  if (slug && /^[A-Za-z0-9_-]+$/.test(slug)) return `${SITE_ORIGIN}/jobs/${slug}`;
  const raw = typeof j?.url === 'string' ? j.url.trim() : '';
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol === 'https:' && u.hostname === TRUSTED_HOST) return u.toString();
    } catch {
      /* not a usable URL — fall through */
    }
  }
  return '';
}

/**
 * Normalize one API job record into the web-ui rich job shape, or null when a
 * required field (title / company / a safe url) is missing. Exported for tests.
 * @param {any} j
 */
export function normalizeAgenticJob(j) {
  if (!j || typeof j !== 'object') return null;
  const title = typeof j.title === 'string' ? j.title.trim() : '';
  const company =
    (typeof j.companyName === 'string' ? j.companyName.trim() : '') ||
    (typeof j.company === 'string' ? j.company.trim() : '');
  const url = jobUrlFrom(j);
  if (!title || !company || !url) return null;

  const location = normalizeAgenticLocation(j);
  const isRemote = /\bremote\b/i.test(location);
  const salary = salaryToString(normalizeAgenticSalary(j));

  const posted = typeof j.postedAt === 'string' ? Date.parse(j.postedAt) : NaN;
  const date = Number.isFinite(posted) ? new Date(posted).toISOString().slice(0, 10) : '';

  return {
    id: `agenticjobs-${url}`,
    title,
    company,
    url,
    salary,
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : '',
    relocates: false,
    date,
    snippet: stripHtml(j.description),
    source: 'agenticjobs',
  };
}

/**
 * Map one page's API JSON (`{ data: [...] }`) into deduped web-ui jobs (dedup
 * key: url). Tolerates a missing/non-array `data` by returning []. Exported for
 * tests. The fetch loop performs its own cross-page dedup and its own explicit
 * response-shape check (so a malformed mid-pagination page fails loudly).
 * @param {any} json parsed API response for a single page
 * @param {number} [maxResults] cap on returned jobs
 */
export function parseAgenticJobs(json, maxResults = MAX_RESULTS) {
  const records = Array.isArray(json?.data) ? json.data : [];
  const out = [];
  const seen = new Set();
  for (const rec of records) {
    if (out.length >= maxResults) break;
    const job = normalizeAgenticJob(rec);
    if (job && !seen.has(job.url)) {
      seen.add(job.url);
      out.push(job);
    }
  }
  return out;
}

/**
 * Build the `?page=N` URL for a page off the base endpoint, robust to a base
 * that already carries query params (e.g. a `?mirror=1` override).
 * @param {string} base
 * @param {number} page
 */
function pageUrl(base, page) {
  const u = new URL(base);
  u.searchParams.set('page', String(page));
  return u.toString();
}

/**
 * Fetch + normalize the Agentic Jobs listing from the REST API. Pages through
 * `{base}?page=N` (1-based), dedups across pages, and hard-fails on zero jobs
 * (response-shape-change canary). A malformed page (missing/non-array `data`)
 * after real jobs were already collected throws rather than silently truncating.
 * @param {string} feedUrl base jobs endpoint (adapter default: FEED_URL)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           pageDelayMs?: number }} [opts]
 */
export async function fetchAgenticJobs(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal, pageDelayMs = PAGE_DELAY_MS } = opts;
  assertAgenticUrl(feedUrl);

  const jobs = [];
  const seen = new Set();
  let total = null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) await delay(pageDelayMs, signal);
    const url = assertAgenticUrl(pageUrl(feedUrl, page));
    const json = await fetchJson(fetchImpl, url, {
      signal,
      redirect: 'error',
      headers: { accept: 'application/json' },
    });
    // A missing/non-array `data` is a response-shape change, not a legitimate
    // empty page (the API returns `data: []` for that) — fail loudly instead of
    // silently truncating whatever pages were already collected.
    if (!json || !Array.isArray(json.data)) {
      throw new Error(
        `agenticjobs: unexpected API response shape on page ${page} — "data" is missing or not an array`,
      );
    }
    const records = json.data;
    if (total === null) total = typeof json.meta?.total === 'number' ? json.meta.total : null;
    // Trust the API's own reported page size over our constant.
    const effectivePageSize =
      typeof json.meta?.per_page === 'number' && json.meta.per_page > 0 ? json.meta.per_page : PAGE_SIZE;

    for (const job of parseAgenticJobs(json, MAX_RESULTS)) {
      if (!seen.has(job.url)) {
        seen.add(job.url);
        jobs.push(job);
      }
    }

    if (jobs.length >= MAX_RESULTS) break;
    if (records.length < effectivePageSize) break; // short page — last one
    if (total !== null && page * effectivePageSize >= total) break;
  }

  if (jobs.length === 0) {
    throw new Error(
      'agenticjobs: parsed 0 jobs from the API — the response shape likely changed',
    );
  }
  return jobs.slice(0, MAX_RESULTS);
}
