/**
 * Working Nomads source — board-wide remote-jobs aggregator feed.
 *   GET https://www.workingnomads.com/api/exposed_jobs/  → JSON array
 *
 * Ported from parent career-ops v1.12.0 `providers/workingnomads.mjs` into the
 * web-ui source contract. The en-scanner's title_filter / location_filter gate
 * the returned rows afterwards.
 *
 * Used by the workingnomads adapter
 * (server/lib/portals/adapters/workingnomads.mjs).
 */
const UA = 'career-ops-web-ui/1.0';

export const FEED_URL = 'https://www.workingnomads.com/api/exposed_jobs/';

export const meta = {
  value: 'workingnomads',
  label: 'Working Nomads',
  region: 'en',
};

/** tiny stable hash (djb2) → base36, for postings with no native id. */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/**
 * Fetch + normalize the Working Nomads public feed.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 */
export async function fetchWorkingNomads(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
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
      && typeof j.url === 'string' && /^https?:\/\//i.test(j.url.trim()))
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
    date: typeof j.pub_date === 'string' ? j.pub_date : '',
    snippet: '',
    source: 'workingnomads',
  };
}
