// @ts-check
/**
 * Get on Board source — board-wide feed for the tech "programming" category
 *   GET https://www.getonbrd.com/api/v0/categories/programming/jobs
 *
 * Ported from parent career-ops `providers/getonbrd.mjs` into the web-ui source
 * contract (rich job objects + `meta` for auto-discovery). Public, zero-auth
 * JSON:API; `expand[]=company` embeds the company name at the list level. The
 * broad category feed is fetched (not the server-side ?query= search) so the
 * en-scanner's title_filter gates on the configured titles. Pages are fetched
 * until one comes back short/empty or the page cap is reached (default 3,
 * override with `max_pages` on the portal entry).
 *
 * Host-pinned to www.getonbrd.com; fetch uses `redirect:'error'` (SSRF-safe).
 * Used by the getonbrd adapter (server/lib/portals/adapters/getonbrd.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const FEED_BASE = 'https://www.getonbrd.com/api/v0/categories/programming/jobs';
const TRUSTED_HOST = 'www.getonbrd.com';
const PER_PAGE = 100;
const DEFAULT_MAX_PAGES = 3;
const MAX_PAGES_CAP = 50;

export const meta = {
  value: 'getonbrd',
  label: 'Get on Board',
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertGetonbrdUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`getonbrd: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`getonbrd: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`getonbrd: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/** Resolve the page cap: a positive integer `max_pages` on the entry, capped. */
function resolveMaxPages(entry) {
  const v = entry && entry.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

function toIsoDate(epochSeconds) {
  // Guard 0/negative epochs — a `published_at` of 0 would otherwise render a
  // bogus 1970-01-01 date. (parent career-ops parity, #1528)
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) return '';
  const d = new Date(epochSeconds * 1000);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/**
 * Normalize a single Get on Board JSON:API resource into the web-ui job shape.
 * Exported for tests. Returns null for items without a title or a usable
 * https www.getonbrd.com public URL (the dedup key).
 * @param {any} j
 * @param {string} [fallbackCompany]
 */
export function normalizeGetonbrdJob(j, fallbackCompany = 'Get on Board') {
  if (!j || typeof j !== 'object' || !j.attributes || typeof j.attributes !== 'object') return null;
  const attr = j.attributes;

  const title = typeof attr.title === 'string' ? attr.title.trim() : '';
  if (!title) return null;

  let url = '';
  const rawUrl = j.links && typeof j.links.public_url === 'string' ? j.links.public_url.trim() : '';
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'https:' && parsed.hostname === TRUSTED_HOST) url = parsed.href;
    } catch { /* malformed → dropped below */ }
  }
  if (!url) return null;

  const name = attr.company && attr.company.data && attr.company.data.attributes
    && attr.company.data.attributes.name;
  const company = (typeof name === 'string' && name.trim())
    ? name.trim()
    : ((typeof fallbackCompany === 'string' && fallbackCompany.trim()) ? fallbackCompany.trim() : 'Get on Board');

  const isRemote = attr.remote === true;
  let location = '';
  if (isRemote) {
    location = 'Remote';
  } else if (Array.isArray(attr.countries)) {
    location = attr.countries.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim()).join(', ');
  } else if (typeof attr.countries === 'string') {
    location = attr.countries.trim();
  }

  return {
    id: `getonbrd-${url}`,
    title,
    company,
    url,
    salary: '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : '',
    relocates: false,
    date: toIsoDate(attr.published_at),
    snippet: '',
    source: 'getonbrd',
  };
}

/**
 * Fetch + normalize the Get on Board category feed (paginated).
 * @param {string} feedBase base feed URL (host-pinned to www.getonbrd.com)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchGetonbrd(feedBase = FEED_BASE, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertGetonbrdUrl(feedBase);
  const maxPages = resolveMaxPages(company);
  const fallbackCompany = (company && typeof company.name === 'string') ? company.name : 'Get on Board';
  const out = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const url = `${feedBase}?per_page=${PER_PAGE}&expand[]=company&page=${page}`;
    const json = await fetchJson(fetchImpl, url, { signal, redirect: 'error' });
    if (!json || !Array.isArray(json.data)) {
      throw new Error(`getonbrd: unexpected API response on page ${page} — expected { data: [...] }`);
    }
    for (const j of json.data) {
      const normalized = normalizeGetonbrdJob(j, fallbackCompany);
      if (normalized) out.push(normalized);
    }
    if (json.data.length < PER_PAGE) break; // short page → last page
  }
  return out;
}
