/**
 * NoFluffJobs source — Poland-focused job board.
 *   POST https://nofluffjobs.com/api/search/posting  → { postings: [...] }
 *
 * Implements the
 * web-ui source contract. Uses a single-page POST (no pagination) so the
 * en-scanner's title_filter can gate on configured titles.
 *
 * Used by the nofluffjobs adapter (server/lib/portals/adapters/nofluffjobs.mjs).
 *
 * Content-Type note: the request sends 'application/infiniteSearch+json' — we
 * set that exactly so the API returns a full result set.
 */
const UA = 'career-ops-web-ui/1.0';

export const API_URL = 'https://nofluffjobs.com/api/search/posting';
export const JOB_BASE = 'https://nofluffjobs.com/pl/job/';

export const meta = {
  value: 'nofluffjobs',
  label: 'NoFluffJobs',
  region: 'en',
};

export const NOFLUFF_HOST_RE = /(^|\.)nofluffjobs\.com$/i;

/**
 * Assert that `url` targets nofluffjobs.com over HTTPS.
 * @param {string} url
 * @returns {string} the validated URL
 */
export function assertNoFluffUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`nofluffjobs: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`nofluffjobs: URL must use HTTPS: ${url}`);
  }
  if (!NOFLUFF_HOST_RE.test(parsed.hostname)) {
    throw new Error(`nofluffjobs: untrusted hostname "${parsed.hostname}" — must be nofluffjobs.com`);
  }
  return url;
}

/**
 * Normalize a single posting from the API response.
 * @param {object} p
 * @returns {object} 12-field normalized job
 */
function normalize(p) {
  const slug = String(p.url || p.id || '').trim();
  const rawId = String(p.id || slug || '').trim();

  // Location: fullyRemote flag + city list from location.places
  const locationParts = [];
  if (p.fullyRemote || p.location?.fullyRemote) locationParts.push('Remote');
  if (Array.isArray(p.location?.places)) {
    for (const place of p.location.places) {
      const city = String(place?.city || '').trim();
      const province = String(place?.province || '').trim();
      const country = String(place?.country?.name || '').trim();
      if (city) locationParts.push(city);
      else if (province) locationParts.push(province);
      else if (country) locationParts.push(country);
    }
  }
  const location = [...new Set(locationParts.filter(Boolean))].join(', ');

  const isRemote = !!(p.fullyRemote || p.location?.fullyRemote);
  const workplaceType = isRemote ? 'Remote' : 'Onsite';

  // Salary: format range + currency if present
  let salary = '';
  if (p.salary && (p.salary.from != null || p.salary.to != null)) {
    const from = p.salary.from != null ? String(p.salary.from) : '';
    const to = p.salary.to != null ? String(p.salary.to) : '';
    const currency = String(p.salary.currency || 'PLN');
    salary = from && to ? `${from}–${to} ${currency}` : `${from || to} ${currency}`;
  }

  // Date: posted is epoch ms
  let date = '';
  const postedMs = Number(p.posted);
  if (Number.isFinite(postedMs) && postedMs > 0) {
    date = new Date(postedMs).toISOString().slice(0, 10);
  }

  return {
    id: `nofluffjobs-${rawId}`,
    title: String(p.title || '').trim(),
    company: String(p.name || '').trim(),
    url: slug ? `${JOB_BASE}${slug}` : '',
    salary,
    location,
    isRemote,
    workplaceType,
    relocates: false,
    date,
    snippet: '',
    source: 'nofluffjobs',
  };
}

/**
 * Build the POST body for an open (no keyword filter) search.
 */
function buildBody() {
  return {
    criteriaSearch: {
      country: [],
      withSalaryMatch: [],
      city: [],
      more: [],
      employment: [],
      requirement: [],
      salary: [],
      jobPosition: [],
      applicationStatus: [],
      province: [],
      company: [],
      id: [],
      category: [],
      keyword: [],
      jobLanguage: [],
      seniority: [],
    },
    pageSize: 50,
    withSalaryMatch: true,
  };
}

/**
 * Fetch and normalize jobs from NoFluffJobs.
 * @param {string} [apiUrl]
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 * @returns {Promise<object[]>} normalized jobs (12-field shape)
 */
export async function fetchNoFluffJobs(apiUrl = API_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;

  assertNoFluffUrl(apiUrl);

  const res = await fetchImpl(apiUrl, {
    method: 'POST',
    signal,
    redirect: 'error',
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'Content-Type': 'application/infiniteSearch+json',
    },
    body: JSON.stringify(buildBody()),
  });

  if (!res.ok) {
    const err = new Error(`NoFluffJobs: HTTP ${res.status} (${apiUrl})`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  if (!json || !Array.isArray(json.postings)) {
    throw new Error(
      `NoFluffJobs: unexpected API response — expected { postings: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
    );
  }

  return json.postings
    .filter((p) => p && typeof p === 'object')
    .map((p) => normalize(p))
    .filter((p) => p.title && (p.url || p.id));
}
