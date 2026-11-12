// @ts-check
/**
 * Amazon / AWS source — the public amazon.jobs search JSON API
 *   GET https://www.amazon.jobs/en/search.json?base_query=&loc_query=&result_limit=100&offset=0
 *
 * Implements the web-ui source
 * contract (rich job objects + `meta` for auto-discovery). Public, zero-auth
 * JSON. The board is enormous (100k+ postings), so a per-company `amazon:` config
 * block (loc_query / base_query / category …) narrows it; keys pass through as
 * query params. `result_limit` is fixed at 100 (the API's hard per-page max) and
 * pagination walks `offset`.
 *
 * Host-pinned to www.amazon.jobs; every fetch uses `redirect:'error'` (SSRF-safe).
 * Used by the amazon adapter (server/lib/portals/adapters/amazon.mjs).
 */
import { fetchJson } from '../http-json.mjs';
import { markTruncated } from '../board-truncation.mjs';
import { requireContainer, requireArray } from './_shape.mjs';

export const ORIGIN = 'https://www.amazon.jobs';
export const FEED_BASE = `${ORIGIN}/en/search.json`;
const TRUSTED_HOST = 'www.amazon.jobs';
const PAGE_SIZE = 100; // amazon.jobs caps result_limit at 100
const MAX_PAGES = 20; // cap while the total is unknown — 2000 postings
const HARD_MAX_PAGES = 100; // absolute ceiling for a hits-bounded walk — 10,000 postings

export const meta = {
  value: 'amazon',
  label: 'Amazon',
  region: 'en',
};

/**
 * Defence-in-depth host check on the endpoint built by the adapter.
 * Accepts www.amazon.jobs (the search host) and, for a normalized job_path
 * that is already absolute, any *.amazon.jobs host.
 */
export function assertAmazonUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`amazon: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`amazon: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`amazon: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/**
 * amazon.jobs posted_date reads "July  3, 2026" (note the padded day); Date.parse
 * handles it once whitespace is collapsed. (updated_time is a relative string like
 * "10 minutes" / "about 1 hour" — unparseable, skipped.) Returns '' when absent.
 */
function toIsoDate(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const parsed = Date.parse(raw.replace(/\s+/g, ' ').trim());
  if (Number.isNaN(parsed)) return '';
  // Date.parse reads "July 3, 2026" in the process's LOCAL zone, so east of
  // UTC toISOString() shifted the calendar day back by one (off-by-one, #56).
  // Re-stamp the local Y/M/D the string named at UTC midnight (Date.UTC) — the
  // emitted YYYY-MM-DD is then the printed date in every timezone.
  const d = new Date(parsed);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

/** Resolve a job_path (relative or absolute) to an absolute https amazon.jobs URL, or '' if bad. */
function resolveJobUrl(path) {
  if (!path || typeof path !== 'string') return '';
  const raw = /^https?:\/\//i.test(path)
    ? path
    : ORIGIN + (path.startsWith('/') ? path : `/${path}`);
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    const host = parsed.hostname.toLowerCase();
    if (host !== TRUSTED_HOST && !host.endsWith('.amazon.jobs')) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

/**
 * Normalize a single amazon.jobs posting into the web-ui job shape.
 * Exported for tests. Returns null for rows without a title or a usable
 * https amazon.jobs URL (the dedup key).
 * @param {any} raw
 * @param {string} [fallbackCompany]
 */
export function normalizeAmazonJob(raw, fallbackCompany = 'Amazon') {
  if (!raw || typeof raw !== 'object') return null;

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;

  const url = resolveJobUrl(raw.job_path);
  if (!url) return null;

  const company = (typeof raw.company_name === 'string' && raw.company_name.trim())
    ? raw.company_name.trim()
    : ((typeof fallbackCompany === 'string' && fallbackCompany.trim()) ? fallbackCompany.trim() : 'Amazon');

  const locRaw = raw.normalized_location || raw.location || '';
  const location = typeof locRaw === 'string' ? locRaw.trim() : '';

  // amazon.jobs marks remote roles via is_remote / a "Virtual" location token.
  const isRemote = raw.is_remote === true
    || /\bvirtual\b/i.test(location);

  return {
    id: `amazon-${url}`,
    title,
    company,
    url,
    salary: '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : '',
    relocates: false,
    date: toIsoDate(raw.posted_date),
    snippet: '',
    source: 'amazon',
  };
}

/**
 * Fetch + normalize the amazon.jobs search feed (paginated via offset).
 * MAX_PAGES caps a walk only while the total is unknown. The API reports
 * `hits` for the filtered query, and once page 0 answers, that total sizes
 * the page budget (one page past it, up to HARD_MAX_PAGES). It never proves
 * the walk complete: only an empty page, a short page or a page with no new
 * ids ends the board, so a `hits` that understates the result set leaves a
 * full last page, which is reported partial. A whole-region board such as
 * CA+NY (3,171 postings, 2026-11-07) is then read in full instead of being
 * sliced by keyword queries that miss titles. A health probe (opts.maxPages)
 * reads its budget and is never a truncation; a later-page failure keeps the
 * partials and is marked fetch-error.
 *
 * @param {string} feedBase base search URL (host-pinned to www.amazon.jobs; may carry query params)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           maxPages?: number }} [opts]
 */
export async function fetchAmazon(feedBase = FEED_BASE, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertAmazonUrl(feedBase);
  const fallbackCompany = (company && typeof company.name === 'string') ? company.name : 'Amazon';

  const base = new URL(feedBase);
  // Sensible defaults the API needs; a caller-supplied value wins.
  if (!base.searchParams.has('base_query')) base.searchParams.set('base_query', '');
  if (!base.searchParams.has('loc_query')) base.searchParams.set('loc_query', '');
  if (!base.searchParams.has('sort')) base.searchParams.set('sort', 'recent');

  const out = [];
  const seen = new Set();
  const probe = Number(opts.maxPages);
  let maxPages = probe > 0 ? Math.min(MAX_PAGES, probe) : MAX_PAGES;
  let total = null;
  // Set only by a natural end of the board (empty page, a loop, a short page)
  // or by a later-page failure — a cap stop leaves it false.
  let ended = false;
  let failed = false;
  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(base.href);
    url.searchParams.set('result_limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(page * PAGE_SIZE));
    // Phase-2: a 200 without the documented {jobs:[...]} envelope is a shape
    // change — loud on page 1; a later-page failure (HTTP or shape) keeps the
    // partials and logs instead of discarding what was already collected.
    let json;
    try {
      json = await fetchJson(fetchImpl, url.href, { signal, redirect: 'error' });
      requireContainer(json, 'Amazon search', 'jobs');
      requireArray(json.jobs, 'Amazon search jobs');
    } catch (err) {
      if (page === 0) throw err;
      console.error(`  ⚠ amazon: page ${page + 1} failed (${err.message}) — keeping the ${out.length} jobs collected so far`);
      ended = true;
      failed = true;
      break;
    }
    if (total === null && Number.isInteger(json.hits)) {
      total = json.hits;
      // One page past the reported hits, up to the ceiling: `hits` never proves
      // the walk complete, so the budget overshoots by a page to observe the end.
      if (!(probe > 0)) maxPages = Math.max(maxPages, Math.min(Math.ceil(total / PAGE_SIZE) + 1, HARD_MAX_PAGES));
    }
    const postings = json.jobs;
    if (postings.length === 0) { ended = true; break; }

    let fresh = 0;
    for (const posting of postings) {
      const normalized = normalizeAmazonJob(posting, fallbackCompany);
      if (!normalized) continue;
      if (seen.has(normalized.url)) continue; // API ignored offset / looped
      seen.add(normalized.url);
      fresh += 1;
      out.push(normalized);
    }
    if (fresh === 0) { ended = true; break; } // API ignored offset / looped
    if (postings.length < PAGE_SIZE) { ended = true; break; } // last page
  }
  if (!(probe > 0) && !ended) {
    console.error(`⚠️  amazon: ${fallbackCompany} stopped at ${maxPages} pages (${out.length}${total === null ? '' : ` of ${total}`} jobs) — the board is partial`);
    markTruncated(out, 'page-cap', { fetched: out.length, ...(total === null ? {} : { total }) });
  } else if (!(probe > 0) && failed) {
    markTruncated(out, 'fetch-error', { fetched: out.length });
  }
  return out;
}
