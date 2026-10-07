/**
 * 4 Day Week source — board-wide aggregator of 4-day-week / reduced-hours roles.
 * Public, zero-auth JSON API: https://4dayweek.io/api/jobs
 *
 * Response shape: { jobs: [...], total, page, has_more }
 * Each job: { id, title, slug, company_name, company: { name, slug, ... },
 *   work_arrangement, remote, locations: [{ city, country, ... }],
 *   posted (epoch SECONDS), is_expired, salary?, ... }
 *
 * Paginated 25/page via ?page=N. Stop when has_more===false or maxPages reached.
 * Expired postings (is_expired===true) are dropped.
 * No per-job URL in the feed — built as https://4dayweek.io/job/<slug>.
 *
 * Used by the 4dayweek adapter (server/lib/portals/adapters/4dayweek.mjs).
 */

const UA = 'career-ops-web-ui/1.0';
const TRUSTED_HOST = '4dayweek.io';
const DEFAULT_MAX_PAGES = 3;
const MAX_PAGES_CAP = 50;
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

export const FEED_BASE = 'https://4dayweek.io/api/jobs';
export const JOB_BASE = 'https://4dayweek.io/job/';

export const meta = {
  value: '4dayweek',
  label: '4 Day Week',
  region: 'en',
};

/**
 * SSRF guard — throws unless the URL is https://4dayweek.io/...
 * @param {string} u
 * @returns {string}
 */
export function assert4DayWeekUrl(u) {
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error(`4dayweek: invalid URL: ${u}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`4dayweek: URL must use HTTPS: ${u}`);
  }
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`4dayweek: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return u;
}

/**
 * Normalize a single job object from the 4 Day Week API into the 12-field shape.
 * Returns null for expired postings or entries without a usable slug/title.
 * @param {any} j
 * @returns {object|null}
 */
function normalize(j) {
  if (!j || typeof j !== 'object') return null;
  if (j.is_expired === true) return null;

  const title = typeof j.title === 'string' ? j.title.trim() : '';
  if (!title) return null;

  const slug = typeof j.slug === 'string' ? j.slug.trim() : '';
  if (!SLUG_RE.test(slug)) return null; // need a clean slug to build the URL

  const url = `${JOB_BASE}${encodeURIComponent(slug)}`;
  assert4DayWeekUrl(url);

  // id: prefer numeric id, fall back to slug
  const rawId = j.id != null ? String(j.id) : slug;
  const id = `4dayweek-${rawId}`;

  // company: company_name field first, then nested company.name
  const company =
    typeof j.company_name === 'string' && j.company_name.trim()
      ? j.company_name.trim()
      : j.company && typeof j.company === 'object' && typeof j.company.name === 'string'
        ? j.company.name.trim()
        : '4 Day Week';

  // location: first element of locations[], append Remote when applicable
  const first =
    Array.isArray(j.locations) && j.locations[0] && typeof j.locations[0] === 'object'
      ? j.locations[0]
      : {};
  const city = typeof first.city === 'string' ? first.city.trim() : '';
  const country = typeof first.country === 'string' ? first.country.trim() : '';
  const locBase = [city, country].filter(Boolean).join(', ');
  const isRemote = j.remote === true || j.work_arrangement === 'remote' || first.work_arrangement === 'remote';
  const location = [locBase, isRemote ? 'Remote' : ''].filter(Boolean).join(', ');
  const workplaceType = isRemote ? 'Remote' : 'Onsite';

  // date: posted is epoch SECONDS → multiply by 1000 → YYYY-MM-DD
  let date = '';
  if (typeof j.posted === 'number' && Number.isFinite(j.posted)) {
    date = new Date(j.posted * 1000).toISOString().slice(0, 10);
  }

  const salary = typeof j.salary === 'string' ? j.salary.trim() : '';

  return {
    id,
    title,
    company,
    url,
    salary,
    location,
    isRemote,
    workplaceType,
    relocates: false,
    date,
    snippet: '',
    source: '4dayweek',
  };
}

/**
 * Fetch + normalize the 4 Day Week public feed, paginating up to maxPages.
 * The page cap resolves from opts.maxPages, then the entry's own `max_pages`
 * (the scanner threads the company entry through opts.company — previously
 * dead config), then the default. Page URLs are built with URL() so a feedUrl
 * that already carries a query string doesn't grow a second `?`. A page-1
 * failure (HTTP or shape) throws; a later-page failure keeps the collected
 * partials and logs.
 *
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, maxPages?: number,
 *           company?: object }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetch4DayWeek(feedUrl = FEED_BASE, opts = {}) {
  const { fetchImpl = fetch, signal, maxPages: rawMax, company = {} } = opts;

  // Clamp maxPages to [1, MAX_PAGES_CAP]
  const cap = rawMax !== undefined ? rawMax : (company && company.max_pages);
  const maxPages = Math.min(Math.max(1, Math.floor(Number(cap) || DEFAULT_MAX_PAGES)), MAX_PAGES_CAP);

  assert4DayWeekUrl(feedUrl);

  const out = [];

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = new URL(feedUrl);
    pageUrl.searchParams.set('page', String(page));
    const url = pageUrl.toString();

    let json;
    try {
      const res = await fetchImpl(url, {
        signal,
        redirect: 'error',
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });
      if (!res.ok) {
        const err = new Error(`4dayweek: HTTP ${res.status} (${url})`);
        err.status = res.status;
        throw err;
      }
      json = await res.json();
    } catch (err) {
      // Phase-2: page-1 failure is fatal; a later-page failure (HTTP or
      // unparseable JSON) keeps the partials and logs.
      if (page === 1) throw err;
      console.error(`  ⚠ 4dayweek: page ${page} failed (${err.message}) — keeping the ${out.length} jobs collected so far`);
      break;
    }

    if (!json || !Array.isArray(json.jobs)) {
      if (page === 1) {
        throw new Error(
          `4dayweek: unexpected API response on page ${page} — expected { jobs: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
        );
      }
      console.error(`  ⚠ 4dayweek: page ${page} returned an unexpected shape — keeping the ${out.length} jobs collected so far`);
      break;
    }

    for (const j of json.jobs) {
      const normalized = normalize(j);
      if (normalized) out.push(normalized);
    }

    if (json.has_more === false) break;
  }

  return out;
}
