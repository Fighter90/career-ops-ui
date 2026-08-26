// @ts-check
/**
 * Get on Board source — board-wide category feeds
 *   GET https://www.getonbrd.com/api/v0/categories/{category}/jobs
 *
 * Category defaults to `programming`; override with `category: <slug>` or scan
 * several in one entry with `categories: [<slug>, …]` (deduped by URL, capped
 * at 12 categories). See resolveCategories().
 *
 * Implements the web-ui source
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

const FEED_HOST = 'https://www.getonbrd.com';
const TRUSTED_HOST = 'www.getonbrd.com';
const DEFAULT_CATEGORY = 'programming';
export const FEED_BASE = `${FEED_HOST}/api/v0/categories/${DEFAULT_CATEGORY}/jobs`;
const PER_PAGE = 100;
const DEFAULT_MAX_PAGES = 3;
const MAX_PAGES_CAP = 50;
// Category slugs are lowercase alphanumeric words joined by single hyphens.
// Anchored so a config typo can never inject a path segment or query into the
// feed URL (`../`, `?`, `//host`); assertGetonbrdUrl is the second gate.
const CATEGORY_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_CATEGORIES = 12;

/** Build the feed base URL for one category slug. */
function feedBase(category) {
  return `${FEED_HOST}/api/v0/categories/${category}/jobs`;
}

/**
 * Resolve the categories to scan, in config order, deduped. `categories:`
 * (array) wins over `category:` (string); neither → the `programming` default
 * (keeps pre-existing entries byte-identical). The board splits leadership and
 * ML/data roles out of `programming`, so an EM/Tech-Lead search misses most of
 * its matches without `operations-management` and `machine-learning-ai`.
 * Exported for tests.
 * @param {any} entry
 * @returns {string[]}
 */
export function resolveCategories(entry) {
  const raw = entry?.categories !== undefined ? entry.categories : entry?.category;
  if (raw === undefined || raw === null) return [DEFAULT_CATEGORY];
  const list = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const c of list) {
    if (typeof c !== 'string' || !CATEGORY_SLUG_RE.test(c.trim())) {
      throw new Error(
        `getonbrd: invalid category ${JSON.stringify(c)} — expected a slug like "programming" or "machine-learning-ai"`,
      );
    }
    const slug = c.trim();
    if (!out.includes(slug)) out.push(slug);
  }
  if (!out.length) {
    throw new Error('getonbrd: `categories` is empty — omit it to use the "programming" default');
  }
  if (out.length > MAX_CATEGORIES) {
    throw new Error(
      `getonbrd: ${out.length} categories configured — cap is ${MAX_CATEGORIES} (each one costs up to max_pages requests)`,
    );
  }
  return out;
}

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
  // bogus 1970-01-01 date.
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
export async function fetchGetonbrd(feedUrl = FEED_BASE, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const maxPages = resolveMaxPages(company);
  const fallbackCompany = (company && typeof company.name === 'string') ? company.name : 'Get on Board';
  // Multiple categories per entry (v1.219.0): the board splits EM/leadership and
  // ML/data roles out of `programming`. When the entry names `categories:` /
  // `category:` we build a feed URL per category from the canonical host; with
  // no category config we honor the single `feedUrl` the adapter passed (the
  // `programming` default OR a test/mirror override), so existing entries and
  // the `getonbrd:`/`api:` override path are byte-identical.
  const explicitCategories = company && (company.categories !== undefined || company.category !== undefined);
  const bases = explicitCategories ? resolveCategories(company).map(feedBase) : [feedUrl];
  const out = [];
  // A posting can appear under several categories; first sighting wins so the
  // scanner never sees the same URL twice from one entry.
  const seen = new Set();
  for (const base of bases) {
    assertGetonbrdUrl(base);
    for (let page = 1; page <= maxPages; page += 1) {
      const url = `${base}?per_page=${PER_PAGE}&expand[]=company&page=${page}`;
      const json = await fetchJson(fetchImpl, url, { signal, redirect: 'error' });
      if (!json || !Array.isArray(json.data)) {
        throw new Error(`getonbrd: unexpected API response on page ${page} — expected { data: [...] }`);
      }
      for (const j of json.data) {
        const normalized = normalizeGetonbrdJob(j, fallbackCompany);
        if (!normalized || seen.has(normalized.url)) continue;
        seen.add(normalized.url);
        out.push(normalized);
      }
      if (json.data.length < PER_PAGE) break; // short page → last page
    }
  }
  return out;
}
