// @ts-check
/**
 * Computrabajo source — a LATAM board-wide aggregator with one host per
 * country (co.computrabajo.com, mx.computrabajo.com, …). Board-wide source
 * wired with a search URL on a country host (the query lives in the URL
 * path):
 *
 *   tracked_companies:
 *     - name: Computrabajo Colombia
 *       careers_url: https://co.computrabajo.com/trabajo-de-sistemas
 *       enabled: true
 *
 * There is no public API; the search pages are server-rendered HTML. Card
 * shape (measured on the trabajo-de-sistemas search, 2026-10-23, parent): an
 * `<article class="box_offer" data-id="{ID}">` per card, a `<h2><a>` with the
 * title (href `/ofertas-de-trabajo/...-{ID}#lc=…`), a company link carrying
 * the `offer-grid-article-company-url` class, and a `<p><span class="mr10">`
 * with the city. Only the Colombian host was measured; other country hosts
 * share the domain and the markup is assumed to match (unverified).
 *
 * Pagination is `?p=N` (unverified: the listing renders no plain page links).
 * The walk also stops as soon as a page brings no new ids, so a parameter the
 * board ignores (re-serving page 1) ends the walk instead of repeating it.
 *
 * Crawl limits are deliberately tight, as the contributor asked: at most 3
 * pages and 15 postings per entry.
 *
 * Ported from the parent's providers/computrabajo.mjs (parity v1.253.0, the
 * #2650 encoding-fixed version — titles/companies arrive HTML-entity-encoded
 * Latin-1 `&#xF3;`-style and decode through the shared html-entities table).
 * Deviations from the parent, per the web-ui source contract:
 *   - the parent's ctx transport (ctx.fetchText / ctx.sleep / ctx.maxPages
 *     health-probe path) does not exist here; the source fetches through the
 *     injected fetchImpl with a local retry budget, and web-ui's scanner has
 *     no probe path;
 *   - the parent's REQUEST_TIMEOUT_MS per-request timeout is dropped —
 *     web-ui's scanner wraps every request in makeTimeoutFetch;
 *   - the parent's random 2-5 s inter-page pause becomes a fixed
 *     INTER_PAGE_DELAY_MS (delayMs opt), like every other web-ui source;
 *   - a stop at the crawl caps tags the result array `computrabajoTruncated`,
 *     the web-ui partial-board convention (the parent only warns);
 *   - isRemote also reads Spanish "remoto" (the board is Spanish-language).
 */
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
  value: 'computrabajo',
  label: 'Computrabajo',
  region: 'en',
};

/** A two-letter country host: co.computrabajo.com, mx.computrabajo.com, ... */
export const HOST_RE = /^[a-z]{2}\.computrabajo\.com$/;

// Also the hard cap: a typo cannot turn one entry into a ban-prone crawl.
export const MAX_PAGES = 3;
export const DEFAULT_MAX_JOBS = 15;
export const OBSERVED_PAGE_SIZE = 20; // cards per page, measured 2026-10-23

// Courtesy pause between pages — only multi-page searches pay it. The parent
// paused 2-5 s at random; the fixed lower bound keeps the same politeness
// without the randomness other web-ui sources don't have.
export const INTER_PAGE_DELAY_MS = 2000;

// OBSERVED_PAGE_SIZE feeds the last-full-page cap heuristic only. [spec,
// review round CAR-86 #15 — deliberate follow-up]: there is no short-page
// stop yet, so a 2-card page 1 still fetches page 2 on this ban-prone board,
// and the heuristic reads parsed cards rather than raw box_offer articles.
// The cap flag covers the truncation case for now; add the raw-count stop
// with a byte-level fixture when this source is next touched.

// Parent retry budget (1 attempt + 2 retries on a transient failure).
export const RETRIES = 2;
export const RETRY_DELAY_MS = 500;
export const RETRY_MAX_DELAY_MS = 8000;

/**
 * Markers that only a challenge / block page carries. Generic words such as
 * "cloudflare" or "captcha" also appear in normal pages (CDN assets, a login
 * form's reCAPTCHA), so they are not used.
 */
const CHALLENGE_RE = /<title[^>]*>[^<]*(?:just a moment|attention required|access denied|acceso denegado)|cf-(?:challenge|browser-verification|error-details)|cf-mitigated/i;

/** A posting detail link anywhere in the page: the "this is a listing" signal. */
const POSTING_HREF_RE = /href="(?:https:\/\/[a-z]{2}\.computrabajo\.com)?\/ofertas-de-trabajo\/[^"]+"/i;

/** Decode-then-strip via the shared helper: a local strip-then-decode lets
 * "&lt;script&gt;" come back out as a live "<script>" in a title or company
 * (the CodeQL order bug — see html-to-text.mjs). */
const clean = (/** @type {unknown} */ s) => htmlToText(String(s ?? ''));

/** Keep user overrides bounded so a typo cannot turn one board into a ban-prone crawl. */
function boundedPositiveInt(value, fallback, cap) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, cap) : fallback;
}

/**
 * Resolve the page cap: a positive integer `max_pages` on the entry — capped
 * at MAX_PAGES itself, which is both the default and the hard cap.
 * @param {{max_pages?: unknown}} entry
 */
export function resolveMaxPages(entry) {
  return boundedPositiveInt(entry?.max_pages, MAX_PAGES, MAX_PAGES);
}

/**
 * Resolve the posting cap: a positive integer `max_jobs` on the entry —
 * capped at DEFAULT_MAX_JOBS itself, which is both the default and the cap.
 * @param {{max_jobs?: unknown}} entry
 */
export function resolveMaxJobs(entry) {
  return boundedPositiveInt(entry?.max_jobs, DEFAULT_MAX_JOBS, DEFAULT_MAX_JOBS);
}

/**
 * Validate a configured search URL and rebuild it from its parts: https only,
 * a Computrabajo country host only, port and credentials dropped. Throws on a
 * malformed URL or a foreign host — the adapter's fail-soft path treats that
 * as no endpoint, and fetchComputrabajo re-runs it as defence-in-depth.
 * @param {unknown} raw
 * @returns {URL}
 */
export function resolveListUrl(raw) {
  const u = new URL(String(raw)); // throws on a malformed URL
  if (u.protocol !== 'https:') throw new Error(`computrabajo: careers_url must be https, got ${u.protocol}`);
  if (!HOST_RE.test(u.hostname)) throw new Error(`computrabajo: ${u.hostname} is not a Computrabajo country host`);
  return new URL(`https://${u.hostname}${u.pathname}${u.search}`);
}

/**
 * Parse the posting cards out of one search page. Exported for unit tests.
 * @param {string} html
 * @param {string} origin - e.g. https://co.computrabajo.com
 * @returns {Array<{id:string,title:string,url:string,company:string,location:string}>}
 */
export function parseCards(html, origin) {
  const out = [];
  for (const chunk of String(html).split(/<article\b/i).slice(1)) {
    const card = chunk.split(/<\/article>/i)[0];
    const openTag = card.slice(0, card.indexOf('>') + 1);
    if (!/\bbox_offer\b/.test(openTag)) continue;

    const link = card.match(/<a\b[^>]*\bhref="((?:https:\/\/[a-z]{2}\.computrabajo\.com)?\/ofertas-de-trabajo\/[^"#?]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    let url;
    try {
      url = new URL(link[1], origin);
    } catch {
      continue;
    }
    if (!HOST_RE.test(url.hostname)) continue;

    const heading = card.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
    const title = clean(link[2]) || (heading ? clean(heading[1]) : '');
    if (!title || title.length < 3) continue;

    const idM = openTag.match(/\bdata-id=['"]([^'"]+)['"]/);
    const companyM = card.match(/<a\b[^>]*\boffer-grid-article-company-url\b[^>]*>([\s\S]*?)<\/a>/i);
    const locationM = card.match(/<p\b[^>]*>\s*<span class="mr10">([\s\S]*?)<\/span>/i);

    out.push({
      id: idM ? idM[1] : url.pathname,
      title,
      url: `${url.origin}${url.pathname}`,
      // Never substitute the board's or the entry's name for a missing
      // employer (Source Indexing Policy rule 1): '?' is the tracker's marker.
      company: (companyM && clean(companyM[1])) || '?',
      location: locationM ? clean(locationM[1]) : '',
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
  'Accept-Language': 'es-CO,es;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};
// [spec, review round CAR-86 #19 — deliberate follow-up]: every fixture here
// carries entities (&#xF3;), but raw ISO-8859-1 bytes served with
// `charset=iso-8859-1` would be mangled by fetchText's utf-8 res.text();
// decode via the Content-Type charset (TextDecoder) and add a byte-level
// fixture when this source is next touched.

/**
 * The URL of one results page. Newest first (the board's own "Fecha" sort).
 * Employers can pay Computrabajo to feature a posting ("Empleo destacado"),
 * and those cards are interleaved in every sort order; a `by=` the user put
 * in their URL wins. robots.txt disallows `/ofertas-de-trabajo/*by=`, so no
 * sort is sent there, not even one from the URL.
 * @param {URL} listUrl
 * @param {number} page
 * @returns {string}
 */
export function buildPageUrl(listUrl, page) {
  const u = new URL(listUrl);
  if (u.pathname.startsWith('/ofertas-de-trabajo/')) {
    u.searchParams.delete('by');
  } else if (!u.searchParams.has('by')) {
    u.searchParams.set('by', 'publicationtime');
  }
  u.searchParams.set('p', String(page));
  return u.href;
}

function normalize(card, entry) {
  return {
    id: `computrabajo-${card.id}`,
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
    source: 'computrabajo',
  };
}

/**
 * Fetch + normalize one Computrabajo country search (paginated, tight caps).
 * Mirrors the parent's fetch(): a page-1 fetch failure throws; a later-page
 * failure keeps the earlier pages; an anti-bot challenge on page 1 throws and
 * on a later page keeps the earlier pages; an empty page-1 search with no
 * posting links returns []; a page bringing no new ids ends the sweep; the
 * crawl caps tag the result array `computrabajoTruncated`.
 *
 * @param {string} endpoint - a Computrabajo country-host search URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           delayMs?: number, retries?: number, retryDelayMs?: number }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchComputrabajo(endpoint, opts = {}) {
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
      console.error(`⚠️  computrabajo: ${entry.name} truncated at page ${page} of ${maxPages} (${jobs.length} jobs): ${err.message}`);
      stopReason = 'fetch-error';
      break;
    }

    const cards = parseCards(html, listUrl.origin);
    if (cards.length === 0) {
      const challenged = CHALLENGE_RE.test(html);
      if (page === 1) {
        if (challenged) throw new Error(`computrabajo: anti-bot challenge on ${pageUrl}, no postings readable`);
        if (POSTING_HREF_RE.test(html)) throw new Error(`computrabajo: ${pageUrl} links postings but no card parsed (markup change?)`);
        return []; // a search with no results
      }
      if (challenged) {
        console.error(`⚠️  computrabajo: ${entry.name} hit an anti-bot challenge on page ${page} (${jobs.length} jobs kept)`);
        stopReason = 'challenge';
      }
      break;
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
    // The walk stopped because the posting cap was hit: unless this was the
    // last allowed page, pages remain unexamined — a cap stop, not a natural
    // end, even when the page lands exactly on max_jobs (10 + 5 across two
    // pages with more to come reads as partial, never as the whole board).
    if (jobs.length >= maxJobs) {
      if (page < maxPages) stopReason = 'cap';
      break;
    }
    if (page === maxPages && cards.length >= OBSERVED_PAGE_SIZE) stopReason = 'cap';
  }

  if (stopReason === 'cap') {
    console.error(`⚠️  computrabajo: ${entry.name} truncated at the crawl limit (${maxPages} page(s), ${maxJobs} posting(s), ${jobs.length} jobs) — narrow the search URL to see more`);
    jobs.computrabajoTruncated = true;
  }
  return jobs;
}
