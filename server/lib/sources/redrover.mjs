// @ts-check
/**
 * Red Rover K12 source — US school-district job boards at
 * `https://jobs.redroverk12.com/org/<orgId>` (one portal entry = one district).
 *
 * Ported from parent career-ops `providers/redrover.mjs` and re-shaped to the
 * web-ui source contract: a `meta` export for registry auto-discovery, pure
 * exported helpers the tests drive with no network, an injected `fetchImpl`,
 * and the web-ui job object.
 *
 * ── The API ──────────────────────────────────────────────────────────────
 * The board is a Next.js app over a public, unauthenticated GraphQL API. The
 * query below is the one the browse page itself sends, trimmed to the fields
 * used here:
 *
 *   POST https://api.redroverk12.com/graphql
 *   body: {"operationName":"GetJobPostings","variables":{"search":{"orgId":"<id>",…}},"query":…}
 *   → {data:{jobSeekerSiteUnauthenticated:{jobPostingSearch:{results:[…],hasMoreData}}}}
 *
 * Only PUBLIC postings are returned. Red Rover also lists internal-only
 * postings ("Internal applicants only") with no public activation date; an
 * outside applicant cannot apply to those, so they are left out. Closed rows
 * are dropped too.
 *
 * ── Security ─────────────────────────────────────────────────────────────
 * The API host is a fixed literal and the org id is digits-only, so nothing
 * config-derived reaches the request URL. `resolveRedRoverTarget` requires
 * HTTPS and an exact (case-insensitive) `jobs.redroverk12.com` host, so a
 * look-alike (`jobs.redroverk12.com.evil.example`) or a path-spoofed URL is
 * refused. The POST uses `redirect:'error'`, and `fetchJson` adds the
 * DNS-rebinding guard on the real network path. Posting URLs are rebuilt from
 * the fixed board origin plus the validated org id and a digits-only posting
 * id — never taken from the payload.
 *
 * ── Caps / failure ───────────────────────────────────────────────────────
 * The API answers up to 500 postings per call (`hasMoreData` says when there
 * are more). No page cursor was found, so a board past 500 THROWS instead of
 * returning a silently truncated list (parent behaviour). One request per
 * company means no page cap applies; the row count is capped at MAX_JOBS. A
 * transient failure (429, 5xx, network) is retried; a 4xx or a refused
 * redirect is not. A final failure throws, and the scanner's per-company
 * try/catch turns it into one logged error for that district.
 */
import { fetchJsonWithRetry, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';

export const meta = {
  value: 'redrover',
  label: 'Red Rover',
  region: 'en',
};

export const API_URL = 'https://api.redroverk12.com/graphql';
export const REDROVER_HOST = 'jobs.redroverk12.com';
export const REDROVER_ORIGIN = `https://${REDROVER_HOST}`;

/** One API response holds at most 500 postings; `hasMoreData` throws past that. */
export const MAX_JOBS = 500;
// Matches the parent's fetchJsonWithRetry budget: 1 attempt + 2 retries on a
// transient failure (429, 5xx, or a network error without a status).
const RETRIES = 2;
const DEFAULT_COMPANY = 'Red Rover';

const ORG_PATH_RE = /^\/org\/(\d+)(?:\/|$)/;

export const QUERY = `query GetJobPostings($search: JobPostingSearchInput!) {
  jobSeekerSiteUnauthenticated {
    jobPostingSearch(search: $search) {
      results {
        id
        name
        organizationName
        location { name }
        activePublicOnDateUtc
        closedOnDateUtc
        allowsRemote
      }
      hasMoreData
    }
  }
}`;

/**
 * Whether a hostname is the Red Rover job board. Exact match, anchored — never
 * a substring test. Exported for the adapter + tests.
 * @param {unknown} hostname
 */
export function isRedRoverHost(hostname) {
  return typeof hostname === 'string' && hostname.toLowerCase() === REDROVER_HOST;
}

/**
 * `{ origin, orgId }` from a careers_url, or null. HTTPS-only, host pinned to
 * jobs.redroverk12.com, path `/org/<digits>` (optionally followed by more path).
 * @param {unknown} url
 * @returns {{ origin: string, orgId: string } | null}
 */
export function resolveRedRoverTarget(url) {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !isRedRoverHost(parsed.hostname)) return null;
  const orgId = (parsed.pathname.match(ORG_PATH_RE) || [])[1];
  return orgId ? { origin: REDROVER_ORIGIN, orgId } : null;
}

/**
 * Canonical board URL for a careers_url, or null. Used as the adapter endpoint.
 * @param {unknown} url
 */
export function buildBoardUrl(url) {
  const t = resolveRedRoverTarget(url);
  return t ? `${t.origin}/org/${t.orgId}` : null;
}

/**
 * Validate a board URL and return its target. Throws the parent's message.
 * @param {unknown} url
 * @param {string} [name]
 */
export function assertRedRoverUrl(url, name = '') {
  const t = resolveRedRoverTarget(url);
  if (!t) {
    throw new Error(`redrover: cannot derive org id for ${name || String(url)} (need an https://jobs.redroverk12.com/org/<id> careers_url)`);
  }
  return t;
}

/**
 * GraphQL request body for one district. Exported for tests.
 * @param {string} orgId
 */
export function buildRequestBody(orgId) {
  return JSON.stringify({
    operationName: 'GetJobPostings',
    variables: { search: { orgId, searchTerm: '', locationIds: [], jobPostingCategoryIds: [] } },
    query: QUERY,
  });
}

/**
 * `activePublicOnDateUtc` → `YYYY-MM-DD` (UTC), or '' when absent/unparseable
 * (NaN-safe) — a fabricated date would defeat the scanner's age filter.
 * @param {unknown} v
 */
function isoDate(v) {
  if (!v) return '';
  const ms = Date.parse(String(v));
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : '';
}

/**
 * Parse the GetJobPostings GraphQL response into web-ui job rows. Exported for
 * tests.
 *
 * - `null` / `{}` / `data: null` / no `results` → [] (alive, nothing there).
 * - A GraphQL `errors` array, or `jobSeekerSiteUnauthenticated` present without
 *   a `jobPostingSearch` object → throws.
 * - `hasMoreData: true` → throws (no way to fetch the rest; see header).
 * - Internal-only (no `activePublicOnDateUtc`), closed, id-less and name-less
 *   rows are skipped.
 *
 * @param {any} json
 * @param {string} orgId validated digits-only org id
 * @param {string} [company] the portals.yml entry name
 * @returns {object[]}
 */
export function parseRedRoverResponse(json, orgId, company = DEFAULT_COMPANY) {
  if (json == null || typeof json !== 'object') return [];
  if (Array.isArray(json.errors) && json.errors.length) {
    throw new Error(`redrover: API error: ${json.errors[0]?.message || 'unknown GraphQL error'}`);
  }
  const site = json.data?.jobSeekerSiteUnauthenticated;
  if (site == null) return [];
  const search = site.jobPostingSearch;
  if (search == null || typeof search !== 'object') {
    throw new Error(`redrover: unexpected response shape (jobSeekerSiteUnauthenticated keys: ${Object.keys(site).join(', ') || 'none'})`);
  }
  if (search.hasMoreData) throw new Error('redrover: more postings than one response holds; paging is not supported');
  const rows = search.results;
  if (!Array.isArray(rows)) return [];

  const label = typeof company === 'string' && company.trim() ? company.trim() : DEFAULT_COMPANY;
  const jobs = [];
  for (const j of rows) {
    const id = String(j?.id ?? '').trim();
    const title = String(j?.name ?? '').trim();
    // id is numeric; anything else cannot become a posting URL.
    if (!/^\d+$/.test(id) || !title) continue;
    if (!j.activePublicOnDateUtc || j.closedOnDateUtc) continue; // internal-only or closed
    const where = [j.location?.name, j.organizationName].filter(Boolean).join(' - ');
    const isRemote = !!j.allowsRemote;
    jobs.push({
      id: `redrover-${orgId}-${id}`,
      title,
      company: label,
      url: `${REDROVER_ORIGIN}/org/${orgId}/opening/${id}`,
      salary: '',
      location: isRemote ? (where ? `${where} (Remote)` : 'Remote') : where,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: isoDate(j.activePublicOnDateUtc),
      snippet: '',
      source: 'redrover',
    });
    if (jobs.length >= MAX_JOBS) break;
  }
  return jobs;
}

/**
 * Fetch + normalize one Red Rover district — a single GraphQL POST.
 *
 * The endpoint is validated BEFORE the request, so a bad careers_url never
 * reaches the network; the request itself always goes to the fixed API host.
 * `fetchImpl` is always the injected one.
 *
 * @param {string} endpoint board URL from buildEndpoint (the entry's careers_url)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any, retryDelayMs?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchRedRover(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const name = company && typeof company.name === 'string' ? company.name : '';
  const { origin, orgId } = assertRedRoverUrl(endpoint, name);
  const json = await fetchJsonWithRetry(/** @type {any} */ (fetchImpl), API_URL, {
    signal,
    method: 'POST',
    redirect: 'error',
    headers: {
      'User-Agent': BROWSER_LIKE_USER_AGENT,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: buildRequestBody(orgId),
    retries: RETRIES,
    ...(opts.retryDelayMs !== undefined ? { retryDelayMs: opts.retryDelayMs } : {}),
  });
  return parseRedRoverResponse(json, orgId, name);
}
