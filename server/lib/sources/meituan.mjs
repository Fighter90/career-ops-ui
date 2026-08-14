/**
 * Meituan careers source — posts to the public zhaopin.meituan.com JSON API
 * (no auth, no browser, no special headers).
 *
 * Implements the
 * web-ui source contract. Meituan is a single-company board, so it is
 * selected via an explicit `provider: meituan` entry or auto-detected from a
 * zhaopin.meituan.com careers_url. Config comes from the company entry, read
 * via `opts.company`:
 *
 *   tracked_companies:
 *     - name: 美团
 *       careers_url: https://zhaopin.meituan.com/web/social   # auto-detected
 *       keywords: ["AI", "大模型"]  # each keyword is a separate server-side
 *                                   # query, results deduped; omit to pull the
 *                                   # whole board (~2300 postings)
 *       max_pages: 30               # per keyword, pageSize 100
 *
 * API shape (verified 2026-07 by capturing the site's own XHR):
 *   POST /api/official/job/getJobList
 *   { "page": {"pageNo": N, "pageSize": 100},   ← nested pagination (a flat
 *     "keywords": "大模型",                        {pageNo} is silently ignored
 *     "jobShareType": "1",                         and always returns page 1)
 *     "jobType": [{"code": "3", "subCode": []}], ← 3 = social hiring (社招)
 *     "cityList": [], "department": [], "jfJgList": [], "typeCode": [], "specialCode": [] }
 *
 * The board sporadically answers a mid-pagination request with an empty list
 * (observed live upstream; reads as rate-limiting) — retried with backoff
 * before concluding a keyword is exhausted.
 *
 * Used by the meituan adapter (server/lib/portals/adapters/meituan.mjs).
 */
import { fetchJson, delay } from '../http-json.mjs';

const API_HOST = 'zhaopin.meituan.com';
export const DEFAULT_API = `https://${API_HOST}/api/official/job/getJobList`;
const DETAIL = `https://${API_HOST}/web/position/detail?jobUnionId=`;
const PAGE_SIZE = 100;
const DEFAULT_KEYWORDS = ['']; // empty keyword = the whole board, no topical bias
const DEFAULT_MAX_PAGES = 30;
// Every request after the first pays it — across pages and keyword switches
// (same idiom as avature/workday); 400ms instead of their 150 because this
// board rate-limits harder (see EMPTY_RETRIES below).
const INTER_PAGE_DELAY_MS = 400;
const EMPTY_RETRIES = 2;
const RETRY_BACKOFF_MS = 1500;
const SNIPPET_CAP = 500;

export const meta = {
  value: 'meituan',
  label: 'Meituan',
  region: 'en',
};

/** @param {string} url */
export function assertMeituanUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`meituan: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`meituan: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== API_HOST) {
    throw new Error(`meituan: untrusted hostname "${parsed.hostname}" — must be ${API_HOST}`);
  }
  return url;
}

function toEpochMs(v) {
  if (v == null) return undefined;
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
  const parsed = Date.parse(v);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** cityList/department items are objects like {name: "北京市"} */
function names(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.map((x) => (typeof x === 'string' ? x : x?.name)).filter(Boolean).join('/');
}

function buildBody(keywords, pageNo) {
  return JSON.stringify({
    page: { pageNo, pageSize: PAGE_SIZE },
    keywords,
    jobShareType: '1',
    jobType: [{ code: '3', subCode: [] }],
    cityList: [], department: [], jfJgList: [], typeCode: [], specialCode: [],
  });
}

/**
 * Parse one page of the getJobList payload into web-ui Jobs.
 * Exported for unit tests.
 * @param {any} json
 * @param {string} companyName
 * @returns {{ jobs: object[], total: number }}
 */
export function parseMeituanResponse(json, companyName) {
  const list = json?.data?.list;
  const total = Number(json?.data?.page?.totalCount) || 0;
  if (!Array.isArray(list)) return { jobs: [], total };

  const jobs = [];
  for (const p of list) {
    const title = p.name || '';
    const id = p.jobUnionId;
    if (!title || !id) continue;
    const postedAt = toEpochMs(p.refreshTime ?? p.firstPostTime);
    // Meituan posts carry full-text JDs (duty + requirements), much longer
    // than other boards' summaries — cap to keep scan payloads sane.
    const snippet = [
      names(p.department) && `部门: ${names(p.department)}`,
      p.jobFamily && `序列: ${p.jobFamily}`,
      p.workYear && `经验: ${p.workYear}`,
      p.jobDuty,
      p.jobRequirement,
    ].filter(Boolean).join('\n').slice(0, SNIPPET_CAP);
    jobs.push({
      id: `meituan-${String(id)}`,
      title,
      company: companyName,
      url: DETAIL + encodeURIComponent(id),
      salary: '',
      location: names(p.cityList),
      isRemote: false,
      workplaceType: 'Onsite',
      relocates: false,
      date: postedAt != null ? new Date(postedAt).toISOString() : '',
      snippet,
      source: 'meituan',
    });
  }
  return { jobs, total };
}

/**
 * Fetch + normalize Meituan postings, paginating per keyword and retrying
 * sporadic empty pages before giving up on a keyword.
 * @param {string} apiUrl API endpoint (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchMeituan(apiUrl = DEFAULT_API, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertMeituanUrl(apiUrl);

  const keywords = Array.isArray(company.keywords) && company.keywords.length
    ? company.keywords
    : DEFAULT_KEYWORDS;
  const maxPages = Number(company.max_pages) > 0 ? Number(company.max_pages) : DEFAULT_MAX_PAGES;
  const companyName = company.name || '美团';

  /** @type {Map<string, object>} */
  const seen = new Map();
  let firstRequest = true;
  let succeededOnce = false;

  for (const keyword of keywords) {
    let total = 0;

    for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
      let jobs = null;

      for (let attempt = 0; attempt <= EMPTY_RETRIES; attempt++) {
        if (firstRequest) firstRequest = false;
        else await delay(attempt > 0 ? RETRY_BACKOFF_MS * attempt : INTER_PAGE_DELAY_MS, signal);

        let json;
        try {
          json = await fetchJson(fetchImpl, apiUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: buildBody(keyword, pageNo),
            signal,
          });
        } catch (err) {
          // A dead board should still read as a failure, but a mid-run blip
          // must not discard what's already collected (same idiom as
          // workday/jobstreet/glints). Track successes directly — a keyword
          // can legitimately match 0 jobs, so seen.size is not the signal.
          if (!succeededOnce) throw err;
          console.error(`  ⚠ meituan: keyword "${keyword}" page ${pageNo} failed (${err.message}) — keeping the ${seen.size} jobs collected so far`);
          return [...seen.values()];
        }
        const parsed = parseMeituanResponse(json, companyName);
        succeededOnce = true;
        if (parsed.total) total = parsed.total;
        if (parsed.jobs.length > 0) { jobs = parsed.jobs; break; }
        if (total && (pageNo - 1) * PAGE_SIZE >= total) break; // legitimately past the end
      }

      if (!jobs) {
        if (total && (pageNo - 1) * PAGE_SIZE < total) {
          console.error(`  ⚠ meituan: keyword "${keyword}" page ${pageNo} still empty after ${EMPTY_RETRIES} retries — keeping the ${seen.size} jobs collected so far`);
        }
        break;
      }

      for (const job of jobs) {
        if (!seen.has(job.url)) seen.set(job.url, job);
      }

      if (total && pageNo * PAGE_SIZE >= total) break;
    }
  }

  return [...seen.values()];
}
