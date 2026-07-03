// @ts-check
/**
 * Amazon / AWS source — the public amazon.jobs search JSON API
 *   GET https://www.amazon.jobs/en/search.json?base_query=&loc_query=&result_limit=100&offset=0
 *
 * Ported from parent career-ops `providers/amazon.mjs` into the web-ui source
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

export const ORIGIN = 'https://www.amazon.jobs';
export const FEED_BASE = `${ORIGIN}/en/search.json`;
const TRUSTED_HOST = 'www.amazon.jobs';
const PAGE_SIZE = 100; // amazon.jobs caps result_limit at 100
const MAX_PAGES = 20; // safety cap — at most 2000 postings per entry

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
  const d = new Date(parsed);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
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
 * @param {string} feedBase base search URL (host-pinned to www.amazon.jobs; may carry query params)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
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
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(base.href);
    url.searchParams.set('result_limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(page * PAGE_SIZE));
    const json = await fetchJson(fetchImpl, url.href, { signal, redirect: 'error' });
    const postings = Array.isArray(json && json.jobs) ? json.jobs : [];
    if (postings.length === 0) break;

    let fresh = 0;
    for (const posting of postings) {
      const normalized = normalizeAmazonJob(posting, fallbackCompany);
      if (!normalized) continue;
      if (seen.has(normalized.url)) continue; // API ignored offset / looped
      seen.add(normalized.url);
      fresh += 1;
      out.push(normalized);
    }
    if (fresh === 0) break; // API ignored offset / looped
    if (postings.length < PAGE_SIZE) break; // last page
  }
  return out;
}
