// @ts-check
/**
 * UKG Pro / UltiPro Recruiting source — the public, no-auth "JobBoard" search
 * API behind a tenant's public job board. Per-tenant ATS (one entry per tenant).
 *
 *   List:   POST {origin}/{tenant}/JobBoard/{boardId}/JobBoardView/LoadSearchResults
 *   Detail: GET  {origin}/{tenant}/JobBoard/{boardId}/OpportunityDetail?opportunityId={Id}
 *
 * Ported from parent career-ops `providers/ultipro.mjs`, rewritten to the
 * web-ui source contract (12-field job objects + `meta` for auto-discovery).
 *
 * Host handling (do not "fix"): boards are NOT on one canonical host. The
 * origin used is whichever recruiting host the tenant's own URL names,
 * preserved verbatim. HOST_RE is an allowlist PATTERN
 * (`recruiting[N].ultipro.{com,ca}`), not a string-equality check, so the
 * `.ca` tenants and numbered hosts (recruiting2/recruiting3) are accepted.
 * HTTPS only, `redirect:'error'` on every request.
 *
 * Pagination is a plain Top/Skip row offset (Top=50). Stops on an empty page,
 * a short page, or a full page with no new ids. `totalCount` is reported but
 * never trusted as a stop condition. A page cap (max_pages, default 100, hard
 * ceiling 1500) applies independently; a board still holding rows when the cap
 * is hit is flagged `ultiproTruncated` on the returned array.
 *
 * The detail page is NOT JSON: the full JD lives in a `<script>` as
 * `new US.Opportunity.CandidateOpportunityDetail({...})`, extracted with a
 * string-aware brace-balancing walk. An expired id answers HTTP 200 with an
 * empty app shell (no marker) which is reported as `not-found`, never as a
 * successful empty description. Full-JD enrichment is opt-in:
 *
 *   tracked_companies:
 *     - name: Example
 *       careers_url: https://recruiting.ultipro.com/EXA5001EXCO/JobBoard/<guid>/
 *       ultipro:
 *         fetchDetails: true   # fetch each posting's detail page
 *         detailLimit: 25      # 1..100, default 25
 *
 * Used by the ultipro adapter (server/lib/portals/adapters/ultipro.mjs).
 */
import {
  fetchJson,
  fetchText,
  delay,
  computeRetryDelayMs,
  REDIRECT_REFUSAL_CAUSE_MESSAGE,
  BROWSER_LIKE_USER_AGENT,
} from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';

export const meta = {
  value: 'ultipro',
  label: 'UKG Pro (UltiPro)',
  region: 'en',
};

export const HOST_RE = /^recruiting\d*\.ultipro\.(?:com|ca)$/i;
const PATH_RE = /^\/([^/]+)\/JobBoard\/([^/]+)(?:\/|$)/;

export const PAGE_SIZE = 50;
export const DEFAULT_MAX_PAGES = 100;
export const MAX_PAGES_CAP = 1500;
export const INTER_PAGE_DELAY_MS = 250;
const DEFAULT_DETAIL_LIMIT = 25;
const MAX_DETAIL_LIMIT = 100;
const SNIPPET_CAP = 500;
const RETRIES = 2;
const RETRY_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 8000;
const REMOTE_RE = /\bremote\b/i;

const HEADERS_JSON = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  'content-type': 'application/json',
  accept: 'application/json',
};
const HEADERS_HTML = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.8',
};

/** @param {unknown} value */
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Resolve {origin, tenant, boardId} from an entry, honouring `api:` over
 * `careers_url`. `tenant`/`boardId` are taken verbatim from the URL path.
 * Exported for tests and the adapter.
 * @param {any} entry
 * @returns {{ origin: string, tenant: string, boardId: string } | null}
 */
export function resolveTenant(entry) {
  for (const raw of [entry?.api, entry?.careers_url]) {
    if (typeof raw !== 'string' || !raw) continue;
    let parsed;
    try { parsed = new URL(raw.trim()); } catch { continue; }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) continue;
    if (!HOST_RE.test(parsed.hostname)) continue;
    const m = parsed.pathname.match(PATH_RE);
    if (!m || !m[1] || !m[2]) continue;
    return { origin: `https://${parsed.hostname.toLowerCase()}`, tenant: m[1], boardId: m[2] };
  }
  return null;
}

/** Throwing SSRF guard: HTTPS + recruiting[N].ultipro.{com,ca} only.
 * @param {string} url */
export function assertUltiproUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error(`ultipro: invalid URL: ${url}`); }
  if (parsed.protocol !== 'https:') throw new Error(`ultipro: URL must use HTTPS: ${url}`);
  if (!HOST_RE.test(parsed.hostname)) {
    throw new Error(`ultipro: untrusted hostname "${parsed.hostname}" — must match recruiting[N].ultipro.com/.ca`);
  }
  return url;
}

/** @param {{origin:string,tenant:string,boardId:string}} t */
export function buildListUrl(t) {
  return `${t.origin}/${t.tenant}/JobBoard/${t.boardId}/JobBoardView/LoadSearchResults`;
}

/** @param {{origin:string,tenant:string,boardId:string}} t @param {string} opportunityId */
export function buildDetailUrl(t, opportunityId) {
  const seg = safeEncodeURIComponent(opportunityId);
  if (seg === null) return null;
  return `${t.origin}/${t.tenant}/JobBoard/${t.boardId}/OpportunityDetail?opportunityId=${seg}`;
}

/** @param {number} skip @param {number} top */
export function buildListBody(skip, top) {
  return {
    opportunitySearch: {
      Top: top,
      Skip: skip,
      QueryString: '',
      OrderBy: [{ Value: 'postedDateDesc', PropertyName: 'PostedDate', Ascending: false }],
      Filters: [],
    },
    matchCriteria: {
      PreferredJobs: [],
      Educations: [],
      LicenseAndCertifications: [],
      Skills: [],
      hasNoLicenses: false,
      SkippedSkills: [],
    },
  };
}

/** NaN-safe Date.parse; `|| undefined` would coerce a valid epoch 0.
 * @param {unknown} value */
function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * `Locations` is an array of `{ LocalizedName, Address: { City, State: { Code } } }`.
 * Prefers "City, StateCode", falls back to LocalizedName (a branch name), also
 * accepts bare strings. Deduped, joined with " / ".
 * @param {any} locations
 */
export function extractLocations(locations) {
  if (!Array.isArray(locations)) return '';
  const out = [];
  for (const loc of locations) {
    let label = '';
    if (typeof loc === 'string') {
      label = loc.trim();
    } else if (loc && typeof loc === 'object') {
      const city = String(loc.Address?.City || '').trim();
      const state = String(loc.Address?.State?.Code || '').trim();
      label = [city, state].filter(Boolean).join(', ');
      if (!label) label = String(loc.LocalizedName || '').trim();
    }
    if (label && !out.includes(label)) out.push(label);
  }
  return out.join(' / ');
}

/**
 * Parse one LoadSearchResults response. Throws on any body that is not an
 * object with an `opportunities` array (never a silent empty board). Rows
 * missing a usable Id or Title are dropped; a numeric Id is normalized to a
 * string; an Id with a lone surrogate drops just that row. `ids` is parallel
 * to `jobs` and carries each row's raw opportunity Id (the detail key).
 *
 * @param {any} json
 * @param {{ origin: string, tenant: string, boardId: string, companyName?: string }} cfg
 * @returns {{ jobs: object[], ids: string[], total: number|null, rawCount: number }}
 */
export function parseListPage(json, cfg) {
  if (!json || typeof json !== 'object' || Array.isArray(json) || !Array.isArray(json.opportunities)) {
    const shape = json && typeof json === 'object' && !Array.isArray(json)
      ? `keys: ${Object.keys(json).join(', ') || '(none)'}`
      : `type: ${Array.isArray(json) ? 'array' : typeof json}`;
    throw new Error(`ultipro: unrecognized LoadSearchResults response for ${cfg.companyName || cfg.tenant} — ${shape}`);
  }
  const rows = json.opportunities;
  const total = typeof json.totalCount === 'number' ? json.totalCount : null;
  const jobs = [];
  const ids = [];
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.Id === 'number' ? String(item.Id) : text(item.Id);
    const title = text(item.Title);
    if (!id || !title) continue;
    const url = buildDetailUrl(cfg, id);
    if (url === null) continue;
    const location = extractLocations(item.Locations);
    const postedAt = toEpochMs(item.PostedDate);
    const description = htmlToText(item.BriefDescription);
    const isRemote = REMOTE_RE.test(location);
    jobs.push({
      id: `ultipro-${cfg.tenant}-${id}`,
      title,
      company: text(cfg.companyName),
      url,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: postedAt !== undefined ? new Date(postedAt).toISOString().slice(0, 10) : '',
      snippet: description ? description.slice(0, SNIPPET_CAP) : '',
      source: 'ultipro',
      ...(description ? { description } : {}),
    });
    ids.push(id);
  }
  return { jobs, ids, total, rawCount: rows.length };
}

/**
 * Extract the `CandidateOpportunityDetail({...})` object from a detail page,
 * walking the string char-by-char so braces/quotes inside JD text never break
 * the depth count. Marker absent (expired posting, HTTP 200 app shell) gives
 * `{status:'not-found'}`; a malformed/unbalanced/mismatched object throws.
 * @param {unknown} html
 * @param {string|number} expectedId
 * @returns {{ status: 'not-found' } | { status: 'ok', detail: any }}
 */
export function extractCandidateOpportunityDetail(html, expectedId) {
  if (typeof html !== 'string' || !html) return { status: 'not-found' };
  const marker = 'CandidateOpportunityDetail(';
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return { status: 'not-found' };
  const start = html.indexOf('{', markerIndex + marker.length);
  if (start < 0) throw new Error('ultipro: detail marker has no JSON object');

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) {
        let detail;
        try {
          detail = JSON.parse(html.slice(start, i + 1));
        } catch (err) {
          throw new Error(`ultipro: malformed detail JSON — ${/** @type {Error} */ (err).message}`);
        }
        if (!detail || !detail.Id || !detail.Title) {
          throw new Error('ultipro: malformed UKG detail — missing Id/Title');
        }
        if (String(detail.Id) !== String(expectedId)) {
          throw new Error(`ultipro: detail ID mismatch — expected ${expectedId}, got ${detail.Id}`);
        }
        return { status: 'ok', detail };
      }
    }
  }
  throw new Error('ultipro: unbalanced detail JSON');
}

/** Clamp to an integer in [min, max]; `def` when not numeric. */
function intInRange(val, def, min, max) {
  if (val === undefined || val === null || val === '') return def;
  const n = Number(val);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Read the entry's optional `ultipro:` block. @param {any} company */
export function parseUltiproConfig(company) {
  const cfg = company && typeof company.ultipro === 'object' && company.ultipro ? company.ultipro : {};
  return {
    fetchDetails: cfg.fetchDetails === true,
    detailLimit: intInRange(cfg.detailLimit, DEFAULT_DETAIL_LIMIT, 1, MAX_DETAIL_LIMIT),
  };
}

/** Positive integer `max_pages` on the entry, capped; else the default. @param {any} company */
export function resolveMaxPages(company) {
  const v = company?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * Run `fn` with the parent's retry budget (1 + 2 retries): only 429, 5xx and
 * status-less network errors are retried; a refused redirect and a permanent
 * 4xx rethrow at once.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ signal?: AbortSignal, sleep: Function, retryDelayMs: number }} o
 * @returns {Promise<T>}
 */
async function withRetry(fn, { signal, sleep, retryDelayMs }) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      return await fn();
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
 * Fetch and normalize one UKG Pro tenant.
 *
 * The list request failing (or an unrecognized shape) propagates. Detail
 * enrichment is opt-in, bounded by `detailLimit`, sequential, paced and
 * fail-soft per job; skipped while probing (`maxPages` set).
 *
 * @param {string} endpoint list URL (from the adapter's buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any, maxPages?: number,
 *           sleep?: (ms: number, signal?: AbortSignal) => Promise<void>, retryDelayMs?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchUltipro(endpoint, opts = {}) {
  const {
    fetchImpl = fetch,
    signal,
    company = {},
    maxPages,
    sleep = delay,
    retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  assertUltiproUrl(endpoint);
  const tenant = resolveTenant({ api: endpoint }) || resolveTenant(company);
  if (!tenant) throw new Error(`ultipro: cannot derive tenant/boardId for ${company?.name || endpoint}`);
  const cfg = { ...tenant, companyName: text(company?.name) };
  const listUrl = assertUltiproUrl(buildListUrl(tenant));
  const io = { signal, sleep, retryDelayMs };

  const probing = Number.isInteger(maxPages) && /** @type {number} */ (maxPages) > 0;
  const pageLimit = probing
    ? Math.min(resolveMaxPages(company), /** @type {number} */ (maxPages))
    : resolveMaxPages(company);

  /** @type {Array<{job: any, rawId: string}>} */
  const rows = [];
  const seen = new Set();
  let skip = 0;
  let total = null;
  let cappedIncomplete = false;

  for (let page = 0; page < pageLimit; page++) {
    if (page > 0) await sleep(INTER_PAGE_DELAY_MS, signal);
    const body = JSON.stringify(buildListBody(skip, PAGE_SIZE));
    const json = await withRetry(
      () => fetchJson(/** @type {any} */ (fetchImpl), listUrl, {
        method: 'POST', signal, redirect: 'error', headers: HEADERS_JSON, body,
      }),
      io,
    );
    const parsed = parseListPage(json, cfg);
    if (parsed.total !== null) total = parsed.total;
    // An empty page (no rows, or every row unusable) is the stop condition.
    if (parsed.rawCount === 0) break;

    let fresh = 0;
    parsed.jobs.forEach((job, i) => {
      const rawId = parsed.ids[i];
      if (seen.has(rawId)) return;
      seen.add(rawId);
      fresh++;
      rows.push({ job, rawId });
    });

    const shortPage = parsed.rawCount < PAGE_SIZE;
    if (fresh === 0) {
      if (!shortPage && !probing) {
        cappedIncomplete = true;
        console.error(`ultipro: ${cfg.companyName || cfg.tenant} pagination made no progress on a full page; results may be incomplete`);
      }
      break;
    }
    if (shortPage) break;
    skip += parsed.rawCount;
    if (page === pageLimit - 1) cappedIncomplete = true;
  }

  const truncated = cappedIncomplete && !probing;
  if (truncated) {
    const summary = `${rows.length}${total !== null ? ` of ${total}` : ''} jobs`;
    console.error(`ultipro: ${cfg.companyName || cfg.tenant} truncated at max_pages=${resolveMaxPages(company)} (${summary}) — raise max_pages on this entry for more`);
  }

  const { fetchDetails, detailLimit } = parseUltiproConfig(company);
  if (fetchDetails && !probing) {
    for (const { job, rawId } of rows.slice(0, detailLimit)) {
      if (signal?.aborted) break;
      await sleep(INTER_PAGE_DELAY_MS, signal);
      try {
        const detailUrl = buildDetailUrl(tenant, rawId);
        if (!detailUrl) continue;
        assertUltiproUrl(detailUrl);
        const html = await withRetry(
          () => fetchText(/** @type {any} */ (fetchImpl), detailUrl, {
            signal, redirect: 'error', headers: HEADERS_HTML,
          }),
          io,
        );
        const result = extractCandidateOpportunityDetail(html, rawId);
        // not-found = posting expired between list and detail: keep the row.
        if (result.status !== 'ok') continue;
        const description = htmlToText(result.detail.Description);
        if (description) {
          job.description = description;
          job.snippet = description.slice(0, SNIPPET_CAP);
        }
      } catch {
        // Enrichment only — keep the listing row on any detail failure.
      }
    }
  }

  const jobs = rows.map((r) => r.job);
  if (truncated) /** @type {any} */ (jobs).ultiproTruncated = true;
  return jobs;
}
