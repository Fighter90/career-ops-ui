// @ts-check
/**
 * Magneto365 source — Colombia's general job board, www.magneto365.com.
 * Board-wide source wired with a search URL on the pinned host (the query
 * lives in the URL path):
 *
 *   tracked_companies:
 *     - name: Magneto365 Tecnologia
 *       careers_url: https://www.magneto365.com/co/trabajos/buscar/tecnologia
 *       enabled: true
 *       max_pages: 5          # optional, capped at 20
 *       max_jobs: 100         # optional, capped at 500
 *
 * There is no public API; the search pages are server-rendered HTML. Card
 * shape (measured on the tecnologia search, 2026-10-23, parent): an
 * `<article>` per card whose `card-jobs` class marks it as a result card (the
 * page's detail-preview panel is an `<article>` too), a `<h2><a href>` with
 * the title, a `<h3>` "COMPANY | CONTRACT TYPE", then paragraphs for salary
 * and city. Only /{country}/empleos/{slug}-{ID} detail pages are postings.
 *
 * Pagination is `?paginator[page]=N`, the shape of the page's own pager
 * links. The walk also stops as soon as a page brings no new ids.
 *
 * Ported from the parent's providers/magneto.mjs (parity v1.253.0).
 * Deviations from the parent, per the web-ui source contract:
 *   - the parent's ctx transport (ctx.fetchText / ctx.sleep / ctx.maxPages
 *     health-probe path) does not exist here; the source fetches through the
 *     injected fetchImpl with a local retry budget, and web-ui's scanner has
 *     no probe path;
 *   - the parent's random 1-2 s inter-page pause becomes a fixed
 *     INTER_PAGE_DELAY_MS (delayMs opt), like every other web-ui source;
 *   - a stop at the max_pages/max_jobs caps tags the result array
 *     `magnetoTruncated`, the web-ui partial-board convention (the parent
 *     only warns);
 *   - isRemote also reads Spanish "remoto" (the board is Spanish-language).
 */
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText } from '../html-to-text.mjs';
import {
  fetchText,
  delay,
  computeRetryDelayMs,
  REDIRECT_REFUSAL_CAUSE_MESSAGE,
  BROWSER_LIKE_USER_AGENT,
} from '../http-json.mjs';

const UA = BROWSER_LIKE_USER_AGENT;

export const meta = {
  value: 'magneto',
  label: 'Magneto365',
  region: 'en',
};

export const ALLOWED_HOSTS = new Set(['www.magneto365.com', 'magneto365.com']);

export const DEFAULT_MAX_PAGES = 5;
export const MAX_PAGES_CAP = 20;
export const DEFAULT_MAX_JOBS = 100;
export const MAX_JOBS_CAP = 500;
export const OBSERVED_PAGE_SIZE = 20; // cards per page, measured 2026-10-23
export const PAGE_PARAM = 'paginator[page]';

// OBSERVED_PAGE_SIZE feeds the last-full-page cap heuristic only. [spec,
// review round CAR-86 #15 — deliberate follow-up]: there is no short-page
// stop yet, so a 2-card page 1 still fetches page 2 on this ban-prone board,
// and the heuristic reads parsed cards rather than raw card-jobs articles.
// The cap flag covers the truncation case for now; add the raw-count stop
// with a byte-level fixture when this source is next touched.

// Courtesy pause between pages — only multi-page searches pay it. The parent
// paused 1-2 s at random; the fixed lower bound keeps the same politeness
// without the randomness other web-ui sources don't have.
export const INTER_PAGE_DELAY_MS = 1000;

// Parent retry budget (1 attempt + 2 retries on a transient failure).
export const RETRIES = 2;
export const RETRY_DELAY_MS = 500;
export const RETRY_MAX_DELAY_MS = 8000;

/** A posting detail path: /co/empleos/{slug}-{numeric id}. */
const POSTING_PATH_RE = /^\/[a-z]{2}\/empleos\/[a-z0-9-]+-(\d+)\/?$/i;
/** A posting detail link anywhere in the page: the "this is a listing" signal. */
const POSTING_HREF_RE = /href="(?:https:\/\/(?:www\.)?magneto365\.com(?!\w))?\/[a-z]{2}\/empleos\/[a-z0-9-]+-\d+\/?"/i;

/** Decode-then-strip via the shared helper: a local strip-then-decode lets
 * "&lt;script&gt;" come back out as a live "<script>" in a title or company
 * (the CodeQL order bug — see html-to-text.mjs). */
const clean = (/** @type {unknown} */ s) => htmlToText(String(s ?? ''));

/** Keep user overrides bounded so a typo cannot turn one board into an unbounded crawl. */
function boundedPositiveInt(value, fallback, cap) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, cap) : fallback;
}

/**
 * Resolve the page cap: a positive integer `max_pages` on the entry, capped.
 * @param {{max_pages?: unknown}} entry
 */
export function resolveMaxPages(entry) {
  return boundedPositiveInt(entry?.max_pages, DEFAULT_MAX_PAGES, MAX_PAGES_CAP);
}

/**
 * Resolve the posting cap: a positive integer `max_jobs` on the entry, capped.
 * @param {{max_jobs?: unknown}} entry
 */
export function resolveMaxJobs(entry) {
  return boundedPositiveInt(entry?.max_jobs, DEFAULT_MAX_JOBS, MAX_JOBS_CAP);
}

/**
 * Validate a configured search URL and rebuild it from its parts: https only,
 * a magneto365.com host only, port and credentials dropped. Throws on a
 * malformed URL or a foreign host — the adapter's fail-soft path treats that
 * as no endpoint, and fetchMagneto re-runs it as defence-in-depth.
 * @param {unknown} raw
 * @returns {URL}
 */
export function resolveListUrl(raw) {
  const u = new URL(String(raw)); // throws on a malformed URL
  if (u.protocol !== 'https:') throw new Error(`magneto: careers_url must be https, got ${u.protocol}`);
  if (!ALLOWED_HOSTS.has(u.hostname)) throw new Error(`magneto: ${u.hostname} is not a magneto365.com host`);
  return new URL(`https://${u.hostname}${u.pathname}${u.search}`);
}

/**
 * The URL of one results page. Brackets stay literal, as in the board's own
 * pager links (`?paginator[page]=2`).
 * @param {URL} listUrl
 * @param {number} page
 * @returns {string}
 */
export function buildPageUrl(listUrl, page) {
  const u = new URL(listUrl);
  u.searchParams.delete(PAGE_PARAM);
  const rest = u.searchParams.toString();
  u.search = `${rest ? `${rest}&` : ''}${PAGE_PARAM}=${page}`;
  return u.href;
}

/**
 * Parse the job cards out of one search page. Exported for unit tests.
 * @param {string} html
 * @param {string} origin - e.g. https://www.magneto365.com
 * @returns {Array<{id:string,title:string,url:string,company:string,location:string}>}
 */
export function parseCards(html, origin) {
  const out = [];
  for (const chunk of String(html).split(/<article\b/i).slice(1)) {
    const card = chunk.split(/<\/article>/i)[0];
    // Only result cards; the page's detail-preview panel is an <article> too.
    const openTag = card.slice(0, card.indexOf('>') + 1);
    if (!/card-jobs/.test(openTag)) continue;

    let url = null;
    let id = '';
    let titleHtml = '';
    for (const a of card.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      let u;
      try {
        u = new URL(decodeEntities(a[1]), origin);
      } catch {
        continue;
      }
      const m = ALLOWED_HOSTS.has(u.hostname) ? u.pathname.match(POSTING_PATH_RE) : null;
      if (!m) continue;
      url = u;
      id = m[1];
      titleHtml = a[2];
      break;
    }
    if (!url) continue;

    const title = clean(titleHtml);
    if (!title || title.length < 3) continue;

    // "COMPANY | CONTRACT TYPE"
    const h3 = card.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
    const named = h3 ? clean(h3[1]).split(' | ')[0].trim() : '';
    // "Confidencial" and the board's own name ("Magneto empleos", seen on 4 of
    // 20 cards on 2026-10-23) stand in for an undisclosed employer.
    const company = /^(?:confidencial|empresa confidencial|magneto(?: empleos| 365)?)$/i.test(named) ? '' : named;
    // The last paragraph is the city; the one before it is the salary.
    const paragraphs = [...card.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((p) => clean(p[1]));
    const last = paragraphs.length ? paragraphs[paragraphs.length - 1] : '';
    const location = last && !last.startsWith('$') ? last : '';

    out.push({
      id,
      title,
      url: `${url.origin}${url.pathname}`,
      // Never substitute the board's or the entry's name for a missing
      // employer (Source Indexing Policy rule 1): '?' is the tracker's marker.
      company: company || '?',
      location,
    });
  }
  return out;
}

/**
 * `fetchText` with the parent's retry budget. Only transient failures are
 * retried: HTTP 429, HTTP 5xx, and network errors that carry no status. A
 * permanent 4xx, and a refused redirect (undici's `unexpected redirect`), are
 * rethrown at once.
 * @param {Function} fetchImpl
 * @param {string} url
 * @param {{ signal?: AbortSignal, retries: number, retryDelayMs: number,
 *           headers: Record<string, string> }} o
 */
async function fetchTextWithRetry(fetchImpl, url, { signal, retries, retryDelayMs, headers }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchText(/** @type {any} */ (fetchImpl), url, { signal, headers, redirect: 'error' });
    } catch (err) {
      lastErr = err;
      const status = err && typeof err.status === 'number' ? err.status : undefined;
      const redirectRefusal = status === undefined
        && err instanceof TypeError
        && err?.cause?.message === REDIRECT_REFUSAL_CAUSE_MESSAGE;
      const transient = !redirectRefusal && (status === undefined || status === 429 || status >= 500);
      if (!transient || attempt === retries || signal?.aborted) throw err;
      await delay(computeRetryDelayMs({
        attempt, baseDelayMs: retryDelayMs, maxDelayMs: RETRY_MAX_DELAY_MS, retryAfter: err?.retryAfter,
      }), signal);
    }
  }
  throw lastErr;
}

const PAGE_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};
// [spec, review round CAR-86 #19 — deliberate follow-up]: every fixture here
// carries entities (&#xF3;), but raw ISO-8859-1 bytes served with
// `charset=iso-8859-1` would be mangled by fetchText's utf-8 res.text();
// decode via the Content-Type charset (TextDecoder) and add a byte-level
// fixture when this source is next touched.

function normalize(card, entry) {
  return {
    id: `magneto-${card.id}`,
    title: card.title,
    company: card.company || String(entry?.name ?? ''),
    url: card.url,
    salary: '',
    location: card.location || '',
    isRemote: /remot|удал[её]н/i.test(card.title),
    workplaceType: '',
    relocates: false,
    date: '',
    snippet: '',
    source: 'magneto',
  };
}

/**
 * Fetch + normalize one Magneto365 search (paginated).
 * Mirrors the parent's fetch(): a page-1 fetch failure throws; a later-page
 * failure keeps the earlier pages; an empty page ends the sweep (page 1 with
 * posting links still on it is a markup change and throws); a page bringing
 * no new ids ends the sweep; the max_pages/max_jobs caps tag the result array
 * `magnetoTruncated` (web-ui partial-board convention).
 *
 * @param {string} endpoint - a magneto365.com search URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           delayMs?: number, retries?: number, retryDelayMs?: number }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchMagneto(endpoint, opts = {}) {
  const {
    fetchImpl = fetch,
    signal,
    company = {},
    delayMs = INTER_PAGE_DELAY_MS,
    retries = RETRIES,
    retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  const entry = company ?? {};
  // Host allowlist before any request (SSRF guard): the adapter resolved this
  // endpoint from the entry's careers_url; re-validate it here.
  const listUrl = resolveListUrl(endpoint);
  const maxPages = resolveMaxPages(entry);
  const maxJobs = resolveMaxJobs(entry);

  const jobs = [];
  const seen = new Set();
  // Why pagination stopped. Only 'cap' earns the truncation flag.
  let stopReason = 'complete';
  let page = 1;
  for (; page <= maxPages; page++) {
    if (page > 1 && delayMs > 0) await delay(delayMs, signal);
    // A scan aborted before page 1 must fail loud, not report an empty board;
    // past page 1 a break keeps the partials.
    if (page === 1) signal?.throwIfAborted();
    else if (signal?.aborted) break;

    const pageUrl = buildPageUrl(listUrl, page);
    let html;
    try {
      html = await fetchTextWithRetry(fetchImpl, pageUrl, { signal, retries, retryDelayMs, headers: PAGE_HEADERS });
    } catch (err) {
      // The first page failing means there is no board to report on.
      if (page === 1) throw err;
      console.error(`⚠️  magneto: ${entry.name} truncated at page ${page} of ${maxPages} (${jobs.length} jobs): ${err.message}`);
      stopReason = 'fetch-error';
      break;
    }

    const cards = parseCards(html, listUrl.origin);
    if (cards.length === 0) {
      if (page === 1 && POSTING_HREF_RE.test(html)) {
        throw new Error(`magneto: ${pageUrl} links postings but no job card parsed (markup change?)`);
      }
      break; // page 1: a search with no results; later: past the last page
    }

    let fresh = 0;
    for (const card of cards) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      fresh++;
      if (jobs.length >= maxJobs) {
        stopReason = 'cap';
        break;
      }
      jobs.push(normalize(card, entry));
    }
    if (stopReason === 'cap' || fresh === 0) break;
    // A full page that ends exactly on max_jobs, or the last allowed page, may
    // hide more results. A SHORT page landing exactly on max_jobs with pages
    // unexamined is likewise a cap stop, not a natural end — the board was cut
    // mid-list, and the flag has to say so.
    if (cards.length >= OBSERVED_PAGE_SIZE && (jobs.length >= maxJobs || page === maxPages)) stopReason = 'cap';
    if (stopReason === 'cap') break;
    if (jobs.length >= maxJobs) {
      if (page < maxPages) stopReason = 'cap';
      break;
    }
  }

  if (stopReason === 'cap') {
    console.error(`⚠️  magneto: ${entry.name} truncated at max_pages=${maxPages} / max_jobs=${maxJobs} (${jobs.length} jobs) — raise max_pages or max_jobs on this entry for more`);
    jobs.magnetoTruncated = true;
  }
  return jobs;
}
