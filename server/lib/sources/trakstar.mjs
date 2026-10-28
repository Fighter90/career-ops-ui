// @ts-check
/**
 * Trakstar Hire source — single-company ATS adapter (→ tracked_companies:).
 * The product was Recruiterbox. A tenant board is
 * `https://<client>.hire.trakstar.com` (legacy host
 * `<client>.recruiterbox.com`). The public no-auth Frontend API needs no key:
 *
 *   GET https://jsapi.recruiterbox.com/v1/openings?client_name=<client>&limit=N&offset=N
 *   → { meta: { offset, limit, total | total_count },
 *       objects: [{ id, title, description, location: { city, state, country },
 *         allows_remote, hosted_url, close_date, ... }] }
 *
 * `limit` is honoured (the board serves up to 250/request; this source asks
 * for 100). A short page is the end. An unknown client is HTTP 400, not an
 * empty objects array — a first-page 400 fails the entry. `close_date` is
 * when the opening CLOSES, not when it was posted, and the list payload does
 * not include `created_on`, so jobs carry no date. Posting URLs stay on the
 * client's own board host: `hosted_url` is kept only when it is https on
 * that host, otherwise the URL is rebuilt from the opening id.
 *
 * Ported from the parent's providers/trakstar.mjs (upstream #6131).
 * Deviations from the parent, per the web-ui source contract:
 *   - the parent's ctx transport (ctx.fetchJson / ctx.sleep) does not exist
 *     here; the source fetches through the injected fetchImpl via the shared
 *     fetchJsonWithRetry (local retry budget 1 + 2 attempts) with a courtesy
 *     delay between pages (dover pattern);
 *   - web-ui's scanner has no ctx.maxPages probe path, so the entry's own
 *     `max_pages` is the only cap;
 *   - page-1 shape runs through the shared `_shape.mjs` guards
 *     (requireObject / requireArray) — a malformed 200 throws, never an
 *     empty board.
 */
import { fetchJsonWithRetry, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';
import { requireObject, requireArray } from './_shape.mjs';

const UA = BROWSER_LIKE_USER_AGENT;

export const meta = {
  value: 'trakstar',
  label: 'Trakstar Hire',
  region: 'en',
};

export const API_HOST = 'jsapi.recruiterbox.com';
export const HIRE_SUFFIX = '.hire.trakstar.com';
export const LEGACY_SUFFIX = '.recruiterbox.com';
// Labels that are never a client: product-owned subdomains of both hosts.
export const RESERVED = new Set([
  'www', 'jsapi', 'api', 'app', 'mail', 'support', 'help', 'status', 'blog', 'docs',
]);
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// The API serves up to 250/request; the parent asks for 100 — parity.
export const PAGE_SIZE = 100;
export const DEFAULT_MAX_PAGES = 20;
export const MAX_PAGES_CAP = 50;
// Courtesy delay between pages — only multi-page boards pay it (dover pattern).
export const PAGE_DELAY_MS = 200;

const STOP_REASON = {
  COMPLETE: 'complete',
  CAP: 'cap',
  FETCH_ERROR: 'fetch-error',
};

/**
 * Defence-in-depth endpoint check: HTTPS on exactly the Frontend API host,
 * default port only. Runs on the endpoint the adapter resolved, before any
 * request — a tampered or misconfigured entry can never point the fetch
 * somewhere else.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertTrakstarUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`trakstar: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`trakstar: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`trakstar: a non-default port is not allowed: ${url}`);
  if (parsed.hostname !== API_HOST) {
    throw new Error(`trakstar: untrusted hostname "${parsed.hostname}" — must be ${API_HOST}`);
  }
  return url;
}

/**
 * One label before a known board suffix, or the client_name on a Frontend
 * API URL. Rejects non-https inputs, look-alike hosts (an extra label, the
 * apex host, a suffix-shaped foreign host), reserved labels and anything
 * that is not a DNS-safe lowercase slug.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function extractClient(raw) {
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
  if (host === API_HOST) {
    if (!/^\/v1\/openings\/?$/.test(u.pathname)) return null;
    candidate = u.searchParams.get('client_name');
  } else if (host.endsWith(HIRE_SUFFIX)) {
    candidate = host.slice(0, -HIRE_SUFFIX.length);
  } else if (host.endsWith(LEGACY_SUFFIX)) {
    candidate = host.slice(0, -LEGACY_SUFFIX.length);
  }
  if (!candidate || candidate.includes('.')) return null;
  candidate = candidate.toLowerCase();
  if (RESERVED.has(candidate) || !SLUG_RE.test(candidate)) return null;
  return candidate;
}

/**
 * The client name from an entry's explicit `api` field, else its careers_url.
 * @param {{api?: unknown, careers_url?: unknown}} [entry]
 * @returns {string | null}
 */
export function resolveClient(entry) {
  return extractClient(entry?.api) || extractClient(entry?.careers_url);
}

/** The page-1 list endpoint for one client (the adapter's endpoint shape). */
export function apiUrlFor(client) {
  return `https://${API_HOST}/v1/openings?client_name=${client}`;
}

/**
 * Resolve the page cap: a positive integer `max_pages` on the entry, capped.
 * @param {{max_pages?: unknown}} [entry]
 */
export function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/** @param {unknown} value @returns {string} */
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Location the way the board shows it: city/state/country joined, "Remote"
 * (or "Remote (<place>)") when the opening allows remote.
 * @param {any} row
 * @returns {string}
 */
export function jobLocation(row) {
  const loc = row?.location && typeof row.location === 'object' ? row.location : {};
  const place = [loc.city, loc.state, loc.country].map(text).filter(Boolean).join(', ');
  if (row?.allows_remote === true) return place ? `Remote (${place})` : 'Remote';
  return place;
}

/**
 * `hosted_url` is kept only when it is https on this client's own board
 * host; otherwise the URL is rebuilt from the opening id. A host-controlled
 * id is routed through safeEncodeURIComponent — a lone surrogate drops the
 * one posting, never the page.
 * @param {any} row
 * @param {string} client
 * @returns {string | null}
 */
export function postingUrl(row, client) {
  const hireHost = `${client}.hire.trakstar.com`;
  const legacyHost = `${client}.recruiterbox.com`;
  if (typeof row?.hosted_url === 'string' && row.hosted_url.trim()) {
    try {
      const u = new URL(row.hosted_url.trim());
      const host = u.hostname.toLowerCase();
      if (u.protocol === 'https:' && (host === hireHost || host === legacyHost)) return u.href;
    } catch {
      // Fall through and rebuild from the id.
    }
  }
  const id = row?.id;
  if (id === undefined || id === null || id === '') return null;
  const encoded = safeEncodeURIComponent(id);
  if (!encoded) return null;
  return `https://${hireHost}/jobs/${encoded}/`;
}

/**
 * Parse one page of the Frontend API. Exported for unit tests.
 *
 * A malformed envelope throws (the _shape.mjs contract — a 200 that stopped
 * speaking its shape must never read as an empty board). Rows without a
 * title or a usable URL are dropped; null/junk rows are skipped.
 *
 * @param {any} json
 * @param {string} company
 * @param {string} client
 * @returns {{ rawCount: number, rawKey: string, total: number | null,
 *             jobs: Array<{title: string, url: string, company: string, location: string, description?: string}> }}
 */
export function parseTrakstarPage(json, company, client) {
  const body = requireObject(json, 'trakstar');
  const rows = requireArray(body.objects, 'trakstar openings');
  const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
  const totalRaw = typeof meta.total === 'number' ? meta.total : meta.total_count;
  const total = typeof totalRaw === 'number' && Number.isFinite(totalRaw) ? totalRaw : null;
  const jobs = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const title = typeof row.title === 'string' ? row.title.replace(/\s+/g, ' ').trim() : '';
    const url = postingUrl(row, client);
    if (!title || !url) continue;
    /** @type {{title: string, url: string, company: string, location: string, description?: string}} */
    const job = { title, url, company, location: jobLocation(row) };
    if (typeof row.description === 'string') {
      const description = htmlToText(row.description);
      if (description) job.description = description;
    }
    jobs.push(job);
  }
  const rawKey = JSON.stringify(rows.map((r) => (r && typeof r === 'object' ? r.id ?? null : null)));
  return { rawCount: rows.length, rawKey, total, jobs };
}

function normalize(row, entry) {
  return {
    id: `trakstar-${row.url}`,
    title: row.title,
    company: row.company || String(entry?.name ?? ''),
    url: row.url,
    salary: '',
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: '',
    relocates: false,
    // The list payload carries no created_on and close_date is a closing
    // date, not a posting date — no date, deliberately.
    date: '',
    snippet: row.description || '',
    source: 'trakstar',
  };
}

/**
 * Fetch + normalize the Trakstar Hire openings for one client (paginated).
 * Mirrors the parent's fetch(): walk `offset` until `meta.total` and stop on
 * a short page, an empty page, or a repeated page; keep the pages already
 * collected on a later-page failure; tag the result array `trakstarTruncated`
 * when the max_pages cap or a fetch error cut the sweep — the web-ui
 * partial-board convention. The parent also accepted a ctx.maxPages probe
 * budget; web-ui's scanner has no probe path.
 *
 * @param {string} endpoint - the page-1 API URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           delayMs?: number, retries?: number }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchTrakstar(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company, delayMs = PAGE_DELAY_MS, retries = 2 } = opts;
  // Host allowlist before any request (SSRF guard): the adapter resolved this
  // endpoint from the entry; re-validate it here.
  assertTrakstarUrl(endpoint);
  const entry = company ?? {};
  // A scan aborted before the first request must fail loud, not report an
  // empty board (paylocity convention).
  signal?.throwIfAborted();
  const client = resolveClient(entry);
  if (!client) {
    throw new Error(`trakstar: cannot derive the client name for ${entry.name || endpoint}. Set careers_url to https://<client>.hire.trakstar.com`);
  }

  const maxPages = resolveMaxPages(entry);
  const jobs = [];
  // Why pagination stopped. Both 'cap' and 'fetch-error' earn the flag (the
  // parent tags both): a partial board must not present as complete.
  let stopReason = STOP_REASON.COMPLETE;
  let endedNaturally = false;
  let lastRawCount = 0;
  let lastRawKey = null;
  let seenRaw = 0;
  let total = null;
  let offset = 0;
  let pages = 0;
  const seenUrls = new Set();
  for (; pages < maxPages; pages++) {
    if (pages > 0 && delayMs > 0) await delay(delayMs, signal);
    let parsed;
    try {
      const json = await fetchJsonWithRetry(fetchImpl, `${endpoint}&limit=${PAGE_SIZE}&offset=${offset}`, {
        signal,
        redirect: 'error',
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        retries,
      });
      // Parse INSIDE the try: a later-page shape throw keeps the pages
      // already collected (partials); on page 1 the throw propagates — the
      // first page failing means there is no board.
      parsed = parseTrakstarPage(json, String(entry.name ?? ''), client);
    } catch (err) {
      if (pages === 0) throw err;
      console.error(`⚠️  trakstar: ${entry.name} truncated at page ${pages + 1} (${jobs.length}${total !== null ? ` of ${total}` : ''} jobs): ${err.message}`);
      stopReason = STOP_REASON.FETCH_ERROR;
      break;
    }
    if (total === null) total = parsed.total;
    lastRawCount = parsed.rawCount;
    const repeated = lastRawKey !== null && parsed.rawKey === lastRawKey && parsed.rawCount > 0;
    seenRaw += parsed.rawCount;
    lastRawKey = parsed.rawKey;
    for (const job of parsed.jobs) {
      if (seenUrls.has(job.url)) continue;
      seenUrls.add(job.url);
      jobs.push(normalize(job, entry));
    }
    const counted = total !== null && seenRaw >= total;
    if (parsed.rawCount === 0 || parsed.rawCount < PAGE_SIZE || repeated || counted) {
      endedNaturally = true;
      break;
    }
    offset += parsed.rawCount;
  }
  if (
    stopReason === STOP_REASON.COMPLETE && !endedNaturally
    && pages === maxPages && lastRawCount >= PAGE_SIZE
  ) {
    stopReason = STOP_REASON.CAP;
    console.error(`⚠️  trakstar: ${entry.name} truncated at max_pages=${maxPages} (${jobs.length}${total !== null ? ` of ${total}` : ''} jobs). Raise max_pages on this entry for more`);
  }
  if (stopReason !== STOP_REASON.COMPLETE) {
    /** @type {any} */ (jobs).trakstarTruncated = true;
  }
  return jobs;
}
