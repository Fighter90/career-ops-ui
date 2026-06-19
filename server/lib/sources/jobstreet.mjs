/**
 * Jobstreet / SEEK source — hits the public chalice-search JSON API.
 * Jobstreet (jobstreet.com, jobstreet.co.id, …) and SEEK (seek.com.au,
 * seek.co.nz) share the same SEEK infrastructure and expose a no-auth JSON
 * search endpoint at /api/chalice-search/v4/search.
 *
 * Ported from parent career-ops v1.12.0 `providers/jobstreet.mjs` into the
 * web-ui source contract. Aggregator, not an ATS — selected only via explicit
 * `provider: jobstreet`. Config comes from the company entry, read via
 * `opts.company`:
 *
 *   tracked_companies:
 *     - name: Jobstreet Indonesia
 *       provider: jobstreet
 *       jobstreet:
 *         siteKey: ID-Main
 *         searchKeywords: "Data Scientist"
 *         searchLocation: "Jakarta"
 *         pageSize: 30
 *         maxPages: 3
 *       enabled: true
 *
 * Used by the jobstreet adapter (server/lib/portals/adapters/jobstreet.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const DEFAULT_API = 'https://id.jobstreet.com/api/chalice-search/v4/search';
const DEFAULT_SITE_KEY = 'ID-Main';
const DEFAULT_PAGE_SIZE = 30;
const DEFAULT_MAX_PAGES = 3;
const REMOTE_RE = /remote|work from home|wfh|anywhere/i;

const ALLOWED_JOBSTREET_HOSTS = new Set([
  'id.jobstreet.com',
  'www.jobstreet.com',
  'www.jobstreet.co.id',
  'jobstreet.com',
  'jobstreet.co.id',
  'sg.jobstreet.com',
  'my.jobstreet.com',
  'www.seek.com.au',
  'www.seek.co.nz',
]);

export const meta = {
  value: 'jobstreet',
  label: 'Jobstreet / SEEK',
  region: 'en',
};

/** tiny stable hash (djb2) → base36. */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/** @param {string} url */
export function assertJobstreetUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`jobstreet: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`jobstreet: URL must use HTTPS: ${url}`);
  if (!ALLOWED_JOBSTREET_HOSTS.has(parsed.hostname)) {
    throw new Error(`jobstreet: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_JOBSTREET_HOSTS].join(', ')}`);
  }
  return url;
}

function deriveBaseUrl(apiUrl) {
  try {
    const parsed = new URL(apiUrl);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return 'https://id.jobstreet.com';
  }
}

function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse one raw chalice-search result into a rich Job. Validates the resolved
 * URL hostname against the Jobstreet/SEEK allowlist. Exported for unit tests.
 * @param {any} item
 * @param {string} baseUrl
 * @param {string} fallbackCompany
 */
export function parseJobstreetItem(item, baseUrl, fallbackCompany) {
  if (!item || typeof item !== 'object') return null;
  const title = (item.title || '').trim();
  if (!title) return null;

  let url = '';
  const rawUrl = item.jobUrl || '';
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') url = parsed.href;
    } catch {
      if (rawUrl.startsWith('/')) url = `${baseUrl}${rawUrl}`;
    }
  }
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (!ALLOWED_JOBSTREET_HOSTS.has(parsed.hostname)) return null;
    url = parsed.href;
  } catch {
    return null;
  }

  const company = (item.branding?.companyName || item.companyName || item.advertiser?.description || fallbackCompany || '').trim();
  const location = (item.location || '').trim();
  const postedAt = toEpochMs(item.listingDate);
  const isRemote = REMOTE_RE.test(`${title} ${location}`);

  return {
    id: `jobstreet-${item.id != null ? String(item.id) : djb2(url)}`,
    title,
    company,
    url,
    salary: typeof item.salary === 'string' ? item.salary.trim() : '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : 'Onsite',
    relocates: false,
    date: postedAt != null ? new Date(postedAt).toISOString() : '',
    snippet: '',
    source: 'jobstreet',
  };
}

function buildSearchUrl(apiUrl, params) {
  const url = new URL(apiUrl);
  const { siteKey, keywords, location, pageSize, page } = params;
  if (siteKey) url.searchParams.set('siteKey', siteKey);
  if (keywords) url.searchParams.set('keywords', keywords);
  if (location) url.searchParams.set('where', location);
  url.searchParams.set('pageSize', String(pageSize || DEFAULT_PAGE_SIZE));
  url.searchParams.set('page', String(page || 1));
  url.searchParams.set('solrFields', 'id,title,location,listingDate,jobUrl,companyName,branding.companyName,advertiser.description,salary');
  return url.href;
}

/**
 * Fetch + normalize Jobstreet/SEEK postings.
 * @param {string} apiUrl base search endpoint (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchJobstreet(apiUrl = DEFAULT_API, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertJobstreetUrl(apiUrl);
  const baseUrl = deriveBaseUrl(apiUrl);
  const cfg = company.jobstreet || {};

  const siteKey = cfg.siteKey || DEFAULT_SITE_KEY;
  const keywords = cfg.searchKeywords || '';
  const searchLocation = cfg.searchLocation || '';
  const pageSize = Number(cfg.pageSize) || DEFAULT_PAGE_SIZE;
  const maxPages = Number(cfg.maxPages) || DEFAULT_MAX_PAGES;
  const fallbackCompany = company.name || '';

  const allJobs = [];

  for (let page = 1; page <= maxPages; page++) {
    const searchUrl = buildSearchUrl(apiUrl, { siteKey, keywords, location: searchLocation, pageSize, page });

    let json;
    try {
      json = await fetchJson(fetchImpl, searchUrl, { signal });
    } catch (err) {
      if (page === 1) throw err;
      break; // later-page failure is non-fatal
    }

    const data = Array.isArray(json?.data) ? json.data : [];
    if (data.length === 0) break;

    for (const item of data) {
      const job = parseJobstreetItem(item, baseUrl, fallbackCompany);
      if (job) allJobs.push(job);
    }

    if (data.length < pageSize) break;
    await new Promise((resolve) => setTimeout(resolve, 200)); // rate-limit courtesy
  }

  return allJobs;
}
