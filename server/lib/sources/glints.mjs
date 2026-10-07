/**
 * Glints source — hits the undocumented public GraphQL endpoint that powers
 * glints.com job search (covers Singapore, Indonesia, Malaysia, Vietnam).
 *
 * Implements the web-ui
 * source contract. Glints is an aggregator, not a company ATS, so it is only
 * selected via an explicit `provider: glints` entry — never auto-detected.
 * Config comes from the company entry, read via `opts.company`:
 *
 *   tracked_companies:
 *     - name: Glints Indonesia
 *       provider: glints
 *       glints:
 *         searchKeywords: "Machine Learning"
 *         countryCode: ID
 *         pageSize: 30
 *         maxPages: 3
 *       enabled: true
 *
 * Used by the glints adapter (server/lib/portals/adapters/glints.mjs).
 */
import { fetchJson, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';

export const DEFAULT_API = 'https://glints.com/api/graphql';
const DEFAULT_COUNTRY = 'ID';
const DEFAULT_PAGE_SIZE = 30;
const DEFAULT_MAX_PAGES = 3;
const REMOTE_RE = /remote|anywhere|work from home|wfh/i;
// Config clamps (v1.242.0): a negative pageSize/maxPages used to flow into
// the GraphQL variables / page loop unchecked (limit: -30, zero iterations →
// an empty board), and an absurd maxPages turned one entry into an unbounded
// request loop against a third party.
const PAGE_SIZE_CAP = 100;
const MAX_PAGES_CAP = 20;
// ECMA-262 max representable Date — toISOString() RangeErrors past it.
const MAX_EPOCH_MS = 8_640_000_000_000_000;

const ALLOWED_GLINTS_HOSTS = new Set(['glints.com', 'www.glints.com', 'glints.id']);

const DEFAULT_GRAPHQL_QUERY = `
query SearchJobs($keywords: String!, $country: String!, $limit: Int!, $offset: Int!) {
  opportunities(
    filters: { keywords: $keywords, countryCode: $country }
    first: $limit
    offset: $offset
  ) {
    data {
      id
      title
      company { name }
      location
      salary { min max currency }
      postedAt
      url
    }
    totalCount
  }
}`;

export const meta = {
  value: 'glints',
  label: 'Glints',
  region: 'en',
};

/** tiny stable hash (djb2) → base36. */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/** @param {string} url */
export function assertGlintsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`glints: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`glints: URL must use HTTPS: ${url}`);
  if (!ALLOWED_GLINTS_HOSTS.has(parsed.hostname)) {
    throw new Error(`glints: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_GLINTS_HOSTS].join(', ')}`);
  }
  return url;
}

function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  // NaN (Invalid Date) and out-of-range values both stay undefined — the
  // date field empties instead of toISOString() throwing RangeError.
  return Number.isNaN(parsed) || parsed <= 0 || parsed > MAX_EPOCH_MS ? undefined : parsed;
}

function deriveBaseUrl(apiUrl) {
  try {
    const parsed = new URL(apiUrl);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return 'https://glints.com';
  }
}

/**
 * Parse one raw GraphQL opportunity into a rich Job. Validates the resolved URL
 * hostname against the Glints allowlist. Exported for unit tests.
 * @param {any} item
 * @param {string} baseUrl
 * @param {string} fallbackCompany
 */
export function parseGlintsItem(item, baseUrl, fallbackCompany) {
  if (!item || typeof item !== 'object') return null;
  const title = (item.title || '').trim();
  if (!title) return null;

  let url = (item.url || '').trim();
  if (url) {
    try {
      url = new URL(url).href;
    } catch {
      if (url.startsWith('/')) url = `${baseUrl}${url}`;
    }
  }
  if (!url) return null;

  try {
    const parsed = new URL(url);
    // https required (v1.242.0): url is the dedup key and the apply target —
    // the host allowlist alone let an `http://glints.com/...` row through.
    if (parsed.protocol !== 'https:') return null;
    const allowed = ALLOWED_GLINTS_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith('.glints.com');
    if (!allowed) return null;
    url = parsed.href;
  } catch {
    return null;
  }

  const company = (item.company?.name || fallbackCompany || '').trim();
  const location = (item.location || '').trim();
  const postedAt = toEpochMs(item.postedAt);
  const isRemote = REMOTE_RE.test(`${title} ${location}`);

  return {
    id: `glints-${item.id != null ? String(item.id) : djb2(url)}`,
    title,
    company,
    url,
    salary: '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : 'Onsite',
    relocates: false,
    date: postedAt != null ? new Date(postedAt).toISOString() : '',
    snippet: '',
    source: 'glints',
  };
}

/**
 * Fetch + normalize Glints postings.
 * @param {string} apiUrl base GraphQL endpoint (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchGlints(apiUrl = DEFAULT_API, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertGlintsUrl(apiUrl);
  const baseUrl = deriveBaseUrl(apiUrl);
  const cfg = company.glints || {};

  const query = cfg.graphqlQuery || DEFAULT_GRAPHQL_QUERY;
  const keywords = cfg.searchKeywords || '';
  const country = cfg.countryCode || DEFAULT_COUNTRY;
  // Positive-integer configs are honored (capped); anything else — negative,
  // fractional, garbage — reads as the default. Mirrors getro's
  // getro_max_pages handling.
  const rawPageSize = Number(cfg.pageSize);
  const pageSize = Number.isInteger(rawPageSize) && rawPageSize > 0
    ? Math.min(rawPageSize, PAGE_SIZE_CAP)
    : DEFAULT_PAGE_SIZE;
  const rawMaxPages = Number(cfg.maxPages);
  const maxPages = Number.isInteger(rawMaxPages) && rawMaxPages > 0
    ? Math.min(rawMaxPages, MAX_PAGES_CAP)
    : DEFAULT_MAX_PAGES;
  const fallbackCompany = company.name || '';

  const allJobs = [];
  let totalCount = null;

  for (let page = 0; page < maxPages; page++) {
    const offset = page * pageSize;
    const variables = { keywords, country, limit: pageSize, offset };

    let json;
    try {
      json = await fetchJson(fetchImpl, apiUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Glints' firewall blocks generic UAs outright — a browser-like UA
          // + origin/referer clears it.
          'user-agent': BROWSER_LIKE_USER_AGENT,
          origin: 'https://glints.com',
          referer: 'https://glints.com/id/opportunities/jobs/explore',
        },
        body: JSON.stringify({ query, variables }),
        signal,
      });
    } catch (err) {
      if (page === 0) throw err;
      break; // later-page failure is non-fatal
    }

    const opportunities = json?.data?.opportunities;
    if (!opportunities) {
      if (page === 0) throw new Error(`glints: unexpected API response — ${JSON.stringify(json).slice(0, 200)}`);
      break;
    }

    const data = Array.isArray(opportunities)
      ? opportunities
      : (Array.isArray(opportunities.data) ? opportunities.data : []);
    if (typeof opportunities.totalCount === 'number') totalCount = opportunities.totalCount;
    if (data.length === 0) break;

    for (const item of data) {
      const job = parseGlintsItem(item, baseUrl, fallbackCompany);
      if (job) allJobs.push(job);
    }

    if (totalCount != null && allJobs.length >= totalCount) break;
    if (data.length < pageSize) break;
    await delay(300, signal); // rate-limit courtesy; abort-aware
  }

  return allJobs;
}
