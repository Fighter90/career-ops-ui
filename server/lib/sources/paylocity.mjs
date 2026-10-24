// @ts-check
/**
 * Paylocity source — single-company ATS adapter (→ tracked_companies:).
 * Auto-detects a hosted board from a careers_url like
 * `https://recruiting.paylocity.com/Recruiting/Jobs/All/<guid>`
 * (path matched case-insensitively; a trailing company slug or query string,
 * both of which Paylocity serves the same board under, are ignored), or an
 * explicit `provider: paylocity` on the entry:
 *
 *   tracked_companies:
 *     - name: Acme
 *       provider: paylocity
 *       careers_url: https://recruiting.paylocity.com/Recruiting/Jobs/All/0f0e9d8c-7b6a-5432-1098-76543210fedc
 *       enabled: true
 *       max_jobs: 2000        # optional, capped at 10000
 *
 * Paylocity has no usable public JSON list API for a board: its job feed
 * endpoint (/recruiting/v2/api/feed/jobs/<guid>) answers `jobs: []` for boards
 * whose page lists open postings. The public board page itself is
 * server-rendered with the whole list in one inline script —
 * `window.pageData = {...}` — and is not paginated: a board with 2,000+
 * postings arrives in a single ~1.6 MB response. One request per board.
 *
 * The blob is JSON, so titles arrive already decoded (a literal `&`, never
 * `&amp;`); they still go through the shared htmlToText decode-then-strip pass
 * as defence-in-depth (the bwi precedent — a hostile `&lt;script&gt;` in a
 * title must never survive as markup).
 *
 * Field choices (the parent's):
 * - location: `LocationName`, the employer's own label. `JobLocation.Country`
 *   is not used: it is often the tenant's default (`USA`) on postings whose
 *   LocationName is a German or UK site. City/State are a fallback for an
 *   empty LocationName. A posting with `ShouldDisplayLocation: false` gets
 *   no place. "Remote" or "Hybrid" is appended the way the board page labels
 *   the posting (REMOTE_TYPE_LABELS), also when the place is hidden.
 * - date: `PublishedDate` (ISO with offset) → ISO date.
 * - snippet: omitted — the list carries only a truncated ~110-char snippet.
 * - company: entry.name, or the board's own `ModuleTitle` when entry.name is
 *   empty.
 * - `IsInternal` postings are dropped: they are for the employer's staff.
 *
 * A board GUID that doesn't exist answers 302 → /Recruiting/Jobs/JobNotFound.
 * The board fetch uses `redirect:'manual'` (NEVER followed — undici hands the
 * 3xx back as a response, so the host cannot move) so that redirect can be
 * read from the thrown error's `.location` (the jobvite precedent) and mapped
 * to a synthetic 404 — the scan-quarantine convention (404/410 retires the
 * entry) matches the parent's dead-board mapping.
 *
 * Ported from the parent's providers/paylocity.mjs (parity v1.253.2).
 * Deviations from the parent, per the web-ui source contract:
 *   - the parent's ctx transport (ctx.fetchText / ctx.sleep) does not exist
 *     here; the source fetches through the injected fetchImpl with a local
 *     retry budget (bwi/magneto pattern), and web-ui's scanner has no
 *     ctx.maxPages probe path;
 *   - MAX_HTML_LENGTH caps the board page before the pageData regex runs
 *     (the observed maximum board is ~1.6 MB; the cap sits well above it);
 *   - a `max_jobs` cap (bounded, off by default-sized to cover every board
 *     seen) tags the result array `paylocityTruncated` — the web-ui
 *     partial-board convention (the parent caps nothing);
 *   - JSON-borne strings pass through htmlToText (the parent uses them raw,
 *     since they are already decoded — see above).
 */
import { htmlToText } from '../html-to-text.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';
import {
  fetchText,
  delay,
  computeRetryDelayMs,
  REDIRECT_REFUSAL_CAUSE_MESSAGE,
  BROWSER_LIKE_USER_AGENT,
} from '../http-json.mjs';

const UA = BROWSER_LIKE_USER_AGENT;

export const meta = {
  value: 'paylocity',
  label: 'Paylocity',
  region: 'en',
};

export const HOST = 'recruiting.paylocity.com';
export const ORIGIN = `https://${HOST}`;
export const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const BOARD_PATH_RE = /^\/recruiting\/jobs\/all\/([^/?#]+)/i;
export const NOT_FOUND_PATH_RE = /^\/recruiting\/jobs\/jobnotfound\/?$/i;

// Input ceiling before the pageData regex runs. The biggest observed board
// (2,000+ postings) took ~1.6 MB; the cap is a sanity bound far above it, so
// a hostile or broken endpoint cannot hand the lazy scanner unbounded input.
export const MAX_HTML_LENGTH = 8_000_000;

// Bounded-work cap on the single-response board. 5,000 covers every board
// observed (the largest was ~2,000); a board cut by it is PARTIAL, so the
// result array is tagged paylocityTruncated — never a quiet slice.
export const DEFAULT_MAX_JOBS = 5000;
export const MAX_JOBS_CAP = 10_000;

// Parent retry budget (1 attempt + 2 retries on a transient failure). The
// parent used 3 retries with a longer backoff because the shared host 429s
// under load; the local budget matches every other web-ui source and honours
// a Retry-After header through computeRetryDelayMs.
export const RETRIES = 2;
export const RETRY_DELAY_MS = 500;
export const RETRY_MAX_DELAY_MS = 8000;

// The board page labels a posting from `IndeedRemoteType`, and only when
// `IsRemote` is true: 0 "Temporarily WFH due to COVID-19", 1 "Hybrid Remote",
// 2 "Fully Remote", any other value no label. The label is shown whether or
// not the location itself is displayed.
export const REMOTE_TYPE_LABELS = { 0: 'Remote', 1: 'Hybrid', 2: 'Remote' };

/**
 * Canonical board URL for a board GUID, or null when the value is not a GUID.
 * @param {unknown} guid
 * @returns {string | null}
 */
export function boardUrl(guid) {
  const value = typeof guid === 'string' ? guid.trim() : '';
  return GUID_RE.test(value) ? `${ORIGIN}/Recruiting/Jobs/All/${value.toLowerCase()}` : null;
}

/**
 * Canonical board URL from an entry's `api` or `careers_url`, or null. Only
 * the GUID is taken from the input; the URL is rebuilt on the fixed host, so
 * a trailing company slug or query string is dropped rather than trusted.
 * @param {{api?: unknown, careers_url?: unknown}} [entry]
 * @returns {string | null}
 */
export function resolveBoardUrl(entry) {
  const rawApi = typeof entry?.api === 'string' ? entry.api : '';
  const rawCareers = typeof entry?.careers_url === 'string' ? entry.careers_url : '';
  const raw = (rawApi || rawCareers).trim();
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== HOST) return null;
  return boardUrl(parsed.pathname.match(BOARD_PATH_RE)?.[1]);
}

/**
 * Defence-in-depth endpoint check: HTTPS on exactly the Paylocity board host,
 * default port only. Runs on the endpoint the adapter resolved, before any
 * request — a tampered or misconfigured entry can never point the fetch
 * somewhere else.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertPaylocityUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`paylocity: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`paylocity: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`paylocity: a non-default port is not allowed: ${url}`);
  if (parsed.hostname !== HOST) {
    throw new Error(`paylocity: untrusted hostname "${parsed.hostname}" — must be ${HOST}`);
  }
  return url;
}

/**
 * Resolve the posting cap: a positive integer `max_jobs` on the entry, capped.
 * @param {{max_jobs?: unknown}} [entry]
 */
export function resolveMaxJobs(entry) {
  const v = entry?.max_jobs;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_JOBS_CAP);
  return DEFAULT_MAX_JOBS;
}

/** @param {unknown} value */
function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * The `window.pageData` object from a board page, or null when the page
 * carries no such script or its content is not valid JSON. The HTML length is
 * capped before the regex runs (see MAX_HTML_LENGTH).
 * @param {unknown} html
 */
export function extractPageData(html) {
  if (typeof html !== 'string') return null;
  if (html.length > MAX_HTML_LENGTH) {
    throw new Error(`paylocity: board page is ${html.length} chars — over the ${MAX_HTML_LENGTH}-char sanity cap`);
  }
  const match = html.match(/window\.pageData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/**
 * Parse a board page into jobs. Exported for unit tests.
 * Throws when the page has no `window.pageData` blob or the blob has no
 * `Jobs` array (a markup change — a quiet [] would hide every job forever);
 * returns [] for a board that genuinely has no openings.
 * @param {unknown} html
 * @param {string} companyName
 * @returns {Array<{title: string, url: string, company: string, location: string, date: string}>}
 */
export function parsePaylocityBoard(html, companyName) {
  const pageData = extractPageData(html);
  if (!pageData || typeof pageData !== 'object') {
    throw new Error('paylocity: window.pageData not found on the board page');
  }
  const rows = Array.isArray(pageData.Jobs) ? pageData.Jobs : null;
  if (!rows) {
    throw new Error(`paylocity: unexpected pageData — expected Jobs[], got: [${Object.keys(pageData).join(', ')}]`);
  }
  const company = htmlToText(companyName) || htmlToText(pageData.ModuleTitle);
  const jobs = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || row.IsInternal === true) continue;
    const title = htmlToText(row.JobTitle);
    if (!title) continue;
    const id = row.JobId == null ? '' : String(row.JobId).trim();
    if (!id) continue;
    const encodedId = safeEncodeURIComponent(id);
    if (encodedId === null) continue;

    const place = row.JobLocation && typeof row.JobLocation === 'object' ? row.JobLocation : {};
    // ShouldDisplayLocation:false is the employer hiding the location on its
    // own board, so neither LocationName nor the structured fields are shown.
    const hidden = row.ShouldDisplayLocation === false;
    const name = hidden ? '' : htmlToText(row.LocationName);
    const parts = hidden ? [] : name ? [name] : [htmlToText(place.City), htmlToText(place.State)].filter(Boolean);
    const remoteType = String(row.IndeedRemoteType);
    const workMode = row.IsRemote === true && Object.hasOwn(REMOTE_TYPE_LABELS, remoteType)
      ? REMOTE_TYPE_LABELS[remoteType]
      : undefined;
    if (workMode) parts.push(workMode);

    const postedAt = toEpochMs(row.PublishedDate);
    jobs.push({
      title,
      url: `${ORIGIN}/Recruiting/Jobs/Details/${encodedId}`,
      company,
      location: parts.join(', '),
      date: postedAt !== undefined ? new Date(postedAt).toISOString().slice(0, 10) : '',
    });
  }
  return jobs;
}

/**
 * True when a thrown redirect is the board saying "no such board": a 3xx on
 * the Paylocity host whose target is /Recruiting/Jobs/JobNotFound. Scoped
 * deliberately tight — a redirect OFF the host is a different story and keeps
 * failing loudly (the jobvite isEmptyBoardRedirect discipline).
 * @param {any} err - Error from a redirect:'manual' fetchText (carries .status + .location).
 * @param {string} requestUrl - The board URL that produced it.
 */
export function isJobNotFoundRedirect(err, requestUrl) {
  const status = err?.status;
  if (typeof status !== 'number' || status < 300 || status > 399) return false;
  if (!err.location) return false;
  let target;
  try {
    target = new URL(err.location, requestUrl);
  } catch {
    return false;
  }
  return target.hostname === HOST && NOT_FOUND_PATH_RE.test(target.pathname);
}

/**
 * `fetchText` with the parent's retry budget. Only transient failures are
 * retried: HTTP 429, HTTP 5xx, and network errors that carry no status. A
 * permanent 4xx, and a refused redirect (undici's `unexpected redirect`), are
 * rethrown at once. A 3xx surfaced by `redirect:'manual'` carries a numeric
 * status (302), so it is likewise never retried — same as the parent.
 * @param {Function} fetchImpl
 * @param {string} url
 * @param {{ signal?: AbortSignal, retries: number, retryDelayMs: number,
 *           headers: Record<string, string> }} o
 */
async function fetchTextWithRetry(fetchImpl, url, { signal, retries, retryDelayMs, headers }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchText(/** @type {any} */ (fetchImpl), url, { signal, headers, redirect: 'manual' });
    } catch (err) {
      lastErr = err;
      const status = err && typeof err.status === 'number' ? err.status : undefined;
      const redirectRefusal = status === undefined
        && err instanceof TypeError
        && err?.cause?.message === REDIRECT_REFUSAL_CAUSE_MESSAGE;
      const transient = !redirectRefusal && (status === undefined || status === 429 || status >= 500);
      if (!transient || attempt === retries || signal?.aborted) throw err;
      await delay(computeRetryDelayMs({
        attempt, baseDelayMs: retryDelayMs, maxDelayMs: RETRY_MAX_DELAY_MS, retryAfter: err?.retryAfter,
      }), signal);
    }
  }
  throw lastErr;
}

const PAGE_HEADERS = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' };

/**
 * Fetch + normalize the Paylocity board for one GUID (ONE request — the board
 * is a single server-rendered page, not paginated).
 *
 * The only page IS page 1, so the established page-1 invariants are the whole
 * story here: a fetch failure throws (there is no board to report on), a
 * shape throw (no `window.pageData` / no `Jobs[]`) throws, and an abort
 * before the request — or before the result is returned — throws loud rather
 * than reporting an empty board. There is no later page, so the
 * "later-page failures keep partials" rule has nothing to keep: nothing is
 * returned unless the one page parsed whole.
 *
 * @param {string} endpoint - the canonical board URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           retries?: number, retryDelayMs?: number }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchPaylocity(endpoint, opts = {}) {
  const {
    fetchImpl = fetch,
    signal,
    company,
    retries = RETRIES,
    retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  const entry = company ?? {};
  // Host allowlist before any request (SSRF guard): the adapter resolved this
  // endpoint from the entry's careers_url; re-validate it here.
  assertPaylocityUrl(endpoint);
  // A scan aborted before the request must fail loud, not report an empty board.
  signal?.throwIfAborted();

  let html;
  try {
    // redirect:'manual' — the 3xx is surfaced, never followed, so the
    // dead-board redirect (302 → JobNotFound) can be told from real failures.
    html = await fetchTextWithRetry(fetchImpl, endpoint, { signal, retries, retryDelayMs, headers: PAGE_HEADERS });
  } catch (err) {
    if (isJobNotFoundRedirect(err, endpoint)) {
      const deadErr = new Error(`paylocity: ${endpoint} redirected to JobNotFound — no such board`);
      // 404 = the scan-quarantine convention: a permanent no-such-board
      // retires the entry instead of costing every later scan a request.
      deadErr.status = 404;
      throw deadErr;
    }
    throw err;
  }

  // Parse BEFORE the abort check: parsePaylocityBoard is pure, and the abort
  // below decides whether the parsed board may be delivered at all.
  const boardJobs = parsePaylocityBoard(html, String(entry?.name ?? ''));
  // The only page is page 1: an abort that landed between the fetch and the
  // return must not present a (possibly stale) board as a complete result.
  signal?.throwIfAborted();

  const maxJobs = resolveMaxJobs(entry);
  const jobs = [];
  for (const row of boardJobs) {
    if (jobs.length >= maxJobs) break;
    jobs.push(normalize(row, entry));
  }
  if (boardJobs.length > jobs.length) {
    console.error(`⚠️  paylocity: ${entry.name} truncated at max_jobs=${maxJobs} (${boardJobs.length} jobs on the board) — raise max_jobs on this entry for more`);
    /** @type {any} */ (jobs).paylocityTruncated = true;
  }
  return jobs;
}

function normalize(row, entry) {
  return {
    id: `paylocity-${row.url}`,
    title: row.title,
    company: row.company || String(entry?.name ?? ''),
    url: row.url,
    salary: '',
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: '',
    relocates: false,
    date: row.date || '',
    snippet: '',
    source: 'paylocity',
  };
}
