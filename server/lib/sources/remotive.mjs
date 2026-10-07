/**
 * Remotive source — board-wide remote-jobs aggregator feed.
 *   GET https://remotive.com/api/remote-jobs  → { jobs: [...] }
 *
 * Implements the
 * web-ui source contract. The full feed is fetched (no ?search=) so the
 * en-scanner's title_filter can gate on the configured titles — the feed's
 * own ?search= is a narrow substring match that misses e.g. "ML Engineer".
 *
 * Phase-2 URL pinning (v1.242.0 sources-6): the feed URL must be https on a
 * real host (an explicit `api:`/`remotive:` mirror stays allowed — same model
 * as phenom's branded tenants), and every job `url` is pinned to https on the
 * exact remotive.com host; anything else is dropped.
 *
 * Used by the remotive adapter (server/lib/portals/adapters/remotive.mjs).
 */
const UA = 'career-ops-web-ui/1.0';

export const FEED_URL = 'https://remotive.com/api/remote-jobs';

// Anchored: `remotive.com` itself or any subdomain — never a lookalike.
export const REMOTIVE_HOST_RE = /(?:^|\.)remotive\.com$/i;

export const meta = {
  value: 'remotive',
  label: 'Remotive',
  region: 'en',
};

/**
 * Guard on the feed URL (the one server-fetched request): HTTPS + a real
 * hostname. The mirror override stays usable; the job-url pin below carries
 * the exact-host rule.
 * @param {string} url
 */
export function assertRemotiveUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`remotive: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`remotive: URL must use HTTPS: ${url}`);
  if (!parsed.hostname) throw new Error(`remotive: URL has no hostname: ${url}`);
  return url;
}

/** https: + the exact pinned board host — the only accepted job URL shape. */
function isTrustedJobUrl(value) {
  if (typeof value !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  return parsed.protocol === 'https:' && REMOTIVE_HOST_RE.test(parsed.hostname);
}

/**
 * Fetch + normalize the Remotive public feed.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 */
export async function fetchRemotive(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertRemotiveUrl(feedUrl);
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
      && isTrustedJobUrl(j.url))
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
