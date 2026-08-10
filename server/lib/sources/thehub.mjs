/**
 * The Hub source — board-wide public JSON API (Nordic / EU startups).
 *   GET https://thehub.io/api/v2/jobsandfeatured?page=N&countryCode=EU
 *
 * v2 migration (parent career-ops 6b33fc4 + ae905db): the old `/api/jobs`
 * endpoint moved to `/api/v2/jobsandfeatured`, which wraps the list in a
 * `jobs` envelope and no longer carries a per-posting URL or posting date.
 *
 * Response shape: { jobs: { docs: [ { id, title, company: { name },
 *   location: { address, locality, country }, isRemote, ... } ], total, page,
 *   pages, limit } }
 *
 * Because the response has no job URL, the canonical posting URL is built from
 * `id` as `https://thehub.io/jobs/{id}` (host-pinned constant + encoded id, so
 * it is never attacker-controlled). Because the response has no posting date,
 * every row emits `date: ''` — thehub rows are exempt from the scanner's age
 * filter (there is no date to fabricate).
 *
 * `countryCode` is required on every v2 request: omitting it scopes results to
 * the caller's geo-IP, so coverage would depend on where this server runs
 * (harmful behind a VPN / non-EU host). We default it to `EU`; an explicit
 * `countryCode` on an overridden endpoint (via `thehub:` / `api:`) is honored.
 *
 * Paginated 15/page via `?page=N` (1-indexed); the `jobs.pages` field bounds
 * the loop. Default cap is 3 pages; override via opts.maxPages (clamped to [1, 50]).
 *
 * Ported from parent career-ops `providers/thehub.mjs` — reimplemented to the
 * web-ui source contract (no code lifted).
 *
 * Used by the thehub adapter (server/lib/portals/adapters/thehub.mjs).
 */

const UA = 'career-ops-web-ui/1.0';
const TRUSTED_HOST = 'thehub.io';
const DEFAULT_COUNTRY_CODE = 'EU';
const PER_PAGE = 15;
const DEFAULT_MAX_PAGES = 3;
const MAX_PAGES_CAP = 50;

export const FEED_BASE = 'https://thehub.io/api/v2/jobsandfeatured';

export const meta = {
  value: 'thehub',
  label: 'The Hub',
  region: 'en',
};

/**
 * Assert that `url` points to thehub.io over HTTPS. Throws on failure.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertTheHubUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`thehub: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`thehub: URL must use HTTPS: ${url}`);
  }
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`thehub: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/**
 * Build a paginated request URL: sets `page`, and adds `countryCode=EU` unless
 * the endpoint already carries a `countryCode`. `feedUrl` is validated by
 * {@link assertTheHubUrl} before this runs, so `new URL` never throws here.
 * @param {string} feedUrl
 * @param {number} page
 * @returns {string}
 */
function buildPageUrl(feedUrl, page) {
  const u = new URL(feedUrl);
  u.searchParams.set('page', String(page));
  if (!u.searchParams.has('countryCode')) {
    u.searchParams.set('countryCode', DEFAULT_COUNTRY_CODE);
  }
  return u.href;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Map a raw The Hub v2 job object to the 12-field web-ui normalized shape.
 * Returns null for rows missing a valid title or id. The v2 response carries
 * no posting date, so `date` is always '' (exempt from the age filter).
 * @param {any} j
 * @returns {object|null}
 */
function normalize(j) {
  if (!j || typeof j !== 'object') return null;

  const title = cleanText(j.title);
  if (!title) return null;

  // v2 has no per-posting URL — build the canonical page from the id. Host is a
  // hardcoded constant and the id is encoded, so the URL is never off-host.
  const id = j.id != null ? String(j.id).trim() : '';
  if (!id) return null;
  const url = `https://${TRUSTED_HOST}/jobs/${encodeURIComponent(id)}`;

  const company =
    j.company && typeof j.company === 'object' && cleanText(j.company.name)
      ? cleanText(j.company.name)
      : 'The Hub';

  const loc = j.location && typeof j.location === 'object' ? j.location : {};
  const address = cleanText(loc.address);
  const locality = cleanText(loc.locality);
  const country = cleanText(loc.country);
  const base = address || [locality, country].filter(Boolean).join(', ');
  const remote = j.isRemote === true;
  const location = [base, remote ? 'Remote' : ''].filter(Boolean).join(', ');

  return {
    id: `thehub-${id}`,
    title,
    company,
    url,
    salary: '',
    location,
    isRemote: remote,
    workplaceType: remote ? 'Remote' : 'Onsite',
    relocates: false,
    date: '', // v2 API carries no posting date — exempt from the age filter
    snippet: '',
    source: 'thehub',
  };
}

/**
 * Fetch + normalize The Hub public v2 jobs API (paginated).
 *
 * Dead-board contract: a failure on the first request (HTTP error, network
 * reject, or malformed shape) throws so a dead board reads as a failure. Once
 * page 1 has succeeded, a later page failing mid-pagination stops the loop and
 * keeps whatever was already collected.
 *
 * @param {string} feedUrl  Base API endpoint (default: FEED_BASE)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object, maxPages?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchTheHub(feedUrl = FEED_BASE, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  const rawMax = opts.maxPages;
  const maxPages = Math.min(
    Math.max(1, Number.isInteger(rawMax) ? rawMax : DEFAULT_MAX_PAGES),
    MAX_PAGES_CAP,
  );

  // Validate the base endpoint before any requests.
  assertTheHubUrl(feedUrl);

  const headers = { 'User-Agent': UA, Accept: 'application/json' };
  const out = [];

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = buildPageUrl(feedUrl, page);

    let json;
    try {
      // redirect:'error' refuses server-side redirects (SSRF guard).
      const res = await fetchImpl(pageUrl, { signal, redirect: 'error', headers });
      if (!res.ok) {
        const err = new Error(`TheHub: HTTP ${res.status} (${pageUrl})`);
        err.status = res.status;
        throw err;
      }
      json = await res.json();
    } catch (err) {
      // First request fails → dead board, surface it. Later page fails after
      // ≥1 success → keep the partials already collected.
      if (page === 1) throw err;
      break;
    }

    const jobs = json && json.jobs;
    if (!jobs || !Array.isArray(jobs.docs)) {
      if (page === 1) {
        throw new Error(
          `TheHub: unexpected API response on page ${page} — expected { jobs: { docs: [...] } }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
        );
      }
      break;
    }

    for (const j of jobs.docs) {
      const normalized = normalize(j);
      if (normalized) out.push(normalized);
    }

    // Stop when we've reached the last page or received a short page.
    const totalPages = Number.isInteger(jobs.pages) ? jobs.pages : Infinity;
    if (page >= Math.min(totalPages, maxPages)) break;
    if (jobs.docs.length < PER_PAGE) break;
  }

  return out;
}
