// @ts-check
/**
 * ADP Workforce Now Recruitment source — the public, no-auth "staffing" event
 * API behind a tenant's recruitment page. Single-company ATS: one
 * `tracked_companies` entry per tenant.
 *
 *   List:   GET {API_BASE}/job-requisitions?cid={CID}&ccId={CCID}&$skip=1&$top=20
 *   Detail: GET {API_BASE}/job-requisitions/{itemID}?cid=..&ccId=..&lang=en_US&locale=en_US
 *
 * Ported from parent career-ops `providers/adp-workforcenow.mjs` and rewritten
 * to the web-ui source contract (12-field job objects + `meta`).
 *
 * Parent quirks kept on purpose:
 *   - `$skip` is ONE-BASED and advances by the rows actually returned, never by
 *     the fixed page size of 20.
 *   - Pagination stops on an empty page, a page with no fresh ids (server
 *     ignored `$skip`), or a short page. A full page on the last allowed
 *     iteration marks the result truncated (`adpTruncated` + console warning),
 *     whether or not `meta.totalNumber` was present.
 *   - A response with neither a `jobRequisitions` array nor a `meta` object is
 *     an unrecognized shape and throws, never "0 jobs". A positive
 *     `meta.totalNumber` with no array also throws.
 *   - `ExternalJobID` (customFieldGroup.stringFields) is the public job number;
 *     it falls back to `itemID` for the posting URL.
 *   - Salary: structured payGradeRange first; else digits from the free-text
 *     `SalaryRange` field. Hourly free-text is skipped, and only a 3-letter ISO
 *     code counts as a currency. Never invented.
 *   - Detail enrichment is opt-in (`adpWorkforcenow.fetchDetails`), sequential,
 *     capped by `detailLimit` (1..100, default 25), fail-soft per job, and
 *     skipped while a bounded probe (`maxPages`) is running.
 *
 *   tracked_companies:
 *     - name: Example employer
 *       provider: adp-workforcenow
 *       careers_url: https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=...&ccId=...
 *       max_pages: 100           # optional, hard ceiling 1500
 *       adpWorkforcenow:
 *         fetchDetails: false
 *         detailLimit: 25
 *
 * Used by the adp-workforcenow adapter.
 */
import {
  fetchJson,
  delay,
  computeRetryDelayMs,
  REDIRECT_REFUSAL_CAUSE_MESSAGE,
  BROWSER_LIKE_USER_AGENT,
} from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';

export const meta = {
  value: 'adp-workforcenow',
  label: 'ADP Workforce Now',
  region: 'en',
};

export const ADP_HOST = 'workforcenow.adp.com';
export const API_BASE = `https://${ADP_HOST}/mascsr/default/careercenter/public/events/staffing/v1`;
export const PAGE_SIZE = 20;
export const DEFAULT_MAX_PAGES = 100;
export const MAX_PAGES_CAP = 1500;
export const INTER_PAGE_DELAY_MS = 250;
const DEFAULT_DETAIL_LIMIT = 25;
const MAX_DETAIL_LIMIT = 100;
const SNIPPET_CAP = 500;
const RETRIES = 2;
const RETRY_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 8000;

const HEADERS = { 'User-Agent': BROWSER_LIKE_USER_AGENT, accept: 'application/json' };

/** @param {unknown} v */
function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * cid/ccId from an ADP recruitment or API URL (either query order). Host-pinned
 * (exact hostname), HTTPS-only. Exported for the adapter and tests.
 * @param {unknown} raw
 * @returns {{ cid: string, ccId: string } | null}
 */
export function parseTenantUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let parsed;
  try { parsed = new URL(raw.trim()); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== ADP_HOST) return null;
  const cid = parsed.searchParams.get('cid');
  const ccId = parsed.searchParams.get('ccId');
  return cid && ccId ? { cid, ccId } : null;
}

/** `api:` first, then `careers_url`. @param {any} entry */
export function resolveTenant(entry) {
  return parseTenantUrl(entry?.api) || parseTenantUrl(entry?.careers_url);
}

/** @param {string} cid @param {string} ccId @param {number} skip */
export function buildListUrl(cid, ccId, skip) {
  const u = new URL(`${API_BASE}/job-requisitions`);
  u.searchParams.set('cid', cid);
  u.searchParams.set('ccId', ccId);
  u.searchParams.set('$skip', String(skip));
  u.searchParams.set('$top', String(PAGE_SIZE));
  return u.href;
}

/** @param {string} itemId @param {string} cid @param {string} ccId */
export function buildDetailUrl(itemId, cid, ccId) {
  const enc = safeEncodeURIComponent(itemId);
  if (enc === null) return null;
  const u = new URL(`${API_BASE}/job-requisitions/${enc}`);
  u.searchParams.set('cid', cid);
  u.searchParams.set('ccId', ccId);
  u.searchParams.set('lang', 'en_US');
  u.searchParams.set('locale', 'en_US');
  return u.href;
}

/** Throwing SSRF guard for every request. @param {string} url */
export function assertAdpUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error(`adp-workforcenow: invalid URL: ${url}`); }
  if (parsed.protocol !== 'https:') throw new Error(`adp-workforcenow: URL must use HTTPS: ${url}`);
  if (parsed.hostname.toLowerCase() !== ADP_HOST) {
    throw new Error(`adp-workforcenow: untrusted hostname "${parsed.hostname}" — must be ${ADP_HOST}`);
  }
  return url;
}

/** @param {any} group @param {string} groupKey @param {string} codeValue */
function findCustomField(group, groupKey, codeValue) {
  const list = group?.[groupKey];
  if (!Array.isArray(list)) return null;
  return list.find((f) => f?.nameCode?.codeValue === codeValue) ?? null;
}

/** @param {any} group */
export function extractExternalJobId(group) {
  const v = findCustomField(group, 'stringFields', 'ExternalJobID')?.stringValue;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** NaN-safe Date.parse. @param {unknown} value */
function toEpochMs(value) {
  if (!value) return undefined;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** @param {any} job */
export function extractPostedAt(job) {
  const direct = toEpochMs(job?.postDate);
  if (direct !== undefined) return direct;
  return toEpochMs(findCustomField(job?.customFieldGroup, 'dateFields', 'PostingDate')?.dateValue);
}

/** Dedupe and join work locations with " / ". @param {any} job */
export function extractLocation(job) {
  const list = Array.isArray(job?.requisitionLocations) ? job.requisitionLocations : [];
  const out = [];
  for (const loc of list) {
    const nameCode = loc?.nameCode;
    let label = str(nameCode?.shortName) || str(nameCode?.longName);
    if (!label) {
      const addr = loc?.address;
      label = [
        str(addr?.cityName),
        str(addr?.countrySubdivisionLevel1?.codeValue),
        str(addr?.country?.codeValue),
      ].filter(Boolean).join(', ');
    }
    if (label && !out.includes(label)) out.push(label);
  }
  return out.join(' / ');
}

/**
 * Best-effort salary; null when absent. Same logic as the parent.
 * @param {any} job
 * @returns {{min?: number, max?: number, currency?: string} | null}
 */
export function extractSalary(job) {
  const range = job?.payGradeRange;
  const minAmt = range?.minimumRate?.amountValue;
  const maxAmt = range?.maximumRate?.amountValue;
  const min = typeof minAmt === 'number' && Number.isFinite(minAmt) ? minAmt : null;
  const max = typeof maxAmt === 'number' && Number.isFinite(maxAmt) ? maxAmt : null;
  if (min !== null || max !== null) {
    const currency = range?.minimumRate?.currencyCode || range?.maximumRate?.currencyCode || '';
    return {
      ...(min !== null ? { min } : {}),
      ...(max !== null ? { max } : {}),
      ...(typeof currency === 'string' && currency ? { currency } : {}),
    };
  }
  const salaryRange = findCustomField(job?.customFieldGroup, 'stringFields', 'SalaryRange')?.stringValue;
  const symbolOrCode = findCustomField(job?.customFieldGroup, 'stringFields', 'CurrencySymbolOrCode')?.stringValue;
  if (typeof salaryRange === 'string' && salaryRange.trim()) {
    if (/\bhour(?:ly)?\b|\bper\s+hour\b/i.test(salaryRange)) return null;
    const nums = (salaryRange.match(/[\d,]+(?:\.\d+)?/g) || [])
      .map((n) => Number(n.replace(/,/g, '')))
      .filter((n) => Number.isFinite(n));
    if (nums.length > 0) {
      return {
        min: Math.min(...nums),
        max: Math.max(...nums),
        currency: typeof symbolOrCode === 'string' && /^[A-Z]{3}$/.test(symbolOrCode.trim())
          ? symbolOrCode.trim() : '',
      };
    }
  }
  return null;
}

/**
 * web-ui jobs carry salary as a display string.
 * @param {{min?: number, max?: number, currency?: string} | null} s
 */
export function formatSalary(s) {
  if (!s) return '';
  const { min, max, currency } = s;
  const span = min !== undefined && max !== undefined && min !== max
    ? `${min} - ${max}`
    : String(min ?? max);
  return currency ? `${span} ${currency}` : span;
}

/**
 * Canonical public posting URL; `jobId` falls back to itemID when
 * ExternalJobID is absent. Null on a lone-surrogate id.
 * @param {string} cid @param {string} ccId @param {string} itemId @param {string | null} externalJobId
 */
export function buildPostingUrl(cid, ccId, itemId, externalJobId) {
  const jobId = externalJobId || itemId;
  // Probe only — URLSearchParams does the encoding (avoids double-encoding `%`).
  if (safeEncodeURIComponent(jobId) === null || safeEncodeURIComponent(itemId) === null) return null;
  const u = new URL(`https://${ADP_HOST}/mascsr/default/mdf/recruitment/recruitment.html`);
  u.searchParams.set('cid', cid);
  u.searchParams.set('ccId', ccId);
  u.searchParams.set('lang', 'en_US');
  u.searchParams.set('type', 'JS');
  u.searchParams.set('jobId', jobId);
  u.searchParams.set('jwId', itemId);
  return u.href;
}

/**
 * Parse one list-page response into web-ui job rows (+ internal `_itemId`).
 * @param {any} json
 * @param {{ cid: string, ccId: string, companyName: string }} cfg
 * @returns {{ jobs: any[], total: number | null, raw: any[] }}
 */
export function parseListPage(json, cfg) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('adp-workforcenow: unrecognized job-requisitions response');
  }
  const metaOk = json.meta && typeof json.meta === 'object' && !Array.isArray(json.meta);
  if (!Array.isArray(json.jobRequisitions) && !metaOk) {
    throw new Error('adp-workforcenow: unrecognized job-requisitions response');
  }
  if (metaOk && typeof json.meta.totalNumber === 'number' && json.meta.totalNumber > 0
    && !Array.isArray(json.jobRequisitions)) {
    throw new Error('adp-workforcenow: response has a positive totalNumber but no jobRequisitions array');
  }
  const raw = Array.isArray(json.jobRequisitions) ? json.jobRequisitions : [];
  const total = typeof json?.meta?.totalNumber === 'number' ? json.meta.totalNumber : null;
  const jobs = [];
  for (const j of raw) {
    if (!j || typeof j !== 'object') continue;
    const itemId = str(j.itemID);
    const title = str(j.requisitionTitle);
    if (!itemId || !title) continue;
    const url = buildPostingUrl(cfg.cid, cfg.ccId, itemId, extractExternalJobId(j.customFieldGroup));
    if (!url) continue;
    const location = extractLocation(j);
    const postedAt = extractPostedAt(j);
    const isRemote = /\bremote\b/i.test(location);
    jobs.push({
      id: `adp-workforcenow-${cfg.cid}-${itemId}`,
      title,
      company: cfg.companyName,
      url,
      salary: formatSalary(extractSalary(j)),
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: postedAt !== undefined ? new Date(postedAt).toISOString().slice(0, 10) : '',
      snippet: '',
      source: 'adp-workforcenow',
      _itemId: itemId,
    });
  }
  return { jobs, total, raw };
}

/** @param {unknown} val @param {number} def @param {number} min @param {number} max */
function intInRange(val, def, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** @param {any} entry */
export function parseAdpConfig(entry) {
  const cfg = entry && typeof entry.adpWorkforcenow === 'object' && entry.adpWorkforcenow ? entry.adpWorkforcenow : {};
  return {
    fetchDetails: cfg.fetchDetails === true,
    detailLimit: intInRange(cfg.detailLimit, DEFAULT_DETAIL_LIMIT, 1, MAX_DETAIL_LIMIT),
  };
}

/** @param {any} entry */
export function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * fetchJson with the parent's retry budget (429, 5xx, status-less network
 * errors; never a permanent 4xx or a refused redirect). Injectable sleep.
 */
async function fetchJsonRetry(fetchImpl, url, { signal, sleep, retryDelayMs }) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      return await fetchJson(/** @type {any} */ (fetchImpl), url, { signal, headers: HEADERS, redirect: 'error' });
    } catch (err) {
      lastErr = err;
      const status = err && typeof err.status === 'number' ? err.status : undefined;
      const redirectRefusal = status === undefined
        && err instanceof TypeError
        && err?.cause?.message === REDIRECT_REFUSAL_CAUSE_MESSAGE;
      const transient = !redirectRefusal && (status === undefined || status === 429 || status >= 500);
      if (!transient || attempt === RETRIES || signal?.aborted) throw err;
      await sleep(computeRetryDelayMs({
        attempt, baseDelayMs: retryDelayMs, maxDelayMs: RETRY_MAX_DELAY_MS, retryAfter: err?.retryAfter,
      }), signal);
    }
  }
  throw lastErr;
}

/**
 * Fetch and normalize one ADP Workforce Now tenant.
 *
 * @param {string} endpoint list API URL (carries cid/ccId); re-validated here
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any, maxPages?: number,
 *           sleep?: (ms: number, signal?: AbortSignal) => Promise<void>, retryDelayMs?: number }} [opts]
 * @returns {Promise<any[]>}
 */
export async function fetchAdpWorkforcenow(endpoint, opts = {}) {
  const {
    fetchImpl = fetch, signal, company = {}, maxPages, sleep = delay, retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  assertAdpUrl(endpoint);
  const tenant = parseTenantUrl(endpoint) || resolveTenant(company);
  const name = str(company?.name);
  if (!tenant) throw new Error(`adp-workforcenow: cannot derive cid/ccId for ${name || endpoint}`);
  const { cid, ccId } = tenant;
  const cfg = { cid, ccId, companyName: name };
  const io = { signal, sleep, retryDelayMs };

  const probeCap = Number.isInteger(maxPages) && /** @type {number} */ (maxPages) > 0
    ? /** @type {number} */ (maxPages) : Infinity;
  const configured = resolveMaxPages(company);
  const pageLimit = Math.min(configured, probeCap);

  /** @type {any[]} */
  const jobs = [];
  const seen = new Set();
  let skip = 1; // ADP's $skip is one-based.
  let total = null;
  let cappedIncomplete = false;

  for (let page = 0; page < pageLimit; page++) {
    if (signal?.aborted) break;
    if (page > 0) await sleep(INTER_PAGE_DELAY_MS, signal);
    const json = await fetchJsonRetry(fetchImpl, assertAdpUrl(buildListUrl(cid, ccId, skip)), io);
    if (json && typeof json === 'object' && !Array.isArray(json.jobRequisitions) && json.meta === undefined) {
      throw new Error(`adp-workforcenow: unrecognized job-requisitions response for ${name} — keys: ${Object.keys(json).join(', ') || '(none)'}`);
    }
    const { jobs: pageJobs, total: pageTotal, raw } = parseListPage(json, cfg);
    if (pageTotal !== null) total = pageTotal;
    if (raw.length === 0) break;

    let fresh = 0;
    for (const job of pageJobs) {
      if (seen.has(job._itemId)) continue;
      seen.add(job._itemId);
      fresh++;
      jobs.push(job);
    }
    if (fresh === 0) break; // server ignored $skip, or we looped
    skip += raw.length; // rows actually returned, never PAGE_SIZE
    if (raw.length < PAGE_SIZE) break;
    if (page === pageLimit - 1) cappedIncomplete = true;
  }

  const truncated = cappedIncomplete && probeCap === Infinity;
  if (truncated) {
    console.error(`adp-workforcenow: ${name} truncated at max_pages=${configured} (${jobs.length}${total !== null ? ` of ${total}` : ''} jobs) — raise max_pages on this entry for more`);
  }

  const { fetchDetails, detailLimit } = parseAdpConfig(company);
  if (fetchDetails && probeCap === Infinity) {
    for (const job of jobs.slice(0, detailLimit)) {
      if (signal?.aborted) break;
      await sleep(INTER_PAGE_DELAY_MS, signal);
      try {
        const detailUrl = buildDetailUrl(job._itemId, cid, ccId);
        if (!detailUrl) continue;
        const detail = await fetchJsonRetry(fetchImpl, assertAdpUrl(detailUrl), io);
        const description = htmlToText(detail?.requisitionDescription);
        if (description) {
          job.description = description;
          job.snippet = description.slice(0, SNIPPET_CAP);
        }
      } catch {
        // Enrichment only — keep the listing row.
      }
    }
  }

  const result = jobs.map(({ _itemId, ...job }) => job);
  if (truncated) /** @type {any} */ (result).adpTruncated = true;
  return result;
}
