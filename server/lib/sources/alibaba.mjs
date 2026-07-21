/**
 * Alibaba Group careers source — posts to the public talent.alibaba.com JSON
 * API (no auth, no login, no browser).
 *
 * Ported from parent career-ops `providers/alibaba.mjs` into the web-ui source
 * contract. Alibaba is a single-company board, so it is selected via an
 * explicit `provider: alibaba` entry or auto-detected from a talent.alibaba.com
 * careers_url. Config comes from the company entry, read via `opts.company`:
 *
 *   tracked_companies:
 *     - name: 阿里巴巴
 *       careers_url: https://talent.alibaba.com/off-campus/position-list  # auto-detected
 *       keywords: ["AI", "大模型"]  # each keyword is a separate server-side
 *                                   # query, results deduped; omit to pull the
 *                                   # whole board (~4100 postings)
 *       max_pages: 50               # per keyword, pageSize 100
 *
 * API shape (verified 2026-07 by capturing the site's own XHR):
 *   POST /position/search
 *   { "channel": "group_official_site", "language": "zh", "key": "大模型",
 *     "pageIndex": 1, "pageSize": 100, "batchId": "", "categories": "",
 *     "deptCodes": [], "regions": "", "subCategories": "" }
 *
 * The endpoint sits behind a stateless double-submit-cookie CSRF filter, not an
 * auth wall: it accepts any request whose XSRF-TOKEN cookie matches the
 * x-xsrf-token header, and 403s on a mismatch (a self-minted UUID pair is
 * accepted — no server-side session). So each run mints one random token and
 * sends it both ways; there is no login, cookie jar, or bootstrap request.
 *
 * The detail URL is built from the numeric position id rather than the API's
 * own positionUrl field, which embeds a per-request track_id that would make
 * the dedup key (the URL) unstable across scans.
 *
 * Used by the alibaba adapter (server/lib/portals/adapters/alibaba.mjs).
 */
import { randomUUID } from 'node:crypto';
import { fetchJson, delay } from '../http-json.mjs';

const API_HOST = 'talent.alibaba.com';
export const DEFAULT_API = `https://${API_HOST}/position/search`;
const DETAIL = `https://${API_HOST}/off-campus/position-detail?positionId=`;
const PAGE_SIZE = 100;
const DEFAULT_KEYWORDS = ['']; // empty keyword = the whole board, no topical bias
const DEFAULT_MAX_PAGES = 50; // whole board is ~4100 postings ≈ 42 pages
// Every request after the first pays it — across pages and keyword switches
// (same idiom as avature/workday). A whole-board pull is 40+ requests, so pace
// politely.
const INTER_PAGE_DELAY_MS = 300;
const SNIPPET_CAP = 500;

export const meta = {
  value: 'alibaba',
  label: 'Alibaba',
  region: 'en',
};

/** @param {string} url */
export function assertAlibabaUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`alibaba: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`alibaba: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== API_HOST) {
    throw new Error(`alibaba: untrusted hostname "${parsed.hostname}" — must be ${API_HOST}`);
  }
  return url;
}

/** Alibaba publish/modify times are 13-digit epoch ms; NaN/seconds-safe. */
function toEpochMs(v) {
  if (v == null) return undefined;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n > 1e12 ? n : n * 1000;
  const parsed = Date.parse(String(v));
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** experience is {from, to} in years; either side may be null/absent. */
function formatExperience(exp) {
  if (!exp || typeof exp !== 'object') return '';
  const from = Number.isFinite(exp.from) ? exp.from : null;
  const to = Number.isFinite(exp.to) ? exp.to : null;
  if (from != null && to != null) return `${from}-${to}年`;
  if (from != null) return `${from}年以上`;
  if (to != null) return `${to}年以下`;
  return '';
}

function buildBody(key, pageIndex) {
  return JSON.stringify({
    channel: 'group_official_site',
    language: 'zh',
    batchId: '',
    categories: '',
    deptCodes: [],
    key,
    pageIndex,
    pageSize: PAGE_SIZE,
    regions: '',
    subCategories: '',
  });
}

/**
 * Parse one page of the position/search payload into web-ui Jobs.
 * Exported for unit tests.
 * @param {any} json
 * @param {string} companyName
 * @returns {{ jobs: object[], total: number }}
 */
export function parseAlibabaResponse(json, companyName) {
  const list = json?.content?.datas;
  const total = Number(json?.content?.totalCount) || 0;
  if (!Array.isArray(list)) return { jobs: [], total };

  const jobs = [];
  for (const p of list) {
    const title = p.name || '';
    const id = p.id;
    if (!title || id == null) continue;
    const experience = formatExperience(p.experience);
    const postedAt = toEpochMs(p.publishTime ?? p.modifyTime);
    // Alibaba posts carry full-text JDs (description + requirement), much
    // longer than other boards' summaries — cap to keep scan payloads sane.
    const snippet = [
      Array.isArray(p.categories) && p.categories.length && `类别: ${p.categories.filter(Boolean).join('/')}`,
      experience && `经验: ${experience}`,
      p.description,
      p.requirement,
    ].filter(Boolean).join('\n').slice(0, SNIPPET_CAP);
    jobs.push({
      id: `alibaba-${String(id)}`,
      title,
      company: companyName,
      url: DETAIL + encodeURIComponent(id),
      salary: '',
      location: Array.isArray(p.workLocations) ? p.workLocations.filter(Boolean).join('/') : '',
      isRemote: false,
      workplaceType: 'Onsite',
      relocates: false,
      date: postedAt != null ? new Date(postedAt).toISOString() : '',
      snippet,
      source: 'alibaba',
    });
  }
  return { jobs, total };
}

/**
 * Fetch + normalize Alibaba postings, paginating per keyword and deduping the
 * union by detail URL. One CSRF token is minted per run and sent as both the
 * XSRF-TOKEN cookie and the x-xsrf-token header (double-submit-cookie).
 * @param {string} apiUrl API endpoint (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchAlibaba(apiUrl = DEFAULT_API, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertAlibabaUrl(apiUrl);

  const keywords = Array.isArray(company.keywords) && company.keywords.length
    ? company.keywords
    : DEFAULT_KEYWORDS;
  const maxPages = Number(company.max_pages) > 0 ? Number(company.max_pages) : DEFAULT_MAX_PAGES;
  const companyName = company.name || '阿里巴巴';

  // One token per run, sent as both cookie and header (see file header).
  const csrfToken = randomUUID();

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
        json = await fetchJson(fetchImpl, apiUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `XSRF-TOKEN=${csrfToken}`,
            'x-xsrf-token': csrfToken,
          },
          body: buildBody(keyword, page),
          signal,
        });
        // The API reports failures in-band with HTTP 200; surface them so a
        // dead board doesn't read as an empty-but-alive one.
        if (json?.success === false) {
          throw new Error(`API error: ${json.errorMsg || json.errorCode || 'success=false'}`);
        }
      } catch (err) {
        // A dead board should still read as a failure, but a mid-run blip must
        // not discard what's already collected (same idiom as
        // workday/jobstreet/glints). Track successes directly — a keyword can
        // legitimately match 0 jobs, so seen.size is not the signal.
        if (!succeededOnce) throw err;
        console.error(`  ⚠ alibaba: keyword "${keyword}" page ${page} failed (${err.message}) — keeping the ${seen.size} jobs collected so far`);
        return [...seen.values()];
      }
      succeededOnce = true;
      const { jobs, total } = parseAlibabaResponse(json, companyName);
      if (jobs.length === 0) break;

      for (const job of jobs) {
        if (!seen.has(job.url)) seen.set(job.url, job);
      }

      if (page * PAGE_SIZE >= total) break;
    }
  }

  return [...seen.values()];
}
