/**
 * Landing.jobs source — board-wide tech/Europe-focused aggregator feed.
 *   GET https://landing.jobs/api/v1/jobs  → JSON array of postings
 *
 * Implements the
 * web-ui source contract.
 *
 * NOTE: the v1 feed carries no company-name field — the employer slug only
 * appears in the posting URL path (`https://landing.jobs/at/<slug>/<job>`),
 * so `company` is derived best-effort from that slug (humanized) and falls
 * back to 'Landing.jobs'.
 *
 * Used by the landingjobs adapter (server/lib/portals/adapters/landingjobs.mjs).
 */
const UA = 'career-ops-web-ui/1.0';

export const FEED_URL = 'https://landing.jobs/api/v1/jobs';

const TRUSTED_HOST = 'landing.jobs';

export const meta = {
  value: 'landingjobs',
  label: 'Landing.jobs',
  region: 'en',
};

/**
 * SSRF guard — throws unless host is landing.jobs over HTTPS.
 * @param {string} u
 * @returns {string} the same URL if valid
 */
export function assertLandingjobsUrl(u) {
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error(`landingjobs: invalid URL: ${u}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`landingjobs: URL must use HTTPS: ${u}`);
  }
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(
      `landingjobs: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`,
    );
  }
  return u;
}

/**
 * Derive a best-effort company name from a Landing.jobs posting URL.
 * Posting URLs are `https://landing.jobs/at/<slug>/<job>`; the `<slug>` is
 * humanized (hyphens/underscores → spaces, title-cased).
 * Returns '' when the URL is not the expected `/at/<slug>/…` shape.
 * @param {string} url
 * @returns {string}
 */
export function companyFromUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return '';
  }
  const segs = parsed.pathname.split('/').filter(Boolean);
  if (segs[0] !== 'at' || !segs[1]) return '';
  return segs[1]
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// NaN-safe ISO-date → 'YYYY-MM-DD' string, or '' on failure.
function toDateStr(value) {
  if (typeof value !== 'string' || !value) return '';
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Normalize a single Landing.jobs job object to the 12-field shape.
 * Returns null for rows that are missing required fields (title, url).
 * @param {any} j
 * @returns {object|null}
 */
function normalize(j) {
  if (!j || typeof j !== 'object') return null;

  const title = typeof j.title === 'string' ? j.title.trim() : '';
  if (!title) return null;

  // Host-lock the posting URL; drop rows with missing/off-host URLs.
  let url = '';
  const rawUrl = typeof j.url === 'string' ? j.url.trim() : '';
  if (rawUrl) {
    try {
      const p = new URL(rawUrl);
      if (p.protocol === 'https:' && p.hostname === TRUSTED_HOST) url = p.href;
    } catch {
      // malformed — leave url = '' → dropped below
    }
  }
  if (!url) return null;

  const company = companyFromUrl(url) || 'Landing.jobs';

  // Build location string from first location entry + remote flag.
  const first =
    Array.isArray(j.locations) &&
    j.locations[0] &&
    typeof j.locations[0] === 'object'
      ? j.locations[0]
      : {};
  const city = typeof first.city === 'string' ? first.city.trim() : '';
  const country =
    typeof first.country_code === 'string' ? first.country_code.trim() : '';
  const base = [city, country].filter(Boolean).join(', ');
  const isRemote = j.remote === true;
  const location = [base, isRemote ? 'Remote' : ''].filter(Boolean).join(', ');

  // Salary — only if the feed exposes gross_salary_low/high.
  let salary = '';
  if (
    typeof j.gross_salary_low === 'number' &&
    typeof j.gross_salary_high === 'number'
  ) {
    salary = `${j.gross_salary_low}–${j.gross_salary_high}`;
  }

  return {
    id: `landingjobs-${j.id != null ? String(j.id) : url}`,
    title,
    company,
    url,
    salary,
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : 'Onsite',
    relocates: false,
    date: toDateStr(j.published_at) || toDateStr(j.created_at),
    snippet: '',
    source: 'landingjobs',
  };
}

/**
 * Fetch + normalize the Landing.jobs public feed.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 */
export async function fetchLandingjobs(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertLandingjobsUrl(feedUrl);
  const res = await fetchImpl(feedUrl, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`landingjobs: HTTP ${res.status} (${feedUrl})`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error(
      `landingjobs: unexpected API response — expected a JSON array, got ${json === null ? 'null' : typeof json}`,
    );
  }
  return json.map((j) => normalize(j)).filter(Boolean);
}
