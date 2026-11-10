// @ts-check
/**
 * ADP Recruiting Management "myjobs" source — single-company ATS adapter for
 * `tracked_companies:`. Ported from the parent's providers/adp-myjobs.mjs
 * (upstream #6678, CAR-254). Distinct from adp-workforcenow.mjs, which reads
 * a different ADP product (workforcenow.adp.com). The myjobs sites are an
 * Angular SPA at
 *
 *   https://myjobs.adp.com/{site}/cx/job-listing        (e.g. /apply/cx/..., ADP's own)
 *   https://myjobs.adp.com/{site}/cx/job-details?reqId=...
 *
 * and auto-detect from any myjobs.adp.com URL whose first path segment is
 * the career-site slug. The SPA calls a public, no-auth JSON API on the
 * same host:
 *
 *   Site:   GET /public/staffing/v1/career-site/{site}
 *             -> { orgoid, clientName, ... }   (the site slug -> orgoid lookup)
 *   List:   GET /public/staffing/v1/job-requisitions?rb=CareerSite&$top=N&$skip=M
 *             header `orgoid: {orgoid}` -> { count, jobRequisitions: [...] }
 *   Detail: GET /public/staffing/v1/job-requisitions/{reqId}?rb=CareerSite&lang=en_US
 *             -> { jobRequisitions: [{ jobDescription, postingDate, ... }] }
 *
 * ── orgoid ────────────────────────────────────────────────────────────────
 * Every list/detail call needs the tenant's `orgoid` header (a missing one
 * is HTTP 400 "Missing orgoid header"). It is not in the careers URL, so it
 * is resolved once from the site slug through the career-site endpoint and
 * cached per site (30 days, the parent's provider-id-cache semantics) in a
 * module Map, or the `idCache` opt when the caller supplies one. To skip
 * that lookup entirely, set it on the entry:
 *
 *   adpMyjobs:
 *     orgoid: 0F18AC8F6B800272
 *
 * ── Accept-Language ───────────────────────────────────────────────────────
 * The list endpoint filters on the request's Accept-Language. Node's fetch
 * sends `Accept-Language: *`, which the API answers with a well-formed
 * `{"count":0,"jobRequisitions":[]}` — a silent empty board, not an error.
 * Every request therefore sends an explicit `Accept-Language: en-US`.
 *
 * ── Paging ────────────────────────────────────────────────────────────────
 * `$top` / `$skip` (zero-based row offset). `limit` / `offset` are silently
 * ignored and return page one forever, so they are not used. The walk
 * advances by rows actually returned and ends on an empty page, once
 * `$skip` reaches the response's own `count`, or on a short page when no
 * `count` was given. Both are bounded by DEFAULT_MAX_PAGES / MAX_PAGES_CAP
 * regardless of what the API reports. An API that ignores `$skip` (the same
 * rows forever) ends the walk after two repeated pages, and that stall —
 * like a max_pages ceiling — tags the result `adpMyjobsTruncated` (the
 * CAR-256 partial-board convention): never presented as complete.
 *
 * The list payload has a title and locations but no date and no JD. Detail
 * enrichment (description + postedAt) is opt-in per entry:
 *
 *   adpMyjobs:
 *     fetchDetails: true   # one detail call per posting, paced
 *     detailLimit: 25      # max detail calls per sweep when fetchDetails=true
 *
 * Some list rows carry no title at all (observed live: a `type: "Sourcing"`
 * talent-pool pseudo-requisition). They are not postings and are dropped.
 *
 * Used by the adp-myjobs adapter (server/lib/portals/adapters/adp-myjobs.mjs).
 */
import { fetchJsonWithRetry, delay } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';

export const meta = {
  value: 'adp-myjobs',
  label: 'ADP myjobs',
  region: 'en',
};

export const HOST = 'myjobs.adp.com';
const API_BASE = `https://${HOST}/public/staffing/v1`;

export const PAGE_SIZE = 200; // verified live: $top=200 is honored
export const DEFAULT_MAX_PAGES = 100; // 100 * 200 = 20000 postings; ADP's own site has ~1800
export const MAX_PAGES_CAP = 1500;
const INTER_PAGE_DELAY_MS = 250;

const SITE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const ORGOID_RE = /^[A-Za-z0-9]{8,64}$/;
// First path segments on myjobs.adp.com that are API/static routes, not sites.
const RESERVED_SEGMENTS = new Set(['public', 'admin', 'myadp_prefix']);

/** @param {unknown} raw @returns {string|undefined} */
function coerceId(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const s = String(raw).trim();
  return s === '' ? undefined : s;
}

/** Clamp to an integer in [min, max], using `def` when the value is not numeric. */
function intInRange(val, def, min, max) {
  if (val === undefined || val === null || val === '') return def;
  const n = Number(val);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * The career-site slug from a myjobs URL, or null. Only the hostname and the
 * first path segment are read; the rest of the URL is opaque.
 * @param {any} entry
 * @returns {string | null}
 */
export function resolveSite(entry) {
  for (const raw of [entry?.api, entry?.careers_url]) {
    if (typeof raw !== 'string' || !raw) continue;
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:') continue;
    if (parsed.hostname.toLowerCase() !== HOST) continue;
    const seg = parsed.pathname.split('/').filter(Boolean)[0];
    if (!seg || !SITE_RE.test(seg) || RESERVED_SEGMENTS.has(seg.toLowerCase())) continue;
    return seg;
  }
  return null;
}

/**
 * Defence-in-depth endpoint check: HTTPS on exactly the myjobs API host,
 * default port only. Runs on the endpoint the adapter resolved, before any
 * request.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertAdpMyjobsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`adp-myjobs: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`adp-myjobs: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`adp-myjobs: a non-default port is not allowed: ${url}`);
  if (parsed.hostname.toLowerCase() !== HOST) {
    throw new Error(`adp-myjobs: untrusted hostname "${parsed.hostname}" — must be ${HOST}`);
  }
  return url;
}

/**
 * Read the entry's optional `adpMyjobs:` block. Exported for tests.
 * @param {any} entry
 */
export function parseAdpMyjobsConfig(entry) {
  const cfg = (entry && entry.adpMyjobs) || {};
  return {
    orgoid: typeof cfg.orgoid === 'string' && ORGOID_RE.test(cfg.orgoid.trim()) ? cfg.orgoid.trim() : null,
    fetchDetails: cfg.fetchDetails === true,
    detailLimit: intInRange(cfg.detailLimit, 25, 1, 100),
  };
}

/** @param {any} entry */
export function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/** The career-site endpoint for one site slug (the orgoid lookup). */
export function careerSiteUrl(site) {
  return `${API_BASE}/career-site/${encodeURIComponent(site)}`;
}

/** @param {number} skip */
export function buildListUrl(skip) {
  const u = new URL(`${API_BASE}/job-requisitions`);
  u.searchParams.set('rb', 'CareerSite');
  u.searchParams.set('$top', String(PAGE_SIZE));
  u.searchParams.set('$skip', String(skip));
  return u.href;
}

/** @param {string} reqId */
export function buildDetailUrl(reqId) {
  const seg = safeEncodeURIComponent(reqId);
  if (seg === null) return null;
  const u = new URL(`${API_BASE}/job-requisitions/${seg}`);
  u.searchParams.set('rb', 'CareerSite');
  u.searchParams.set('lang', 'en_US');
  return u.href;
}

/**
 * Public posting page. `site` is config-derived and already validated by
 * SITE_RE; reqId is host-controlled and goes through URLSearchParams.
 * @param {string} site @param {string} reqId
 */
export function buildPostingUrl(site, reqId) {
  if (safeEncodeURIComponent(reqId) === null) return null;
  const u = new URL(`https://${HOST}/${encodeURIComponent(site)}/cx/job-details`);
  u.searchParams.set('rb', 'CareerSite');
  u.searchParams.set('reqId', reqId);
  return u.href;
}

// NaN-safe: `Date.parse(s) || undefined` would also null a valid epoch 0.
/** @param {unknown} value */
function toEpochMs(value) {
  if (!value || typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * "City, ST, USA" from the structured address; the nameCode label ("Stamford
 * CT (1266 East Main St. - 17011)") is an internal site name and is only the
 * fallback. Multiple locations are deduped and joined with " / ".
 * @param {any} row
 */
export function extractLocation(row) {
  const list = Array.isArray(row?.requisitionLocations) ? row.requisitionLocations : [];
  const out = [];
  for (const loc of list) {
    const addr = loc?.address;
    const str = (/** @type {any} */ v) => (typeof v === 'string' ? v.trim() : '');
    const city = str(addr?.cityName);
    const sub = addr?.countrySubdivisionLevel1;
    const subCode = str(sub?.codeValue);
    const region = /^[A-Za-z]{2,3}$/.test(subCode) ? subCode : str(sub?.longName) || subCode;
    const country = str(addr?.country?.codeValue) || str(addr?.country?.longName);
    let label = [city, region, country].filter(Boolean).join(', ');
    if (!label) label = str(loc?.nameCode?.longName) || str(loc?.nameCode?.shortName);
    if (label && !out.includes(label)) out.push(label);
  }
  return out.join(' / ');
}

/**
 * Parse one list page in the parent's row shape. Throws on a body that is
 * not the documented envelope; a malformed row is dropped.
 * @param {any} json
 * @param {{ site: string, companyName: string }} cfg
 * @returns {{ jobs: Array<Record<string, any>>, total: number | null, rawCount: number }}
 */
export function parseListPage(json, cfg) {
  const rows = json && typeof json === 'object' && Array.isArray(json.jobRequisitions) ? json.jobRequisitions : null;
  if (!rows) {
    const got = json && typeof json === 'object' ? Object.keys(json).join(', ') : typeof json;
    throw new Error(`adp-myjobs: unexpected response — expected jobRequisitions[], got: [${got}]`);
  }
  const total = Number.isInteger(json.count) && json.count >= 0 ? json.count : null;
  const jobs = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const reqId = coerceId(row.reqId);
    const title = [row.jobTitle, row.publishedJobTitle, row.requisitionTitle]
      .find((t) => typeof t === 'string' && t.trim());
    if (!reqId || !title) continue;
    const url = buildPostingUrl(cfg.site, reqId);
    if (!url) continue;
    /** @type {Record<string, any>} */
    const job = { title: title.trim(), url, company: cfg.companyName, location: extractLocation(row) };
    const requisitionId = coerceId(row.clientRequisitionID);
    if (requisitionId !== undefined) job.requisitionId = requisitionId;
    jobs.push(Object.assign(job, { _reqId: reqId }));
  }
  return { jobs, total, rawCount: rows.length };
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  return {
    id: `adp-myjobs-${row.url}`,
    title: row.title,
    company: row.company,
    url: row.url,
    salary: '',
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: '',
    relocates: false,
    date: typeof row.postedAt === 'number' ? new Date(row.postedAt).toISOString() : '',
    snippet: row.description || '',
    ...(row.description ? { description: row.description } : {}),
    ...(row.requisitionId !== undefined ? { requisitionId: row.requisitionId } : {}),
    source: 'adp-myjobs',
  };
}

// Orgoid cache: the parent keeps it in the persisted provider-id-cache;
// web-ui caches per process with the same freshness rules (30 days),
// overridable per call via opts.idCache.
const DEFAULT_RECHECK_MS = 30 * 24 * 60 * 60 * 1000;
const defaultOrgoidCache = new Map();

/** Forget every cached orgoid (tests). */
export function clearAdpMyjobsOrgoidCache() {
  defaultOrgoidCache.clear();
}

/**
 * The parent's cachedLookup semantics (see turbohire.mjs for the full
 * contract).
 * @template T
 * @param {Map<string, any> | undefined} cache
 * @param {string} key
 * @param {() => Promise<T>} lookup
 * @param {{ isValid: (v: unknown) => boolean, isGone?: (err: any) => boolean }} opts
 * @returns {Promise<T>}
 */
async function cachedOrgoid(cache, key, lookup, { isValid, isGone = () => false }) {
  const store = cache || defaultOrgoidCache;
  const cached = store.get(key);
  const known = cached && isValid(cached.id) ? cached.id : undefined;
  const checkedAt = Date.parse(cached?.checkedAt ?? '');
  if (known !== undefined && Number.isFinite(checkedAt) && Date.now() - checkedAt < DEFAULT_RECHECK_MS) return known;
  let value;
  try {
    value = await lookup();
  } catch (err) {
    if (isGone(err)) {
      store.delete(key);
      throw err;
    }
    if (known !== undefined) return known;
    throw err;
  }
  store.set(key, { id: value, checkedAt: new Date().toISOString() });
  return value;
}

/**
 * @param {Function} fetchImpl
 * @param {string} site
 * @param {string | null} override
 * @param {{ signal?: AbortSignal, sleep?: (ms: number) => Promise<void> }} io
 * @param {Map<string, any> | undefined} idCache
 * @returns {Promise<string>}
 */
async function resolveOrgoid(fetchImpl, site, override, io, idCache) {
  if (override) return override;
  return cachedOrgoid(idCache, site.toLowerCase(), async () => {
    const json = await fetchJsonWithRetry(
      fetchImpl,
      careerSiteUrl(site),
      {
        redirect: 'error',
        headers: { accept: 'application/json', 'accept-language': 'en-US' },
        ...(io.signal ? { signal: io.signal } : {}),
        ...(io.sleep ? { sleep: io.sleep } : {}),
      },
    );
    const orgoid = typeof json?.orgoid === 'string' ? json.orgoid.trim() : '';
    if (!ORGOID_RE.test(orgoid)) {
      throw new Error(`adp-myjobs: could not resolve orgoid for career site "${site}" — set adpMyjobs.orgoid on this entry`);
    }
    return orgoid;
  }, {
    isValid: (v) => typeof v === 'string' && ORGOID_RE.test(v),
    // An unknown site slug answers 404/400/403: the board is gone, drop the cached id.
    isGone: (err) => err?.status === 404 || err?.status === 400,
  });
}

/**
 * Fetch + normalize the ADP myjobs board for one career site (paginated).
 * Mirrors the parent's fetch(): a `$top`/`$skip` walk that stops on the
 * source's own count, an empty page, or a short page when no count was
 * given; keeps the walk honest when the API stalls (two consecutive pages
 * with no new reqId). A max_pages ceiling or a stall tags the result
 * `adpMyjobsTruncated`; the parent also accepted a ctx.maxPages probe
 * budget, which web-ui callers may pass as opts.maxPages (one list page, no
 * detail calls, no tag).
 *
 * @param {string} endpoint - a page-0 list API URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any,
 *           idCache?: Map<string, any>, sleep?: (ms: number) => Promise<void>,
 *           maxPages?: number }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchAdpMyjobs(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {}, idCache, sleep: sleepFn, maxPages } = opts;
  assertAdpMyjobsUrl(endpoint);
  const site = resolveSite(company);
  if (!site) {
    throw new Error(`adp-myjobs: cannot derive the career-site slug (myjobs.adp.com/{site}/...) for ${company?.name ?? endpoint}`);
  }
  const io = { signal, sleep: sleepFn };
  const { orgoid: override, fetchDetails, detailLimit } = parseAdpMyjobsConfig(company);
  const orgoid = await resolveOrgoid(fetchImpl, site, override, io, idCache);
  const headers = { accept: 'application/json', 'accept-language': 'en-US', orgoid };
  const cfg = { site, companyName: company.name };

  // The probe budget (opts.maxPages, a positive integer) caps the walk at one
  // page and skips detail enrichment — the parent's ctx.maxPages semantics.
  const probing = Number.isInteger(maxPages) && /** @type {number} */ (maxPages) > 0;
  const entryMaxPages = resolveMaxPages(company);
  const pageLimit = probing ? 1 : entryMaxPages;
  const pause = sleepFn || ((ms) => delay(ms, signal));

  /** @type {Array<Record<string, any>>} */
  const jobs = [];
  const seen = new Set();
  let skip = 0;
  let total = null;
  let hitCeiling = false; // ran out of page budget with a full page and more to read
  let repeatPages = 0; // consecutive pages that yielded no new reqId
  let sawRepeat = false; // a repeated page left a possible gap, even if later pages had new rows
  let stalled = false; // the API stopped advancing ($skip ignored) before the board's own end

  for (let page = 0; page < pageLimit; page++) {
    if (page > 0) await pause(INTER_PAGE_DELAY_MS);
    const json = await fetchJsonWithRetry(fetchImpl, buildListUrl(skip), {
      redirect: 'error',
      headers,
      ...(signal ? { signal } : {}),
      ...(sleepFn ? { sleep: sleepFn } : {}),
    });
    const { jobs: pageJobs, total: pageTotal, rawCount } = parseListPage(json, cfg);
    if (pageTotal !== null) total = pageTotal;
    if (rawCount === 0) break;

    let fresh = 0;
    for (const job of pageJobs) {
      if (seen.has(job._reqId)) continue;
      seen.add(job._reqId);
      fresh++;
      jobs.push(job);
    }
    skip += rawCount;
    // Every row on this page was a repeat: $skip is being ignored. Checked
    // before the count test, since a repeated page can push `skip` past
    // `count` without the board being complete. A short page with no count
    // is still a natural end.
    // One repeated page is tolerated (a later page may still carry new rows);
    // two in a row mean the API is not advancing.
    if (fresh === 0 && pageJobs.length > 0 && (total !== null || rawCount >= PAGE_SIZE)) {
      sawRepeat = true;
      if (++repeatPages >= 2) { stalled = true; break; }
    } else {
      repeatPages = 0;
    }
    // Natural end: the source's own count is reached, or (no count) a short page.
    // Reaching the count on a page that added nothing new is not completion.
    if (total !== null ? skip >= total : rawCount < PAGE_SIZE) {
      if (fresh === 0 && pageJobs.length > 0) stalled = true;
      break;
    }
    if (page === pageLimit - 1) hitCeiling = true;
  }

  const truncated = hitCeiling && !probing;
  if (truncated) {
    console.error(`⚠️  adp-myjobs: ${company.name} truncated at max_pages=${entryMaxPages} (${jobs.length}${total !== null ? ` of ${total}` : ''} jobs) — raise max_pages on this entry for more`);
  }

  // A stall is not a ceiling: never blame max_pages for it, but do not let a
  // partial board pass as complete either.
  const incomplete = stalled || sawRepeat;
  if (incomplete && !probing) {
    console.error(`⚠️  adp-myjobs: ${company.name} incomplete — the API returned a page of only repeated rows (stopped at $skip=${skip}) (${jobs.length}${total !== null ? ` of ${total}` : ''} jobs); the board may be incomplete`);
  }

  // Detail enrichment is opt-in, paced, best-effort, and skipped while a
  // health probe runs (opts.maxPages set).
  if (fetchDetails && !probing) {
    for (const job of jobs.slice(0, detailLimit)) {
      const detailUrl = buildDetailUrl(job._reqId);
      if (!detailUrl) continue;
      await pause(INTER_PAGE_DELAY_MS);
      try {
        const detail = await fetchJsonWithRetry(fetchImpl, detailUrl, {
          redirect: 'error',
          headers,
          ...(signal ? { signal } : {}),
          ...(sleepFn ? { sleep: sleepFn } : {}),
        });
        const d = Array.isArray(detail?.jobRequisitions) ? detail.jobRequisitions[0] : null;
        const description = htmlToText([d?.jobDescription, d?.jobQualifications].filter(Boolean).join('\n'));
        if (description) job.description = description;
        const postedAt = toEpochMs(d?.postingDate);
        if (postedAt !== undefined) job.postedAt = postedAt;
      } catch {
        // enrichment only — keep the listing row (same contract as smartrecruiters.mjs)
      }
    }
  }

  const normalized = /** @type {any} */ (jobs.map(normalize));
  if ((truncated || incomplete) && !probing) normalized.adpMyjobsTruncated = true;
  return normalized;
}
