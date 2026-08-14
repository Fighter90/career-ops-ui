/**
 * The Muse source — board-wide public JSON jobs API, paginated.
 *   GET https://www.themuse.com/api/public/jobs?page={n}
 *   Response: { results: [...], page: n, page_count: N }
 *
 * Implements the
 * web-ui source contract. Fetches up to maxPages pages sequentially.
 *
 * Used by the themuse adapter (server/lib/portals/adapters/themuse.mjs).
 */
const UA = 'career-ops-web-ui/1.0';
const TRUSTED_HOST = 'www.themuse.com';

export const FEED_BASE = 'https://www.themuse.com/api/public/jobs';

export const meta = {
  value: 'themuse',
  label: 'The Muse',
  region: 'en',
};

/**
 * SSRF guard — throws unless the URL is https://www.themuse.com/…
 * @param {string} url
 * @returns {string}
 */
export function assertTheMuseUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`themuse: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`themuse: URL must use HTTPS: ${url}`);
  }
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(
      `themuse: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`,
    );
  }
  return url;
}

/**
 * Normalize a single result from the Muse API into the 12-field web-ui shape.
 * Returns null when required fields (title or url) are missing/invalid.
 * @param {any} j
 * @returns {object|null}
 */
function normalize(j) {
  if (!j || typeof j !== 'object') return null;

  const title = typeof j.name === 'string' ? j.name.trim() : '';
  if (!title) return null;

  const rawUrl = typeof j.refs?.landing_page === 'string' ? j.refs.landing_page.trim() : '';
  if (!rawUrl || !/^https:\/\//i.test(rawUrl)) return null;

  const company =
    typeof j.company?.name === 'string' && j.company.name.trim()
      ? j.company.name.trim()
      : 'The Muse';

  const location =
    Array.isArray(j.locations) && j.locations.length > 0
      ? j.locations
          .map((l) => (typeof l?.name === 'string' ? l.name.trim() : ''))
          .filter(Boolean)
          .join(', ')
      : '';

  const lowerLoc = location.toLowerCase();
  const isRemote = lowerLoc.includes('remote') || lowerLoc.includes('flexible');
  // Canonical enum only (Remote / Hybrid / Onsite). "Flexible" → Remote so
  // isRemote and workplaceType never disagree.
  const workplaceType = isRemote ? 'Remote' : 'Onsite';

  const date =
    typeof j.publication_date === 'string'
      ? j.publication_date.slice(0, 10)
      : '';

  return {
    id: `themuse-${j.id != null ? String(j.id) : rawUrl}`,
    title,
    company,
    url: rawUrl,
    salary: '',
    location,
    isRemote,
    workplaceType,
    relocates: false,
    date,
    snippet: '',
    source: 'themuse',
  };
}

/**
 * Fetch + normalize The Muse public jobs API (paginated).
 *
 * @param {string} feedUrl  - Base endpoint (default: FEED_BASE)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, maxPages?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchTheMuse(feedUrl = FEED_BASE, opts = {}) {
  const { fetchImpl = fetch, signal, maxPages: rawMax = 3 } = opts;

  // Clamp maxPages to [1, 50]
  const maxPages = Math.min(Math.max(1, Math.floor(rawMax)), 50);

  assertTheMuseUrl(feedUrl);

  const base = new URL(feedUrl);

  const allResults = [];
  let pageCount = 1;

  for (let page = 0; page < Math.min(pageCount, maxPages); page++) {
    const pageUrl = new URL(base.toString());
    pageUrl.searchParams.set('page', String(page));

    const res = await fetchImpl(pageUrl.toString(), {
      signal,
      redirect: 'error',
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });

    if (!res.ok) {
      if (page === 0) {
        const err = new Error(`The Muse: HTTP ${res.status} (${pageUrl})`);
        err.status = res.status;
        throw err;
      }
      // Non-fatal on subsequent pages — stop pagination
      break;
    }

    const json = await res.json();

    if (!json || !Array.isArray(json.results)) {
      if (page === 0) {
        throw new Error(
          `The Muse: unexpected API response — expected { results: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
        );
      }
      break;
    }

    // Discover total page count from first page
    if (page === 0 && Number.isInteger(json.page_count) && json.page_count > 1) {
      pageCount = json.page_count;
    }

    allResults.push(...json.results);
  }

  return allResults.map(normalize).filter(Boolean);
}
