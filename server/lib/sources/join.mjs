// @ts-check
/**
 * JOIN (join.com) source — reads a tenant's jobs from the Next.js
 * `__NEXT_DATA__` JSON blob embedded in the SSR-rendered careers-page HTML.
 * No API key needed — the board is server-rendered into the page.
 *
 * Implements the web-ui source
 * contract (rich job objects + `meta` for auto-discovery). join.com hosts one
 * board per company at https://join.com/companies/<slug>, so a tracked entry is
 * auto-detected from a join.com careers_url (mirrored by the adapter's
 * `matches`). Per-entry config (max_pages) is read from `opts.company`, like
 * the tencent source.
 *
 * Host-pinned + `redirect:'error'` (SSRF-safe): the base URL is ALWAYS rebuilt
 * as https://join.com/companies/<slug> from the extracted slug, so the host is
 * pinned to join.com regardless of what the original careers_url carried.
 *
 * Dead-board contract (parity with the successfactors/tencent `succeededOnce`
 * idiom): the FIRST page fetch/parse failing (nothing resolved) THROWS, so
 * scan/portal-health record a real failure rather than mistaking a scraper
 * break for a genuinely empty board. A LATER page failing after page 1 already
 * succeeded keeps the partials already collected (break, don't throw) — a
 * transient page-N blip must not discard scraped jobs nor quarantine a live
 * board as permanently dead.
 *
 * Used by the join adapter (server/lib/portals/adapters/join.mjs).
 */
import { fetchText } from '../http-json.mjs';

export const meta = {
  value: 'join',
  label: 'JOIN',
  region: 'en',
};

// Safety cap on pagination — applied regardless of what the page's own
// __NEXT_DATA__ reports as pagination.pageCount, so a board that grows (or a
// payload that reports a wrong pageCount) can't drive this into an unbounded
// fetch loop. Every known tenant is a single company's careers page, so 50
// pages is generous headroom; override with `max_pages` on the portal entry.
const DEFAULT_MAX_PAGES = 50;
// Hard ceiling even for an explicit override.
const MAX_PAGES_CAP = 200;

/**
 * Resolve the page cap: a positive integer `max_pages` on the portal entry,
 * clamped at MAX_PAGES_CAP; else the default.
 * @param {any} [company] the portal entry (opts.company)
 * @returns {number}
 */
function resolveMaxPages(company) {
  const v = company?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * Extract the company slug from a join.com careers_url. Anchored to the literal
 * `join.com` host (exact match, not a suffix) and the `/companies/<slug>` path,
 * so spoofed hosts (`join.com.evil.com`, `evil.com/join.com/...`) return null.
 * Returns null for invalid/missing input. Exported for tests + the adapter.
 * @param {unknown} url
 * @returns {string|null}
 */
export function extractSlug(url) {
  let parsed;
  try {
    parsed = new URL(String(url ?? ''));
  } catch {
    return null;
  }
  if (parsed.hostname.toLowerCase() !== 'join.com') return null;
  const match = parsed.pathname.match(/^\/companies\/([^/?#]+)/);
  return match?.[1] || null;
}

/**
 * Pull and parse the `__NEXT_DATA__` JSON blob out of a page's HTML. Returns
 * the parsed object, or null when the script tag is absent, the JSON is
 * malformed, or the input is not a string (never throws). Exported for tests.
 * @param {unknown} html
 * @returns {any|null}
 */
export function extractNextData(html) {
  if (typeof html !== 'string') return null;
  const match = html.match(/<script[^>]+__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/** Resolve the SSR-embedded page state, or null. */
function extractInitialState(html) {
  return extractNextData(html)?.props?.pageProps?.initialState || null;
}

/**
 * Normalize one join.com job item into the web-ui rich job shape, or null when
 * it is not ingestible (no `idParam` — the url/id both depend on it, and url is
 * the dedup key). Exported for tests.
 *
 * Field mapping (title/url/company/location) fills the remaining web-ui fields
 * the same way manfred.mjs does:
 *   - date is always '' (the list item carries no reliable publication date).
 *   - relocates is derived from a visa/relocation/sponsorship hit on the title.
 *   - isRemote/workplaceType are derived from the location signal (join's list
 *     item exposes the city, not a percentage), using the same Remote/'' vocab.
 *
 * @param {any} j a single `jobs.items[]` entry
 * @param {{ company?: string, companySlug: string }} ctx
 *   company — the tracked entry name (scanner backfills a blank one);
 *   companySlug — `state.company.domain || slug`, pins every emitted url.
 * @returns {object|null}
 */
export function normalizeJoinJob(j, { company = '', companySlug } = {}) {
  if (!j || typeof j !== 'object') return null;
  const idParam = j.idParam != null && j.idParam !== '' ? String(j.idParam) : '';
  if (!idParam) return null;

  const title = typeof j.title === 'string' ? j.title : '';
  const location = j.city?.cityName || '';
  const isRemote = /remote/i.test(location);

  return {
    id: `join-${idParam}`,
    title,
    company,
    url: `https://join.com/companies/${companySlug}/jobs/${idParam}`,
    salary: '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : '',
    relocates: /visa|relocation|sponsorship/i.test(title),
    date: '', // the list item carries no reliable publication date
    snippet: '',
    source: 'join',
  };
}

/**
 * Fetch + normalize a join.com tenant board, paginating via `?page=N`.
 *
 * @param {string} endpoint the tracked careers_url (any join.com/companies/<slug>
 *   URL — the slug is re-extracted and the base is rebuilt host-pinned)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchJoin(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;

  const slug = extractSlug(endpoint);
  if (!slug) throw new Error('join: cannot extract slug from the endpoint');

  const baseUrl = `https://join.com/companies/${slug}`;
  const companyName =
    company && typeof company.name === 'string' && company.name.trim()
      ? company.name.trim()
      : '';
  const maxPages = resolveMaxPages(company);

  // --- First page: nothing has succeeded yet, so a fetch OR parse failure
  //     THROWS (dead-board contract). fetchText throws on a non-2xx; a
  //     missing/garbage __NEXT_DATA__ is turned into a throw here.
  const firstHtml = await fetchText(fetchImpl, baseUrl, { signal, redirect: 'error' });
  const firstState = extractInitialState(firstHtml);
  const firstItems = firstState?.jobs?.items;
  if (!firstState || !Array.isArray(firstItems)) {
    throw new Error('join: __NEXT_DATA__ not found or unexpected structure');
  }

  // The tenant domain (falls back to the URL slug) pins every emitted job url
  // and is fixed by the first page for the whole crawl.
  const companySlug = firstState.company?.domain || slug;

  const out = [];
  const seen = new Set();
  const addJob = (j) => {
    const job = normalizeJoinJob(j, { company: companyName, companySlug });
    if (job && !seen.has(job.url)) {
      seen.add(job.url);
      out.push(job);
    }
  };
  for (const j of firstItems) addJob(j);

  // --- Later pages: page 1 already succeeded, so a fetch OR parse failure
  //     keeps the partials already collected (break, don't throw) — a
  //     transient page-N blip must not discard scraped jobs (successfactors
  //     succeededOnce idiom).
  const reportedPageCount = Number(firstState.jobs?.pagination?.pageCount) || 0;
  const pageCount = Math.min(reportedPageCount, maxPages);
  for (let page = 2; page <= pageCount; page += 1) {
    let html;
    try {
      html = await fetchText(fetchImpl, `${baseUrl}?page=${page}`, { signal, redirect: 'error' });
    } catch {
      break; // keep partials
    }
    const state = extractInitialState(html);
    const items = state?.jobs?.items;
    if (!state || !Array.isArray(items)) break; // keep partials
    for (const j of items) addJob(j);
  }

  if (pageCount === maxPages && reportedPageCount > maxPages) {
    console.error(
      `⚠️  join: ${companyName || slug} truncated at max_pages=${maxPages} of ${reportedPageCount} reported pages — raise max_pages on this entry for more`,
    );
  }

  return out;
}
