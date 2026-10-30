/**
 * Trudvsem.ru scanner — Russian government job-board ("Работа в России").
 *
 * Endpoint: https://opendata.trudvsem.ru/api/v1/vacancies?text=<q>&limit=<n>
 * Auth:     none (public open-data API).
 * Geo:      no IP gate (works from any country).
 *
 * Response shape (v1, verified live 2026-10-30 — the API speaks its own
 * status INSIDE an HTTP-200 body):
 *   ok:    { status:'200', request:{api}, meta:{ total, limit },
 *            results: { vacancies: [ { vacancy: { id, vac_url, job-name,
 *                    salary_min, salary_max, currency, region: { name },
 *                    company: { name }, schedule, work-places,
 *                    creation-date, duty, ... } } ] } }
 *   empty: { status:'200', ..., meta:{ total:0 }, results:{} } — zero-match
 *          query AND any page past the end (no `vacancies` key at all).
 *   error: { status:'500', request:{api}, meta:{ error:'...' } } — HTTP still
 *          200; happens once offset * limit >= 10000 (deep-offset refusal).
 * `offset` is a RECORD offset (limit=1&offset=1 is the second record).
 *
 * Schema docs: https://trudvsem.ru/opendata/api
 */

import { safeEncodeURIComponent } from './_safe-url.mjs';
import { requireContainer, requireObject, requireArray } from './_shape.mjs';
import { decodeEntities } from '../html-entities.mjs';
import { fetchJson, labeledHttpError } from '../http-json.mjs';

const TRUDVSEM_API = 'https://opendata.trudvsem.ru/api/v1/vacancies';
// Verified live 2026-10-30: the API answers HTTP 200 with
// {"status":"500","request":{...},"meta":{"error":"..."}} once
// offset * limit >= 10000 (limit=50: offset 200 fails, 199 works;
// limit=100: offset 100 fails, 99 works). The walk stops before that zone.
const MAX_OFFSET_PRODUCT = 10000;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Safari/605.1.15';

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs for the rationale.
export const meta = {
  value: 'trudvsem',
  label: 'Trudvsem',
  region: 'ru',
  configKey: 'trudvsem',
};

/**
 * Search Trudvsem for one query string.
 * Returns array of normalized job objects.
 */
// Hard safety cap on pages per query. Trudvsem's open-data API is paged by
// offset/limit and reports `meta.total`, so we usually stop on total anyway.
const MAX_PAGES = 50;

/**
 * Parse one API page. The opendata API speaks its own status INSIDE an
 * HTTP-200 body (verified live 2026-10-30):
 *   ok:    { status:'200', request:{api}, meta:{total,limit}, results:{vacancies:[{vacancy:{...}}]} }
 *   empty: { status:'200', ..., meta:{total:0}, results:{} } — the zero-match
 *          AND the past-the-end shape: `results` present, no `vacancies` key.
 *   error: { status:'500', request:{api}, meta:{error:'...'} } — HTTP still 200,
 *          so fetchJson never sees it. The API's own status field decides.
 * A 200 with NO `results` key at all is still the API stopping its shape —
 * requireContainer throws it (R-04), as does a non-array `vacancies`.
 */
function parseTrudvsemPage(data) {
  const status = data && typeof data === 'object' && !Array.isArray(data) ? data.status : undefined;
  if (status !== undefined && status !== null && String(status) !== '200') {
    const apiMsg = data && typeof data === 'object' ? data.meta?.error : undefined;
    throw new TypeError(`Trudvsem: API returned status ${status}${apiMsg ? `: ${apiMsg}` : ''}`);
  }
  requireContainer(data, 'Trudvsem', 'results', 'results.vacancies');
  const results = requireObject(data.results, 'Trudvsem results');
  return results.vacancies === undefined ? [] : requireArray(results.vacancies, 'Trudvsem vacancies');
}

export async function searchTrudvsem(query, opts = {}) {
  const {
    perPage = 50,
    onlyRemote = false,
    maxPages = MAX_PAGES,
    fetchImpl = fetch,
    signal,
  } = opts;

  const out = [];
  const seen = new Set();

  for (let page = 0; page < maxPages; page++) {
    // `offset` is a RECORD offset (limit=1&offset=1 is the second record —
    // verified live 2026-10-30), so page p starts at p * perPage.
    const offset = page * perPage;
    if (offset * perPage >= MAX_OFFSET_PRODUCT) break; // the API refuses deeper walks — end cleanly
    const params = new URLSearchParams({
      text: query,
      limit: String(perPage),
      offset: String(offset),
    });

    // The fetch AND the shape parse share the fail-soft boundary (v1.242.0
    // Phase 2): a first-page failure throws; a later-page failure keeps the
    // pages already collected and logs.
    let data = null;
    let list;
    try {
      data = await fetchJson(fetchImpl, `${TRUDVSEM_API}?${params}`, {
        signal,
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      }).catch((e) => { throw labeledHttpError(e, 'Trudvsem'); });
      // The documented envelope is REQUIRED: a 200 without results.vacancies
      // AND without the API's own error status is the API stopping its shape,
      // not an empty page.
      list = parseTrudvsemPage(data);
    } catch (err) {
      if (page === 0) throw err;
      console.error(`  ⚠ trudvsem: page ${page} failed (${err.message}) — keeping the ${out.length} jobs collected so far`);
      break;
    }

    let added = 0;
    for (const job of list.map(normalizeTrudvsem).filter(Boolean)) {
      const key = job.url || job.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(job);
      added++;
    }
    if (added === 0) break; // empty page or all-duplicate → end of results
    // `meta.total` is the authoritative end signal (offset counts records).
    const total = Number(data?.meta?.total);
    if (Number.isFinite(total) && (page + 1) * perPage >= total) break;
  }

  return onlyRemote ? out.filter((j) => j.isRemote) : out;
}

/** Any creation-date the API hands us → YYYY-MM-DD UTC ('' when unparseable). */
function toIsoDate(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  let s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // A naive stamp ("2026-05-10T08:00:00" / "2026-05-10 08:00:00") is treated
  // as UTC for determinism — same convention as tkms.mjs.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10);
}

/** Normalize one Trudvsem record into the common job shape. */
export function normalizeTrudvsem(rec) {
  if (!rec) return null;
  const v = rec.vacancy || rec; // API wraps each entry in `{ vacancy: {...} }`.
  if (!v) return null;

  const id = v.id != null ? String(v.id) : '';
  // Employer-submitted text can arrive HTML-escaped even over the JSON API
  // ("C&amp;C", "&#8212;") — same hazard hh.mjs guards, same shared decoder.
  const title = decodeEntities(v['job-name'] || v.jobName || '');
  if (!title) return null;
  // v1.242.0 Phase 2: an id-less row used to synthesize a title-derived id and
  // a URL that collided with every other id-less row of the same title in the
  // caller's dedup — silently swallowing rows. Skip id-less rows outright.
  if (!id) return null;

  const company = decodeEntities(v?.company?.name || v.companyName || '');
  const region = v?.region?.name || '';
  const schedule = (v.schedule || '').toString();
  const workplaces = (v['work-places'] || '').toString();
  const isRemote = /удал[её]н|remote/i.test(schedule + ' ' + workplaces + ' ' + title);
  const date = toIsoDate(v['creation-date'] || v.creationDate);

  // A lone surrogate in id throws URIError out of encodeURIComponent and
  // aborts the caller's .map() over the page. The row only dies when there is
  // no usable https URL for it (no https vac_url AND no encodable id to build
  // one from) — a surrogate id with a real vac_url keeps its row (v1.242.0).
  const encodedId = safeEncodeURIComponent(id);

  // Job URLs are https:-only (Phase-2 contract): a https vac_url/url from the
  // API is kept; otherwise the canonical built URL, which needs an encodable id.
  const rawUrl = [v.vac_url, v.url]
    .filter((x) => typeof x === 'string' && /^https:\/\//i.test(x.trim()))
    .map((x) => x.trim())[0] || '';
  const url = rawUrl || (encodedId === null ? '' : `https://trudvsem.ru/vacancy/${encodedId}`);
  if (!url) return null;

  const salMin = v.salary_min ?? v.salaryMin;
  const salMax = v.salary_max ?? v.salaryMax;
  const currency = v.currency || 'RUB';
  const salary = [
    salMin ? `от ${salMin}` : null,
    salMax ? `до ${salMax}` : null,
    (salMin || salMax) ? currency : null,
  ].filter(Boolean).join(' ');

  return {
    id: `trudvsem-${id}`,
    title: String(title).trim(),
    company: String(company).trim(),
    url,
    salary,
    location: region || 'Russia',
    isRemote,
    workplaceType: isRemote ? 'Remote' : (schedule || 'Onsite'),
    relocates: false,
    date,
    snippet: decodeEntities((v.duty || '').toString()).slice(0, 240),
    source: 'trudvsem',
  };
}

export const TRUDVSEM = { searchTrudvsem, normalizeTrudvsem };
