// @ts-check
/**
 * Platsbanken source — Sweden's national job board (Arbetsförmedlingen), read
 * through the public JobTech Dev JobSearch API. Board-wide source wired with
 * `provider: platsbanken` in portals.yml (a national public employment service,
 * same class as arbeitsagentur/jobbankca — never auto-detected from a
 * careers_url):
 *
 *   tracked_companies:
 *     - name: Platsbanken — Backend
 *       provider: platsbanken
 *       enabled: true
 *       max_pages: 5             # optional, capped at 21 (see below)
 *       platsbanken:
 *         keywords: ["backend developer", "systemutvecklare"]  # optional —
 *                                # falls back to config/profile.yml target_roles
 *
 * PUBLIC FEED, NO AUTH (jobsearch.api.jobtechdev.se/search — verified live by
 * the parent 2026-10-12). Posting permalinks are rebuilt from the ad id against
 * a fixed literal host (arbetsformedlingen.se/platsbanken/annonser/) rather
 * than trusting the payload's webpage_url — the tighter trust boundary leaves
 * nothing for an allowlist to guard.
 *
 * WHY KEYWORD-SCOPED, NOT ENUMERATED. The unfiltered board reports ~39k ads but
 * the API stops serving past `offset` 2000 (offset 2000 answers 100 hits,
 * offset 2100 answers 0 with a plain 200). One walk can therefore never exceed
 * 2,100 rows (~5% of the board); presenting that window as "the board" would be
 * the partial-coverage-reads-as-complete failure. So the source runs one query
 * per keyword and each keyword gets its own window; MAX_PAGES_CAP = 21 is that
 * source ceiling, not a taste call. `description.text` ships in the list
 * payload at no extra request, so `snippet` is populated (the scanner's content
 * filter reads it).
 *
 * Ported from the parent's providers/platsbanken.mjs (parity v1.253.0).
 * Deviations from the parent, per the web-ui source contract:
 *   - the parent's ctx transport (ctx.fetch / ctx.sleep / ctx.maxPages
 *     health-probe path) does not exist here; the source fetches through the
 *     injected fetchImpl via the shared fetchJsonWithRetry, and web-ui's
 *     scanner has no probe path;
 *   - a keyword that ends on a full last-allowed page tags the result array
 *     `platsbankenTruncated` — the web-ui partial-board convention (the parent
 *     only warns, and distinguishes entry-vs-source ceilings in prose);
 *   - rows normalize into the web-ui 12-field shape: `publication_date`
 *     becomes `date`, `description.text` becomes a capped `snippet`, and the
 *     ad id becomes the row id.
 */
import { fetchJsonWithRetry, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';
import { resolveProfileKeywords } from './jobbankca.mjs';

const UA = BROWSER_LIKE_USER_AGENT;

export const meta = {
  value: 'platsbanken',
  label: 'Platsbanken',
  region: 'en',
};

export const SEARCH_URL = 'https://jobsearch.api.jobtechdev.se/search';
export const API_HOST = 'jobsearch.api.jobtechdev.se';

/** Posting permalink base — fixed literal host, see the header note. */
export const POSTING_URL_BASE = 'https://arbetsformedlingen.se/platsbanken/annonser/';

/** Measured: `limit=100` is accepted and serves 100 rows while results remain. */
export const PAGE_SIZE = 100;

/** Pages per keyword; 5 covers a common keyword (~500 ads) with room to spare. */
export const DEFAULT_MAX_PAGES = 5;

/**
 * Hard ceiling on a configured `max_pages`: the source stops serving at
 * `offset` 2000, so page 21 (offset=2000) is the last page that returns rows
 * and page 22 answers 0 with a plain HTTP 200 (measured by the parent,
 * 2026-10-12). A larger cap would only buy silent empty requests.
 */
export const MAX_PAGES_CAP = 21;

/** Self-imposed pacing between pages past the first (a public service). */
export const INTER_PAGE_DELAY_MS = 1000;

// Parent retry budget (1 attempt + 2 retries on a transient failure).
export const RETRIES = 2;

/**
 * Defence-in-depth endpoint check: HTTPS on exactly the JobTech API host,
 * default port only. The search keyword rides this URL, so it is re-validated
 * here no matter what the adapter built.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertPlatsbankenUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`platsbanken: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`platsbanken: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`platsbanken: a non-default port is not allowed: ${url}`);
  if (parsed.hostname !== API_HOST) {
    throw new Error(`platsbanken: untrusted hostname "${parsed.hostname}" — must be ${API_HOST}`);
  }
  return url;
}

/**
 * Read + sanitize the entry's `platsbanken:` config block.
 * @param {{ platsbanken?: any }} entry
 * @returns {{ keywords: string[] }}
 */
export function parsePlatsbankenConfig(entry) {
  const cfg = (entry && entry.platsbanken) || {};
  const keywords = [...new Set(
    (Array.isArray(cfg.keywords) ? cfg.keywords : [])
      .filter((k) => typeof k === 'string' && k.trim())
      .map((k) => k.trim()),
  )];
  return { keywords };
}

/** Clamp a positive-integer entry field to a cap, falling back to a default. */
function boundedPositiveInt(value, fallback, cap) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, cap);
}

/**
 * Resolve the page cap: a positive integer `max_pages` on the entry, capped at
 * the source's own 2000-offset ceiling.
 * @param {{max_pages?: unknown}} entry
 */
export function resolveMaxPages(entry) {
  return boundedPositiveInt(entry?.max_pages, DEFAULT_MAX_PAGES, MAX_PAGES_CAP);
}

/**
 * Build the search URL for one keyword and one page. `offset` is the source's
 * own paging parameter (page 1 is offset 0). The keyword is config-derived, so
 * URLSearchParams (never throws) encodes it once here, outside the row loop.
 * @param {string} keyword
 * @param {number} page 1-based
 * @param {string} [apiUrl] validated base endpoint
 */
export function buildSearchUrl(keyword, page, apiUrl = SEARCH_URL) {
  const params = new URLSearchParams({
    q: keyword,
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  });
  return `${apiUrl}?${params.toString()}`;
}

/**
 * Build a posting permalink from the ad id. The id is a response field, so it
 * goes through `safeEncodeURIComponent` (null on a lone UTF-16 surrogate) and
 * a null drops exactly the one bad posting instead of losing the page.
 * @param {unknown} id
 * @returns {string|null}
 */
export function postingUrl(id) {
  if (id === null || id === undefined) return null;
  const seg = safeEncodeURIComponent(String(id).trim());
  return seg ? `${POSTING_URL_BASE}${seg}` : null;
}

/** NaN-safe ISO-date parse; absent/empty/malformed → undefined. */
function toEpochMs(value) {
  if (!value || typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** `city` → `municipality` → `region` → country, whichever the ad carries. */
export function formatLocation(address) {
  if (!address || typeof address !== 'object') return '';
  for (const field of ['city', 'municipality', 'region', 'country']) {
    const value = address[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/** RAW row count of one page — pagination stops on this, never on the
 *  post-filter count (a full page carrying one bad row must not end the walk
 *  a page early). */
export function rawHitCount(json) {
  return json && Array.isArray(json.hits) ? json.hits.length : 0;
}

/**
 * Normalize the JobSearch payload. Exported for unit tests.
 *
 * Contract (the web-ui source convention):
 *   - the documented container present and empty (`hits: []`)  → `[]`
 *   - the envelope not the documented shape (`{}`, `{hits: null}`,
 *     `{hits: {}}`, a bare non-object)                           → descriptive
 *     throw naming the keys that arrived
 *   - one malformed row (no id / no headline)                    → skipped
 *
 * @param {any} json
 * @returns {{title: string, url: string, company: string, location: string, description?: string, postedAt?: number, externalId?: string}[]}
 */
export function parsePlatsbankenResponse(json) {
  const rows = json && typeof json === 'object' && !Array.isArray(json) && Array.isArray(json.hits)
    ? json.hits
    : null;
  if (!rows) {
    const got = json === null || json === undefined
      ? String(json)
      : Array.isArray(json)
        ? `an array of ${json.length}`
        : typeof json === 'object'
          ? `keys: [${Object.keys(json).join(', ')}]`
          : typeof json;
    throw new Error(`platsbanken: unexpected response — expected hits[], got: ${got}`);
  }

  const jobs = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;

    const title = typeof row.headline === 'string' ? row.headline.trim() : '';
    if (!title) continue;

    const url = postingUrl(row.id);
    if (!url) continue;

    const employer = row.employer && typeof row.employer === 'object' ? row.employer : null;
    const description = row.description && typeof row.description === 'object' ? row.description : null;
    const descriptionText = description && typeof description.text === 'string' ? description.text.trim() : '';
    const postedAt = toEpochMs(row.publication_date);
    const externalId = row.id === null || row.id === undefined ? '' : String(row.id).trim();

    jobs.push({
      title,
      url,
      company: employer && typeof employer.name === 'string' ? employer.name.trim() : '',
      location: formatLocation(row.workplace_address),
      ...(descriptionText ? { description: descriptionText } : {}),
      ...(postedAt === undefined ? {} : { postedAt: postedAt }),
      ...(externalId ? { externalId } : {}),
    });
  }
  return jobs;
}

const SNIPPET_CAP = 500;

function normalize(row, entry) {
  return {
    id: `platsbanken-${row.externalId || row.url}`,
    title: row.title,
    company: row.company || String(entry?.name ?? ''),
    url: row.url,
    salary: '',
    location: row.location || '',
    // The board is Swedish-language: "Distansarbete" / "Helt distans" are the
    // remote markers there (same board-language precedent as magneto's
    // Spanish "remoto").
    isRemote: /remote|distans|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: /remote|distans/i.test(`${row.title} ${row.location}`) ? 'Remote' : '',
    relocates: false,
    date: row.postedAt != null ? new Date(row.postedAt).toISOString() : '',
    snippet: row.description ? String(row.description).slice(0, SNIPPET_CAP) : '',
    source: 'platsbanken',
  };
}

/**
 * Fetch + normalize Platsbanken postings across the configured keywords.
 * Mirrors the parent's fetch(): one query per keyword (each with its own
 * 2,100-row window), a page-1 failure marks that keyword failed while a
 * later-page failure keeps the pages already collected, and only when EVERY
 * keyword's first request failed does the fetch throw (a keyword that answered
 * with zero rows is not an outage — recall-first). A keyword that stops on the
 * max_pages cap with a full page tags the result array `platsbankenTruncated`.
 *
 * @param {string} endpoint - the search API URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           delayMs?: number, retries?: number, profileKeywords?: string[] }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchPlatsbanken(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {}, delayMs = INTER_PAGE_DELAY_MS, retries = RETRIES } = opts;
  // A scan aborted before the first request must fail loud, never report an
  // empty board. Every return path is behind this line.
  signal?.throwIfAborted();
  assertPlatsbankenUrl(endpoint);
  const entry = company ?? {};

  let { keywords } = parsePlatsbankenConfig(entry);
  // Fall back to config/profile.yml's target_roles when this entry has no
  // platsbanken.keywords[] of its own — same convention jobbankca/gupy use.
  // `opts.profileKeywords` is an injectable override (tests avoid the FS).
  if (!keywords.length) {
    keywords = Array.isArray(opts.profileKeywords) ? opts.profileKeywords : await resolveProfileKeywords();
  }
  if (!keywords.length) {
    throw new Error(`platsbanken: entry "${entry.name || '(unnamed)'}" has no platsbanken.keywords[] and no config/profile.yml target_roles to fall back to`);
  }

  const maxPages = resolveMaxPages(entry);
  const byUrl = new Map();
  const errors = [];
  let succeeded = 0;
  let truncated = false;

  for (const keyword of keywords) {
    if (signal?.aborted) break; // keeps the keywords already collected
    let keywordFailed = false;
    for (let page = 1; page <= maxPages; page++) {
      if (page > 1 && delayMs > 0) await delay(delayMs, signal);

      let json;
      let pageJobs;
      try {
        json = await fetchJsonWithRetry(fetchImpl, buildSearchUrl(keyword, page, endpoint), {
          signal,
          redirect: 'error',
          headers: { 'User-Agent': UA, Accept: 'application/json' },
          retries,
        });
        // Parse INSIDE the try: a later-page envelope throw keeps the pages
        // already collected (partials, the later-page invariant). A page-1
        // throw marks this keyword failed (recall-first: the other keywords
        // still run); if EVERY keyword's first request fails, the fetch throws
        // below — a board-wide envelope change never reads as an empty board.
        pageJobs = parsePlatsbankenResponse(json);
      } catch (err) {
        // An aborted scan is never a keyword failure.
        if (signal?.aborted) throw err;
        if (page === 1) {
          keywordFailed = true;
          errors.push(`"${keyword}": ${(err && err.message) || err}`);
        } else {
          console.error(`⚠️  platsbanken: "${keyword}" truncated at page ${page} of ${maxPages} — ${err.message}`);
        }
        break;
      }

      // RAW row count of the payload — pagination stops on this, never on how
      // many rows survived normalization.
      const rawCount = rawHitCount(json);
      for (const row of pageJobs) {
        if (!byUrl.has(row.url)) byUrl.set(row.url, row);
      }

      // Natural end: a SHORT RAW page (before row filtering) is this
      // keyword's own end.
      if (rawCount < PAGE_SIZE) break;

      // Full page at the last allowed page: the cap stopped the walk, not the
      // source. Which ceiling decides the advice — raising max_pages cannot
      // buy a page the source does not serve past offset 2000.
      if (page === maxPages) {
        truncated = true;
        if (maxPages >= MAX_PAGES_CAP) {
          console.error(`⚠️  platsbanken: "${keyword}" hit the source's 2000-offset ceiling at ${byUrl.size} rows (${maxPages} pages) — narrow the keyword for the rest`);
        } else {
          console.error(`⚠️  platsbanken: ${entry.name || '(unnamed)'} truncated at max_pages=${maxPages} for "${keyword}" — raise max_pages on this entry for more`);
        }
      }
    }
    if (!keywordFailed) succeeded++;
  }

  // Total outage = every keyword's first request failed.
  if (succeeded === 0 && errors.length) {
    throw new Error(`platsbanken: all ${keywords.length} keyword request(s) failed — ${errors[0]}`);
  }

  const out = [...byUrl.values()].map((row) => normalize(row, entry));
  if (truncated) out.platsbankenTruncated = true;
  return out;
}
