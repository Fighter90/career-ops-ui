// @ts-check
/**
 * ApplicantPro source (now branded "isolved Talent Acquisition") — the
 * single-employer ATS behind `https://<tenant>.applicantpro.com`.
 * Ported from the parent's providers/applicantpro.mjs (upstream #6252).
 *
 * The listing page, `/jobs/`, is a client-side Vue component, so its HTML
 * holds no postings — but that component fills itself from one public,
 * unauthenticated JSON request on the same host:
 *
 *   GET https://<tenant>.applicantpro.com/core/jobs/<domainId>?getParams={}
 *   → { success: true, data: { jobs: [{ id, title, jobLocation, city,
 *        abbreviation, startDateRef, minSalary, maxSalary, payTypeFrame, … }],
 *        jobCount } }
 *
 * So a scan is two requests: one for `<domainId>` (the numeric site id the
 * component is given inline on `/jobs/`; OR pinned with
 * `applicantpro.domainId`) and one for the list. `jobCount` equals the row
 * count on a healthy board; a larger count warns that the list is incomplete.
 *
 * Opt-in `applicantpro: { fetchDetails: true, detailLimit: N }` additionally
 * fetches each posting's server-rendered page (capped at `detailLimit`,
 * default 25, max 100; sequential and paced 250 ms) for the JSON-LD
 * `JobPosting` description. That is the only per-posting request fan-out and
 * it is off by default.
 *
 * Gotchas, all from live observation of the JSON-LD / list data:
 *   - `validThrough` can sit years in the future, so it is never used to
 *     decide whether a posting is open — presence in the list is the signal.
 *   - `employmentType` can be wrong (a permanent management posting tagged
 *     CONTRACTOR), so it is not mapped to anything.
 *   - the JSON-LD title is the posting's title and wins over the list title
 *     on enrichment; the body text is left untouched even when it disagrees.
 *   - pay attaches only for an ANNUAL range with a positive figure; hourly
 *     or missing ranges are left off, never inferred. No currency is guessed.
 *   - the list id is numeric and becomes the URL path segment, so only
 *     digits pass — nothing host-controlled can restructure the dedup key.
 *
 * robots.txt on a tenant host disallows only /admin/, /stats/ and the
 * /internaljobs* routes; the listing page, `/core/jobs/…`, the detail pages
 * and the sitemap are all open to `User-agent: *`. The sitemap itself is
 * NOT read: it lists only `www.applicantpro.com/openings/<tenant>/jobs/<id>`
 * URLs with `<lastmod>` — no titles — and those 302 to the tenant host
 * (redirect:'error' never follows them), so titling from it would cost one
 * detail request per posting per scan.
 *
 * Deviations from the parent provider for the web-ui source contract:
 *   - the parent keeps the resolved site id in `ctx.idCache` for 30 days;
 *     the web-ui scanner threads no cache through fetchers, so `/jobs/` is
 *     re-read on every scan (still two requests total) unless
 *     `applicantpro.domainId` is pinned on the entry.
 *   - the parent skips detail enrichment while a health probe runs
 *     (`ctx.maxPages`); the web-ui scanner has no probe context on this
 *     path, so the opt-in flag alone controls enrichment.
 *   - the parent's salary rides as an internal `{min,max}` object; the
 *     web-ui row's `salary` is a display string ("48000–50000", currency
 *     unknown → not guessed).
 */
import { fetchJsonWithRetry, fetchTextWithRetry, delay } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';

export const meta = {
  value: 'applicantpro',
  label: 'ApplicantPro',
  region: 'en',
};

const HOST_RE = /^[a-z0-9][a-z0-9-]*\.applicantpro\.com$/;
// Platform hosts that are not employer tenants.
const NON_TENANT_LABELS = new Set(['www', 'feeds']);
const TENANT_RE = /^[a-z0-9][a-z0-9-]*$/;
const DETAIL_DEFAULT_LIMIT = 25;
const DETAIL_MAX_LIMIT = 100;
// Courtesy pause between back-to-back detail pages on the same tenant.
const DETAIL_PACE_MS = 250;

/**
 * Defence-in-depth endpoint check: HTTPS on exactly a tenant host (never a
 * platform label), default port only. Runs on the endpoint the adapter
 * resolved, before any request.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertApplicantproUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`applicantpro: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`applicantpro: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`applicantpro: a non-default port is not allowed: ${url}`);
  if (parsed.username || parsed.password) throw new Error(`applicantpro: credentials in the URL are not allowed: ${url}`);
  const host = parsed.hostname.toLowerCase();
  const label = host.split('.')[0];
  if (!HOST_RE.test(host) || NON_TENANT_LABELS.has(label)) {
    throw new Error(`applicantpro: untrusted hostname "${parsed.hostname}" — must be a <tenant>.applicantpro.com host`);
  }
  return url;
}

/**
 * Tenant origin (`https://<tenant>.applicantpro.com`) for a URL string, or
 * null. Only the hostname is trusted: the origin is rebuilt from it, so any
 * path or port on the input is discarded. A
 * `www.applicantpro.com/openings/<tenant>/…` link (what the tenant's sitemap
 * and aggregators hand out) maps to its tenant.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function originFromUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
  const host = parsed.hostname.toLowerCase();
  if (host === 'www.applicantpro.com') {
    const tenant = parsed.pathname.match(/^\/openings\/([^/]+)(?:\/|$)/i)?.[1]?.toLowerCase();
    if (tenant && TENANT_RE.test(tenant) && !NON_TENANT_LABELS.has(tenant)) {
      return `https://${tenant}.applicantpro.com`;
    }
    return null;
  }
  if (!HOST_RE.test(host) || NON_TENANT_LABELS.has(host.split('.')[0])) return null;
  return `https://${host}`;
}

/**
 * The tenant origin from an entry's explicit `api` field, else its careers_url.
 * @param {{api?: unknown, careers_url?: unknown}} [entry]
 * @returns {string | null}
 */
export function resolveOrigin(entry) {
  return originFromUrl(entry?.api) || originFromUrl(entry?.careers_url);
}

/** The listing-page URL for one tenant origin (the adapter's endpoint shape). */
export function jobsUrlFor(origin) {
  return `${origin}/jobs/`;
}

/**
 * Numeric site id from a tenant's `/jobs/` page. The listing component is
 * handed it inline (`organizationId : 1, domainId : 2, getParams : …`); the
 * case-sensitive lookbehind keeps `rootDomainId` (a different number, used by
 * the social widget further down the page) from matching.
 * @param {unknown} html
 * @returns {number | null}
 */
export function extractDomainId(html) {
  if (typeof html !== 'string' || !html) return null;
  const match = html.match(/(?<![A-Za-z0-9_])domainId["']?\s*[:=]\s*["']?(\d+)/)
    || html.match(/\/core\/jobs\/(\d+)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** @param {unknown} value */
function toEpochMs(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  // The list gives "Sep 02, 2026" and the JSON-LD "2026-09-02 00:00:00", both
  // calendar dates with no zone: read them as UTC so the day does not depend
  // on the machine's timezone.
  const text = value.trim();
  const parsed = Date.parse(/(?:Z|[+-]\d\d:?\d\d)$/.test(text) ? text : `${text} UTC`);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** @param {any} row */
function locationOf(row) {
  const text = (v) => (typeof v === 'string' ? v.trim() : '');
  if (text(row.jobLocation)) return text(row.jobLocation);
  return [text(row.city), text(row.abbreviation) || text(row.stateName)].filter(Boolean).join(', ');
}

/** Minimal numeric reader for the payload's structured pay fields ("48,000"). */
function parseAmountField(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const s = value.replace(/[€$£¥,\s]/g, '').trim();
  if (!s || !/^\d+(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Annual pay frame only — the payload's structured `payTypeFrame` field. */
function isAnnualFrame(frame) {
  return /(?:\/\s*(?:year|yr)\b|\bper\s+(?:year|annum)\b|\bannual(?:ly)?\b|\byearly\b)/i.test(String(frame ?? ''));
}

/**
 * Annual pay range only; hourly, per-period or zero/missing figures are left
 * off. `{min?, max?}`, or undefined.
 * @param {any} row
 * @returns {{min?: number, max?: number} | undefined}
 */
export function salaryRangeOf(row) {
  if (!isAnnualFrame(row.payTypeFrame)) return undefined;
  const lo = parseAmountField(row.minSalary);
  const hi = parseAmountField(row.maxSalary);
  const min = lo !== null && lo > 0 ? lo : undefined;
  const max = hi !== null && hi > 0 ? hi : undefined;
  if (min === undefined && max === undefined) return undefined;
  return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
}

/** Display string for a salary range ("48000–50000"); the currency is never guessed.
 * salaryRangeOf provably yields undefined, {min}, {max} or {min,max} — the
 * final `≤ max` line is the terminal case, so there is no unreachable
 * fallthrough for CodeQL/coverage to flag. */
function salaryText(salary) {
  if (!salary) return '';
  if (salary.min !== undefined && salary.max !== undefined) return `${salary.min}–${salary.max}`;
  if (salary.min !== undefined) return `≥ ${salary.min}`;
  return `≤ ${salary.max}`;
}

/**
 * Normalize a `/core/jobs/<domainId>` response. Exported for unit tests.
 *
 * Shape: `{ success: true, data: { jobs: [...], jobCount } }`. A tenant with
 * no openings answers `jobs: []`. Anything else (no `data.jobs` array,
 * `success: false`) is an API change and throws; one malformed row is
 * dropped. Exported for unit tests.
 * @param {any} json
 * @param {string} origin
 * @param {string} companyName
 * @returns {Array<{title: string, url: string, company: string, location: string,
 *   externalId: string, postedAt?: number, salary?: {min?: number, max?: number}}>}
 */
export function parseListResponse(json, origin, companyName) {
  const rows = json && json.success !== false && Array.isArray(json?.data?.jobs) ? json.data.jobs : null;
  if (!rows) {
    const got = json && typeof json === 'object'
      ? Object.keys(json.data && typeof json.data === 'object' ? json.data : json).join(', ')
      : typeof json;
    throw new Error(`applicantpro: unexpected response — expected data.jobs[], got: [${got}]`);
  }
  const jobs = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id).trim() : '';
    const title = typeof row.title === 'string' ? row.title.replace(/\s+/g, ' ').trim() : '';
    // The id becomes a URL path segment: digits only, so nothing host
    // controlled can add a path, query or lone surrogate to the dedup key.
    if (!title || !id || !/^\d+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const postedAt = toEpochMs(row.startDateRef);
    const salary = salaryRangeOf(row);
    jobs.push({
      title,
      url: `${origin}/jobs/${id}`,
      company: companyName,
      location: locationOf(row),
      externalId: id,
      ...(postedAt !== undefined ? { postedAt } : {}),
      ...(salary ? { salary } : {}),
    });
  }
  return jobs;
}

/** @param {any} value @returns {any[]} */
function flattenJsonLd(value) {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== 'object') return [];
  return [value, ...flattenJsonLd(value['@graph'])];
}

/**
 * Title, description and posted date from a detail page's `JobPosting`
 * JSON-LD. `validThrough`, `employmentType` and `baseSalary` are deliberately
 * not read (see the header). Exported for unit tests.
 * @param {unknown} html
 * @returns {{ title?: string, description?: string, postedAt?: number, location?: string }}
 */
export function parseDetail(html) {
  if (typeof html !== 'string') return {};
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    let parsed;
    try { parsed = JSON.parse(match[1]); } catch { continue; }
    const node = flattenJsonLd(parsed).find((item) => {
      const type = item?.['@type'];
      return type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
    });
    if (!node) continue;
    const title = typeof node.title === 'string' ? node.title.replace(/\s+/g, ' ').trim() : '';
    const description = htmlToText(typeof node.description === 'string' ? node.description : '');
    const postedAt = toEpochMs(node.datePosted);
    const places = Array.isArray(node.jobLocation) ? node.jobLocation : [node.jobLocation];
    const address = places.find((p) => p?.address)?.address || {};
    const location = [address.addressLocality, address.addressRegion]
      .filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim()).join(', ');
    return {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(postedAt !== undefined ? { postedAt } : {}),
      ...(location ? { location } : {}),
    };
  }
  return {};
}

/** @param {any} entry */
function parseConfig(entry) {
  const cfg = entry?.applicantpro || {};
  const n = Number(cfg.detailLimit);
  const detailLimit = Number.isFinite(n) ? Math.min(DETAIL_MAX_LIMIT, Math.max(1, Math.trunc(n))) : DETAIL_DEFAULT_LIMIT;
  return {
    fetchDetails: cfg.fetchDetails === true,
    detailLimit,
  };
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  return {
    id: `applicantpro-${row.url}`,
    title: row.title,
    company: row.company,
    url: row.url,
    salary: salaryText(row.salary),
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: '',
    relocates: false,
    date: typeof row.postedAt === 'number' ? new Date(row.postedAt).toISOString() : '',
    snippet: row.description || '',
    source: 'applicantpro',
  };
}

/**
 * Fetch + normalize one `<tenant>.applicantpro.com` board (two requests by
 * default: the `/jobs/` site-id page, then the `/core/jobs/<id>` JSON list;
 * the opt-in `applicantpro.fetchDetails` adds paced per-posting detail
 * fetches). The endpoint is re-validated against the pinned host before any
 * request (assertApplicantproUrl).
 *
 * @param {string} endpoint - the `/jobs/` listing URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchApplicantpro(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  // Host allowlist before any request (SSRF guard): the adapter resolved this
  // endpoint from the entry; re-validate it here.
  assertApplicantproUrl(endpoint);
  // A scan aborted before the first request must fail loud, not report an
  // empty board (deel convention).
  signal?.throwIfAborted();
  // Test seam (apple convention); the default honors the abort signal while
  // pacing between detail pages.
  const pace = opts.sleep || ((ms) => delay(ms, signal));
  const origin = new URL(endpoint).origin;
  const who = String(company?.name || origin);

  const domainId = await resolveDomainId(company, origin, fetchImpl, signal);
  // `getParams` is the listing's filter object, sent as JSON; `{}` is "no
  // filter" and returns the full public inventory.
  const listUrl = `${origin}/core/jobs/${domainId}?getParams=${encodeURIComponent('{}')}`;
  const json = await fetchJsonWithRetry(fetchImpl, listUrl, { signal, redirect: 'error' });
  const jobs = parseListResponse(json, origin, who);

  const reported = Number(json?.data?.jobCount);
  if (Number.isFinite(reported) && reported > (json?.data?.jobs?.length ?? 0)) {
    console.error(`⚠️  applicantpro: ${who} returned ${json.data.jobs.length} of ${reported} postings — the list may be incomplete`);
  }

  const { fetchDetails, detailLimit } = parseConfig(company);
  if (!fetchDetails) return jobs.map(normalize);

  const targets = jobs.slice(0, detailLimit);
  for (let i = 0; i < targets.length; i++) {
    if (i > 0) await pace(DETAIL_PACE_MS);
    const job = targets[i];
    try {
      const html = await fetchTextWithRetry(fetchImpl, job.url, { signal, redirect: 'error' });
      const detail = parseDetail(html);
      if (detail.title) job.title = detail.title;
      if (detail.description) job.description = detail.description;
      if (job.postedAt === undefined && detail.postedAt !== undefined) job.postedAt = detail.postedAt;
      if (!job.location && detail.location) job.location = detail.location;
    } catch { /* optional enrichment: keep the list row */ }
  }
  return jobs.map(normalize);
}

/**
 * The numeric site id: pinned on the entry (`applicantpro.domainId`), else
 * read off the tenant's `/jobs/` page. The parent keeps this in a 30-day
 * ctx.idCache between scans; the web-ui scanner threads no cache, so it is
 * re-read per scan (documented deviation).
 * @param {any} company
 * @param {string} origin
 * @param {typeof fetch} fetchImpl
 * @param {AbortSignal} [signal]
 */
async function resolveDomainId(company, origin, fetchImpl, signal) {
  const pinned = company?.applicantpro?.domainId;
  if (Number.isSafeInteger(pinned) && pinned > 0) return pinned;
  const html = await fetchTextWithRetry(fetchImpl, `${origin}/jobs/`, { signal, redirect: 'error' });
  const id = extractDomainId(html);
  if (id === null) throw new Error(`applicantpro: could not find the site id on ${origin}/jobs/`);
  return id;
}
