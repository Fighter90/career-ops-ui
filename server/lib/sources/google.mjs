// @ts-check
/**
 * Google source — Google Careers is server-rendered, so the results page HTML
 * contains every job link:
 *   GET https://www.google.com/about/careers/applications/jobs/results/?q=<kw>&location=United%20States&sort_by=date
 *   -> HTML with one card per posting, closed by <a href="jobs/results/{id}-{slug}">
 * No JSON API and no XHR (data is in the document), so we run phrase queries and
 * let the scanner's title filter cut. Board-wide source wired with
 * `provider: google` (or a `google:` config block):
 *
 *   tracked_companies:
 *     - name: Google
 *       provider: google
 *       enabled: true
 *       google:
 *         location: "United States"      # optional
 *         queries: ["business strategy", "business operations", ...]
 *       max_pages: 10                     # optional, per query
 *
 * Each card carries the posting's real title (<h3>) and an "Employer | location;
 * location; +2 more" line. The EMPLOYER is not always Google: the same results
 * list YouTube, DeepMind and other Alphabet companies' postings, so the card's
 * employer is the company, not the portals.yml entry name (CodeRabbit, #4078).
 * A card without that markup falls back to the entry name, the link's
 * aria-label or slug for the title, and a blank location.
 *
 * PAGINATION (parent PR #6761 / #6694 parity). The results are paged with a
 * 1-based `page` query parameter (omitted on page 1), PAGE_SIZE cards per full
 * page, newest first under `sort_by=date`. Until 2026-11-08 this source read
 * only the first page because `google.com/robots.txt` disallows the `page=`
 * results URLs; rule 6 of the parent's Source Indexing Policy stopped treating
 * robots.txt as a gate (#6691, #6694), so the walk now continues page by page
 * (upstream `providers/google.mjs`). A query ends on the first empty page, a
 * page that repeats an id already seen in the same walk, or a short page
 * (fewer than PAGE_SIZE cards), and is otherwise bounded by `max_pages` per
 * query (resolveMaxPages: DEFAULT_MAX_PAGES, hard ceiling MAX_PAGES_CAP).
 *
 * A walk stopped by the page cap or by a failed request marks the returned
 * array with the canonical partial-read shape (markTruncated,
 * board-truncation.mjs), so a scan reports the board `partial` instead of
 * presenting a cut prefix as the whole one. One failed query never loses the
 * queries already collected (recall-first); only a total outage — every query
 * failing on its first page — throws, and it throws the FIRST error.
 *
 * Deviations from the parent, per the web-ui source contract:
 *   - the parent's ctx transport (ctx.fetchText / ctx.maxPages probe seam)
 *     does not exist here; the source fetches through the shared
 *     fetchTextWithRetry (injected fetchImpl, redirect:'error', browser
 *     User-Agent). Web-ui has no probe path, so the ctx.maxPages one-query
 *     probe is deliberately not ported (the apple full_board precedent,
 *     CAR-268).
 *   - card text goes through the shared web-ui html-to-text helper (the same
 *     strip-before-decode pipeline the parent's shared helper implements).
 *
 * Ported from the parent's providers/google.mjs (parity v1.253.0 + PR #6761).
 */
import { htmlToText } from '../html-to-text.mjs';
import { fetchTextWithRetry, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { markTruncated } from '../board-truncation.mjs';

const UA = BROWSER_LIKE_USER_AGENT;

export const meta = {
  value: 'google',
  label: 'Google',
  region: 'en',
};

export const BASE = 'https://www.google.com/about/careers/applications/jobs/results/';
export const ALLOWED_HOST = 'www.google.com';

export const DEFAULT_LOCATION = 'United States';
export const DEFAULT_QUERIES = [
  'business strategy', 'business operations', 'strategy and operations',
  'corporate development', 'financial planning',
];

// A full results page carries PAGE_SIZE cards; a shorter page is the last one
// for that query. Observed live upstream 2026-11-08.
export const PAGE_SIZE = 20;
export const DEFAULT_MAX_PAGES = 10; // 200 postings per query
export const MAX_PAGES_CAP = 50; // hard ceiling even for a max_pages override
export const INTER_PAGE_DELAY_MS = 400;

// The anchor that closes each card; the markup since the previous anchor is that
// card. Google serves the href relative ("jobs/results/…"); a path prefix is
// tolerated, and the URL is rebuilt from BASE either way.
// [spec, review round CAR-86 #20] ANCHOR_RE is O(k·n) backtracking (no
// catastrophic case found — bounded input, one page per request); cap the HTML
// length here if a live page ever grows past the scanner's sanity size.
const ANCHOR_RE = /<a\b[^>]*?\bhref="(?:[^"]*\/)?jobs\/results\/(\d+)-([a-z0-9-]+)[^"]*"[^>]*>/g;
const H3_RE = /<h3\b[^>]*>([^<]+)<\/h3>/g;
const EMPLOYER_LINE_RE = /<p class="l103df">([\s\S]*?)<\/p>/g;
const ARIA_TITLE_RE = /\baria-label="Learn more about ([^"]+)"/;
// "+2 more" is Google collapsing the rest of the list, not a place.
const MORE_RE = /^\+\d+ more$/;

// Any posting link the page still carries, however the markup shifted — the
// "this is a results page" signal when zero cards parsed.
const POSTING_LINK_RE = /jobs\/results\/\d+/;
// Google's own empty-state copy. Only this explicit marker keeps a zero-card
// board quiet (see fetchGoogle): every other zero-card answer is a markup
// change worth failing on.
const NO_RESULTS_RE = /\b0 results\b|no (?:matching )?(?:results|jobs|positions|openings)\b/i;

/**
 * Defence-in-depth endpoint check: HTTPS on exactly the results host.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertGoogleUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`google: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`google: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`google: a non-default port is not allowed: ${url}`);
  if (parsed.hostname !== ALLOWED_HOST)
    throw new Error(`google: untrusted hostname "${parsed.hostname}" — must be ${ALLOWED_HOST}`);
  return url;
}

/**
 * Read the `google:` block of an entry: the phrase queries and the location.
 * Empty or non-string queries are dropped; a block with none falls back to
 * DEFAULT_QUERIES (so `provider: google` alone still scans).
 * @param {any} entry
 * @returns {{ queries: string[], location: string }}
 */
export function parseGoogleConfig(entry) {
  const c = (entry && entry.google) || {};
  const queries = (Array.isArray(c.queries) ? c.queries : [])
    .map((q) => (typeof q === 'string' ? q.trim() : ''))
    .filter(Boolean);
  return {
    queries: queries.length ? queries : [...DEFAULT_QUERIES],
    location: typeof c.location === 'string' && c.location.trim() ? c.location.trim() : DEFAULT_LOCATION,
  };
}

/**
 * Resolve the per-query page cap: a positive integer `max_pages` on the entry,
 * capped at MAX_PAGES_CAP; the default otherwise. Exported for unit tests
 * (parent parity — PR #6761 / #6694).
 * @param {any} entry
 * @returns {number}
 */
export function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * The URL of one query's results page. Page 1 is the param-less URL (the shape
 * the robots file historically served, and what the adapter's endpoint uses);
 * later pages carry the 1-based `page` parameter. URLSearchParams, not
 * hand-built encodeURIComponent: q and location come from portals.yml, and
 * URLSearchParams never throws on a malformed string.
 * @param {string} query
 * @param {string} location
 * @param {number} [page] 1-based; 1 (or anything below 2) omits the param
 * @returns {string}
 */
export function buildQueryUrl(query, location, page = 1) {
  const params = new URLSearchParams({ q: String(query), location: String(location), sort_by: 'date' });
  if (page > 1) params.set('page', String(page));
  return `${BASE}?${params}`;
}

/** @param {string} slug */
function titleFromSlug(slug) {
  return slug.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Card text goes through the shared pipeline, never a local strip-then-decode:
// stripping tags before decoding lets "&lt;script&gt;" come back out as a live
// "<script>" (CodeQL js/incomplete-multi-character-sanitization on #4078).
const text = (/** @type {string} */ s) => htmlToText(s);

/** Last match of a global regex in `s`, or null. */
function lastMatch(/** @type {RegExp} */ re, /** @type {string} */ s) {
  let last = null;
  for (const m of s.matchAll(re)) last = m;
  return last;
}

/**
 * Parse one results page into its cards. Exported for unit tests.
 *
 * @param {string} html
 * @returns {{id: string, slug: string, title: string, employer: string, locations: string[]}[]}
 */
export function parseResultsPage(html) {
  const cards = [];
  let prevEnd = 0;
  for (const a of String(html).matchAll(ANCHOR_RE)) {
    const [tag, id, slug] = a;
    const card = html.slice(prevEnd, a.index);
    prevEnd = /** @type {number} */ (a.index) + tag.length;
    const h3 = lastMatch(H3_RE, card);
    const aria = tag.match(ARIA_TITLE_RE);
    const title = (h3 && text(h3[1])) || (aria && text(aria[1])) || titleFromSlug(slug);
    const line = lastMatch(EMPLOYER_LINE_RE, card);
    let employer = '';
    let locations = [];
    if (line) {
      const sep = line[1].indexOf('|');
      if (sep !== -1) {
        employer = text(line[1].slice(0, sep));
        locations = text(line[1].slice(sep + 1)).split(';').map((l) => l.trim()).filter((l) => l && !MORE_RE.test(l));
      }
    }
    cards.push({ id, slug, title, employer, locations });
  }
  return cards;
}

function normalize(card, entry) {
  return {
    id: `google-${card.id}`,
    title: card.title,
    // The card's employer is the posting's real Alphabet company (YouTube,
    // DeepMind, …); the entry name is only the fallback for a card whose
    // markup carries none.
    company: card.employer || String(entry?.name ?? ''),
    url: `${BASE}${card.id}-${card.slug}`,
    salary: '',
    location: card.locations.join('; '),
    isRemote: /remote|удал[её]н/i.test(card.title),
    workplaceType: '',
    relocates: false,
    date: '',
    snippet: '',
    source: 'google',
  };
}

/**
 * Fetch + normalize the Google Careers results across the entry's queries,
 * PAGE_SIZE cards a page per query (see the pagination note).
 * Mirrors the parent's fetch() (PR #6761): postings are deduplicated by id
 * across queries AND within one query's walk, a card's employer wins over the
 * entry name, a page that repeats ids is past the end, and a failed page keeps
 * everything collected so far (marking the result partial) rather than losing
 * it — only a total outage (every query failing on its first page) throws the
 * first error.
 *
 * @param {string} endpoint - a results URL on www.google.com (asserted here;
 *   the query actually fetched is rebuilt per query, the endpoint only pins
 *   the host).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           sleep?: (ms: number) => Promise<void> }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchGoogle(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const entry = company ?? {};
  // Host pin before any request (SSRF guard): the adapter derived this
  // endpoint from the fixed BASE; re-validate it here.
  assertGoogleUrl(endpoint);
  const { queries, location } = parseGoogleConfig(entry);
  const maxPages = resolveMaxPages(entry);
  const name = String(entry?.name ?? 'Google');
  // Test seam; the default honors the abort signal while pacing between pages.
  const sleep = opts.sleep || ((ms) => delay(ms, signal));

  const byId = new Map();
  let requestsMade = 0;
  let succeeded = 0; // queries whose first page answered (i.e. the source answered)
  let sawNoResults = false; // a page said outright it has no results
  let truncated = false; // a query ran out of pages on a full, fresh page
  let fetchFailed = false; // a query stopped on a failed request
  let firstPageFailures = 0;
  let firstPageError;
  for (const [qi, q] of queries.entries()) {
    // A scan aborted before the first query must fail loud, not report an
    // empty board; past the first query a break keeps the partials.
    if (qi === 0) signal?.throwIfAborted();
    else if (signal?.aborted) break;
    // IDs seen in THIS query's walk: a page that adds none is Google
    // re-serving an earlier page past the end, so the walk for this query
    // stops — but a later query whose first page overlaps an earlier query
    // still walks its own deeper pages (parent parity).
    const seenThisQuery = new Set();
    let queryAnswered = false;
    for (let page = 1; page <= maxPages; page++) {
      if (requestsMade > 0) await sleep(INTER_PAGE_DELAY_MS);
      const url = buildQueryUrl(q, location, page);
      assertGoogleUrl(url);
      let html;
      try {
        html = await fetchTextWithRetry(fetchImpl, url, {
          signal,
          redirect: 'error',
          headers: { 'User-Agent': UA, Accept: 'text/html' },
        });
      } catch (err) {
        // Recall-first: tolerate a failed query (or page) and keep going. A
        // page-1 failure counts toward the total-outage check below; a later
        // failure marks the board partial instead of a cap stop.
        if (signal?.aborted) break;
        fetchFailed = true;
        if (page === 1) {
          if (firstPageFailures === 0) firstPageError = err;
          firstPageFailures += 1;
        }
        const cause = err instanceof Error ? err.message : String(err);
        console.error(`⚠️  google: ${name} stopped "${q}" at page ${page} (${byId.size} jobs so far): ${cause}`);
        break;
      }
      requestsMade += 1;
      queryAnswered = true;
      if (!POSTING_LINK_RE.test(html) && NO_RESULTS_RE.test(html)) {
        sawNoResults = true;
      }
      const cards = parseResultsPage(html);
      let newThisQuery = 0;
      for (const c of cards) {
        if (!seenThisQuery.has(c.id)) { seenThisQuery.add(c.id); newThisQuery += 1; }
        if (!byId.has(c.id)) byId.set(c.id, c);
      }
      // Stop at this query's last page: empty, re-served (no new ids), or
      // short (a full page is PAGE_SIZE cards).
      if (cards.length === 0 || newThisQuery === 0 || cards.length < PAGE_SIZE) break;
      if (page === maxPages) truncated = true;
    }
    if (queryAnswered) succeeded += 1;
  }

  // Total outage = every query failed on its first page: throw the FIRST
  // error (parent PR #6761 — an empty board would read as "no postings").
  if (firstPageFailures === queries.length && firstPageError) {
    throw firstPageError;
  }

  // Every query answered 200 but not a single card parsed anywhere: a markup
  // change (ANCHOR_RE no longer matching) would read as an empty board
  // forever. Only a page that says outright it has no results may stay quiet.
  if (succeeded > 0 && byId.size === 0 && !sawNoResults) {
    throw new Error(`google: ${succeeded} query page(s) answered 200 but parsed 0 postings across ${queries.length} quer${queries.length === 1 ? 'y' : 'ies'} — results markup changed?`);
  }

  let jobs = [...byId.values()].map((card) => normalize(card, entry));
  if (truncated) {
    console.error(`⚠️  google: ${name} hit the ${maxPages}-page cap on at least one query — raise max_pages on this entry for more`);
    jobs = markTruncated(jobs, 'page-cap', { fetched: jobs.length });
  }
  if (fetchFailed) {
    jobs = markTruncated(jobs, 'fetch-error', { fetched: jobs.length });
  }
  return jobs;
}
