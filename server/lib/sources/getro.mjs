// @ts-check
/**
 * Getro source — VC "talent network" portfolio job boards (jobs at a fund's
 * portfolio companies). Powers b2venture, Earlybird, Point Nine, Speedinvest,
 * Cherry, HV Capital, Atomico, and many other VC boards.
 *
 * Built to the web-ui source contract (rich job objects + `meta` for
 * auto-discovery). The public search API is:
 *   POST https://api.getro.com/api/v2/collections/{collection_id}/search/jobs
 *   body: {"hitsPerPage":N,"page":P}
 *   -> { results: { jobs: [ {title,url,organization:{name},locations[],created_at} ], count } }
 *
 * A board's numeric collection_id is the `network.id` embedded in the board
 * page's __NEXT_DATA__. We don't derive it from the URL — it is set explicitly
 * on the portal entry (read here via `opts.company`, like tencent.mjs):
 *
 *   tracked_companies:
 *     - name: b2venture (portfolio)
 *       provider: getro
 *       getro_collection: 4283
 *       careers_url: https://jobs.b2venture.vc   # reference only
 *       enabled: true
 *
 * These boards are large (1000-2000 jobs) but the API returns them
 * created_at-DESCENDING (newest first), so we paginate newest-first and STOP
 * once postings fall older than `getro_max_age_days`. That is a PAGINATION BOUND
 * for efficiency (don't page through 2000 stale jobs); each job still carries a
 * `date` for downstream freshness handling. The bound default (90d) is
 * deliberately wide. `getro_max_pages` (default 40, hard cap 200) is a request
 * safety cap. Jobs with no created_at are kept ("missing data = pass").
 *
 * Host-pinned to api.getro.com + HTTPS + `redirect:'error'` (SSRF-safe). Used by
 * the getro adapter (server/lib/portals/adapters/getro.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const API_BASE = 'https://api.getro.com/api/v2/collections';
const TRUSTED_HOST = 'api.getro.com';
const HITS_PER_PAGE = 20;        // the API hard-caps page size at 20
const DEFAULT_MAX_PAGES = 40;    // safety cap: 40 x 20 = 800 newest jobs/board
// Ceiling on the per-entry `getro_max_pages` override. Without it a typo'd or
// hostile portals.yml value (getro_max_pages: 10000) turns one board into
// 10k sequential API calls against a third party.
const HARD_MAX_PAGES = 200;      // 200 x 20 = 4000 newest jobs/board
const DEFAULT_MAX_AGE_DAYS = 90; // pagination bound only; the global filter does the real cut

export const meta = {
  value: 'getro',
  label: 'Getro',
  region: 'en',
};

/**
 * Getro returns `created_at` as Unix seconds, but older boards have been seen
 * emitting ISO strings, so both shapes are handled. Non-positive values return
 * null: the pagination cutoff treats null as "undated, keep", whereas a 0 would
 * read as 1970 and stop the walk on the first malformed row. Exported for tests.
 * @param {unknown} value
 * @returns {number|null} epoch milliseconds, or null when unusable
 */
export function toEpochMs(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    // Values below 1e12 are Unix seconds; at or above, already ms.
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) || ms <= 0 ? null : ms;
}

/**
 * Resolve a board's numeric collection id from the portal entry. The id is
 * interpolated straight into the API URL, so anything non-numeric is rejected
 * (an injection-ish value like "4283/../x" must never build a URL). Exported
 * for tests.
 * @param {{ getro_collection?: unknown }} [entry]
 * @returns {string|null}
 */
export function resolveCollection(entry) {
  const id = entry?.getro_collection;
  if (id == null) return null;
  const s = String(id).trim();
  if (!/^\d+$/.test(s)) return null;
  return s;
}

/**
 * Defence-in-depth host guard on the search URL. The collection id is validated
 * by resolveCollection before it reaches here; this pins the host + scheme so a
 * built URL can never point off api.getro.com. Throws on failure. Exported for
 * tests.
 * @param {string} url
 * @returns {string} the same URL if valid
 */
export function assertGetroUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`getro: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`getro: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`getro: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

// Stable, dependency-free 32-bit hash (djb2/xor) → base36. Only needs to be
// stable for a given url; dedup is done on the url itself, so the id is a
// convenience handle, not the identity key.
/** @param {string} s */
function hashUrl(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/**
 * Derive the workplace signal for a Getro job. Getro exposes remoteness as a
 * boolean `remote` flag, a `work_mode: 'remote'` field, or purely in the
 * location text ("Remote - US"), so all are honoured; on-site
 * is only asserted when there is a location to assert it about (an empty
 * location stays unknown, "missing = pass"). Exported for tests.
 * @param {any} job
 * @param {string} [location]
 * @returns {{ isRemote: boolean, workplaceType: string }}
 */
export function deriveWorkplace(job, location = '') {
  const flag = Boolean(
    job && (job.remote === true || job.remote === 'true'
      || job.workplace_type === 'remote' || job.workplaceType === 'remote'
      || job.work_mode === 'remote'),
  );
  const loc = String(location || '');
  const isRemote = flag || /\bremote\b/i.test(loc);
  const workplaceType = isRemote ? 'Remote' : (loc ? 'Onsite' : '');
  return { isRemote, workplaceType };
}

/**
 * Build the salary DISPLAY STRING from a Getro job's compensation fields.
 * web-ui's job shape carries salary as a string that the client
 * `Skills.parseSalaryRange` re-parses, so this follows the same remotli/lever
 * string convention. Only an ANNUAL figure is emitted: an hourly/monthly
 * `compensation_period` would read as a wildly-off yearly number in the filter,
 * so those return '' ("missing = pass"). Amounts are cents → whole units.
 * Exported for tests.
 * @param {any} job
 * @returns {string}
 */
export function getroSalary(job) {
  const period = typeof job?.compensation_period === 'string' ? job.compensation_period.trim().toLowerCase() : '';
  if (period && period !== 'year') return '';
  const minCents = Number(job?.compensation_amount_min_cents);
  const maxCents = Number(job?.compensation_amount_max_cents);
  const min = Number.isFinite(minCents) && minCents > 0 ? Math.round(minCents / 100) : null;
  const max = Number.isFinite(maxCents) && maxCents > 0 ? Math.round(maxCents / 100) : null;
  if (min == null && max == null) return '';
  const currency = typeof job?.compensation_currency === 'string' ? job.compensation_currency.trim().toUpperCase() : '';
  const cur = currency ? ` ${currency}` : '';
  if (min != null && max != null) return `${Math.min(min, max)}–${Math.max(min, max)}${cur}`;
  if (min != null) return `from ${min}${cur}`;
  return `up to ${max}${cur}`;
}

/**
 * All known locations joined (not just the first). Getro boards commonly list
 * several offices for one role; showing only `locations[0]`
 * dropped the rest. Falls back to `searchable_locations` when `locations` is
 * empty. Remoteness is carried separately by deriveWorkplace/workplaceType, so
 * the location string stays the real places only. Exported for tests.
 * @param {any} job
 * @returns {string}
 */
export function getroLocation(job) {
  const fromArray = (arr) => (Array.isArray(arr)
    ? arr.filter((l) => typeof l === 'string' && l.trim()).map((l) => l.trim())
    : []);
  const parts = fromArray(job?.locations);
  return (parts.length > 0 ? parts : fromArray(job?.searchable_locations)).join(', ');
}

/**
 * Normalize a single Getro job row into the web-ui rich job shape, or null when
 * it is not ingestible (no url — url is the dedup key). Exported for tests.
 *
 * Field mapping:
 *   - company:  the PORTFOLIO employer (`organization.name`), NOT the fund —
 *               falls back to `organization_name`, then the portal entry name.
 *   - location: ALL of `locations` (or `searchable_locations`), comma-joined.
 *   - salary:   annual `compensation_amount_min/max_cents` → display string.
 *   - date:     `created_at` (Unix seconds or ISO) → ISO string, else ''.
 *
 * @param {any} job
 * @param {string} [fallbackCompany] the portal entry name (opts.company.name)
 * @param {number|null} [createdMs] pre-computed epoch ms (avoids re-parsing)
 */
export function normalizeGetroJob(job, fallbackCompany = '', createdMs) {
  if (!job || typeof job !== 'object') return null;
  const url = typeof job.url === 'string' ? job.url.trim() : '';
  if (!url) return null;

  const title = typeof job.title === 'string' ? job.title.trim() : '';
  const ms = createdMs === undefined ? toEpochMs(job.created_at) : createdMs;

  const orgName = job.organization && typeof job.organization.name === 'string'
    ? job.organization.name.trim() : '';
  const orgNameFlat = typeof job.organization_name === 'string' ? job.organization_name.trim() : '';
  const company = orgName
    || orgNameFlat
    || (typeof fallbackCompany === 'string' ? fallbackCompany.trim() : '')
    || '';

  const location = getroLocation(job);

  const { isRemote, workplaceType } = deriveWorkplace(job, location);

  return {
    id: `getro-${hashUrl(url)}`,
    title,
    company,
    url,
    salary: getroSalary(job),
    location,
    isRemote,
    workplaceType,
    relocates: false,
    date: ms != null ? new Date(ms).toISOString() : '',
    snippet: '',
    source: 'getro',
  };
}

/**
 * Fetch + normalize a Getro collection's jobs, paginating newest-first.
 *
 * Config is read from `opts.company`: `getro_collection`
 * (required numeric id), `getro_max_pages` (default 40, hard cap 200),
 * `getro_max_age_days` (default 90, pagination bound; 0 disables the cutoff).
 *
 * Dead-board contract: the first (page 0) request failing THROWS — an
 * unreachable board is unreachable, not empty, so scan/portal-health record a
 * real failure. A later page failing after ≥1 successful page keeps the
 * partials already collected (a transient page-N blip must not discard them nor
 * quarantine a live board). An empty jobs array ends the walk normally.
 *
 * `endpoint` is accepted for the adapter contract; the fetch URL is
 * (re)built from the validated collection id so the host-pin is enforced at the
 * fetch boundary regardless of caller.
 *
 * @param {string} endpoint search endpoint from buildEndpoint (informational)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any }} [opts]
 */
export async function fetchGetro(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const id = resolveCollection(company);
  if (!id) {
    throw new Error(`getro: ${company?.name || 'entry'} needs a numeric 'getro_collection' to scan a Getro board`);
  }
  const apiUrl = assertGetroUrl(`${API_BASE}/${id}/search/jobs`);

  const rawMaxPages = company?.getro_max_pages;
  const maxPages = Number.isInteger(rawMaxPages) && rawMaxPages > 0
    ? Math.min(rawMaxPages, HARD_MAX_PAGES)
    : DEFAULT_MAX_PAGES;
  const rawMaxAge = company?.getro_max_age_days;
  const maxAgeDays = Number.isFinite(rawMaxAge) && rawMaxAge >= 0 ? rawMaxAge : DEFAULT_MAX_AGE_DAYS;
  const cutoffMs = maxAgeDays > 0 ? Date.now() - maxAgeDays * 86_400_000 : 0;

  const fallbackCompany = (company && typeof company.name === 'string') ? company.name : '';

  const out = [];
  const seen = new Set();
  let total = Infinity;
  let succeededOnce = false;

  for (let page = 0; page < maxPages && page * HITS_PER_PAGE < total; page += 1) {
    let json;
    try {
      json = await fetchJson(fetchImpl, apiUrl, {
        method: 'POST',
        // apiUrl is pinned to api.getro.com (https); redirect:'error' refuses a
        // 3xx to a private/metadata IP (matches every other source).
        redirect: 'error',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ hitsPerPage: HITS_PER_PAGE, page }),
        signal,
      });
    } catch (err) {
      // Dead-board contract: page 0 failing (nothing collected) propagates; a
      // later page failing after ≥1 success keeps the partials already gathered.
      if (!succeededOnce) throw err;
      break;
    }
    succeededOnce = true;

    const results = json?.results || {};
    const jobs = Array.isArray(results.jobs) ? results.jobs : [];
    if (typeof results.count === 'number') total = results.count;
    if (jobs.length === 0) break;

    let reachedOld = false;
    for (const j of jobs) {
      const url = typeof j?.url === 'string' ? j.url.trim() : '';
      if (!url) continue;
      // Jobs are newest-first; a dated posting older than the cutoff (and
      // everything after it) is stale. Keep undated jobs (missing = pass).
      const createdMs = toEpochMs(j.created_at);
      if (cutoffMs > 0 && createdMs != null && createdMs < cutoffMs) {
        reachedOld = true;
        continue;
      }
      if (seen.has(url)) continue;
      seen.add(url);
      const normalized = normalizeGetroJob(j, fallbackCompany, createdMs);
      if (normalized) out.push(normalized);
    }
    // Once we've crossed the age cutoff, all later pages are older still.
    if (reachedOld) break;
  }

  return out;
}
