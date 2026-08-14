/**
 * Tencent careers source — hits the public careers.tencent.com JSON API.
 * Zero-auth, no browser needed.
 *
 * Implements the
 * web-ui source contract. Tencent is a single-company board, so it is
 * selected via an explicit `provider: tencent` entry or auto-detected from a
 * careers.tencent.com careers_url. Config comes from the company entry, read
 * via `opts.company`:
 *
 *   tracked_companies:
 *     - name: 腾讯
 *       careers_url: https://careers.tencent.com/search.html   # auto-detected
 *       keywords: ["AI", "大模型"]  # each keyword is queried server-side
 *                                   # separately, results deduped; omit to pull
 *                                   # the whole board (empty-keyword query)
 *       max_pages: 20               # per keyword, pageSize 100 → up to 2000 posts/keyword
 *
 * GET /tencentcareer/api/post/Query returns structured JSON with title,
 * location, BG, category, JD text and last-update time ("2026年06月23日").
 *
 * Used by the tencent adapter (server/lib/portals/adapters/tencent.mjs).
 */
import { fetchJson, delay } from '../http-json.mjs';

const API_HOST = 'careers.tencent.com';
const API_PATH = '/tencentcareer/api/post/Query';
export const DEFAULT_API = `https://${API_HOST}${API_PATH}`;
const PAGE_SIZE = 100;
const DEFAULT_KEYWORDS = ['']; // empty keyword = the whole board, no topical bias
const DEFAULT_MAX_PAGES = 20;
// Every request after the first pays it — across pages and keyword switches
// (same idiom as avature/workday).
const INTER_PAGE_DELAY_MS = 150;
const SNIPPET_CAP = 500;

export const meta = {
  value: 'tencent',
  label: 'Tencent',
  region: 'en',
};

/** @param {string} url */
export function assertTencentUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`tencent: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`tencent: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== API_HOST) {
    throw new Error(`tencent: untrusted hostname "${parsed.hostname}" — must be ${API_HOST}`);
  }
  return url;
}

/** Parse "2026年06月23日" → epoch ms. NaN-safe. Exported for unit tests. */
export function parseCnDate(value) {
  if (!value) return undefined;
  const m = String(value).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return undefined;
  const ts = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ts) ? undefined : ts;
}

function buildUrl(keyword, pageIndex) {
  const params = new URLSearchParams({
    timestamp: String(Date.now()),
    keyword,
    pageIndex: String(pageIndex),
    pageSize: String(PAGE_SIZE),
    language: 'zh-cn',
  });
  return `https://${API_HOST}${API_PATH}?${params}`;
}

/**
 * Parse one page of the careers.tencent.com Query API payload into web-ui
 * Jobs. Exported for unit tests.
 * @param {any} json
 * @param {string} companyName
 * @returns {{ jobs: object[], total: number }}
 */
export function parseTencentResponse(json, companyName) {
  const posts = json?.Data?.Posts;
  const total = Number(json?.Data?.Count) || 0;
  if (!Array.isArray(posts)) return { jobs: [], total };

  const jobs = [];
  for (const p of posts) {
    const title = p.RecruitPostName || '';
    const url = p.PostURL || (p.PostId
      ? `https://careers.tencent.com/jobdesc.html?postId=${p.PostId}`
      : '');
    if (!title || !url) continue;
    const postedAt = parseCnDate(p.LastUpdateTime);
    const snippet = [
      p.BGName && `BG: ${p.BGName}`,
      p.CategoryName && `类别: ${p.CategoryName}`,
      p.RequireWorkYearsName && `经验: ${p.RequireWorkYearsName}`,
      p.Responsibility,
    ].filter(Boolean).join('\n').slice(0, SNIPPET_CAP);
    jobs.push({
      id: `tencent-${p.PostId != null ? String(p.PostId) : url}`,
      title,
      company: companyName,
      url,
      salary: '',
      location: [p.CountryName, p.LocationName].filter(Boolean).join('-'),
      isRemote: false,
      workplaceType: 'Onsite',
      relocates: false,
      date: postedAt != null ? new Date(postedAt).toISOString() : '',
      snippet,
      source: 'tencent',
    });
  }
  return { jobs, total };
}

/**
 * Fetch + normalize Tencent postings, paginating per keyword.
 * @param {string} apiUrl API endpoint base (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchTencent(apiUrl = DEFAULT_API, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertTencentUrl(apiUrl);

  const keywords = Array.isArray(company.keywords) && company.keywords.length
    ? company.keywords
    : DEFAULT_KEYWORDS;
  const maxPages = Number(company.max_pages) > 0 ? Number(company.max_pages) : DEFAULT_MAX_PAGES;
  const companyName = company.name || '腾讯';

  /** @type {Map<string, object>} */
  const seen = new Map();
  let firstRequest = true;
  let succeededOnce = false;

  for (const keyword of keywords) {
    for (let page = 1; page <= maxPages; page++) {
      if (firstRequest) firstRequest = false;
      else await delay(INTER_PAGE_DELAY_MS, signal);

      let json;
      try {
        json = await fetchJson(fetchImpl, buildUrl(keyword, page), { signal });
      } catch (err) {
        // A dead board should still read as a failure, but a mid-run blip
        // must not discard what's already collected (same idiom as
        // workday/jobstreet/glints). Track successes directly — a keyword
        // can legitimately match 0 jobs, so seen.size is not the signal.
        if (!succeededOnce) throw err;
        console.error(`  ⚠ tencent: keyword "${keyword}" page ${page} failed (${err.message}) — keeping the ${seen.size} jobs collected so far`);
        return [...seen.values()];
      }
      succeededOnce = true;
      const { jobs, total } = parseTencentResponse(json, companyName);
      if (jobs.length === 0) break;

      for (const job of jobs) {
        if (!seen.has(job.url)) seen.set(job.url, job);
      }

      if (page * PAGE_SIZE >= total) break;
    }
  }

  return [...seen.values()];
}
