/**
 * RemoteOK source — board-wide remote-jobs aggregator feed.
 *   GET https://remoteok.com/api
 *
 * Ported from parent career-ops v1.12.0 `providers/remoteok.mjs` into the
 * web-ui source contract (rich job objects + `meta` for auto-discovery).
 *
 * The feed is a JSON array whose first element is a `{ legal, … }` metadata
 * object (skipped). All postings are remote, so `isRemote` is always true and
 * the en-scanner's title_filter / location_filter gate the rows afterwards.
 *
 * Used by the remoteok adapter (server/lib/portals/adapters/remoteok.mjs).
 */
const UA = 'career-ops-web-ui/1.0';

export const FEED_URL = 'https://remoteok.com/api';

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs.
export const meta = {
  value: 'remoteok',
  label: 'RemoteOK',
  region: 'en',
};

/** tiny stable hash (djb2) → base36, for postings with no native id. */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/**
 * Fetch + normalize the RemoteOK public feed.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 */
export async function fetchRemoteOk(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  // redirect:'error' mirrors the parent provider's SSRF guard.
  const res = await fetchImpl(feedUrl, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`RemoteOK: HTTP ${res.status} (${feedUrl})`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(`RemoteOK: unexpected API response — expected a JSON array, got ${data === null ? 'null' : typeof data}`);
  }
  return data
    .filter((j) => j && typeof j === 'object'
      && typeof j.position === 'string' && j.position.trim() !== ''
      && typeof j.url === 'string' && /^https?:\/\//i.test(j.url.trim()))
    .map((j) => normalize(j));
}

function normalize(j) {
  const url = j.url.trim();
  const native = j.id != null ? String(j.id) : (j.slug || djb2(url));
  return {
    id: `remoteok-${native}`,
    title: j.position.trim(),
    company: typeof j.company === 'string' ? j.company.trim() : '',
    url,
    salary: '',
    location: typeof j.location === 'string' ? j.location.trim() : '',
    isRemote: true,
    workplaceType: 'Remote',
    relocates: false,
    date: typeof j.date === 'string' ? j.date : '',
    snippet: '',
    source: 'remoteok',
  };
}
