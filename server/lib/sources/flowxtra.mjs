/**
 * Flowxtra source — board-wide, no-auth, cross-tenant aggregator.
 *   GET https://app.flowxtra.com/api/central/jobs?status=Live&per_page=100&page=N
 *     → { success, data: { data: [ { title, urlJobApplay, name_company,
 *          city_company, state_company, country_company, workplace,
 *          date_share, ... } ], next_page_url, last_page, per_page, total } }
 *
 * Implements the web-ui
 * source contract. One call lists live postings from every company using
 * Flowxtra as its ATS, so this is a board-wide aggregator like Himalayas /
 * Arbeitnow — the en-scanner's title_filter narrows the result afterwards.
 *
 * The apply URL (`urlJobApplay`) is host-locked to flowxtra.com and the API
 * endpoint is host-pinned to app.flowxtra.com over HTTPS with `redirect:'error'`
 * on every page, closing the SSRF redirect vector.
 *
 * Used by the flowxtra adapter (server/lib/portals/adapters/flowxtra.mjs).
 */
import { fetchJson, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { requireArray, requireContainer } from './_shape.mjs';

const TRUSTED_ENDPOINT_HOST = 'app.flowxtra.com';
const TRUSTED_APPLY_HOST = 'flowxtra.com';
const PER_PAGE = 100;
const DEFAULT_MAX_PAGES = 3;
const MAX_PAGES_CAP = 50;

export const JOBS_ENDPOINT = 'https://app.flowxtra.com/api/central/jobs';

export const meta = {
  value: 'flowxtra',
  label: 'Flowxtra',
  region: 'en',
};

/**
 * Assert that `url` points to app.flowxtra.com over HTTPS. Throws on failure.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertFlowxtraUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`flowxtra: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`flowxtra: URL must use HTTPS: ${url}`);
  }
  if (parsed.hostname !== TRUSTED_ENDPOINT_HOST) {
    throw new Error(`flowxtra: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_ENDPOINT_HOST}`);
  }
  return url;
}

/** Resolve the page cap: a positive integer, capped at MAX_PAGES_CAP. */
function resolveMaxPages(value) {
  if (Number.isInteger(value) && value > 0) return Math.min(value, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// date_share is an ISO 8601 string (e.g. '2026-07-23T16:22:27.000000Z'); accept
// epoch numbers too so the parser survives small API shape changes.
function toDateString(value) {
  let ms;
  if (typeof value === 'number' && Number.isFinite(value)) {
    ms = value < 1_000_000_000_000 ? value * 1000 : value;
  } else if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value.trim());
    ms = Number.isNaN(parsed) ? undefined : parsed;
  }
  if (ms == null) return '';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// Prefer the ready-made apply URL, host-locked to flowxtra.com over HTTPS.
function cleanApplyUrl(value) {
  const raw = cleanText(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' && parsed.hostname === TRUSTED_APPLY_HOST ? parsed.href : '';
  } catch {
    return '';
  }
}

/**
 * Map a raw Flowxtra job row to the 12-field web-ui normalized shape.
 * Returns null for rows that cannot produce a valid title + apply url.
 * Exported for unit tests.
 * @param {any} j
 * @param {string} [fallbackCompany]
 */
export function normalizeFlowxtraJob(j, fallbackCompany) {
  if (!j || typeof j !== 'object') return null;

  const title = cleanText(j.title);
  if (!title) return null;

  const url = cleanApplyUrl(j.urlJobApplay);
  if (!url) return null;

  const company =
    cleanText(j.name_company) || cleanText(fallbackCompany) || 'Flowxtra';

  const parts = [j.city_company, j.state_company, j.country_company]
    .map((v) => cleanText(v))
    .filter(Boolean);
  const isRemote = j.workplace === 'Remote';
  const remote = isRemote ? 'Remote' : '';
  const location = [...parts, remote].filter(Boolean).join(', ');

  return {
    id: `flowxtra-${url}`,
    title,
    company,
    url,
    salary: '',
    location,
    isRemote,
    workplaceType: cleanText(j.workplace),
    relocates: false,
    date: toDateString(j.date_share),
    snippet: '',
    source: 'flowxtra',
  };
}

/**
 * Parse one API response page's `data.data` array into normalized jobs.
 * Malformed/empty pages yield `[]` (never throw). Exported for unit tests.
 * @param {any} json
 * @param {{ fallbackCompany?: string, maxResults?: number }} [opts]
 */
export function parseFlowxtra(json, opts = {}) {
  const { fallbackCompany, maxResults } = opts;
  const rows = json && json.data && json.data.data;
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const j of rows) {
    const normalized = normalizeFlowxtraJob(j, fallbackCompany);
    if (normalized) out.push(normalized);
    if (Number.isInteger(maxResults) && maxResults > 0 && out.length >= maxResults) break;
  }
  return out;
}

/**
 * Fetch + normalize the Flowxtra board-wide feed across paginated pages.
 * Host-pinned to app.flowxtra.com. The board is ONE request on page 1, so a
 * page-1 failure (transport error or a 200 with the wrong shape) THROWS — a
 * dead board must not read as "live but empty" (v1.242.0 Phase-2 rule). A
 * later-page failure keeps the pages already collected.
 *
 * The scanner passes the portals.yml entry as `opts.company`: its `max_pages`
 * lifts the default page cap and its `name` attributes rows whose
 * `name_company` is blank.
 *
 * @param {string} [baseUrl] the endpoint base (host-pinned)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, maxPages?: number,
 *           maxResults?: number, fallbackCompany?: string, company?: object }} [opts]
 */
export async function fetchFlowxtra(baseUrl = JOBS_ENDPOINT, opts = {}) {
  const { fetchImpl = fetch, signal, maxPages, maxResults } = opts;
  const company = (opts.company && typeof opts.company === 'object') ? opts.company : {};
  // An explicit opt still wins over the entry's `max_pages` (probe cap).
  const pages = resolveMaxPages(maxPages ?? company.max_pages);
  const entryName = typeof company.name === 'string' && company.name.trim() ? company.name.trim() : '';
  const fallbackCompany = opts.fallbackCompany ?? entryName;
  const out = [];

  for (let page = 1; page <= pages; page++) {
    const url = `${baseUrl}?status=Live&per_page=${PER_PAGE}&page=${page}`;
    assertFlowxtraUrl(url);

    let json;
    try {
      json = await fetchJson(fetchImpl, url, {
        signal,
        redirect: 'error',
        headers: { 'User-Agent': BROWSER_LIKE_USER_AGENT, Accept: 'application/json' },
      });
    } catch (err) {
      // Page 1 failing means the board or the endpoint is wrong and that must
      // surface. A later page failing after rows are in hand is a partial
      // result worth keeping.
      if (page === 1) throw err;
      console.error(`  ⚠ flowxtra: page ${page} failed (${err.message}) — keeping the ${out.length} jobs collected so far`);
      break;
    }

    if (page === 1) {
      // A 200 with the wrong shape THROWS on page 1 instead of silently
      // reading as an empty board (Phase-2 cross-cutting rule).
      requireContainer(json, 'Flowxtra', 'data.data');
      requireArray(json.data.data, 'Flowxtra data.data');
    }

    const rows = json && json.data && json.data.data;
    if (!Array.isArray(rows)) break; // later page lost the shape → keep partials

    const remaining =
      Number.isInteger(maxResults) && maxResults > 0 ? maxResults - out.length : undefined;
    out.push(...parseFlowxtra(json, { fallbackCompany, maxResults: remaining }));

    if (Number.isInteger(maxResults) && maxResults > 0 && out.length >= maxResults) break;
    if (!json.data.next_page_url || rows.length < PER_PAGE) break; // last page reached (raw page length)
  }

  return out;
}
