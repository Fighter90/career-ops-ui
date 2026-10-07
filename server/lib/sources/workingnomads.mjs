/**
 * Working Nomads source — board-wide remote-jobs aggregator feed.
 *   GET https://www.workingnomads.com/api/exposed_jobs/  → JSON array
 *
 * Implements the
 * web-ui source contract. The en-scanner's title_filter / location_filter gate
 * the returned rows afterwards.
 *
 * Used by the workingnomads adapter
 * (server/lib/portals/adapters/workingnomads.mjs).
 */
const UA = 'career-ops-web-ui/1.0';

export const FEED_URL = 'https://www.workingnomads.com/api/exposed_jobs/';
// Exact-host pin (v1.242.0 Phase 2). This source fetches with a raw
// `fetchImpl`, so the shared fetchJson DNS guard never runs — the host assert
// here is the only SSRF barrier for an `api:`/`workingnomads:` override.
const WORKINGNOMADS_HOST = 'www.workingnomads.com';

export const meta = {
  value: 'workingnomads',
  label: 'Working Nomads',
  region: 'en',
};

/**
 * Assert that `url` is HTTPS on the pinned Working Nomads host. Throws on
 * failure. Exported for the adapter's buildEndpoint.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertWorkingNomadsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`workingnomads: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`workingnomads: URL must use HTTPS: ${url}`);
  }
  if (parsed.hostname !== WORKINGNOMADS_HOST) {
    throw new Error(`workingnomads: untrusted hostname "${parsed.hostname}" — must be ${WORKINGNOMADS_HOST}`);
  }
  return url;
}

/** tiny stable hash (djb2) → base36, for postings with no native id. */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/**
 * Any date the feed hands us → YYYY-MM-DD UTC. A bare YYYY-MM-DD passes
 * through untouched (no timezone shift); a naive datetime is treated as UTC
 * for determinism, same convention as tkms.mjs. Unparseable → ''.
 * @param {unknown} value
 * @returns {string}
 */
function toIsoDateUtc(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  let s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10);
}

/**
 * Fetch + normalize the Working Nomads public feed.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 */
export async function fetchWorkingNomads(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertWorkingNomadsUrl(feedUrl);
  const res = await fetchImpl(feedUrl, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Working Nomads: HTTP ${res.status} (${feedUrl})`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(`Working Nomads: unexpected API response — expected a JSON array, got ${data === null ? 'null' : typeof data}`);
  }
  return data
    .filter((j) => j && typeof j === 'object'
      && typeof j.title === 'string' && j.title.trim() !== ''
      // https:-only job URLs (Phase-2 contract); http: and junk are dropped.
      && typeof j.url === 'string' && /^https:\/\//i.test(j.url.trim()))
    .map((j) => normalize(j));
}

function normalize(j) {
  const url = j.url.trim();
  return {
    id: `workingnomads-${djb2(url)}`,
    title: j.title.trim(),
    company: typeof j.company_name === 'string' ? j.company_name.trim() : '',
    url,
    salary: '',
    location: typeof j.location === 'string' ? j.location.trim() : '',
    isRemote: true,
    workplaceType: 'Remote',
    relocates: false,
    date: toIsoDateUtc(j.pub_date),
    snippet: '',
    source: 'workingnomads',
  };
}
