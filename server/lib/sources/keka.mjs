// @ts-check
/**
 * Keka source — the single-company ATS behind `https://<tenant>.keka.com/careers`.
 * Ported from the parent's providers/keka.mjs (upstream #6199).
 *
 * Keka is an HR/ATS platform used by many mid-size employers in India. The
 * careers page is a thin shell: a script on it fetches a static HTML fragment
 * from `/ats/documents/<identifier>/careerportal/<hash>.html`, where
 * `<identifier>` is a UUID unique to the tenant. The same UUID keys the
 * zero-auth JSON feed the embeddable job widget reads:
 *
 *   GET https://<tenant>.keka.com/careers/api/embedjobs/default/active/<identifier>
 *   → [{ id, title, description, jobLocations: [{ name, city, state,
 *        countryName }], publishedOn, ... }]
 *
 * So a scan is two requests, neither needing JavaScript:
 *   1. GET /careers → read the identifier out of the fragment path.
 *   2. GET the feed above → one top-level array holding every open posting.
 * Step 1 sits outside any page count (it carries no listings). The feed is
 * not paginated, so there is no page loop.
 *
 * Detection: `<tenant>.keka.com` is a wildcard-tenant host, matched with an
 * anchored full-host regex. Only the hostname of `careers_url` / `api:` is
 * trusted — the request URL is rebuilt as `https://<hostname>` plus this
 * source's own fixed paths, so a port or a path in the input never reaches
 * the fetch. `www.keka.com` and the vendor's other own subdomains are not
 * tenants and are never claimed.
 *
 * An unknown tenant answers `GET /careers` with a 302 to
 * `/careers/Content/TenantNotFound.html`. The shell is fetched under
 * `redirect: 'manual'` so that 302 is READ (never followed) and reported as
 * a missing tenant rather than a generic redirect failure.
 *
 * Deviations from the parent provider for the web-ui source contract: the
 * fetch goes through the shared fetchTextWithRetry / fetchJsonWithRetry
 * (injected fetchImpl, signal) and the rows are normalized to the scanner's
 * job shape (id/source/date/…). A malformed 200 throws (_shape.mjs
 * semantics — an explicit array check names what arrived instead of reading
 * as an empty board).
 */
import { fetchJsonWithRetry, fetchTextWithRetry } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';

export const meta = {
  value: 'keka',
  label: 'Keka',
  region: 'en',
};

// Anchored wildcard-tenant host: exactly one label under keka.com. Only the
// hostname is taken from careers_url / api — a port or path is dropped.
export const KEKA_HOST_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.keka\.com$/;

// Subdomains Keka itself runs. None of them is a customer tenant.
const RESERVED_LABELS = new Set(['www', 'app', 'api', 'help', 'support', 'blog', 'docs', 'status', 'mail', 'developers']);

// The identifier UUID as it appears in the shell's fragment path:
//   /ats/documents/<uuid>/careerportal/<hash>.html
const IDENTIFIER_RE = /\/ats\/documents\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/careerportal\//i;

/**
 * Defence-in-depth endpoint check: HTTPS on exactly a tenant host (never a
 * reserved vendor label), default port only. Runs on the endpoint the adapter
 * resolved, before any request.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertKekaUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`keka: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`keka: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`keka: a non-default port is not allowed: ${url}`);
  const host = parsed.hostname.toLowerCase();
  if (!KEKA_HOST_RE.test(host) || RESERVED_LABELS.has(host.slice(0, -'.keka.com'.length))) {
    throw new Error(`keka: untrusted hostname "${parsed.hostname}" — must be a <tenant>.keka.com host`);
  }
  return url;
}

/**
 * The tenant origin (`https://<tenant>.keka.com`) for a URL string, or null.
 * Only the hostname is trusted: its path and port are dropped, and the origin
 * is rebuilt, so an input's own path/port can never reach the fetch.
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
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase();
  if (!KEKA_HOST_RE.test(host)) return null;
  if (RESERVED_LABELS.has(host.slice(0, -'.keka.com'.length))) return null;
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

/** The careers-shell URL for one tenant origin (the adapter's endpoint shape). */
export function careersUrlFor(origin) {
  return `${origin}/careers`;
}

/**
 * Read the feed identifier out of a careers-page shell.
 * @param {unknown} html
 * @returns {string | null}
 */
export function extractIdentifier(html) {
  const m = typeof html === 'string' ? html.match(IDENTIFIER_RE) : null;
  return m ? m[1].toLowerCase() : null;
}

/** @param {unknown} value @returns {number | undefined} */
function toEpochMs(value) {
  if (typeof value !== 'string' || !value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * "City, Country" per location, joined with "; ". `name` is the employer's
 * internal office label ("HQ - Tower 2"), so it is only the fallback.
 * @param {any} row
 * @returns {string}
 */
export function jobLocation(row) {
  const locs = Array.isArray(row?.jobLocations) ? row.jobLocations : [];
  const parts = [];
  for (const loc of locs) {
    if (!loc || typeof loc !== 'object') continue;
    const place = [loc.city, loc.countryName]
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter(Boolean)
      .join(', ');
    const label = place || (typeof loc.name === 'string' ? loc.name.trim() : '');
    if (label && !parts.includes(label)) parts.push(label);
  }
  return parts.join('; ');
}

/**
 * Parse an `embedjobs` response. Exported for unit tests.
 *
 * The documented envelope is a top-level array: `[]` is an empty board, and
 * anything else (an object, a string, null) throws so a silent API change does
 * not read as zero postings forever. A single malformed row is dropped.
 *
 * Posting URL: `<origin>/careers/jobdetails/<id>`, the tenant's public detail
 * page. A row with no title, or whose id cannot be encoded, has no stable URL
 * (and `url` is the scanner's dedup key), so it is skipped.
 *
 * @param {any} json
 * @param {string} companyName
 * @param {string} origin  e.g. "https://acme.keka.com"
 * @returns {Array<{title: string, url: string, company: string, location: string,
 *   postedAt?: number, description?: string}>}
 */
export function parseKekaResponse(json, companyName, origin) {
  if (!Array.isArray(json)) {
    const got = json && typeof json === 'object' ? Object.keys(json).join(', ') : typeof json;
    throw new Error(`keka: unexpected response — expected a jobs array, got: [${got}]`);
  }
  const jobs = [];
  for (const row of json) {
    if (!row || typeof row !== 'object') continue;
    const title = typeof row.title === 'string' ? row.title.replace(/\s+/g, ' ').trim() : '';
    const id = typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id).trim() : '';
    if (!title || !id) continue;
    // A lone surrogate in a host-controlled id would throw out of this loop
    // and lose the whole board; drop just that posting instead.
    const seg = safeEncodeURIComponent(id);
    if (seg === null) continue;
    /** @type {{title: string, url: string, company: string, location: string, postedAt?: number, description?: string}} */
    const job = {
      title,
      url: `${origin}/careers/jobdetails/${seg}`,
      company: companyName,
      location: jobLocation(row),
    };
    const postedAt = toEpochMs(row.publishedOn);
    if (postedAt !== undefined) job.postedAt = postedAt;
    const description = htmlToText(row.description);
    if (description) job.description = description;
    jobs.push(job);
  }
  return jobs;
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  return {
    id: `keka-${row.url}`,
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
    source: 'keka',
  };
}

/**
 * Fetch + normalize one `<tenant>.keka.com` board (two requests: the careers
 * shell, then the embedjobs feed). The endpoint is re-validated against the
 * pinned host shape before any request (assertKekaUrl); an unknown tenant's
 * 302 is reported by name (status 404) so the entry reads as "no such
 * tenant", never as a generic redirect failure.
 *
 * @param {string} endpoint - the careers URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchKeka(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company } = opts;
  // Host allowlist before any request (SSRF guard): the adapter resolved this
  // endpoint from the entry; re-validate it here.
  assertKekaUrl(endpoint);
  // A scan aborted before the first request must fail loud, not report an
  // empty board (deel convention).
  signal?.throwIfAborted();
  const origin = originFromUrl(endpoint);
  const who = String(company?.name || origin);
  if (!origin) {
    throw new Error(`keka: cannot derive a <tenant>.keka.com host for ${company?.name || endpoint} — set careers_url to https://<tenant>.keka.com/careers`);
  }

  // 'manual' only to read the 302 an unknown tenant answers with; it is
  // never followed. Any other failure propagates unwrapped.
  let shell;
  try {
    shell = await fetchTextWithRetry(fetchImpl, `${origin}/careers`, { signal, redirect: 'manual' });
  } catch (err) {
    if (err?.status >= 300 && err?.status < 400) {
      const e = new Error(`keka: ${who} careers page redirected (${err.status} -> ${err.location}) — no such tenant`);
      /** @type {any} */ (e).status = 404;
      throw e;
    }
    throw err;
  }

  // Fail closed: a missing identifier means Keka changed the shell, not that
  // the board is empty.
  const identifier = extractIdentifier(shell);
  if (!identifier) {
    throw new Error(`keka: ${who} careers page is missing the embedjobs identifier (structure changed?)`);
  }

  const json = await fetchJsonWithRetry(fetchImpl, `${origin}/careers/api/embedjobs/default/active/${identifier}`, { signal, redirect: 'error' });
  return parseKekaResponse(json, who, origin).map(normalize);
}
