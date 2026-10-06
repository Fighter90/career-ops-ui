// @ts-check
/**
 * Taleo Enterprise Edition (TEE) source — one career section per company.
 *
 * Ported from parent career-ops `providers/taleo.mjs`, rewritten to the web-ui
 * source contract (12-field job objects + `meta` for auto-discovery).
 *
 *   GET  https://<tenant>.taleo.net/careersection/<section>/jobsearch.ftl
 *        → shell HTML: the public `portal` id and the column headings
 *   POST https://<tenant>.taleo.net/careersection/rest/jobboard/searchjobs
 *             ?lang=<lang>&portal=<portal>   (JSON body, pageNo = 1..N)
 *        → { requisitionList: [{ contestNo, jobId, column: [...] }],
 *            pagingData: { totalCount } }
 *
 * SSRF: the host is pinned by an anchored regex (`<tenant>.taleo.net`), HTTPS
 * only, and `tre.taleo.net` (Taleo Business Edition, a different product) is
 * refused. Every request uses `redirect:'error'`.
 *
 * Parent quirks kept on purpose:
 *  - Column mapping is heading-driven (Requisition Title / Location / Posting
 *    Date); with no headings in the shell it falls back to positions 0/1/2.
 *  - The location column may be a JSON-encoded array (`["AB-Calgary","AB-Edmonton"]`)
 *    and is joined with "; ".
 *  - Pagination stops on an EMPTY RAW page or once the accumulated row count
 *    reaches `pagingData.totalCount`. A short page is NOT an end signal (boards
 *    return uneven page sizes) and a missing/blank total just runs to the cap.
 *  - The job id is `contestNo || jobId`; rows with neither, or without a title,
 *    are dropped (but still count toward the raw page length).
 *  - A shell without a portal id is a private/unavailable board and throws; an
 *    empty `requisitionList` is a valid empty board.
 *  - `fetchDetails` (opt-in) reads the JobPosting JSON-LD description, whose
 *    text is URL-encoded HTML; bounded by `detailLimit` (1..100, default 25),
 *    fail-soft per job, and skipped on a bounded probe (`maxPages`).
 *
 * Optional per-entry config (top-level keys or a `taleo:` block):
 *   max_pages (default 100, cap 1000), fetchDetails, detailLimit.
 *
 * Used by the taleo adapter (server/lib/portals/adapters/taleo.mjs).
 */
import {
  fetchJson,
  fetchText,
  delay,
  computeRetryDelayMs,
  REDIRECT_REFUSAL_CAUSE_MESSAGE,
  BROWSER_LIKE_USER_AGENT,
} from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';

export const meta = {
  value: 'taleo',
  label: 'Taleo',
  region: 'en',
};

export const TALEO_HOST_RE = /^[a-z0-9-]+\.taleo\.net$/i;
const TALEO_BUSINESS_EDITION_HOST = 'tre.taleo.net';
const SECTION_RE = /^\/careersection\/([a-z0-9._-]+)\/(?:jobsearch|joblist|jobdetail)\.ftl$/i;
export const DEFAULT_MAX_PAGES = 100;
export const MAX_PAGES_CAP = 1000;
const DEFAULT_DETAIL_LIMIT = 25;
const MAX_DETAIL_LIMIT = 100;
export const INTER_PAGE_DELAY_MS = 200;
const SNIPPET_CAP = 500;
const RETRIES = 2;
const RETRY_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 4000;

const HEADERS_HTML = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.8',
};
const HEADERS_JSON = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  tz: 'America/Toronto',
  tzname: 'America/Toronto',
};

/** @typedef {{ url: URL, section: string }} Board */

function safeEncode(value) {
  try {
    return encodeURIComponent(String(value));
  } catch {
    return encodeURIComponent(String(value).replace(/[\uD800-\uDFFF]/g, '�'));
  }
}

/**
 * Parse a public TEE section URL. HTTPS + `<tenant>.taleo.net` + a
 * `/careersection/<section>/(jobsearch|joblist|jobdetail).ftl` path, else null.
 * @param {unknown} raw
 * @returns {Board|null}
 */
export function parseBoardUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || host === TALEO_BUSINESS_EDITION_HOST || !TALEO_HOST_RE.test(url.hostname)) return null;
    if (url.username || url.password || url.port) return null;
    const match = url.pathname.match(SECTION_RE);
    if (!match) return null;
    return { url, section: match[1] };
  } catch { return null; }
}

/**
 * Board for a company entry: explicit `api:` first, then `careers_url`.
 * @param {any} entry
 * @returns {Board|null}
 */
export function resolveBoard(entry) {
  if (!entry || typeof entry !== 'object') return null;
  for (const raw of [entry.api, entry.careers_url]) {
    const parsed = parseBoardUrl(raw);
    if (parsed) return parsed;
  }
  return null;
}

/** @param {string} raw @returns {Board} */
export function assertTaleoUrl(raw) {
  const parsed = parseBoardUrl(raw);
  if (!parsed) throw new Error(`taleo: untrusted or invalid TEE URL: ${raw}`);
  return parsed;
}

/**
 * The location column sometimes carries a raw JSON-encoded string array.
 * Join it into readable text; anything else passes through unchanged.
 * @param {any} value
 */
export function parseLocationField(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
          return parsed.map((v) => htmlToText(v)).filter(Boolean).join('; ');
        }
      } catch { /* not JSON; keep the raw string */ }
    }
  }
  return value;
}

/** @param {any} value @returns {string} */
function textValue(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return htmlToText(String(value));
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    for (const key of ['value', 'text', 'label', 'name', 'displayValue']) {
      if (value[key] != null) return textValue(value[key]);
    }
  }
  return '';
}

/** @param {unknown} html */
export function extractPortal(html) {
  if (typeof html !== 'string') return '';
  const matches = [
    /[?&]portal=(\d+)/i,
    /["']portal(?:Id)?["']?\s*[:=]\s*["']?(\d+)/i,
    /name=["']portal["'][^>]*value=["'](\d+)/i,
  ];
  for (const re of matches) {
    const hit = html.match(re);
    if (hit) return hit[1];
  }
  return '';
}

/** @param {URL} url */
function extractLang(url) {
  return url.searchParams.get('lang') || 'en';
}

/** @param {unknown} html @returns {string[]} */
export function extractHeadings(html) {
  if (typeof html !== 'string') return [];
  const jobsTable = html.match(/<table\b[^>]*id=["']jobs["'][^>]*>[\s\S]*?<thead\b[^>]*>([\s\S]*?)<\/thead>/i);
  const source = jobsTable ? jobsTable[1] : html;
  const labels = [];
  for (const m of source.matchAll(/<(?:th|label)[^>]*>([\s\S]*?)<\/(?:th|label)>/gi)) {
    const value = htmlToText(m[1]);
    if (value && !/^(?:icons?|actions?)$/i.test(value)) labels.push(value);
  }
  return labels;
}

function fieldIndex(headings, patterns) {
  return headings.findIndex((h) => patterns.some((p) => p.test(h)));
}

/** @param {any} row @param {string[]} headings */
export function parseColumns(row, headings) {
  const columns = Array.isArray(row?.column) ? row.column : [];
  const values = columns.map(textValue);
  const labels = Array.isArray(headings) ? headings : [];
  const positional = labels.length === 0;
  const titleMatch = fieldIndex(labels, [/requisition\s*title/i, /job\s*title/i, /^title$/i]);
  const locationMatch = fieldIndex(labels, [/location/i, /city/i]);
  const postedMatch = fieldIndex(labels, [/posting\s*date/i, /date\s*posted/i, /posted/i]);
  const titleIndex = titleMatch >= 0 ? titleMatch : (positional ? 0 : -1);
  const locationIndex = locationMatch >= 0 ? locationMatch : (positional ? 1 : -1);
  const postedIndex = postedMatch >= 0 ? postedMatch : (positional ? 2 : -1);
  const title = titleIndex >= 0 ? values[titleIndex] : textValue(row?.title || row?.jobTitle);
  const location = parseLocationField(locationIndex >= 0 ? values[locationIndex] : textValue(row?.location || row?.locationsColumns));
  const posted = postedIndex >= 0 ? values[postedIndex] : '';
  return { title: title || '', location: typeof location === 'string' ? location : '', posted: posted || '' };
}

function toEpochMs(value) {
  if (!value) return undefined;
  const n = Date.parse(value);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Normalize one `searchjobs` response page.
 * `{}`, `null` and `[]` are an empty page; any other envelope throws so a
 * template change cannot pass as zero vacancies.
 * @param {any} json
 * @param {Board} board
 * @param {string[]} headings
 * @param {string} [company]
 */
export function parseTaleoResponse(json, board, headings, company = '') {
  if (json == null || Array.isArray(json)) return [];
  if (typeof json !== 'object') {
    throw new Error(`taleo: unexpected API response — expected an object with requisitionList[], got ${typeof json}`);
  }
  const keys = Object.keys(json);
  if (keys.length === 0) return [];
  const rows = json.requisitionList;
  if (!Array.isArray(rows)) {
    throw new Error(`taleo: unexpected API response — expected requisitionList[], got keys: [${keys.join(', ')}]`);
  }
  const lang = extractLang(board.url);
  const host = board.url.hostname.toLowerCase();
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const contestNo = row.contestNo == null ? '' : String(row.contestNo).trim();
    const jobId = row.jobId == null ? '' : String(row.jobId).trim();
    const id = contestNo || jobId;
    if (!id) continue;
    const parsed = parseColumns(row, headings);
    if (!parsed.title) continue;
    const detail = new URL(`https://${host}/careersection/${safeEncode(board.section)}/jobdetail.ftl`);
    detail.searchParams.set('job', id);
    detail.searchParams.set('lang', lang);
    const postedAt = toEpochMs(parsed.posted);
    const location = parsed.location;
    const isRemote = /\bremote\b/i.test(location);
    out.push({
      id: `taleo-${host}-${board.section}-${id}`,
      title: parsed.title,
      company: typeof company === 'string' ? company.trim() : '',
      url: detail.href,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: postedAt !== undefined ? new Date(postedAt).toISOString().slice(0, 10) : '',
      snippet: '',
      source: 'taleo',
    });
  }
  return out;
}

/** @param {any} value */
function findJobPosting(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const type = value['@type'];
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return value;
  if (value['@graph']) return findJobPosting(value['@graph']);
  return null;
}

/** @param {unknown} value */
function decodeDetail(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  let decoded = value;
  if (/%[0-9a-f]{2}/i.test(decoded)) {
    try { decoded = decodeURIComponent(decoded); } catch { /* keep the original text */ }
  }
  return htmlToText(decoded);
}

/**
 * Public JobPosting description embedded in a Taleo detail page ('' if none).
 * @param {unknown} html
 */
export function parseTaleoDetail(html) {
  if (typeof html !== 'string') return '';
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const description = decodeDetail(findJobPosting(JSON.parse(match[1]))?.description);
      if (description) return description;
    } catch { /* another JSON-LD block may still be usable */ }
  }
  return '';
}

/** @param {Board} board @param {string} portal */
export function buildSearchUrl(board, portal) {
  const url = new URL(`https://${board.url.hostname.toLowerCase()}/careersection/rest/jobboard/searchjobs`);
  url.searchParams.set('lang', extractLang(board.url));
  url.searchParams.set('portal', portal);
  return url.href;
}

/** @param {number} page */
export function buildBody(page) {
  return {
    multilineEnabled: false,
    sortingSelection: { sortBySelectionParam: '5', ascendingSortingOrder: 'true' },
    fieldData: { fields: { KEYWORD: '', LOCATION: '' }, valid: true },
    filterSelectionParam: { searchFilterSelections: [] },
    advancedSearchFiltersSelectionParam: { searchFilterSelections: [] },
    pageNo: page,
  };
}

/**
 * Read the entry's optional config (top-level keys or a `taleo:` block).
 * @param {any} company
 */
export function parseTaleoConfig(company) {
  const block = company && typeof company.taleo === 'object' && company.taleo ? company.taleo : {};
  const pick = (key) => (block[key] !== undefined ? block[key] : company?.[key]);
  const maxPagesRaw = pick('max_pages') ?? pick('maxPages');
  const detailRaw = Number(pick('detailLimit'));
  return {
    maxPages: Number.isInteger(maxPagesRaw) && maxPagesRaw > 0 ? maxPagesRaw : DEFAULT_MAX_PAGES,
    fetchDetails: pick('fetchDetails') === true,
    detailLimit: Number.isInteger(detailRaw) && detailRaw > 0 ? Math.min(detailRaw, MAX_DETAIL_LIMIT) : DEFAULT_DETAIL_LIMIT,
  };
}

/**
 * Retry transient failures only (429, 5xx, status-less network errors); a
 * permanent 4xx and a refused redirect rethrow at once.
 * @template T
 * @param {() => Promise<T>} run
 * @param {{ signal?: AbortSignal, sleep: Function, retryDelayMs: number }} io
 * @returns {Promise<T>}
 */
async function withRetry(run, { signal, sleep, retryDelayMs }) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      return await run();
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
 * Fetch and normalize one Taleo career section.
 *
 * The shell and list requests propagate errors (dead-board contract). Detail
 * enrichment is opt-in, bounded, paced and fail-soft per job.
 *
 * @param {string} endpoint section URL from the adapter's buildEndpoint
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any, maxPages?: number,
 *           sleep?: (ms: number, signal?: AbortSignal) => Promise<void>, retryDelayMs?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchTaleo(endpoint, opts = {}) {
  const {
    fetchImpl = fetch, signal, company = {}, maxPages: probePages,
    sleep = delay, retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  const board = assertTaleoUrl(endpoint);
  const name = typeof company?.name === 'string' ? company.name.trim() : '';
  const cfg = parseTaleoConfig(company);
  const io = { signal, sleep, retryDelayMs };
  const impl = /** @type {typeof fetch} */ (fetchImpl);

  const shellUrl = board.url.href;
  const shell = await withRetry(() => fetchText(impl, shellUrl, { signal, headers: HEADERS_HTML, redirect: 'error' }), io);
  const portal = extractPortal(shell);
  if (!portal) {
    throw new Error(`taleo: career section is private, unavailable, or missing a public portal id (${shellUrl})`);
  }
  const headings = extractHeadings(shell);
  const probing = Number.isInteger(probePages) && /** @type {number} */ (probePages) > 0;
  const maxPages = Math.min(cfg.maxPages, MAX_PAGES_CAP, probing ? /** @type {number} */ (probePages) : MAX_PAGES_CAP);
  const apiUrl = buildSearchUrl(board, portal);

  /** @type {any[]} */
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) await sleep(INTER_PAGE_DELAY_MS, signal);
    const json = await withRetry(() => fetchJson(impl, apiUrl, {
      method: 'POST', signal, redirect: 'error', headers: HEADERS_JSON, body: JSON.stringify(buildBody(page)),
    }), io);
    all.push(...parseTaleoResponse(json, board, headings, name));
    const rawCount = Array.isArray(json?.requisitionList) ? json.requisitionList.length : 0;
    const rawTotal = json?.pagingData?.totalCount;
    const total = rawTotal == null || (typeof rawTotal === 'string' && !rawTotal.trim())
      ? Number.NaN
      : Number(rawTotal);
    // Stop on an empty RAW page or once the reported total is reached. A short
    // page is deliberately not an end signal (uneven page sizes).
    if (!rawCount || (Number.isFinite(total) && all.length >= total)) break;
  }

  if (!cfg.fetchDetails || probing) return all;
  const candidates = all.slice(0, cfg.detailLimit);
  for (let i = 0; i < candidates.length; i++) {
    if (signal?.aborted) break;
    if (i > 0) await sleep(INTER_PAGE_DELAY_MS, signal);
    try {
      const detailUrl = new URL(candidates[i].url);
      if (detailUrl.protocol !== 'https:' || detailUrl.hostname.toLowerCase() !== board.url.hostname.toLowerCase()) continue;
      const html = await withRetry(() => fetchText(impl, detailUrl.href, { signal, headers: HEADERS_HTML, redirect: 'error' }), io);
      const description = parseTaleoDetail(html);
      if (description) {
        candidates[i].description = description;
        candidates[i].snippet = description.slice(0, SNIPPET_CAP);
      }
    } catch {
      // Detail enrichment is best-effort. Keep the parsed listing row.
    }
  }
  return all;
}
