// @ts-check
/**
 * Apple source — jobs.apple.com is a React Router SSR app with NO usable JSON
 * API. Ported from the parent's providers/apple.mjs (upstream #5496 + #6196).
 *
 * Why not the API: `POST /api/v1/search` exists (with an X-Apple-CSRF-Token
 * from `GET /api/v1/CSRFToken`) but returns `{"res":{"searchResults":[],
 * "totalRecords":0}}` for every payload shape, cookies and Referer included.
 * The SPA never calls it — the search results are server-rendered and embedded
 * in the HTML as a React Router hydration blob:
 *
 *   window.__staticRouterHydrationData = JSON.parse("{...}");
 *     -> loaderData.search.searchResults   (20 jobs/page)
 *     -> loaderData.search.totalRecords
 *
 * So this source fetches the ordinary search URL over plain HTTP and reads
 * that blob. Zero tokens, no browser required.
 *
 * Three discovery modes. `queries` and `teams` are deduped by URL and have no
 * default: a built-in list would be one user's search profile applied to
 * everyone's scan (the occ precedent), so an entry needs `full_board: true`
 * or at least one non-empty `queries` or `teams` value and throws without
 * one. Example portals.yml entry:
 *
 *   - name: Apple
 *     careers_url: https://jobs.apple.com/en-us/search
 *     apple:
 *       location: united-states-USA            # optional, this is the default
 *       queries: ["business operations"]
 *       teams: ["business-process-management-OPMFG-BPM"]
 *     max_pages: 2
 *
 *   queries: text search with `sort=relevance`. Apple's text match is loose
 *            (it hits job descriptions too), but relevance ranking puts the
 *            real title matches on page 1-2 — hence max_pages.
 *   teams:   team-slug filter. Precise and small; this is how Apple's
 *            non-obvious orgs are reachable at all.
 *   full_board: true walks every posting in the location once, unsearched,
 *            and ignores queries/teams. Complete by construction, with the
 *            scanner's title_filter doing the selection: Apple's text search
 *            also matches job descriptions ("business operations" returns
 *            about half the US board), so search axes can cost more requests
 *            than the whole board and still stop at the page cap.
 *
 * scan.mjs's title_filter still does the actual role selection; this source
 * only supplies candidates.
 */
import { fetchTextWithRetry } from '../http-json.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';
import { markTruncated } from '../board-truncation.mjs';

const ALLOWED_HOST = 'jobs.apple.com';
const BASE = 'https://jobs.apple.com';
const PAGE_SIZE = 20;

const DEFAULT_LOCATION = 'united-states-USA';
// `max_pages` on the ENTRY (not inside the `apple:` block), with a hard
// ceiling so one portals.yml line cannot turn into an unbounded walk.
const DEFAULT_MAX_PAGES = 2;
const MAX_PAGES_CAP = 50; // 50 pages x 20 rows x (queries + teams) is already generous
// CAR-268 parity (upstream #6634, PR #6638) — `apple.full_board` is ONE walk
// of the whole location, so it gets its own ceiling, and that ceiling is also
// its default: 300 x 20 rows = 6,000 postings, room for Apple's whole US
// board (4,606 on 2026-11-06, measured upstream). The walk still stops at
// Apple's own total, so a smaller board costs fewer requests.
const FULL_BOARD_MAX_PAGES_CAP = 300;

// Pages after the first are paced, and every page fetch is retried through
// the shared helper (429/5xx/transport only, backoff + jitter).
const INTER_PAGE_DELAY_MS = 200;

/** Resolve the page cap: a positive integer `max_pages` on the entry, capped.
 *  A full-board walk gets its own (larger) default and ceiling. */
export function resolveMaxPages(entry, { fullBoard = false } = {}) {
  const cap = fullBoard ? FULL_BOARD_MAX_PAGES_CAP : MAX_PAGES_CAP;
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, cap);
  return fullBoard ? FULL_BOARD_MAX_PAGES_CAP : DEFAULT_MAX_PAGES;
}

// Matches the escaped JSON string argument, honouring backslash escapes so an
// embedded \" inside the blob can't terminate the capture early.
const HYDRATION_RE = /window\.__staticRouterHydrationData\s*=\s*JSON\.parse\("((?:\\.|[^"\\])*)"\)/;

/** @param {string} url */
export function assertAppleUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error(`apple: invalid URL: ${url}`); }
  if (parsed.protocol !== 'https:') throw new Error(`apple: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== ALLOWED_HOST) throw new Error(`apple: untrusted hostname "${parsed.hostname}" — must be ${ALLOWED_HOST}`);
  return url;
}

/**
 * Pull loaderData.search out of the SSR hydration blob.
 * @param {string} html
 * @returns {{ searchResults?: unknown, totalRecords?: number } | null}
 */
export function parseHydration(html) {
  const m = HYDRATION_RE.exec(html || '');
  if (!m) return null;
  try {
    // The blob is a JSON string literal inside JSON.parse("..."), so it needs
    // unescaping (pass 1) before it parses as JSON (pass 2).
    const data = JSON.parse(JSON.parse(`"${m[1]}"`));
    return data?.loaderData?.search ?? null;
  } catch {
    return null;
  }
}

/**
 * A city arrives as a bare `Cupertino` with `countryName` beside it, and a
 * location filter that names a country has only this string to match
 * (CAR-255 parity, upstream #6452). Level 1 entries are the country already,
 * in a shorter spelling: `United States` against `United States of America`.
 * @param {any} l
 */
function placeOf(l) {
  const name = l?.name;
  const country = l?.countryName;
  // Only two strings are joined. Anything else passes through as it did
  // before the join, where name.includes() would throw and fail the page.
  if (typeof name !== 'string' || typeof country !== 'string') return name;
  return name && country && l.level !== 1 && !name.includes(country) ? `${name}, ${country}` : name;
}

/** @param {any} r */
function locationOf(r) {
  const names = (Array.isArray(r.locations) ? r.locations : [])
    .map(placeOf)
    .filter(Boolean);
  const uniq = [...new Set(names)];
  if (uniq.length) return uniq.join('; ');
  return r.isMultiLocation ? 'Various Locations within United States' : '';
}

/**
 * Every segment comes from Apple's hydration payload, so every segment is
 * encoded: a raw "/", "?" or "#" in transformedPostingTitle would restructure
 * the URL, and a lone surrogate makes encodeURIComponent throw mid-board
 * (#4078). null drops that one posting, never the board.
 *
 * @param {any} r
 * @returns {string|null}
 */
function urlOf(r) {
  const id = safeEncodeURIComponent(r.id);
  const slug = safeEncodeURIComponent(r.transformedPostingTitle || 'role');
  const team = r.team?.teamCode ? safeEncodeURIComponent(r.team.teamCode) : '';
  if (id === null || slug === null || team === null) return null;
  return `${BASE}/en-us/details/${id}/${slug}${team ? `?team=${team}` : ''}`;
}

// Each search row carries a `type`, "REQ" or "PIPE". It is only in the
// hydration data, not in the visible job text, and the posting does not say
// what PIPE means, so the note claims no more than the label. It is a hint on
// the pipeline entry; nothing is filtered on it. (#6196) web-ui job shape has
// no `note` field, so the hint rides in the snippet.
const PIPE_NOTE = 'Apple labels this posting PIPE: it may be a talent pipeline, not a specific opening';

/** @param {any} r @param {string} company @returns {object|null} */
function toJob(r, company) {
  const url = urlOf(r);
  if (!url) return null;
  const posted = Date.parse(r.postDateInGMT || '');
  const date = Number.isNaN(posted) ? '' : new Date(posted).toISOString().slice(0, 10);
  const snippet = r.type === 'PIPE' ? PIPE_NOTE : '';
  return {
    id: `apple-${String(r.id)}`,
    title: String(r.postingTitle || '').trim(),
    company,
    url,
    salary: '',
    location: locationOf(r),
    isRemote: /remote/i.test(locationOf(r)),
    workplaceType: /remote/i.test(locationOf(r)) ? 'Remote' : '',
    relocates: false,
    date,
    snippet,
    source: 'apple',
  };
}

/**
 * One search page, empty-vs-broken split: a present-and-empty `searchResults`
 * array is a real "no matches" and yields no jobs; a missing blob, or a
 * `searchResults` that is absent or not an array, is a changed page shape and
 * throws. Read as zero, it would hide a dead provider forever.
 *
 * @param {string} html
 * @param {string} url  the page fetched, named in the error
 * @param {string} company
 * @returns {{ jobs: object[], rowCount: number, total: number }}
 */
export function parseSearchPage(html, url, company) {
  const search = parseHydration(html);
  if (!search) {
    throw new Error(`apple: no hydration blob in ${url} — Apple's SSR markup changed, or the page was not the search route`);
  }
  const rows = search.searchResults;
  if (!Array.isArray(rows)) {
    throw new Error(`apple: loaderData.search.searchResults in ${url} is ${rows === undefined ? 'missing' : `a ${rows === null ? 'null' : typeof rows}`}, not an array — Apple's search payload changed`);
  }
  const jobs = [];
  for (const r of rows) {
    if (!r?.postingTitle || !r?.id) continue;
    const job = toJob(r, company);
    if (job) jobs.push(job);
  }
  return { jobs, rowCount: rows.length, total: Number(search.totalRecords) || 0 };
}

/** @param {Record<string, string>} params */
function searchUrl(params) {
  const qs = new URLSearchParams(params).toString();
  return `${BASE}/en-us/search?${qs}`;
}

export const meta = {
  value: 'apple',
  label: 'Apple',
  region: 'en',
};

/**
 * Fetch + normalize Apple careers postings.
 * @param {string} apiUrl base endpoint (from buildEndpoint — the careers_url)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchApple(apiUrl = `${BASE}/en-us/search`, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertAppleUrl(apiUrl);
  const cfg = company.apple || {};
  const location = cfg.location || DEFAULT_LOCATION;
  const list = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
  const queries = list(cfg.queries);
  const teams = list(cfg.teams);
  // CAR-268 parity (upstream #6634, PR #6638) — `full_board: true` walks every
  // posting in the location once, unsearched, ignoring queries/teams. Apple's
  // text search also matches job DESCRIPTIONS, so a few broad queries can cost
  // more requests than the whole board while still stopping at a page cap; one
  // unsearched walk is complete by definition and leaves the precise cut to
  // the scanner's title_filter.
  const fullBoard = cfg.full_board === true;
  if (!fullBoard && !queries.length && !teams.length) {
    throw new Error(`apple: entry "${company.name || 'Apple'}" needs apple.full_board: true or a non-empty apple.queries or apple.teams list `
      + '(e.g. apple: { queries: ["business operations"] }) — there is no default search');
  }
  const maxPages = resolveMaxPages(company, { fullBoard });
  // Test seam; the default honors the abort signal while pacing between pages.
  const sleep = opts.sleep || ((ms) => new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason ?? new Error('aborted')); }, { once: true });
  }));
  /** @type {Record<string,string>[]} */
  const axes = fullBoard
    ? [{ location }]
    : [
        ...queries.map((q) => ({ search: q, location, sort: 'relevance' })),
        ...teams.map((t) => ({ location, team: t })),
      ];

  /** @type {Map<string, object>} */
  const byUrl = new Map();
  let truncated = false;

  /** Page through one search axis, stopping early on the last page. */
  const harvest = async (/** @type {Record<string,string>} */ base) => {
    for (let page = 1; page <= maxPages; page++) {
      const url = searchUrl({ ...base, page: String(page) });
      assertAppleUrl(url);
      if (page > 1) await sleep(INTER_PAGE_DELAY_MS);
      let html;
      try {
        html = await fetchTextWithRetry(fetchImpl, url, { redirect: 'error', signal });
      } catch (err) {
        // Recall-first during a scan: keep the axes already collected rather
        // than losing the whole board to one bad search.
        return;
      }
      // Throws on a changed page shape rather than returning what we have: a
      // silent 0 reads as "no matching roles" forever.
      const { jobs, rowCount, total } = parseSearchPage(html, url, String(company.name || 'Apple'));
      for (const job of jobs) if (!byUrl.has(job.url)) byUrl.set(job.url, job);
      if (rowCount < PAGE_SIZE || page * PAGE_SIZE >= total) return;
      if (page === maxPages) truncated = true;
    }
  };

  for (const axis of axes) await harvest(axis);
  if (truncated) {
    console.error(`⚠️  apple: ${company.name || 'Apple'} hit the ${maxPages}-page cap on at least one search — raise max_pages on this entry for more`);
  }

  const result = [...byUrl.values()];
  // CAR-255 parity (upstream, delta b859214b..24da28e8) — the canonical
  // partial-read signal (board-truncation.mjs): the scan reports this board
  // `partial` instead of presenting the cap-cut prefix as the whole one.
  if (truncated) markTruncated(result, 'page-cap', { fetched: result.length });
  return result;
}
