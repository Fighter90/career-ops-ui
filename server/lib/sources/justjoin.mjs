/**
 * JustJoin.it source — board-wide GET API returning an array of offers.
 *   GET https://justjoin.it/api/candidate-api/offers → [...]
 *
 * Browser URLs under https://justjoin.it/job-offers/... are accepted for
 * detection, but fetches always use the candidate-api endpoint above.
 *
 * Used by the justjoin adapter (server/lib/portals/adapters/justjoin.mjs).
 */
const UA = 'career-ops-web-ui/1.0';

export const API_URL = 'https://justjoin.it/api/candidate-api/offers';
export const JOB_BASE = 'https://justjoin.it/job-offer/';

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
 * Fetch + normalize the JustJoin.it candidate-api offers endpoint.
 * @param {string} apiUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 */
export async function fetchJustJoin(apiUrl = API_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertJustJoinUrl(apiUrl);
  const res = await fetchImpl(apiUrl, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`JustJoin: HTTP ${res.status} (${apiUrl})`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error(
      `JustJoin: unexpected API response — expected array, got: ${JSON.stringify(json).slice(0, 80)}`
    );
  }
  return json
    .filter((o) => o && typeof o === 'object')
    .map((o) => normalize(o))
    .filter(Boolean);
}

function workplaceType(o) {
  const wt = String(o.workplace_type || o.workplaceType || '').toLowerCase();
  if (wt === 'remote') return 'Remote';
  if (wt === 'hybrid') return 'Hybrid';
  return 'Onsite';
}

function formatSalary(o) {
  if (!Array.isArray(o.employment_types) || o.employment_types.length === 0) return '';
  // Use the first employment type that has a salary range
  for (const et of o.employment_types) {
    const s = et.salary;
    if (s && (s.from != null || s.to != null)) {
      const currency = String(s.currency || '').toUpperCase();
      const from = s.from != null ? String(s.from) : '';
      const to = s.to != null ? String(s.to) : '';
      if (from && to) return `${from}–${to} ${currency}`.trim();
      if (from) return `≥ ${from} ${currency}`.trim();
      if (to) return `≤ ${to} ${currency}`.trim();
    }
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
  const city = String(o.city || '').trim();
  return {
    id: `justjoin-${slug}`,
    title: String(o.title || '').trim(),
    company: String(o.company_name || o.companyName || '').trim(),
    url: `${JOB_BASE}${slug}`,
    salary: formatSalary(o),
    location: city || wt,
    isRemote: wt === 'Remote',
    workplaceType: wt,
    relocates: false,
    date: formatDate(o.published_at || o.publishedAt),
    snippet: '',
    source: 'justjoin',
  };
}
