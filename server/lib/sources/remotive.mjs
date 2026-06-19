/**
 * Remotive source — board-wide remote-jobs aggregator feed.
 *   GET https://remotive.com/api/remote-jobs  → { jobs: [...] }
 *
 * Ported from parent career-ops v1.12.0 `providers/remotive.mjs` into the
 * web-ui source contract. The full feed is fetched (no ?search=) so the
 * en-scanner's title_filter can gate on the configured titles — the feed's
 * own ?search= is a narrow substring match that misses e.g. "ML Engineer".
 *
 * Used by the remotive adapter (server/lib/portals/adapters/remotive.mjs).
 */
const UA = 'career-ops-web-ui/1.0';

export const FEED_URL = 'https://remotive.com/api/remote-jobs';

export const meta = {
  value: 'remotive',
  label: 'Remotive',
  region: 'en',
};

/**
 * Fetch + normalize the Remotive public feed.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 */
export async function fetchRemotive(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  const res = await fetchImpl(feedUrl, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Remotive: HTTP ${res.status} (${feedUrl})`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  if (!json || !Array.isArray(json.jobs)) {
    throw new Error(`Remotive: unexpected API response — expected { jobs: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`);
  }
  return json.jobs
    .filter((j) => j && typeof j === 'object'
      && typeof j.title === 'string' && j.title.trim() !== ''
      && typeof j.url === 'string' && /^https?:\/\//i.test(j.url.trim()))
    .map((j) => normalize(j));
}

function normalize(j) {
  const url = j.url.trim();
  const loc = typeof j.candidate_required_location === 'string' ? j.candidate_required_location.trim() : '';
  return {
    id: `remotive-${j.id != null ? String(j.id) : url}`,
    title: j.title.trim(),
    company: typeof j.company_name === 'string' ? j.company_name.trim() : '',
    url,
    salary: typeof j.salary === 'string' ? j.salary.trim() : '',
    location: loc,
    isRemote: true,
    workplaceType: 'Remote',
    relocates: false,
    date: typeof j.publication_date === 'string' ? j.publication_date : '',
    snippet: '',
    source: 'remotive',
  };
}
