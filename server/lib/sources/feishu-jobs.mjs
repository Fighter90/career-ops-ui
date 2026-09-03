// @ts-check
/**
 * Feishu Jobs (飞书招聘, internal codename "ATSX") source.
 *
 *   POST <origin>/api/v1/search/job/posts
 *        { limit, offset[, keyword] }
 *
 * This is the public endpoint every tenant's own careers-site frontend calls:
 * no login, no CSRF token, no API key. Two host shapes are accepted and
 * nothing else — ByteDance's own board (`jobs.bytedance.com`) and the shared
 * tenant domain (`<tenant>.jobs.feishu.cn`). The two differ in the job-page
 * path, which is why the URL is built per origin rather than by one template.
 *
 * A tenant selects it with `provider: feishu-jobs` plus a `careers_url` naming
 * the origin; `keywords:` narrows the search server-side, and an empty keyword
 * means the whole board — deliberately the default, so a shared source carries
 * no one user's topical bias.
 *
 * The WAF on these tenants 403s the Windows browser UA and serves the macOS one,
 * which is why this source uses `MACOS_BROWSER_LIKE_USER_AGENT`.
 *
 * Ported from parent career-ops v1.31.0 (`providers/feishu-jobs.mjs`).
 */
import { fetchJson, MACOS_BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';

export const meta = {
  value: 'feishu-jobs',
  label: 'Feishu Jobs',
  region: 'en',
};

const PAGE_SIZE = 100;
const DEFAULT_KEYWORDS = [''];      // empty keyword = the whole board, no topical bias
const DEFAULT_MAX_PAGES = 200;
const HARD_MAX_PAGES = 200;
const INTER_PAGE_DELAY_MS = 300;

/**
 * Resolve a careers URL to the API origin, or null when it is not a Feishu
 * Jobs host. HTTPS-only; `jobs.bytedance.com` exactly, or any
 * `*.jobs.feishu.cn` tenant — an `endsWith` on the bare `feishu.cn` would let
 * `jobs.feishu.cn.evil.test` through, hence the leading-dot suffix.
 * @param {unknown} value
 * @returns {string|null}
 */
export function resolveFeishuOrigin(value) {
  if (typeof value !== 'string') return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const own = url.hostname === 'jobs.bytedance.com';
  const tenant = url.hostname.endsWith('.jobs.feishu.cn');
  return own || tenant ? url.origin : null;
}

/**
 * Normalize one API page.
 *
 * Returns `total` alongside the rows so the caller can stop as soon as the
 * pages it has cover the reported count, rather than probing until an empty
 * page comes back.
 * @param {any} json
 * @param {string} companyName
 * @param {string} origin
 */
export function parseFeishuJobsResponse(json, companyName, origin) {
  const list = json?.data?.job_post_list;
  const total = Number(json?.data?.count) || 0;
  if (!Array.isArray(list)) return { jobs: [], total };

  const jobs = [];
  for (const p of list) {
    const title = p?.title;
    const id = p?.id;
    if (!title || id == null) continue;

    const cities = Array.isArray(p.city_list)
      ? p.city_list.map((c) => c?.name).filter(Boolean).join('/')
      : '';
    const category = p?.job_category?.name || '';
    const recruitType = p?.recruit_type?.name || '';
    const description = [
      category && `类别: ${category}`,
      recruitType && `类型: ${recruitType}`,
    ].filter(Boolean).join(' · ');

    // The two host shapes use different job-page paths.
    const url = origin === 'https://jobs.bytedance.com'
      ? `${origin}/experienced/position/${encodeURIComponent(id)}/detail`
      : `${origin}/index/position/${encodeURIComponent(id)}/detail`;

    jobs.push({
      id: `feishu-jobs-${id}`,
      title,
      company: companyName,
      url,
      salary: '',
      location: cities,
      isRemote: /remote|远程/i.test(cities),
      workplaceType: '',
      relocates: false,
      date: '',
      snippet: description,
      description,
      source: 'feishu-jobs',
    });
  }
  return { jobs, total };
}

/** @param {object} [company] */
export function buildFeishuUrl(company = {}) {
  const origin = resolveFeishuOrigin(company?.careers_url ?? company?.api);
  if (!origin) {
    throw new Error('feishu-jobs: careers_url must use HTTPS on jobs.bytedance.com or a *.jobs.feishu.cn tenant');
  }
  return `${origin}/api/v1/search/job/posts`;
}

const sleep = (ms, signal) => new Promise((resolve) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener?.('abort', () => { clearTimeout(t); resolve(undefined); }, { once: true });
});

/**
 * Fetch + normalize one Feishu Jobs tenant.
 * @param {string} url from buildEndpoint
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchFeishuJobs(url, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const api = url || buildFeishuUrl(company);
  const origin = new URL(api).origin;
  if (!resolveFeishuOrigin(origin)) {
    throw new Error(`feishu-jobs: untrusted origin ${origin}`);
  }

  const keywords = Array.isArray(company?.keywords) && company.keywords.length
    ? company.keywords
    : DEFAULT_KEYWORDS;
  const rawMax = Number(company?.max_pages);
  const maxPages = Number.isSafeInteger(rawMax) && rawMax > 0
    ? Math.min(rawMax, HARD_MAX_PAGES)
    : DEFAULT_MAX_PAGES;
  const companyName = company?.name || origin;

  /** @type {Map<string, object>} */
  const seen = new Map();
  let firstRequest = true;

  for (const keyword of keywords) {
    for (let page = 1; page <= maxPages; page++) {
      const offset = (page - 1) * PAGE_SIZE;
      if (!firstRequest) await sleep(INTER_PAGE_DELAY_MS, signal);
      firstRequest = false;

      let json;
      try {
        json = await fetchJson(fetchImpl, api, {
          method: 'POST',
          signal,
          headers: {
            'content-type': 'application/json',
            'user-agent': MACOS_BROWSER_LIKE_USER_AGENT,
            referer: `${origin}/`,
          },
          body: JSON.stringify(keyword ? { limit: PAGE_SIZE, offset, keyword } : { limit: PAGE_SIZE, offset }),
          redirect: 'error',
        });
        if (json?.code !== 0) throw new Error(`API error: code=${json?.code}`);
      } catch (err) {
        // The first page failing means the tenant or the endpoint is wrong, and
        // that must surface. A later page failing after rows are already in
        // hand is a partial result worth keeping — dropping it would turn a
        // network blip into "this tenant has no jobs".
        if (seen.size === 0) throw err;
        console.error(`  ⚠ feishu-jobs: keyword "${keyword}" page ${page} failed (${err.message}) — keeping the ${seen.size} jobs collected so far`);
        return [...seen.values()];
      }

      const pageRows = Array.isArray(json?.data?.job_post_list) ? json.data.job_post_list : [];
      const { jobs, total } = parseFeishuJobsResponse(json, companyName, origin);
      if (pageRows.length === 0) break;
      for (const job of jobs) if (!seen.has(job.url)) seen.set(job.url, job);

      if (Math.min(offset + PAGE_SIZE, total) >= total) break;
    }
  }

  return [...seen.values()];
}
