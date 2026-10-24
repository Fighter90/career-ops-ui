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
 *
 * Each card carries the posting's real title (<h3>) and an "Employer | location;
 * location; +2 more" line. The EMPLOYER is not always Google: the same results
 * list YouTube, DeepMind and other Alphabet companies' postings, so the card's
 * employer is the company, not the portals.yml entry name (CodeRabbit, #4078).
 * A card without that markup falls back to the entry name, the link's
 * aria-label or slug for the title, and a blank location.
 *
 * FIRST PAGE ONLY, and that is a robots.txt constraint, not an oversight.
 * google.com/robots.txt disallows the paginated results URLs for every crawler:
 *
 *   Disallow: /about/careers/applications/jobs/results?page=
 *   Disallow: /about/careers/applications/jobs/results/?page=
 *   Disallow: /about/careers/applications/jobs/results?*&page=
 *   Disallow: /about/careers/applications/jobs/results/?*&page=
 *
 * with no Allow under /about/careers that could take precedence (RFC 9309 §2.2.2
 * longest-match). career-ops declines Lagou for the same reason — see the
 * parent's docs/SUPPORTED_JOB_BOARDS.md: "The project does not route around that
 * stated restriction." So this source never sends `page`, which leaves one
 * results page per query (~20 postings). `sort_by=date` makes that page the
 * NEWEST postings, which is what a scanner run on a schedule wants; pages beyond
 * the first are unreachable without the disallowed parameter, so `max_pages`
 * does not apply to this source (and there is no truncation flag: one page per
 * query is the complete first-page result, by design).
 *
 * Ported from the parent's providers/google.mjs (parity v1.253.0).
 * Deviations from the parent, per the web-ui source contract:
 *   - the parent's ctx transport (ctx.fetchText) does not exist here; the
 *     source fetches through the injected fetchImpl (redirect:'error',
 *     browser User-Agent), and web-ui's scanner has no probe path (the
 *     parent's ctx.maxPages one-query probe), so every query always runs;
 *   - the parent lets one failed query abort the whole board; here a failed
 *     query is warned and skipped (recall-first — the mycareersfuture
 *     keyword-loop pattern) and only an all-queries failure throws;
 *   - card text goes through the shared web-ui html-to-text helper (the same
 *     strip-before-decode pipeline the parent's shared helper implements).
 */
import { htmlToText } from '../html-to-text.mjs';
import { fetchText, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';

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

// One request per query: no `page` parameter exists in any URL this source builds.
// The anchor that closes each card; the markup since the previous anchor is that
// card. Google serves the href relative ("jobs/results/…"); a path prefix is
// tolerated, and the URL is rebuilt from BASE either way.
const ANCHOR_RE = /<a\b[^>]*?\bhref="(?:[^"]*\/)?jobs\/results\/(\d+)-([a-z0-9-]+)[^"]*"[^>]*>/g;
const H3_RE = /<h3\b[^>]*>([^<]+)<\/h3>/g;
const EMPLOYER_LINE_RE = /<p class="l103df">([\s\S]*?)<\/p>/g;
const ARIA_TITLE_RE = /\baria-label="Learn more about ([^"]+)"/;
// "+2 more" is Google collapsing the rest of the list, not a place.
const MORE_RE = /^\+\d+ more$/;

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
 * The URL of one query's first (and only — see the robots.txt note) results page.
 * URLSearchParams, not hand-built encodeURIComponent: q and location come from
 * portals.yml, and URLSearchParams never throws on a malformed string.
 * @param {string} query
 * @param {string} location
 * @returns {string}
 */
export function buildQueryUrl(query, location) {
  return `${BASE}?${new URLSearchParams({ q: String(query), location: String(location), sort_by: 'date' })}`;
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
 * Fetch + normalize the Google Careers results across the entry's queries
 * (one first-page request per query — see the robots.txt note).
 * Mirrors the parent's fetch(): results are deduplicated by posting id across
 * queries, and a card's employer wins over the entry name.
 *
 * @param {string} endpoint - a results URL on www.google.com (asserted here;
 *   the query actually fetched is rebuilt per query, the endpoint only pins
 *   the host).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchGoogle(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const entry = company ?? {};
  // Host pin before any request (SSRF guard): the adapter derived this
  // endpoint from the fixed BASE; re-validate it here.
  assertGoogleUrl(endpoint);
  const { queries, location } = parseGoogleConfig(entry);

  const byId = new Map();
  let succeeded = 0; // queries whose request completed (i.e. the source answered)
  const errors = [];
  for (const q of queries) {
    let html;
    try {
      html = await fetchText(fetchImpl, buildQueryUrl(q, location), {
        signal,
        redirect: 'error',
        headers: { 'User-Agent': UA, Accept: 'text/html' },
      });
      succeeded++;
    } catch (err) {
      // Recall-first: tolerate a single failed query and keep going; a query
      // that answered with zero cards is not an outage.
      if (signal?.aborted) break;
      errors.push(`"${q}": ${(err && err.message) || err}`);
      continue;
    }
    for (const card of parseResultsPage(html)) {
      if (!byId.has(card.id)) byId.set(card.id, card);
    }
  }

  // Total outage = every query failed.
  if (succeeded === 0 && errors.length) {
    throw new Error(`google: all ${queries.length} query request(s) failed — ${errors[0]}`);
  }

  return [...byId.values()].map((card) => normalize(card, entry));
}
