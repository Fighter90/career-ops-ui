// @ts-check
/**
 * PrevueAPS source — single-company ATS, one entry per tenant under
 * `tracked_companies:` (a per-employer careers page at
 * `https://<tenant>.prevueaps.ca`, mirroring breezy/recruitee — not a job-board
 * aggregator).
 *
 * Ported from parent career-ops `providers/prevueaps.mjs`, reimplemented to the
 * web-ui source contract (rich 12-field job objects + `meta` for
 * auto-discovery).
 *
 * ── The non-obvious part: domainId resolution ──
 *
 * The public JSON endpoint is NOT keyed by the tenant subdomain but by a small
 * numeric per-tenant site id that only appears in the tenant's own `/jobs/`
 * HTML page:
 *
 *   GET https://{tenant}.prevueaps.ca/core/jobs/{domainId}?getParams={...}
 *
 * So a fetch is TWO requests: the `/jobs/` page (text) → `extractDomainId()` →
 * the `/core/jobs/{id}` API (JSON). The resolver tries, strongest signal first:
 *   1. a literal `/core/jobs/<digits>` path (the page's own JS built the URL)
 *   2. a `data-domain-id="<digits>"` attribute
 *   3. a `domainId` JS identifier (`domainId: 889`, `"domainId":"889"`)
 *   4. a `siteId` JS identifier in the same shapes
 * If none matches, fetch THROWS with the company name so the gap is visible in
 * a scan run instead of silently producing zero jobs.
 *
 * `getParams` is a display-hints payload (which columns the page renders), not
 * a query filter; the full observed constant is sent unchanged.
 *
 * SSRF: the tenant subdomain is the variable part, so the host is pinned by an
 * anchored regex (`<safe-tenant>.prevueaps.ca`), HTTPS-only, and both requests
 * use `redirect:'error'` so a server-side redirect can't bounce us off-domain.
 * The domainId is digits-only by construction, so it can't inject a path.
 *
 * NOT PAGINATED: the API returns every open job in one response, so there is no
 * page loop — MAX_JOBS caps the emitted rows instead. Dead-board contract: any
 * request failure propagates (the scanner records it per company, fail-soft
 * across companies); per-row parsing is fail-soft (a malformed row is dropped).
 *
 * Used by the prevueaps adapter (server/lib/portals/adapters/prevueaps.mjs).
 */
import { fetchJson, fetchText, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';

export const PREVUEAPS_HOST_RE = /^[a-z0-9][a-z0-9-]*\.prevueaps\.ca$/;

/** Cap total postings emitted per tenant (single-response API). */
export const MAX_JOBS = 1000;

/** Observed getParams shape (display/formatting hints only). */
export const DEFAULT_GET_PARAMS = {
  showDate: true,
  showLocation: true,
  showEmploymentType: true,
  showCategory: true,
  showClassification: true,
  showWorkplaceType: true,
  customCategoryTitle: '',
};

export const meta = {
  value: 'prevueaps',
  label: 'PrevueAPS',
  region: 'en',
};

/**
 * Defence-in-depth host check on every URL this source requests.
 * @param {string} url
 */
export function assertPrevueapsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`prevueaps: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`prevueaps: URL must use HTTPS: ${url}`);
  if (!PREVUEAPS_HOST_RE.test(parsed.hostname)) {
    throw new Error(`prevueaps: untrusted hostname "${parsed.hostname}" — must match <tenant>.prevueaps.ca`);
  }
  return url;
}

/**
 * Resolve the tenant origin (`https://<tenant>.prevueaps.ca`) from a company
 * entry. Honours an explicit `api:` URL, else parses `careers_url`. Non-string
 * values, malformed URLs, non-https, and hosts outside `*.prevueaps.ca`
 * (including path-spoofed `https://evil.example/x.prevueaps.ca/…`) → null.
 * @param {any} company
 * @returns {string|null}
 */
export function resolveOrigin(company) {
  if (!company || typeof company !== 'object') return null;
  const rawApi = typeof company.api === 'string' ? company.api : '';
  const rawCareers = typeof company.careers_url === 'string' ? company.careers_url : '';
  const raw = (rawApi || rawCareers).trim();
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!PREVUEAPS_HOST_RE.test(parsed.hostname)) return null;
  return `https://${parsed.hostname}`;
}

/**
 * Extract the numeric domainId from a tenant's `/jobs/` HTML page.
 * Returns null when no pattern matches (or input is not a non-empty string).
 * @param {unknown} html
 * @returns {string|null}
 */
export function extractDomainId(html) {
  if (typeof html !== 'string' || !html) return null;

  let m = html.match(/\/core\/jobs\/(\d+)/);
  if (m) return m[1];

  m = html.match(/data-domain-id\s*=\s*["'](\d+)["']/i);
  if (m) return m[1];

  m = html.match(/["']?domainId["']?\s*[:=]\s*["']?(\d+)["']?/i);
  if (m) return m[1];

  m = html.match(/["']?siteId["']?\s*[:=]\s*["']?(\d+)["']?/i);
  if (m) return m[1];

  return null;
}

/**
 * Build the `/core/jobs/{domainId}` API URL for a tenant origin.
 * @param {string} origin
 * @param {string} domainId
 */
export function buildApiUrl(origin, domainId) {
  const getParams = encodeURIComponent(JSON.stringify(DEFAULT_GET_PARAMS));
  return `${origin}/core/jobs/${domainId}?getParams=${getParams}`;
}

/** @param {unknown} v */
function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Parse a PrevueAPS `/core/jobs/{domainId}` response. Exported for unit tests.
 *
 *   { success: true, data: { jobs: [{ id, title, jobUrl, jobLocation, city,
 *     abbreviation, stateName, employmentType, classification, workplaceType,
 *     payTypeFrame, minSalary, maxSalary, … }], jobCount } }
 *
 * `data.jobs: []` (the real "No job found" shape) → []. Anything whose
 * `data.jobs` is not an array (missing `data`, `jobs: null`, null/undefined
 * body) is a malformed envelope and THROWS — never swallowed as "no jobs".
 *
 * Per row: title must be a non-blank string (trimmed); `jobUrl` must be a
 * well-formed https URL (it is the employer's own posting page and the dedup
 * key; display-only, never server-fetched). Location prefers `jobLocation`,
 * else `city, abbreviation|stateName`. The list payload carries no job body,
 * so employment type / classification / salary are folded into `snippet`
 * (parent's `description`), and the salary range also fills `salary`.
 *
 * @param {any} json
 * @param {string} companyName
 */
export function parsePrevueapsResponse(json, companyName) {
  const jobs = json?.data?.jobs;
  if (!Array.isArray(jobs)) {
    throw new Error(`prevueaps: unexpected response shape for ${companyName} — missing or invalid data.jobs`);
  }
  const out = [];
  const seen = new Set();
  for (const j of jobs) {
    if (!j || typeof j.title !== 'string' || !j.title.trim()) continue;

    let url = '';
    const rawUrl = typeof j.jobUrl === 'string' ? j.jobUrl : '';
    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol === 'https:') url = parsed.href;
      } catch { /* malformed → drop */ }
    }
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const location = str(j.jobLocation)
      || [str(j.city), str(j.abbreviation) || str(j.stateName)].filter(Boolean).join(', ');

    const min = str(j.minSalary);
    const max = str(j.maxSalary);
    let salary = '';
    if (min || max) {
      salary = [[min, max].filter(Boolean).join(' - '), str(j.payTypeFrame)].filter(Boolean).join(' ');
    }
    const snippetBits = [str(j.employmentType), str(j.classification), salary].filter(Boolean);

    const workplace = str(j.workplaceType);
    const isRemote = /remote/i.test(workplace) || /remote/i.test(location);

    out.push({
      id: `prevueaps-${url}`,
      title: j.title.trim(),
      company: companyName,
      url,
      salary,
      location,
      isRemote,
      workplaceType: workplace || (isRemote ? 'Remote' : ''),
      relocates: false,
      date: '',
      snippet: snippetBits.join(' · '),
      source: 'prevueaps',
    });
    if (out.length >= MAX_JOBS) break;
  }
  return out;
}

/**
 * Fetch + normalize a PrevueAPS tenant: `/jobs/` page → domainId → JSON API.
 * @param {string} endpoint `https://<tenant>.prevueaps.ca/jobs/` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any }} [opts]
 */
export async function fetchPrevueaps(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const name = (company && typeof company.name === 'string') ? company.name : '';
  assertPrevueapsUrl(endpoint);
  const origin = new URL(endpoint).origin;
  const jobsPageUrl = `${origin}/jobs/`;

  const html = await fetchText(/** @type {typeof fetch} */ (fetchImpl), jobsPageUrl, {
    signal,
    redirect: 'error',
    headers: { 'user-agent': BROWSER_LIKE_USER_AGENT, accept: 'text/html,*/*' },
  });
  const domainId = extractDomainId(html);
  if (!domainId) {
    throw new Error(`prevueaps: could not resolve domainId for ${name || origin} from ${jobsPageUrl}`);
  }

  const apiUrl = assertPrevueapsUrl(buildApiUrl(origin, domainId));
  const json = await fetchJson(/** @type {typeof fetch} */ (fetchImpl), apiUrl, {
    signal,
    redirect: 'error',
    headers: { 'user-agent': BROWSER_LIKE_USER_AGENT, accept: 'application/json' },
  });
  return parsePrevueapsResponse(json, name);
}
