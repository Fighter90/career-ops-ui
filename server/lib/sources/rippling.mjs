// @ts-check
/**
 * Rippling source — the tenant's public v2 board JSON API (parent #4353 parity).
 *
 * Detection: careers_url host is `ats.rippling.com`; the slug is the first
 * path segment (e.g. `https://ats.rippling.com/acme-jobs/jobs` → `acme-jobs`).
 *
 * Board API — same origin as the careers pages (the old
 * `api.rippling.com/platform/api/ats/v1/board/<slug>/jobs` host is retired):
 *   GET https://ats.rippling.com/api/v2/board/<slug>/jobs?page=<n>&pageSize=1000
 * Response: `{ items: [...], page, pageSize, totalItems, totalPages }`, each item
 *   `{ id, name, url, department: { name }, locations: [{ name, ... }], language }`.
 *
 * pageSize 1000 (the client's own cap) returns any realistic board in one
 * request; the walk still paginates for the rare larger tenant, bounded by its
 * own page ceiling (`max_pages`, never the source's `totalPages` alone).
 *
 * Used by the rippling adapter (server/lib/portals/adapters/rippling.mjs).
 */
import { fetchJsonWithRetry, delay } from '../http-json.mjs';

const UA = 'Mozilla/5.0 (compatible; career-ops/1.3)';

export const RIPPLING_CAREERS_HOST_RE = /(^|\.)ats\.rippling\.com$/i;
/** The board API is same-origin with the careers pages. */
export const RIPPLING_API_HOST = 'ats.rippling.com';
export const API_BASE = 'https://ats.rippling.com/api/v2/board';

/** Largest pageSize the client requests. */
export const PAGE_SIZE = 1000;
// Page ceiling independent of `totalPages`: 10 × 1000 = 10,000 postings is
// already implausible for one company; MAX_PAGES_CAP bounds an explicit override.
export const DEFAULT_MAX_PAGES = 10;
const MAX_PAGES_CAP = 50;
const INTER_PAGE_DELAY_MS = 200;
const RETRIES = 2;

export const meta = { value: 'rippling', label: 'Rippling', region: 'en' };

/**
 * Extract the tenant slug from a Rippling careers URL.
 * Accepts `https://ats.rippling.com/<slug>/jobs` or `https://ats.rippling.com/<slug>`.
 * Returns the slug string, or null when the URL is not a valid Rippling careers URL.
 *
 * @param {string} raw
 * @returns {string|null}
 */
// Parent parity: an unsafe or empty first segment never becomes a slug.
const SLUG_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;

export function ripplingSlugFromCareersUrl(raw) {
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (!RIPPLING_CAREERS_HOST_RE.test(u.hostname)) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  // The v2 board API shares this host, so a pasted API URL
  // (`/api/v2/board/<slug>/jobs`) must yield <slug>, not `api`.
  const segment = (parts[0] === 'api' ? (parts[1] === 'v2' && parts[2] === 'board' ? parts[3] : '') : parts[0]) || '';
  return SLUG_RE.test(segment) ? segment : null;
}

/**
 * Build one page's board API URL for a validated slug.
 * @param {string} slug
 * @param {number} [page]
 * @returns {string}
 */
export function buildRipplingEndpoint(slug, page = 0) {
  const u = new URL(`${API_BASE}/${encodeURIComponent(slug)}/jobs`);
  u.searchParams.set('page', String(page));
  u.searchParams.set('pageSize', String(PAGE_SIZE));
  return u.href;
}

/**
 * Defence-in-depth: assert the endpoint is an ats.rippling.com HTTPS URL.
 * @param {string} url
 */
function assertRipplingApiUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`rippling: invalid URL: ${url}`);
  }
  if (u.protocol !== 'https:') throw new Error(`rippling: URL must use HTTPS: ${url}`);
  if (u.hostname !== RIPPLING_API_HOST) {
    throw new Error(`rippling: untrusted hostname "${u.hostname}" — must be ${RIPPLING_API_HOST}`);
  }
}

function toIsoDate(value) {
  if (!value) return '';
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10);
}

const REMOTE_RE = /remote|anywhere|distributed|home\s*office/i;

/**
 * Normalize one raw v2 board item into the 12-field web-ui job shape.
 * Postings without a title, or whose url is not an absolute https URL on
 * ats.rippling.com (Rippling always serves postings there), are dropped.
 * @param {any} j raw posting object
 * @param {string} companyName
 */
function normalize(j, companyName) {
  const title = (typeof j?.name === 'string' ? j.name : typeof j?.title === 'string' ? j.title : '').trim();
  if (!title) return null;

  // URL: absolute https, host-locked; display-only, never server-fetched here.
  let url = '';
  const rawUrl = typeof j?.url === 'string' ? j.url.trim() : '';
  if (rawUrl) {
    try {
      const p = new URL(rawUrl);
      if (p.protocol === 'https:' && p.hostname === RIPPLING_API_HOST) url = p.href;
    } catch { /* drop */ }
  }
  if (!url) return null;

  // Location: every `locations[].name`, joined (a posting can list several places).
  const locs = Array.isArray(j?.locations) ? j.locations : [];
  const location = locs
    .map((l) => (l && typeof l.name === 'string' ? l.name.trim() : ''))
    .filter(Boolean)
    .join(' · ');

  const isRemote = REMOTE_RE.test(location) || REMOTE_RE.test(title);

  const company =
    typeof j?.company === 'string' && j.company.trim() ? j.company.trim() : companyName;

  const rawId = j?.id || j?.uuid || '';
  const id = `rippling-${rawId || url}`;

  const date = toIsoDate(j?.created || j?.published || j?.created_at || '');

  return {
    id,
    title,
    url,
    company,
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : 'Onsite',
    salary: '',
    date,
    snippet: '',
    relocates: false,
    source: 'rippling',
  };
}

/**
 * Parse one page of the v2 board response. Exported for unit tests.
 * A present-and-empty `items: []` is an empty board; any other envelope throws
 * a descriptive error instead of silently reading as "0 jobs forever".
 * @param {any} json
 * @param {string} companyName
 * @returns {{ jobs: object[], rawCount: number }}
 */
export function parseRipplingPage(json, companyName) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.items)) {
    const got = json && typeof json === 'object' ? Object.keys(json).join(', ') : typeof json;
    throw new Error(`rippling: unexpected response — expected items[], got: [${got}]`);
  }
  const jobs = json.items.map((j) => normalize(j, companyName)).filter(Boolean);
  return { jobs, rawCount: json.items.length };
}

/** Resolve the page cap: a positive integer `max_pages` on the entry, capped. */
function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * Fetch + normalize a Rippling tenant's board, walking pages until a short page
 * (the source's raw row count < PAGE_SIZE) or the page ceiling. A failure on
 * page 0 throws (a dead board must read as a failure); a later page's failure
 * keeps what was collected. `opts.maxPages` (health probe) caps the walk too.
 *
 * @param {string} endpoint  `https://ats.rippling.com/api/v2/board/<slug>/jobs?page=0&pageSize=1000`
 * @param {{ fetchImpl?: typeof fetch, signal?: AbortSignal, company?: any,
 *           maxPages?: number, retryDelayMs?: number, interPageDelayMs?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchRippling(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertRipplingApiUrl(endpoint);

  // Path: /api/v2/board/<slug>/jobs
  const segs = new URL(endpoint).pathname.split('/').filter(Boolean);
  if (segs[0] !== 'api' || segs[1] !== 'v2' || segs[2] !== 'board' || !segs[3] || segs[4] !== 'jobs') {
    throw new Error(`rippling: not a v2 board endpoint: ${endpoint}`);
  }
  const slug = decodeURIComponent(segs[3]);
  const companyName =
    (typeof company?.name === 'string' && company.name.trim()) ||
    slug.charAt(0).toUpperCase() + slug.slice(1);

  const maxPages = resolveMaxPages(company);
  const probeCap = Number.isInteger(opts.maxPages) && opts.maxPages > 0 ? opts.maxPages : Infinity;
  const pagesToFetch = Math.min(maxPages, probeCap);
  const interPageDelayMs = opts.interPageDelayMs ?? INTER_PAGE_DELAY_MS;

  const jobs = [];
  let page = 0;
  let stoppedOnError = false;
  for (; page < pagesToFetch; page++) {
    if (page > 0) await delay(interPageDelayMs, signal);
    const url = buildRipplingEndpoint(slug, page);
    assertRipplingApiUrl(url);

    let json;
    try {
      json = await fetchJsonWithRetry(fetchImpl, url, {
        signal,
        redirect: 'error',
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        retries: RETRIES,
        ...(opts.retryDelayMs !== undefined ? { retryDelayMs: opts.retryDelayMs } : {}),
      });
    } catch (err) {
      if (page === 0) throw err;
      console.error(`  ⚠ rippling: ${companyName} truncated at page ${page + 1} of ${pagesToFetch} (${jobs.length} jobs): ${err.message}`);
      stoppedOnError = true;
      break;
    }

    const { jobs: pageJobs, rawCount } = parseRipplingPage(json, companyName);
    jobs.push(...pageJobs);
    // Natural end — break WITHOUT incrementing, so a short page that is also
    // the last allowed page is not misreported as a cap stop below.
    if (rawCount < PAGE_SIZE) break;
  }

  // Only a healthy walk that exhausted its OWN max_pages budget is a cap stop —
  // never a probe cap and never a fetch-error stop.
  if (!stoppedOnError && page === pagesToFetch && pagesToFetch === maxPages) {
    console.error(`  ⚠ rippling: ${companyName} truncated at max_pages=${maxPages} (${jobs.length} jobs) — raise max_pages on this entry for more`);
  }

  return jobs;
}
