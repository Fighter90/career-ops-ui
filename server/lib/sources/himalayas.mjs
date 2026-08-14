/**
 * Himalayas source — board-wide remote-jobs public JSON API.
 *   GET https://himalayas.app/jobs/api?limit=50  → { jobs: [...] }
 *
 * Implements the
 * web-ui source contract. The full feed is fetched so the en-scanner's
 * title_filter can gate on configured titles consistently with other
 * zero-token board providers. Himalayas is a remote-only board so
 * isRemote is always true and workplaceType is always 'Remote'.
 *
 * Used by the himalayas adapter (server/lib/portals/adapters/himalayas.mjs).
 */
const UA = 'career-ops-web-ui/1.0';
const TRUSTED_HOST = 'himalayas.app';

export const FEED_URL = 'https://himalayas.app/jobs/api?limit=50';

export const meta = {
  value: 'himalayas',
  label: 'Himalayas',
  region: 'en',
};

/**
 * Assert that `url` points to himalayas.app over HTTPS. Throws on failure.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertHimalayasUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`himalayas: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`himalayas: URL must use HTTPS: ${url}`);
  }
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`himalayas: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/**
 * Fetch + normalize the Himalayas public feed.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 */
export async function fetchHimalayas(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertHimalayasUrl(feedUrl);
  const res = await fetchImpl(feedUrl, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Himalayas: HTTP ${res.status} (${feedUrl})`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  if (!json || !Array.isArray(json.jobs)) {
    throw new Error(
      `Himalayas: unexpected API response — expected { jobs: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
    );
  }
  return json.jobs
    .filter((j) => j && typeof j === 'object')
    .map((j) => normalize(j))
    .filter((j) => j !== null);
}

// Himalayas pubDate is epoch seconds. Accept milliseconds and parseable
// date strings too so the parser survives small API shape changes.
function toDateString(value) {
  let ms;
  if (typeof value === 'number' && Number.isFinite(value)) {
    ms = value < 1_000_000_000_000 ? value * 1000 : value;
  } else if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    } else {
      const parsed = Date.parse(value);
      ms = Number.isNaN(parsed) ? undefined : parsed;
    }
  }
  if (ms == null) return '';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanHimalayasUrl(value) {
  const raw = cleanText(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const trusted = host === TRUSTED_HOST || host.endsWith(`.${TRUSTED_HOST}`);
    return parsed.protocol === 'https:' && trusted ? parsed.href : '';
  } catch {
    return '';
  }
}

function locationText(value) {
  if (!Array.isArray(value)) return '';
  return value
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim())
    .join(', ');
}

/**
 * Map a raw Himalayas job object to the 12-field web-ui normalized shape.
 * Returns null for rows that cannot produce a valid title + url.
 */
function normalize(j) {
  const title = cleanText(j.title);
  if (!title) return null;

  const url = cleanHimalayasUrl(j.applicationLink) || cleanHimalayasUrl(j.guid);
  if (!url) return null;

  return {
    id: `himalayas-${j.id != null ? String(j.id) : url}`,
    title,
    company: cleanText(j.companyName),
    url,
    salary: cleanText(j.salary),
    location: locationText(j.locationRestrictions),
    isRemote: true,
    workplaceType: 'Remote',
    relocates: false,
    date: toDateString(j.pubDate),
    snippet: '',
    source: 'himalayas',
  };
}
