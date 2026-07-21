// @ts-check
/**
 * Jobvite source — hits the public, zero-auth per-tenant jobs JSON API of
 * Jobvite career sites. Used by ~3,000 companies across a wide range of
 * industries.
 *
 * Ported from parent career-ops `providers/jobvite.mjs` into the web-ui
 * source contract (rich job objects + `meta` for auto-discovery).
 *
 * API (GET, zero-auth, single page):
 *   https://jobs.jobvite.com/api/company/{companyId}/jobs
 * Response: { jobs: [ { id, title, category, location, country, jobType,
 *   date, applyURL } ] }
 *
 * Auto-detects from careers_url pattern:
 *   https://jobs.jobvite.com/{companyId}
 *   https://jobs.jobvite.com/{companyId}/jobs
 * The companyId is the slug segment immediately after the host. An explicit
 * `api:` of the form https://jobs.jobvite.com/api/company/{companyId}/jobs
 * takes precedence (custom slugs).
 *
 * SSRF stance (parent parity): the API URL is constructed from the extracted
 * slug only, never from a user-supplied path; `assertJobviteUrl` pins the
 * hostname to jobs.jobvite.com before every fetch, and the fetch uses
 * `redirect:'error'`. Job applyURLs are display-only (written into the job
 * list, never fetched here) and accepted from any https: origin — per-job
 * URLs in Jobvite commonly point to a branded company subdomain
 * (e.g. careers.example.com/jobs/…) rather than jobs.jobvite.com. Non-https
 * or malformed applyURLs drop the posting.
 *
 * Used by the jobvite adapter (server/lib/portals/adapters/jobvite.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const JOBVITE_HOST = 'jobs.jobvite.com';
export const MAX_JOBS = 5000; // bounded-work cap on a single-page payload
const UA = 'career-ops-web-ui/1.0';

export const meta = {
  value: 'jobvite',
  label: 'Jobvite',
  region: 'en',
};

/** Defence-in-depth host guard on every URL this source fetches. @param {string} url */
export function assertJobviteUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`jobvite: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`jobvite: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== JOBVITE_HOST) {
    throw new Error(`jobvite: untrusted hostname "${parsed.hostname}" — must be ${JOBVITE_HOST}`);
  }
  return url;
}

// NaN-safe Date.parse → epoch ms (parent career-ops parity).
/** @param {string} value */
function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Extract the companyId slug from a company entry's `api:`/`careers_url`.
 * Parent career-ops parity — accepted forms:
 *   https://jobs.jobvite.com/{slug}
 *   https://jobs.jobvite.com/{slug}/jobs
 *   https://jobs.jobvite.com/api/company/{slug}/jobs  (explicit api: field)
 * Returns null for any non-Jobvite or malformed URL (wrong host, plain HTTP,
 * non-string, empty path).
 *
 * @param {{ api?: unknown, careers_url?: unknown }} entry
 * @returns {string | null}
 */
export function resolveCompanyId(entry) {
  if (!entry || typeof entry !== 'object') return null;
  // Prefer an explicit api: URL (may be set by the user for custom slugs).
  const raw = typeof entry.api === 'string' && entry.api
    ? entry.api
    : typeof entry.careers_url === 'string' ? entry.careers_url : '';
  if (!raw) return null;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== JOBVITE_HOST) return null;

  const segments = parsed.pathname.split('/').filter(Boolean);

  // api: https://jobs.jobvite.com/api/company/{slug}/jobs → ['api','company',slug,'jobs']
  const apiIdx = segments.indexOf('company');
  if (apiIdx !== -1 && segments[apiIdx + 1]) {
    return segments[apiIdx + 1];
  }

  // careers_url: https://jobs.jobvite.com/{slug}[/jobs] → [slug] or [slug, 'jobs']
  if (segments.length >= 1 && segments[0] !== 'api') {
    return segments[0];
  }

  return null;
}

/** Canonical jobs API URL for a tenant slug. @param {string} companyId */
export function buildApiUrl(companyId) {
  return `https://${JOBVITE_HOST}/api/company/${encodeURIComponent(companyId)}/jobs`;
}

/**
 * Pure normalizer for a Jobvite /api/company/{id}/jobs response. Exported for
 * unit tests. Returns [] for null / non-object / non-array `jobs` bodies
 * (fail-soft). Per row:
 *   - title required — posting dropped when absent/blank;
 *   - url ← applyURL, required — dropped when not a valid https: URL
 *     (branded off-host https origins accepted, display-only);
 *   - location ← `location` string, falling back to `country`;
 *   - date ← `date` → ISO string ('' when absent/unparseable);
 *   - snippet ← `category` · `jobType` (whichever are present).
 * Output is capped at MAX_JOBS rows.
 *
 * @param {unknown} json raw parsed API response
 * @param {string} companyName value to write into job.company
 */
export function parseJobvite(json, companyName) {
  if (!json || typeof json !== 'object') return [];
  const jobs = /** @type {any} */ (json).jobs;
  if (!Array.isArray(jobs)) return [];
  const company = typeof companyName === 'string' ? companyName : '';

  const out = [];
  for (const j of jobs) {
    if (out.length >= MAX_JOBS) break;
    if (!j || typeof j !== 'object') continue;

    const title = typeof j.title === 'string' ? j.title.trim() : '';
    if (!title) continue;

    // Resolve and validate the application URL (https-only, else drop).
    const rawUrl = typeof j.applyURL === 'string' ? j.applyURL.trim() : '';
    let url = '';
    if (rawUrl) {
      try {
        const p = new URL(rawUrl);
        if (p.protocol === 'https:') url = p.href;
      } catch { /* malformed URL — drop posting */ }
    }
    if (!url) continue;

    // Location: prefer the explicit location string, fall back to country.
    const location = (typeof j.location === 'string' && j.location.trim())
      ? j.location.trim()
      : (typeof j.country === 'string' ? j.country.trim() : '');

    const isRemote = /\bremote\b/i.test(`${location} ${title}`);
    const postedAt = toEpochMs(j.date);
    const snippet = [j.category, j.jobType]
      .filter((v) => typeof v === 'string' && v.trim())
      .map((v) => v.trim())
      .join(' · ');

    out.push({
      id: `jobvite-${(typeof j.id === 'string' || typeof j.id === 'number') && `${j.id}` !== '' ? j.id : url}`,
      title,
      company,
      url,
      salary: '', // jobvite's public API exposes no salary field
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: postedAt !== undefined ? new Date(postedAt).toISOString() : '',
      snippet,
      source: 'jobvite',
    });
  }
  return out;
}

/**
 * Fetch + normalize a Jobvite tenant's job list (single page, no pagination).
 * The endpoint may be either careers form (jobs.jobvite.com/{slug}[/jobs]) or
 * api form (jobs.jobvite.com/api/company/{slug}/jobs); the slug is re-derived
 * and the canonical API URL rebuilt from it, so a user-supplied path never
 * reaches the wire (parent parity).
 *
 * @param {string} endpoint host-pinned Jobvite URL (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchJobvite(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const companyId = resolveCompanyId({ api: endpoint });
  if (!companyId) throw new Error(`jobvite: cannot derive company ID from ${endpoint}`);
  const apiUrl = buildApiUrl(companyId);
  assertJobviteUrl(apiUrl); // SSRF guard before the fetch
  const companyName = (company && typeof (/** @type {any} */ (company).name) === 'string')
    ? /** @type {any} */ (company).name
    : '';

  // redirect:'error' closes the server-side redirect SSRF vector; combined
  // with assertJobviteUrl the final hostname stays pinned to jobs.jobvite.com.
  const json = await fetchJson(fetchImpl, apiUrl, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  return parseJobvite(json, companyName);
}
