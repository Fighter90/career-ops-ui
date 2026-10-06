// @ts-check
/**
 * Gupy source — board-wide keyword search over the Brazilian Gupy ATS:
 *
 *   GET https://employability-portal.gupy.io/api/v1/jobs?jobName=…&offset=…&limit=100
 *   → { data: [ { name, jobUrl, careerPageName, city, state, country,
 *                 workplaceType, publishedDate, description,
 *                 isConfidentialCareerPage } ], pagination: {…} }
 *
 * Ported from parent career-ops `providers/gupy.mjs` and rewritten to the
 * web-ui source contract (12-field job objects + `meta` for auto-discovery).
 *
 * Public and zero-auth. The search is keyed by KEYWORD, not by company, so one
 * entry runs one sweep per keyword (terms are never joined: `jobName` is a
 * narrow title match) and the results are merged, deduped by posting URL. Config
 * comes from the entry's `gupy:` block, read via `opts.company`:
 *
 *   tracked_companies:
 *     - name: Gupy — Brasil
 *       provider: gupy
 *       gupy:
 *         keywords: ["Desenvolvedor", "Engenheiro de Dados"]  # or `q:`; falls
 *                                                             # back to profile
 *         since_days: 14                  # entry's own recency window
 *         workplace_types: [remote, hybrid]
 *         job_types: [vacancy_type_effective]
 *         state: Rio Grande do Sul
 *         country: Brasil
 *       max_pages: 5                      # per keyword, default 5, cap 200
 *       enabled: true
 *
 * Parent quirks kept on purpose:
 *   - `pagination.total` reports the PAGE SIZE (100 at every offset), never the
 *     result-set size. It is NOT a stop condition; a short page is the only
 *     end-of-feed signal. limit caps at 100 (limit=200 is an HTTP 400).
 *   - `workplaceType` is a SINGULAR string; there is no plural field.
 *   - Rows flagged `isConfidentialCareerPage`, or with a blank `careerPageName`,
 *     name no employer and are dropped.
 *   - Posting URLs are host-locked to HTTPS `gupy.io` / `*.gupy.io`.
 *   - Newest-first ordering holds across pages, so a recency window stops a
 *     sweep early (with a 2-day safety margin). `opts.sinceMs` (the run window)
 *     only stops pagination; the entry's own `since_days` also filters.
 *   - `opts.maxPages` is a TOTAL page budget for the call (pages ATTEMPTED), not
 *     per keyword. During such a probe a failure propagates unwrapped.
 *   - A failed page ends its own sweep and the others continue. When no sweep
 *     produced a page, the ORIGINAL error is rethrown (status intact).
 *
 * Used by the gupy adapter (server/lib/portals/adapters/gupy.mjs).
 */
import { fetchJsonWithRetry, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { resolveProfileKeywords } from './jobbankca.mjs';

export const meta = {
  value: 'gupy',
  label: 'Gupy',
  region: 'en',
};

export const API_BASE = 'https://employability-portal.gupy.io/api/v1/jobs';
const API_HOST = 'employability-portal.gupy.io';
/** Hosts whose URL means "the whole Gupy platform", as opposed to one tenant. */
export const PLATFORM_HOSTS = new Set(['portal.gupy.io', API_HOST]);
export const PER_PAGE = 100; // server-side maximum
const DEFAULT_MAX_PAGES = 5;
const MAX_PAGES_CAP = 200;
export const INTER_REQUEST_DELAY_MS = 200;
const DAY_MS = 86_400_000;
export const EARLY_STOP_MARGIN_MS = 2 * DAY_MS;
const SNIPPET_CAP = 500;

const HEADERS = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  accept: 'application/json, */*;q=0.8',
};

/** @param {unknown} value */
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Hosts a Gupy posting URL may live on: HTTPS `gupy.io` or `*.gupy.io`.
 * Exported for tests.
 * @param {unknown} value
 */
export function isSafeGupyUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' && (host === 'gupy.io' || host.endsWith('.gupy.io'));
  } catch {
    return false;
  }
}

/**
 * Throwing SSRF guard for the API endpoint: HTTPS and the pinned host only.
 * @param {string} url
 */
export function assertGupyUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`gupy: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`gupy: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== API_HOST) {
    throw new Error(`gupy: untrusted hostname "${parsed.hostname}"; must be ${API_HOST}`);
  }
  return url;
}

/**
 * True when `raw` is an HTTPS URL on a platform-wide Gupy host (never a tenant,
 * the apex, a lookalike or a non-HTTPS URL). Used by the adapter.
 * @param {unknown} raw
 */
export function isGupyPlatformUrl(raw) {
  if (typeof raw !== 'string' || !raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' && PLATFORM_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Per-keyword page cap: a positive integer `max_pages`, capped. */
export function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/** The entry's `gupy:` block, or {} when absent or not a mapping. */
export function searchConfig(entry) {
  const cfg = entry?.gupy;
  return cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : {};
}

/**
 * Keywords to sweep from the `gupy:` block (`keywords[]`, then `q`). Empty when
 * neither is set; the caller falls back to the profile's target_roles.
 * @param {any} cfg
 * @returns {string[]}
 */
export function configKeywords(cfg) {
  if (Array.isArray(cfg.keywords)) {
    const list = [...new Set(cfg.keywords.filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim()))];
    if (list.length > 0) return list;
  }
  if (typeof cfg.q === 'string' && cfg.q.trim()) return [cfg.q.trim()];
  return [];
}

/** @param {any} cfg */
function resolveSinceDays(cfg) {
  const v = cfg.since_days;
  return Number.isInteger(v) && v > 0 ? v : null;
}

/**
 * Turn a day count into an absolute floor truncated to UTC midnight (what
 * `--since` means). Null for null input or a day count outside the Date range.
 * @param {number|null} days
 * @param {number} [now]
 * @returns {number|null}
 */
export function sinceDaysToCutoffMs(days, now = Date.now()) {
  if (days === null) return null;
  const d = new Date(now - days * DAY_MS);
  if (Number.isNaN(d.getTime())) return null;
  return Date.parse(`${d.toISOString().slice(0, 10)}T00:00:00Z`);
}

/**
 * True once a page's oldest dated posting is past the window (plus margin).
 * Undated postings are invisible here: a page of only undated postings never
 * stops pagination.
 * @param {Array<{postedAt?: number}>} pageJobs
 * @param {number|null} cutoffMs
 */
export function pageIsPastWindow(pageJobs, cutoffMs) {
  if (typeof cutoffMs !== 'number') return false;
  const dated = pageJobs.map((j) => j?.postedAt).filter((v) => typeof v === 'number');
  if (dated.length === 0) return false;
  return Math.min(...dated) < cutoffMs - EARLY_STOP_MARGIN_MS;
}

/** Comma-joined list param, or null when unset/empty. */
function listParam(value) {
  if (!Array.isArray(value)) return null;
  const list = value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());
  return list.length > 0 ? list.join(',') : null;
}

/** NaN-safe Date.parse that keeps a valid epoch 0. */
function toEpochMs(value) {
  if (typeof value !== 'string' || !value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * The documented envelope's `data` array, or a descriptive throw naming what
 * arrived instead. `{ data: [] }` is an empty result, not an error.
 * @param {any} json
 * @param {string} keyword
 * @param {number} page
 * @returns {any[]}
 */
export function extractGupyRows(json, keyword, page) {
  const rows = json && typeof json === 'object' && Array.isArray(json.data) ? json.data : null;
  if (!rows) {
    const got = json && typeof json === 'object'
      ? `keys: [${Object.keys(json).join(', ')}]`
      : `type: ${json === null ? 'null' : typeof json}`;
    throw new Error(`gupy: unexpected API response for "${keyword}" page ${page}: expected { data: [...] }, got ${got}`);
  }
  return rows;
}

/**
 * Display location from the platform's separate fields. Labels stay pt-BR to
 * match the postings themselves and the scanner's location_filter.
 * @param {any} j
 */
export function buildGupyLocation(j) {
  const parts = [];
  const type = text(j?.workplaceType);
  if (type) {
    parts.push({ remote: 'Remoto', hybrid: 'Híbrido', 'on-site': 'Presencial' }[type] || type);
  } else if (j?.isRemoteWork === true) {
    parts.push('Remoto');
  }
  for (const field of ['city', 'state', 'country']) {
    const v = text(j?.[field]);
    if (v) parts.push(v);
  }
  return parts.join(', ');
}

/**
 * Normalize one raw Gupy posting into the web-ui job shape, or null when it
 * must be dropped (non-object, confidential, no title, unsafe/absent URL, no
 * employer name).
 * @param {any} j
 */
export function normalizeGupyJob(j) {
  if (!j || typeof j !== 'object') return null;
  if (j.isConfidentialCareerPage === true) return null;
  const title = text(j.name);
  if (!title) return null;
  const url = text(j.jobUrl);
  if (!isSafeGupyUrl(url)) return null;
  const company = text(j.careerPageName);
  if (!company) return null;

  const type = text(j.workplaceType);
  const isRemote = type === 'remote' || (!type && j.isRemoteWork === true);
  const postedAt = toEpochMs(j.publishedDate);
  const description = typeof j.description === 'string' ? j.description : '';
  /** @type {Record<string, any>} */
  const job = {
    id: `gupy-${url}`,
    title,
    company,
    url,
    salary: '',
    location: buildGupyLocation(j),
    isRemote,
    workplaceType: isRemote ? 'Remote' : type === 'hybrid' ? 'Hybrid' : 'Onsite',
    relocates: false,
    date: postedAt === undefined ? '' : new Date(postedAt).toISOString().slice(0, 10),
    snippet: description.slice(0, SNIPPET_CAP),
    source: 'gupy',
  };
  if (description) job.description = description;
  if (postedAt !== undefined) job.postedAt = postedAt;
  return job;
}

/**
 * Fetch and normalize Gupy postings across the configured keywords.
 *
 * @param {string} endpoint API URL from the adapter's buildEndpoint
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any, maxPages?: number,
 *           sinceMs?: number, delayMs?: number, sleep?: (ms: number, signal?: AbortSignal) => Promise<void>,
 *           retries?: number, retryDelayMs?: number, profileKeywords?: string[] }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchGupy(endpoint = API_BASE, opts = {}) {
  const {
    fetchImpl = fetch,
    signal,
    company = {},
    sleep = delay,
    retries,
    retryDelayMs,
  } = opts;
  const base = assertGupyUrl(endpoint);
  const cfg = searchConfig(company);
  let keywords = configKeywords(cfg);
  if (!keywords.length) {
    keywords = Array.isArray(opts.profileKeywords) ? opts.profileKeywords : await resolveProfileKeywords();
  }
  if (!keywords.length) {
    throw new Error(
      `gupy: entry "${company?.name || '(unnamed)'}" has no gupy.keywords[]/gupy.q and no config/profile.yml target_roles to fall back to`,
    );
  }

  const maxPages = resolveMaxPages(company);
  const workplaceTypes = listParam(cfg.workplace_types);
  const jobTypes = listParam(cfg.job_types);
  const state = text(cfg.state);
  const country = text(cfg.country);
  const delayMs = Number.isFinite(opts.delayMs) ? /** @type {number} */ (opts.delayMs) : INTER_REQUEST_DELAY_MS;

  // opts.maxPages is a TOTAL page budget for the call (pages ATTEMPTED).
  const probing = Number.isInteger(opts.maxPages) && /** @type {number} */ (opts.maxPages) > 0;
  const pageBudget = probing ? /** @type {number} */ (opts.maxPages) : Infinity;
  let pagesAttempted = 0;

  // The run's own window only stops pagination; the entry's since_days also
  // filters, because nothing downstream knows about it.
  const ctxCutoff = typeof opts.sinceMs === 'number' ? opts.sinceMs : null;
  const entryCutoff = sinceDaysToCutoffMs(resolveSinceDays(cfg));
  const cutoffMs = ctxCutoff ?? entryCutoff;
  const filterCutoff = ctxCutoff === null ? entryCutoff : null;

  const seen = new Set();
  const out = [];
  /** @type {any} */
  let firstError = null;
  let succeededOnce = false;

  for (const keyword of keywords) {
    if (pagesAttempted >= pageBudget) break;
    for (let page = 0; page < maxPages; page++) {
      if (pagesAttempted >= pageBudget) break;
      const params = new URLSearchParams({
        jobName: keyword,
        offset: String(page * PER_PAGE),
        limit: String(PER_PAGE),
      });
      if (workplaceTypes) params.set('workplaceTypes', workplaceTypes);
      if (jobTypes) params.set('jobTypes', jobTypes);
      if (state) params.set('state', state);
      if (country) params.set('country', country);

      const url = assertGupyUrl(`${base}?${params}`);
      if (pagesAttempted > 0) await sleep(delayMs, signal);
      pagesAttempted++;
      let rows;
      try {
        const json = await fetchJsonWithRetry(/** @type {any} */ (fetchImpl), url, {
          signal,
          headers: HEADERS,
          redirect: 'error',
          ...(retries !== undefined ? { retries } : {}),
          ...(retryDelayMs !== undefined ? { retryDelayMs } : {}),
        });
        rows = extractGupyRows(json, keyword, page);
      } catch (err) {
        // A probe must see the rejection itself (identity preserved).
        if (probing) throw err;
        if (firstError === null) firstError = err;
        console.error(`gupy: sweep "${keyword}" stopped at page ${page}: ${/** @type {any} */ (err)?.message || String(err)}`);
        break;
      }
      succeededOnce = true;

      const pageJobs = [];
      for (const raw of rows) {
        const job = normalizeGupyJob(raw);
        if (!job) continue;
        pageJobs.push(job);
        if (seen.has(job.url)) continue;
        seen.add(job.url);
        if (filterCutoff !== null && typeof job.postedAt === 'number' && job.postedAt < filterCutoff) continue;
        out.push(job);
      }

      // A short page is the end of the feed (pagination.total is unusable).
      if (rows.length < PER_PAGE) break;
      if (pageIsPastWindow(pageJobs, cutoffMs)) break;
      if (page + 1 >= maxPages) {
        console.error(
          `gupy: "${keyword}" truncated at max_pages=${maxPages} (${maxPages * PER_PAGE} postings read, feed has more); raise max_pages on this entry for more`,
        );
      }
    }
  }

  // No sweep produced a page: an outage or changed payload must surface, with
  // the ORIGINAL error (status intact), not pass for a quiet zero.
  if (!succeededOnce && firstError !== null) throw firstError;
  return out;
}
