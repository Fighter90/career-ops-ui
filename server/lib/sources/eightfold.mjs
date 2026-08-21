// @ts-check
/**
 * Eightfold AI source — hits the public, per-tenant Talent Acquisition JSON API
 * (zero-auth GET, no token/cookie). Eightfold hosts branded career sites for
 * large enterprises (Bayer, Vodafone, PepsiCo, Autodesk, Micron, …).
 *
 * Implements the
 * web-ui source contract (rich job objects + `meta` for auto-discovery).
 *
 * Host pattern (per-tenant, host-pinned):
 *   <tenant>.eightfold.ai        e.g. bayer.eightfold.ai
 *
 * Career page URL:
 *   https://<tenant>.eightfold.ai/careers[?domain=<domain>]
 * Many tenants also front the same board on a branded CNAME
 * (careers.<company>.com). That host is deliberately NOT accepted: the API is
 * host-pinned to *.eightfold.ai, so an entry must point at the canonical tenant
 * host via `careers_url` (or `api:`).
 *
 * JSON API (GET, zero-auth):
 *   https://<tenant>.eightfold.ai/api/apply/v2/jobs?domain=<domain>&start=<n>&num=<n>
 *   `domain` is OPTIONAL — the server infers it from the tenant host — but is
 *   forwarded when the entry supplies one (multi-brand tenants scope by it).
 *   Response: { positions: [...], count: <total>, domain: "<domain>" }.
 *   Per position: id, name, posting_name, location, locations[], department,
 *   business_unit, t_create/t_update (epoch SECONDS), canonicalPositionUrl.
 *
 * PAGE SIZE IS SERVER-CAPPED AT 10 regardless of `num`, so pagination is
 * mandatory rather than an optimization. A safety cap on page count keeps a
 * misbehaving API from driving an unbounded request loop; `max_pages` on the
 * company entry raises it for a genuinely huge tenant.
 *
 * SSRF defence: `assertEightfoldUrl` requires HTTPS + an exact *.eightfold.ai
 * host (EIGHTFOLD_HOST_RE), and every fetch uses `redirect:'error'`. A
 * canonicalPositionUrl frequently points at a branded host (talent.bayer.com):
 * that is accepted for the DISPLAY url only — it is written to history, never
 * fetched. Host-pinning applies to endpoints WE request, not links we record.
 *
 * Used by the eightfold adapter (server/lib/portals/adapters/eightfold.mjs).
 */
import { fetchJsonWithRetry, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';

export const EIGHTFOLD_HOST_RE = /^[a-z0-9-]+\.eightfold\.ai$/i;

// The API refuses to return more than 10 rows per request regardless of `num`.
const PAGE_SIZE = 10;
// Safety cap on pagination, applied regardless of what `count` claims.
// 200 pages = 2,000 postings; override with `max_pages` on the entry.
const DEFAULT_MAX_PAGES = 200;
// Hard ceiling even for an explicit override (10,000 postings).
const MAX_PAGES_CAP = 1000;
// Same-host pacing between pages inside one tenant's own pagination loop —
// Eightfold's edge rate-limits bursts. WAF-aware spacing, same idiom as oracle.
const INTER_PAGE_DELAY_MS = 250;
const RETRY_DELAY_MS = 500;
const SNIPPET_CAP = 500;

export const meta = {
  value: 'eightfold',
  label: 'Eightfold',
  region: 'en',
};

/**
 * Defence-in-depth host guard on every URL this source touches.
 * @param {string} url
 */
export function assertEightfoldUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`eightfold: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`eightfold: URL must use HTTPS: ${url}`);
  if (!EIGHTFOLD_HOST_RE.test(parsed.hostname)) {
    throw new Error(`eightfold: untrusted hostname "${parsed.hostname}" — must match *.eightfold.ai`);
  }
  return url;
}

/**
 * Resolve the tenant host (+ optional domain) from a host-pinned URL — either
 * the entry's careers_url/api or the endpoint the adapter derived from it.
 * Returns null (never throws) for anything off-host, non-https or unparseable,
 * so the adapter can host-pin an override and drop it silently. Keyed off a URL
 * string rather than the raw entry.
 *
 * @param {string} rawUrl
 * @returns {{host: string, domain: (string|null)}|null}
 */
export function resolveTenantHost(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl) return null;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!EIGHTFOLD_HOST_RE.test(parsed.hostname)) return null;
  const fromUrl = parsed.searchParams.get('domain');
  const domain = fromUrl && fromUrl.trim() ? fromUrl.trim() : null;
  return { host: parsed.hostname.toLowerCase(), domain };
}

/**
 * Build the jobs API URL for one page. `num` is requested but server-capped at
 * 10. Exported so the adapter can pin the endpoint from an entry.
 * @param {{host: string, domain?: (string|null)}} tenant
 * @param {number} [start] row offset (0-based)
 * @param {number} [num]   requested page size (server caps at 10)
 */
export function buildApiUrl(tenant, start = 0, num = PAGE_SIZE) {
  const params = new URLSearchParams();
  if (tenant.domain) params.set('domain', tenant.domain);
  params.set('start', String(start));
  params.set('num', String(num));
  return `https://${tenant.host}/api/apply/v2/jobs?${params.toString()}`;
}

/**
 * Fallback posting URL for a position with no usable canonicalPositionUrl.
 * @param {{host: string, domain?: (string|null)}} tenant
 * @param {string} pid
 */
export function buildJobUrl(tenant, pid) {
  const params = new URLSearchParams();
  params.set('pid', pid);
  if (tenant.domain) params.set('domain', tenant.domain);
  return `https://${tenant.host}/careers?${params.toString()}`;
}

/**
 * Eightfold reports timestamps as epoch SECONDS (`t_create`, `t_update`), not
 * ISO strings. Converted here; anything non-finite or non-positive is dropped
 * rather than guessed at (else postings date to 1970).
 * @param {unknown} value
 * @returns {number|undefined} epoch ms, or undefined.
 */
function epochSecondsToMs(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 1000);
}

/**
 * Assemble a location string. Prefers the flat `location` field, then folds in
 * the `locations[]` array. Deduped, joined with " · " so scan's location
 * filter sees every city a multi-site role is open to.
 * @param {any} p
 */
function assembleLocation(p) {
  const parts = [];
  if (typeof p.location === 'string' && p.location.trim()) parts.push(p.location.trim());
  if (Array.isArray(p.locations)) {
    for (const loc of p.locations) {
      if (typeof loc === 'string' && loc.trim()) parts.push(loc.trim());
    }
  }
  return [...new Set(parts)].join(' · ');
}

/**
 * Normalize one Eightfold position into the web-ui job shape. Exported for unit
 * tests. Returns null (dropped, never half-formed) when a row has:
 *   - no title (`name`, falling back to `posting_name`), or
 *   - no usable URL — canonicalPositionUrl must parse as https:, else there
 *     must be an `id` to build the tenant fallback URL from (the URL is the
 *     dedup key downstream).
 *
 * @param {any} p
 * @param {{host: string, domain?: (string|null)}} tenant
 * @param {string} companyName
 * @returns {object|null}
 */
export function normalizeEightfoldJob(p, tenant, companyName) {
  if (!p || typeof p !== 'object') return null;

  const title = (typeof p.name === 'string' && p.name.trim())
    ? p.name.trim()
    : (typeof p.posting_name === 'string' ? p.posting_name.trim() : '');
  if (!title) return null;

  let url = '';
  const canonical = typeof p.canonicalPositionUrl === 'string' ? p.canonicalPositionUrl.trim() : '';
  if (canonical) {
    try {
      const parsed = new URL(canonical);
      if (parsed.protocol === 'https:') url = parsed.href; // display-only, not fetched
    } catch {
      // malformed — fall through to the tenant fallback
    }
  }
  const pid = p.id != null && `${p.id}`.trim() ? `${p.id}`.trim() : '';
  if (!url && pid) url = buildJobUrl(tenant, pid);
  if (!url) return null;

  const location = assembleLocation(p);
  const remote = /\bremote\b/i.test(location);
  const postedMs = epochSecondsToMs(p.t_create) ?? epochSecondsToMs(p.t_update);
  const snippet = [
    typeof p.department === 'string' && p.department.trim() ? p.department.trim() : null,
    typeof p.business_unit === 'string' && p.business_unit.trim() ? `BU: ${p.business_unit.trim()}` : null,
  ].filter(Boolean).join('\n').slice(0, SNIPPET_CAP);

  return {
    id: `eightfold-${pid || url}`,
    title,
    company: companyName,
    url,
    salary: '',
    location,
    isRemote: remote,
    workplaceType: remote ? 'Remote' : '',
    relocates: false,
    date: postedMs != null ? new Date(postedMs).toISOString() : '',
    snippet,
    source: 'eightfold',
  };
}

/** Resolve the page cap: a positive integer `max_pages` on the entry, capped. */
function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * Fetch + normalize an Eightfold tenant's board (paginated by `start` in steps
 * of PAGE_SIZE). Stops on an empty/short page, once past `count`, or at the
 * page cap. A first-page failure throws (dead board); a mid-run blip after ≥1
 * successful page keeps what's already collected (same idiom as
 * tencent/oraclecloud). Deduped by url.
 *
 * @param {string} endpoint host-pinned Eightfold jobs URL (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchEightfold(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertEightfoldUrl(endpoint);
  const tenant = resolveTenantHost(endpoint);
  if (!tenant) throw new Error(`eightfold: cannot derive API URL from ${endpoint}`);

  // An explicit entry.domain overrides any ?domain= baked into the endpoint
  // (multi-brand tenants scope their board by it).
  if (typeof company.domain === 'string' && company.domain.trim()) {
    tenant.domain = company.domain.trim();
  }
  const companyName = (typeof company.name === 'string' && company.name.trim())
    ? company.name.trim()
    : tenant.host.split('.')[0];
  const maxPages = resolveMaxPages(company);

  /** @type {Map<string, object>} */
  const seen = new Map();
  /** @type {number|null} */
  let total = null;
  let succeededOnce = false;

  for (let page = 0; page < maxPages; page += 1) {
    const start = page * PAGE_SIZE;
    const url = buildApiUrl(tenant, start, PAGE_SIZE);
    assertEightfoldUrl(url); // SSRF guard before every fetch
    if (page > 0) await delay(INTER_PAGE_DELAY_MS, signal);

    let json;
    try {
      json = await fetchJsonWithRetry(fetchImpl, url, {
        signal,
        // redirect:'error' + assertEightfoldUrl above guarantees the final
        // hostname stays inside *.eightfold.ai (no SSRF via redirect).
        redirect: 'error',
        headers: { accept: 'application/json', 'user-agent': BROWSER_LIKE_USER_AGENT },
        retryDelayMs: RETRY_DELAY_MS,
      });
    } catch (err) {
      // A dead board should still read as a failure, but a mid-run blip must
      // not discard what's already collected.
      if (!succeededOnce) throw err;
      console.error(`  ⚠ eightfold: page ${page} failed (${err.message}) — keeping the ${seen.size} jobs collected so far`);
      return [...seen.values()];
    }
    succeededOnce = true;

    const positions = Array.isArray(json?.positions)
      ? json.positions
      : (Array.isArray(json?.jobs) ? json.jobs : []);
    for (const p of positions) {
      const job = normalizeEightfoldJob(p, tenant, companyName);
      if (job && !seen.has(job.url)) seen.set(job.url, job);
    }
    if (total === null && typeof json?.count === 'number' && Number.isFinite(json.count)) {
      total = json.count;
    }

    // Stop conditions, in the order they can be trusted:
    //   - an empty or short page is the end of the board;
    //   - once we've paged past `count` there is nothing left to ask for.
    if (positions.length === 0 || positions.length < PAGE_SIZE) break;
    if (total !== null && start + PAGE_SIZE >= total) break;
  }

  return [...seen.values()];
}
