// @ts-check
/**
 * Polymer Hire source (→ tracked_companies:) — a tenant's public board is
 * https://jobs.polymer.co/<slug>, and the board reads a public no-auth JSON
 * API:
 *
 *   GET https://api.polymer.co/v1/hire/organizations/<slug>/jobs?page=N
 *   → { items: [{ id, title, job_post_url, display_location, city,
 *        state_region, country, remoteness_pretty, published_at,
 *        published_at_timestamp, ... }], meta: { page, count, total, is_last,
 *        next_page, ... } }
 *
 * Ported from the parent's providers/polymer.mjs (upstream #6128).
 *
 * Measured on the vendor demo tenant: `per_page` is ignored, `meta.total`
 * stays at 1 on a multi-job board, and `?page=2` returns `items: []` while
 * `meta.is_last` is false and `meta.next_page` is 3. Trusting `is_last`,
 * `next_page`, or `total` walks until the page cap. The walk stops on an
 * empty page (the RAW page length), a repeated page, `is_last: true` on a
 * page that has rows, or a `meta.count` that is at least this page's length
 * and already covered by the rows seen. A count smaller than the page (the
 * demo's `total` shape) is ignored. An unknown slug is HTTP 422, not an
 * empty `items` array.
 *
 * The list payload has no description. `salary_pretty` is free text, not a
 * structured salary, so it is left off the job. The request URL is rebuilt
 * from the fixed API host plus a charset-checked slug.
 *
 * Deviations for the web-ui source contract: the fetch goes through the
 * shared fetchJsonWithRetry (injected fetchImpl, redirect:'error'), the
 * page-1 container check uses `_shape.mjs` (a malformed 200 throws, never an
 * empty board) while a later-page failure keeps the partials, and rows are
 * normalized to the scanner's job shape.
 */
import { fetchJsonWithRetry, delay } from '../http-json.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';
import { requireArray } from './_shape.mjs';

export const meta = {
  value: 'polymer',
  label: 'Polymer',
  region: 'en',
};

export const API_HOST = 'api.polymer.co';
export const BOARD_HOST = 'jobs.polymer.co';
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const DEFAULT_MAX_PAGES = 20;
const MAX_PAGES_CAP = 100;
const PAGE_DELAY_MS = 200;

/**
 * The slug from a jobs.polymer.co/<slug> board URL or an
 * api.polymer.co/v1/hire/organizations/<slug>/… API URL. Exported for tests.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function extractSlug(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  let candidate = null;
  if (host === BOARD_HOST) {
    candidate = u.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (host === API_HOST) {
    const m = u.pathname.match(/^\/v1\/hire\/organizations\/([^/]+)/);
    candidate = m ? m[1] : null;
  }
  if (!candidate) return null;
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  candidate = candidate.toLowerCase();
  return SLUG_RE.test(candidate) ? candidate : null;
}

/**
 * The slug from an entry's explicit `api` field, else its careers_url.
 * @param {{api?: unknown, careers_url?: unknown}} [entry]
 * @returns {string | null}
 */
export function resolveSlug(entry) {
  return extractSlug(entry?.api) || extractSlug(entry?.careers_url);
}

/**
 * The per-entry `max_pages` (default 20, hard cap 100). Exported for tests.
 * @param {{max_pages?: unknown}} [entry]
 * @returns {number}
 */
export function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * Defence-in-depth endpoint check: HTTPS on exactly the API host, default
 * port only. Runs before any request. Exported for tests.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertPolymerUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`polymer: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`polymer: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`polymer: a non-default port is not allowed: ${url}`);
  if (parsed.hostname !== API_HOST) {
    throw new Error(`polymer: untrusted hostname "${parsed.hostname}" — must be ${API_HOST}`);
  }
  return url;
}

/** @param {unknown} value @returns {string} */
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** @param {unknown} value @returns {number | undefined} */
function toEpochMs(value) {
  if (typeof value !== 'string' || !value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * One readable location from a row: `display_location` when the API resolved
 * it, else city/state/country joined, with a remoteness that really says
 * remote ("No remote" never counts). Exported for tests.
 * @param {any} row
 * @returns {string}
 */
export function jobLocation(row) {
  const display = text(row?.display_location);
  if (display) return display;
  const place = [row?.city, row?.state_region, row?.country].map(text).filter(Boolean).join(', ');
  const remote = text(row?.remoteness_pretty);
  const isRemote = remote.length > 0 && !/^no\s+remote\b/i.test(remote) && /\bremote\b/i.test(remote);
  if (isRemote) return place ? `Remote (${place})` : 'Remote';
  return place;
}

/**
 * Use job_post_url only when it is https on jobs.polymer.co. Anything else
 * is rebuilt from the posting id so a payload cannot point the dedup key
 * at another host. Exported for tests.
 * @param {any} row
 * @param {string} slug
 * @returns {string | null}
 */
export function postingUrl(row, slug) {
  if (typeof row?.job_post_url === 'string' && row.job_post_url.trim()) {
    try {
      const u = new URL(row.job_post_url.trim());
      if (u.protocol === 'https:' && u.hostname.toLowerCase() === BOARD_HOST) return u.href;
    } catch {
      // Fall through and rebuild from the id.
    }
  }
  const id = row?.id ?? row?.job_id;
  if (id === undefined || id === null || id === '') return null;
  const encoded = safeEncodeURIComponent(id);
  if (!encoded) return null;
  return `https://${BOARD_HOST}/${slug}/${encoded}`;
}

/**
 * @param {any} row
 * @returns {number | undefined}
 */
function postedAtOf(row) {
  const fromIso = toEpochMs(row?.published_at);
  if (fromIso !== undefined) return fromIso;
  const ts = row?.published_at_timestamp;
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts * 1000;
  return undefined;
}

/**
 * Parse one page's JSON. Exported for unit tests.
 *
 * - `items` is required to be an array — a container of any other shape
 *   throws through requireArray (a named error), never reads as "no rows".
 * - a malformed row (no title, no usable id/url) is dropped, never fatal.
 *
 * @param {any} json
 * @param {string} company
 * @param {string} slug
 * @returns {{ rawCount: number, rawKey: string, isLast: boolean, count: number|null, jobs: Array<object> }}
 */
export function parsePolymerPage(json, company, slug) {
  const rows = requireArray(json?.items, 'polymer items');
  const meta = json?.meta && typeof json.meta === 'object' ? json.meta : {};
  const count = typeof meta.count === 'number' && Number.isFinite(meta.count) ? meta.count : null;
  const jobs = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const title = typeof row.title === 'string' ? row.title.replace(/\s+/g, ' ').trim() : '';
    const url = postingUrl(row, slug);
    if (!title || !url) continue;
    const postedAt = postedAtOf(row);
    jobs.push({
      title,
      url,
      company,
      location: jobLocation(row),
      ...(postedAt !== undefined ? { postedAt } : {}),
    });
  }
  const rawKey = JSON.stringify(rows.map((r) => (r && typeof r === 'object' ? r.id ?? r.job_id ?? null : null)));
  return { rawCount: rows.length, rawKey, isLast: meta.is_last === true, count, jobs };
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  return {
    id: `polymer-${row.url}`,
    title: row.title,
    company: row.company,
    url: row.url,
    salary: '', // salary_pretty is free text, not a structured salary
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: '',
    relocates: false,
    date: typeof row.postedAt === 'number' ? new Date(row.postedAt).toISOString() : '',
    snippet: '', // the list payload carries no description
    source: 'polymer',
  };
}

/**
 * Fetch + normalize a Polymer organization's jobs, paginating until one of
 * the stop conditions fires. `endpoint` is accepted for the adapter
 * contract; the fetch URL is (re)built from the validated slug so the
 * host-pin is enforced at the fetch boundary regardless of caller.
 *
 * Dead-board contract: the first (page 1) request failing — a malformed 200
 * included — THROWS; an unreachable board is unreachable, not empty. A later
 * page failing after ≥1 successful page keeps the partials already collected
 * (a transient page-N blip must not discard them) and logs a truncation
 * warning naming the page.
 *
 * @param {string} endpoint - from buildEndpoint (informational)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any, sleep?: Function }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchPolymer(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {}, sleep = delay } = opts;
  const slug = resolveSlug(company);
  if (!slug) {
    throw new Error(`polymer: cannot derive the organization slug for ${company?.name || 'entry'}. Set careers_url to https://${BOARD_HOST}/<slug>`);
  }
  assertPolymerUrl(`https://${API_HOST}/v1/hire/organizations/${slug}/jobs`);
  // A scan aborted before the first request must fail loud, not report an
  // empty board (deel convention).
  signal?.throwIfAborted();

  const maxPages = resolveMaxPages(company);
  const jobs = [];
  const seen = new Set();
  let endedNaturally = false;
  let lastRawCount = 0;
  let lastRawKey = null;
  let seenRaw = 0;
  let page = 1;
  for (; page <= maxPages; page++) {
    if (page > 1) await sleep(PAGE_DELAY_MS, signal);
    const apiUrl = `https://${API_HOST}/v1/hire/organizations/${slug}/jobs?page=${page}`;
    let parsed;
    try {
      const json = await fetchJsonWithRetry(fetchImpl, apiUrl, { signal, redirect: 'error' });
      parsed = parsePolymerPage(json, String(company?.name ?? ''), slug);
    } catch (err) {
      // Page 1 failing (nothing collected) propagates; a later page failing
      // after ≥1 success keeps the partials already gathered.
      if (page === 1) throw err;
      console.error(`⚠️  polymer: ${company?.name || slug} truncated at page ${page} (${jobs.length} jobs): ${err?.message || err}`);
      break;
    }
    lastRawCount = parsed.rawCount;
    const repeated = lastRawKey !== null && parsed.rawKey === lastRawKey;
    seenRaw += parsed.rawCount;
    lastRawKey = parsed.rawKey;
    for (const row of parsed.jobs) {
      if (seen.has(row.url)) continue;
      seen.add(row.url);
      jobs.push(row);
    }
    // Stop on the RAW page length (an empty page), a repeated page,
    // is_last on a page that has rows, or a count that is at least this
    // page's length and already covered by the rows seen. A count smaller
    // than the page (the demo's `total` shape) is ignored.
    const countCovers = parsed.count !== null && parsed.count >= parsed.rawCount && seenRaw >= parsed.count;
    if (parsed.rawCount === 0 || repeated || parsed.isLast === true || countCovers) {
      endedNaturally = true;
      break;
    }
  }
  if (!endedNaturally && lastRawCount > 0) {
    console.error(`⚠️  polymer: ${company?.name || slug} truncated at max_pages=${maxPages} (${jobs.length} jobs). Raise max_pages on this entry for more`);
  }
  return jobs.map(normalize);
}
