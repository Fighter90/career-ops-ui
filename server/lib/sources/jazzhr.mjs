// @ts-check
/**
 * JazzHR source — scrapes a tenant's public, server-rendered ApplyToJob board.
 *   GET https://<tenant>.applytojob.com/apply
 *
 * Ported from parent career-ops `providers/jazzhr.mjs` and rewritten to the
 * web-ui source contract (12-field job objects + `meta` for auto-discovery).
 *
 * Board resolution (same shape as bamboohr/breezy): only the HOSTNAME is
 * trusted from config. Whatever path or port a `careers_url`/`api` carries is
 * discarded and the canonical board `https://<hostname>/apply` is rebuilt from
 * the hostname alone, so a bare host, `/apply`, `/apply/`, a non-default port
 * or a stray deep path all resolve to the same board. SSRF defence is the
 * anchored host regex + HTTPS-only + `redirect:'error'` on every request.
 *
 * The board is one page with no pagination (no page cap applies). Title, URL
 * and location come from the list markup. An opt-in
 * `jazzhr: { fetchDetails: true, detailLimit: N }` entry additionally fetches
 * each posting's own page (default 25, max 100) for its JSON-LD description
 * and posted date, paced 200 ms apart, fail-soft per posting.
 *
 * Parent quirks kept on purpose:
 *  - Card recognition tries the `list-group-item` wrapper first (title +
 *    location); a bare `/apply/<segment>` permalink-anchor pass then ALWAYS
 *    runs too (title only, deduped), so a partial markup redesign still yields
 *    postings instead of a healthy-looking empty board.
 *  - Links present but zero postings parsed => throws (broken markup), while a
 *    genuinely empty board (only the bare `/apply/` "back" nav link) => [].
 *  - A detail page's location only fills an empty / "n/a" list location; the
 *    list value wins otherwise.
 *
 * Used by the jazzhr adapter (server/lib/portals/adapters/jazzhr.mjs).
 */
import {
  fetchText,
  delay,
  computeRetryDelayMs,
  REDIRECT_REFUSAL_CAUSE_MESSAGE,
  BROWSER_LIKE_USER_AGENT,
} from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';

export const meta = {
  value: 'jazzhr',
  label: 'JazzHR',
  region: 'en',
};

export const JAZZHR_HOST_RE = /^[a-z0-9][a-z0-9-]*\.applytojob\.com$/i;
export const MAX_JOBS = 1000;
export const DETAIL_DEFAULT_LIMIT = 25;
export const DETAIL_MAX_LIMIT = 100;
export const DETAIL_FETCH_DELAY_MS = 200;
const SNIPPET_CAP = 500;
// 1 attempt + 2 retries on a transient failure (429, 5xx, no-status network error).
const RETRIES = 2;
const RETRY_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 4000;

const HEADERS = { 'User-Agent': BROWSER_LIKE_USER_AGENT, accept: 'text/html' };

/**
 * Tenant origin (`https://<tenant>.applytojob.com`) from an entry: an explicit
 * `api:` URL first, else `careers_url`. Hostname validated, origin rebuilt from
 * it. Returns null for anything untrusted (never throws).
 * @param {any} entry
 * @returns {string|null}
 */
export function resolveOrigin(entry) {
  for (const raw of [entry?.api, entry?.careers_url]) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    let parsed;
    try { parsed = new URL(raw.trim()); } catch { continue; }
    if (parsed.protocol !== 'https:' || !JAZZHR_HOST_RE.test(parsed.hostname)) continue;
    return `https://${parsed.hostname}`;
  }
  return null;
}

/** @param {string} origin */
export const boardUrl = (origin) => `${origin}/apply`;

/**
 * Throwing host gate (HTTPS + host regex only; the path is not constrained, as
 * it may be a specific posting permalink). Returns the parsed URL.
 * @param {unknown} raw
 * @returns {URL}
 */
export function assertJazzHRUrl(raw) {
  let parsed;
  try { parsed = new URL(String(raw).trim()); } catch { parsed = null; }
  if (!parsed || parsed.protocol !== 'https:' || !JAZZHR_HOST_RE.test(parsed.hostname)) {
    throw new Error(`jazzhr: untrusted or invalid public board URL: ${raw}`);
  }
  return parsed;
}

/** @param {unknown} value */
function clean(value) {
  return htmlToText(typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim();
}

/** @param {unknown} html */
function parseJsonLd(html) {
  /** @type {any[]} */
  const out = [];
  for (const match of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (Array.isArray(parsed?.['@graph'])) out.push(...parsed['@graph']);
      else out.push(parsed);
    } catch { /* unrelated analytics JSON */ }
  }
  return out;
}

/** @param {any} location */
function locationText(location) {
  const places = Array.isArray(location) ? location : [location];
  for (const place of places) {
    const address = place?.address || {};
    const values = [address.addressLocality, address.addressRegion, address.addressCountry]
      .filter((v) => typeof v === 'string' && v.trim());
    if (values.length) return values.join(', ');
  }
  return '';
}

/** A posting permalink anchor anywhere in the page (the markup part a redesign is least likely to change). */
const POSTING_LINK_RE = /<a\b[^>]*href=["']([^"']*\/apply\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const POSTING_HREF_RE = /<a\b[^>]*href=["'][^"']*\/apply\/[^"']+["']/i;

/**
 * @param {string} href
 * @param {URL} base
 * @returns {URL|null}
 */
function resolvePostingUrl(href, base) {
  try {
    const url = new URL(href, base);
    if (url.origin !== base.origin || !/^\/apply\/[^/].*$/i.test(url.pathname)) return null;
    url.search = '';
    return url;
  } catch { return null; }
}

/**
 * Parse the board HTML into minimal rows `{ title, url, company, location }`.
 * Exported for tests.
 * @param {unknown} html
 * @param {string} boardHref
 * @param {string} [companyName]
 * @returns {{ title: string, url: string, company: string, location: string }[]}
 */
export function parseJazzHRList(html, boardHref, companyName = '') {
  if (typeof html !== 'string') return [];
  const base = new URL(boardHref);
  /** @type {{ title: string, url: string, company: string, location: string }[]} */
  const jobs = [];
  const seen = new Set();
  const addJob = (/** @type {URL} */ url, /** @type {string} */ title, /** @type {string} */ location) => {
    if (!title || seen.has(url.href)) return;
    seen.add(url.href);
    jobs.push({ title, url: url.href, company: companyName || '', location });
  };

  const cardRe = /<li\b[^>]*class=["'][^"']*list-group-item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  for (const match of html.matchAll(cardRe)) {
    const card = match[1];
    const link = card.match(/<a\b[^>]*href=["']([^"']*\/apply\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const url = resolvePostingUrl(link[1], base);
    if (!url) continue;
    const location = clean((card.match(/fa-map-marker[^<]*<\/i>\s*([^<]+)/i) || [])[1] || '');
    addJob(url, clean(link[2]), location);
    if (jobs.length >= MAX_JOBS) break;
  }

  // Unconditional fallback pass (see header): only ever adds postings the
  // primary pass missed, never a duplicate or a downgrade.
  for (const match of html.matchAll(POSTING_LINK_RE)) {
    if (jobs.length >= MAX_JOBS) break;
    const url = resolvePostingUrl(match[1], base);
    if (!url) continue;
    addJob(url, clean(match[2]), '');
  }

  // Requires a real segment after `/apply/`: JazzHR's own bare "back to
  // listings" link exists even on an empty board and must not false-alarm.
  if (jobs.length === 0 && POSTING_HREF_RE.test(html)) {
    throw new Error('jazzhr: found ApplyToJob links but could not parse any posting cards');
  }
  return jobs;
}

/**
 * Enrich a minimal row from a posting page's JSON-LD (mutates and returns it).
 * Exported for tests.
 * @param {unknown} html
 * @param {any} job
 */
export function parseJazzHRDetail(html, job) {
  const node = parseJsonLd(html).find((item) => item
    && (item['@type'] === 'JobPosting' || (Array.isArray(item['@type']) && item['@type'].includes('JobPosting'))));
  if (!node) return job;
  if (!job.title && typeof node.title === 'string') job.title = clean(node.title);
  const description = clean(node.description);
  if (description) job.description = description;
  // List location wins; the detail one only fills an empty / "n/a" value.
  if (!String(job.location || '').trim() || /^n\/?a$/i.test(String(job.location).trim())) {
    const location = locationText(node.jobLocation);
    if (location) job.location = location;
  }
  if (typeof node.datePosted === 'string') {
    const parsed = Date.parse(node.datePosted);
    if (!Number.isNaN(parsed)) job.postedAt = parsed;
  }
  return job;
}

/**
 * Read the entry's optional `jazzhr:` block. Exported for tests.
 * @param {any} company
 */
export function parseJazzHRConfig(company) {
  const cfg = company && typeof company.jazzhr === 'object' && company.jazzhr ? company.jazzhr : {};
  const limit = Number.isInteger(cfg.detailLimit) && cfg.detailLimit > 0
    ? Math.min(cfg.detailLimit, DETAIL_MAX_LIMIT)
    : DETAIL_DEFAULT_LIMIT;
  return { fetchDetails: cfg.fetchDetails === true, detailLimit: limit };
}

/**
 * Minimal row -> web-ui 12-field job.
 * @param {{ title: string, url: string, company: string, location: string }} row
 * @param {string} host
 */
function toJob(row, host) {
  const isRemote = /\bremote\b/i.test(row.location);
  return {
    id: `jazzhr-${host}-${new URL(row.url).pathname.replace(/^\/apply\//i, '')}`,
    title: row.title,
    company: row.company,
    url: row.url,
    salary: '',
    location: row.location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : '',
    relocates: false,
    date: '',
    snippet: '',
    source: 'jazzhr',
  };
}

/**
 * `fetchText` with 1 attempt + 2 retries on transient failures only (429, 5xx,
 * status-less network error). Permanent 4xx and refused redirects rethrow.
 * @param {Function} fetchImpl
 * @param {string} url
 * @param {{ signal?: AbortSignal, sleep: (ms: number, signal?: AbortSignal) => Promise<void>, retryDelayMs: number }} o
 */
async function fetchTextWithRetry(fetchImpl, url, { signal, sleep, retryDelayMs }) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      return await fetchText(/** @type {any} */ (fetchImpl), url, { signal, headers: HEADERS, redirect: 'error' });
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
 * Fetch + normalize one JazzHR tenant. The board URL is rebuilt from the
 * endpoint's hostname (host-pinned, HTTPS-only) before any I/O; the board
 * request failing propagates, detail failures are swallowed per posting. A
 * positive-integer `maxPages` (bounded probe) skips detail requests.
 *
 * @param {string} endpoint board URL from the adapter's buildEndpoint
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any, maxPages?: number,
 *           sleep?: (ms: number, signal?: AbortSignal) => Promise<void>, retryDelayMs?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchJazzHR(endpoint, opts = {}) {
  const {
    fetchImpl = fetch,
    signal,
    company = {},
    maxPages,
    sleep = delay,
    retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  const host = assertJazzHRUrl(endpoint).hostname.toLowerCase();
  const board = boardUrl(`https://${host}`);
  const io = { signal, sleep, retryDelayMs };

  const html = await fetchTextWithRetry(fetchImpl, board, io);
  const rows = parseJazzHRList(html, board, typeof company?.name === 'string' ? company.name : '');
  const jobs = rows.map((row) => toJob(row, host));

  const probing = Number.isInteger(maxPages) && /** @type {number} */ (maxPages) > 0;
  const { fetchDetails, detailLimit } = parseJazzHRConfig(company);
  if (!fetchDetails || probing) return jobs;

  const targets = jobs.slice(0, detailLimit);
  for (let i = 0; i < targets.length; i += 1) {
    if (signal?.aborted) break;
    if (i > 0) await sleep(DETAIL_FETCH_DELAY_MS, signal);
    const job = targets[i];
    try {
      const detailUrl = assertJazzHRUrl(job.url);
      const detail = await fetchTextWithRetry(fetchImpl, detailUrl.href, io);
      /** @type {any} */
      const enriched = parseJazzHRDetail(detail, {
        title: job.title, location: job.location,
      });
      if (enriched.description) {
        job.description = enriched.description;
        job.snippet = enriched.description.slice(0, SNIPPET_CAP);
      }
      if (enriched.location && enriched.location !== job.location) {
        job.location = enriched.location;
        job.isRemote = /\bremote\b/i.test(job.location);
        if (job.isRemote) job.workplaceType = 'Remote';
      }
      if (Number.isFinite(enriched.postedAt)) {
        job.date = new Date(enriched.postedAt).toISOString().slice(0, 10);
      }
    } catch { /* optional enrichment must not erase a valid list row */ }
  }
  return jobs;
}
