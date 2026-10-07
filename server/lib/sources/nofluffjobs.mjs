/**
 * NoFluffJobs source — Poland-focused job board.
 *   POST https://nofluffjobs.com/api/search/posting?sort=newest&…&pageTo=N
 *     → { postings: [...], totalPages: N }
 *
 * Implements the
 * web-ui source contract. The live API (2026-06) answers
 * `400 Required parameter salaryCurrency` unless the parent's query params are
 * sent, and pages via `pageTo` up to the reported `totalPages` — the old
 * param-less single POST was dead on arrival. Uses a POST per page so the
 * en-scanner's title_filter can gate on configured titles.
 *
 * Used by the nofluffjobs adapter (server/lib/portals/adapters/nofluffjobs.mjs).
 *
 * Content-Type note: the request sends 'application/infiniteSearch+json' — we
 * set that exactly so the API returns a full result set.
 */
import { requireObject, requireArray } from './_shape.mjs';

const UA = 'career-ops-web-ui/1.0';

export const API_URL = 'https://nofluffjobs.com/api/search/posting';
export const JOB_BASE = 'https://nofluffjobs.com/pl/job/';

const PAGE_SIZE = 20; // the API's pageTo/pageSize paging (parent parity)
const MAX_PAGES = 5;  // walk cap — 5 × 20 = 100 postings (parent parity)

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
    pageSize: PAGE_SIZE,
    withSalaryMatch: true,
  };
}

/**
 * The POST URL for one page. The live API refuses the request without these
 * query params ('Required parameter salaryCurrency'), so they are set
 * canonically here — parent parity (providers/nofluffjobs.mjs buildRequest).
 * @param {string} apiUrl
 * @param {number} pageTo 1-based page number
 */
export function buildRequestUrl(apiUrl, pageTo) {
  const parsed = new URL(assertNoFluffUrl(apiUrl));
  parsed.search = '';
  parsed.searchParams.set('sort', 'newest');
  parsed.searchParams.set('withSalaryMatch', 'true');
  parsed.searchParams.set('pageTo', String(pageTo));
  parsed.searchParams.set('pageSize', String(PAGE_SIZE));
  parsed.searchParams.set('salaryCurrency', 'PLN');
  parsed.searchParams.set('salaryPeriod', 'month');
  parsed.searchParams.set('region', 'pl');
  parsed.searchParams.set('language', 'pl-PL');
  return parsed.href;
}

/**
 * Fetch and normalize jobs from NoFluffJobs, walking pageTo until the reported
 * totalPages is reached, an empty page, or the page cap. A first-page failure
 * throws (dead board); a mid-walk failure keeps what's already collected.
 * @param {string} [apiUrl]
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 * @returns {Promise<object[]>} normalized jobs (12-field shape)
 */
export async function fetchNoFluffJobs(apiUrl = API_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;

  assertNoFluffUrl(apiUrl);

  const jobs = [];
  const seen = new Set();
  for (let pageTo = 1; pageTo <= MAX_PAGES; pageTo += 1) {
    let postings;
    let totalPages;
    try {
      const res = await fetchImpl(buildRequestUrl(apiUrl, pageTo), {
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
      const json = requireObject(await res.json(), 'NoFluffJobs search');
      postings = requireArray(json.postings, 'NoFluffJobs postings');
      totalPages = Number(json.totalPages || 0);
    } catch (err) {
      // Nothing collected yet means the endpoint is wrong — surface it. After
      // a success, a later failure is a partial result worth keeping.
      if (pageTo === 1) throw err;
      console.error(`  ⚠ nofluffjobs: page ${pageTo} failed (${err.message}) — keeping the ${jobs.length} jobs collected so far`);
      break;
    }

    for (const p of postings) {
      if (!p || typeof p !== 'object') continue;
      // The slug is the dedup key AND the posting URL — a row without one can
      // only mint a dead link. (The old post-normalize filter never rejected
      // it: the normalized id always carries the truthy `nofluffjobs-` prefix.)
      const slug = String(p.url || p.id || '').trim();
      if (!slug || !String(p.title || '').trim()) continue;
      const job = normalize(p);
      if (!seen.has(job.url)) {
        seen.add(job.url);
        jobs.push(job);
      }
    }

    if (totalPages && pageTo >= totalPages) break;
    if (postings.length === 0) break;
  }
  return jobs;
}
