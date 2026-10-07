/**
 * JustJoin.it source — board-wide candidate-api offers endpoint,
 * cursor-paginated:
 *   GET https://justjoin.it/api/candidate-api/offers?from=N&itemsCount=100&…
 *     → { data: [...offers], meta: { next: { cursor, itemsCount } } }
 *
 * v1.242.0: the endpoint stopped answering a bare array — it now wraps the
 * offers in `{ data, meta }` and serves only the default first page (10 of
 * 10000+ postings), so the old single fetch threw on every scan. Ported from
 * the parent's paginated walk (providers/justjoin.mjs): follow
 * meta.next.cursor via `?from=` until it disappears, the page comes back
 * empty, or the page cap is hit. Rows are camelCase — salary lives on
 * employmentTypes[].from/to/currency; the legacy snake_case
 * employment_types[].salary shape is still read for safety.
 *
 * Browser URLs under https://justjoin.it/job-offers/... are accepted for
 * detection, but fetches always use the candidate-api endpoint above.
 *
 * Used by the justjoin adapter (server/lib/portals/adapters/justjoin.mjs).
 */
import { requireObject, requireArray } from './_shape.mjs';

const UA = 'career-ops-web-ui/1.0';

export const API_URL = 'https://justjoin.it/api/candidate-api/offers';
export const JOB_BASE = 'https://justjoin.it/job-offer/';

const PAGE_SIZE = 100; // itemsCount per page (the parent's default)
const MAX_PAGES = 50;  // walk cap — 50 × 100 = 5000 offers, like the parent

export const meta = {
  value: 'justjoin',
  label: 'JustJoin.it',
  region: 'en',
};

export const JUSTJOIN_HOST_RE = /(^|\.)justjoin\.it$/i;

/**
 * Assert that a URL is a trusted justjoin.it HTTPS URL.
 * @param {string} url
 * @returns {string} the URL if valid
 */
export function assertJustJoinUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`justjoin: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`justjoin: URL must use HTTPS: ${url}`);
  }
  if (!JUSTJOIN_HOST_RE.test(parsed.hostname)) {
    throw new Error(`justjoin: untrusted hostname "${parsed.hostname}" — must be justjoin.it`);
  }
  return url;
}

/**
 * The offers URL for one page: the endpoint's own origin/path plus the
 * canonical query the live API expects (parent parity). `from` is the cursor
 * served by the previous page's meta.next.cursor.
 * @param {string} apiUrl
 * @param {number} from
 */
export function buildOffersUrl(apiUrl, from = 0) {
  const parsed = new URL(assertJustJoinUrl(apiUrl));
  parsed.searchParams.set('from', String(from));
  parsed.searchParams.set('itemsCount', String(PAGE_SIZE));
  parsed.searchParams.set('cityRadius', '30');
  parsed.searchParams.set('currency', 'pln');
  parsed.searchParams.set('orderBy', 'descending');
  parsed.searchParams.set('sortBy', 'publishedAt');
  parsed.searchParams.set('keywordType', 'any');
  parsed.searchParams.set('isPromoted', 'true');
  return parsed.href;
}

/**
 * Pure page parser. Throws (loud, Phase-2) unless the body is the
 * `{ data: [...] }` envelope. Returns the raw offers plus the next cursor
 * (null when the walk is over).
 * @param {any} json
 * @returns {{ offers: object[], nextCursor: (string|number|null) }}
 */
export function parseJustJoinResponse(json) {
  const body = requireObject(json, 'JustJoin offers');
  const offers = requireArray(body.data, 'JustJoin offers')
    .filter((o) => o && typeof o === 'object');
  const nextCursor = body?.meta?.next?.cursor ?? null;
  return { offers, nextCursor };
}

/**
 * Fetch + normalize the JustJoin.it candidate-api offers endpoint, walking the
 * cursor until it runs out, an empty page, or MAX_PAGES. A first-page failure
 * throws (dead board); a mid-walk failure keeps what's already collected.
 * @param {string} apiUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 */
export async function fetchJustJoin(apiUrl = API_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertJustJoinUrl(apiUrl);

  /** @type {Map<string, object>} */
  const seen = new Map();
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = buildOffersUrl(apiUrl, from);
    let offers;
    let nextCursor;
    try {
      const res = await fetchImpl(url, {
        signal,
        redirect: 'error',
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });
      if (!res.ok) {
        const err = new Error(`JustJoin: HTTP ${res.status} (${url})`);
        err.status = res.status;
        throw err;
      }
      ({ offers, nextCursor } = parseJustJoinResponse(await res.json()));
    } catch (err) {
      // Nothing collected yet means the endpoint is wrong — surface it. After
      // a success, a later failure is a partial result worth keeping.
      if (page === 0) throw err;
      console.error(`  ⚠ justjoin: page ${page + 1} failed (${err.message}) — keeping the ${seen.size} jobs collected so far`);
      return [...seen.values()];
    }

    for (const o of offers) {
      const job = normalize(o);
      if (job && !seen.has(job.url)) seen.set(job.url, job);
    }
    if (offers.length === 0) break;
    const next = Number(nextCursor);
    if (nextCursor == null || !Number.isFinite(next)) break;
    from = next;
  }
  return [...seen.values()];
}

function workplaceType(o) {
  const wt = String(o.workplace_type || o.workplaceType || '').toLowerCase();
  if (wt === 'remote') return 'Remote';
  if (wt === 'hybrid') return 'Hybrid';
  return 'Onsite';
}

// Live camelCase rows and the legacy snake_case shape, in that order.
function employmentTypeList(o) {
  if (Array.isArray(o.employmentTypes)) return o.employmentTypes;
  if (Array.isArray(o.employment_types)) return o.employment_types;
  return [];
}

function formatSalary(o) {
  // Use the first employment type that has a salary range. from/to/currency
  // sit directly on the type (live shape); the legacy shape nested a
  // `{ from, to, currency }` object under `.salary`.
  for (const et of employmentTypeList(o)) {
    if (!et || typeof et !== 'object') continue;
    const s = et.salary && typeof et.salary === 'object' ? et.salary : et;
    if (s.from == null && s.to == null) continue;
    const currency = String(s.currency || '').toUpperCase();
    const from = s.from != null ? String(s.from) : '';
    const to = s.to != null ? String(s.to) : '';
    if (from && to) return `${from}–${to} ${currency}`.trim();
    if (from) return `≥ ${from} ${currency}`.trim();
    if (to) return `≤ ${to} ${currency}`.trim();
  }
  return '';
}

function formatDate(value) {
  if (!value) return '';
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toISOString().slice(0, 10); // YYYY-MM-DD
}

function normalize(o) {
  const slug = String(o.slug || o.id || '').trim();
  // No stable key → drop the row (every other source does the same). A random
  // id would mint a NEW id for the same posting on each scan, so scan-history
  // dedup never recognizes it (and the url would be empty too).
  if (!slug) return null;
  const wt = workplaceType(o);
  const cities = new Set();
  const city = String(o.city || '').trim();
  if (city) cities.add(city);
  if (Array.isArray(o.locations)) {
    for (const loc of o.locations) {
      const c = String(loc?.city || '').trim();
      if (c) cities.add(c);
    }
  }
  const location = [...cities].join(', ') || wt;
  return {
    id: `justjoin-${slug}`,
    title: String(o.title || '').trim(),
    company: String(o.company_name || o.companyName || '').trim(),
    url: `${JOB_BASE}${slug}`,
    salary: formatSalary(o),
    location,
    isRemote: wt === 'Remote',
    workplaceType: wt,
    relocates: false,
    date: formatDate(o.published_at || o.publishedAt),
    snippet: '',
    source: 'justjoin',
  };
}
