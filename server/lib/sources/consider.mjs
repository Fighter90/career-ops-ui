// @ts-check
/**
 * Consider source — VC "talent network" portfolio boards on getconsider.com
 * (Founderful, Creandum, Balderton, Lightspeed, Notion Capital, …).
 *
 * Implements the web-ui source
 * contract (rich job objects + `meta` for auto-discovery). The board is a JS
 * app, but its data comes from a same-origin JSON endpoint we hit directly:
 *
 *   POST {board_origin}/api-boards/search-jobs
 *   body: {"meta":{"size":N},"board":{"id":"<board_id>","isParent":true},
 *          "query":{"promoteFeatured":true}}
 *   -> { jobs: [ {title,url,applyUrl,companyName,locations[],timeStamp,remote} ], total }
 *
 * `url` is the clean destination ATS link (dedups with the ashby/greenhouse
 * sources); `companyName` is the portfolio company. The board id is NOT the host
 * (Founderful's is "wingman"), so it is set explicitly in portals.yml via
 * `consider_board`. `consider_size` (default 500, maximum 1000) is how many
 * jobs one request pulls; the walk follows `meta.sequence` to read the whole
 * board up to `max_pages` (default 10, hard cap 100).
 *
 *   tracked_companies:
 *     - name: Founderful (portfolio)
 *       provider: consider
 *       consider_board: wingman
 *       careers_url: https://jobs.founderful.com/jobs
 *       enabled: true
 *
 * SSRF: the POST target host is config-driven (built from the portals.yml
 * careers_url), so it is pinned to a public HTTPS origin via `resolveOrigin`
 * before fetching — the STRUCTURAL guard here (the board host varies, so the
 * allowlist is "any public registrable https origin", not a literal host).
 * `redirect:'error'` closes the 3xx-to-metadata vector. Dead-board contract:
 * the board is one POST request, so a fetch failure THROWS (nothing succeeded
 * before it) rather than being swallowed into [], letting portal-health record
 * a real failure instead of mistaking a dead board for an empty one.
 *
 * Used by the consider adapter (server/lib/portals/adapters/consider.mjs).
 */
import { createHash } from 'node:crypto';
import { fetchJsonWithRetry, fetchResponse, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { requireArray, requireContainer } from './_shape.mjs';

// Budget for the anonymous GET that seeds the session cookie and csrfToken.
// Shorter than the POST budget so a slow board page can't eat the full timeout.
const HANDSHAKE_TIMEOUT_MS = 8_000;

/**
 * Consider requires an anonymous `GET /jobs` handshake before it accepts the
 * search POST (#2764): the board landing page sets a session cookie and embeds
 * a `"csrfToken":"…"` inside a <script> JSON payload. Returns `{ cookie,
 * csrfToken }` (either null if absent). On ANY failure both are null so the
 * caller still attempts the POST — a 412 is a cleaner signal than a silent skip,
 * and it preserves the pre-fix behaviour for boards that don't enforce CSRF.
 * Uses the injected `fetchImpl` so tests never hit the network.
 * @param {string} origin
 * @param {typeof fetch} fetchImpl
 * @param {AbortSignal} [signal]
 */
async function acquireCsrfHandshake(origin, fetchImpl, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HANDSHAKE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    // The guarded transport (FULL-R2): `fetchResponse` runs the same
    // DNS-rebinding guard the JSON/text helpers run — on the REAL network
    // path the origin's hostname is resolved and refused if it points at a
    // private/loopback address (a no-op for an injected test transport) — and
    // it throws on a non-2xx, which the catch below degrades to the cookieless
    // shape, exactly as the old `!res.ok` check did. `redirect:'error'` blocks
    // every redirect, so a 3xx to a private/metadata IP cannot slip past the
    // resolveOrigin() host pin.
    const res = await fetchResponse(fetchImpl, `${origin}/jobs`, {
      headers: { 'user-agent': BROWSER_LIKE_USER_AGENT, accept: 'text/html,*/*' },
      redirect: 'error',
      signal: controller.signal,
    });
    const html = await res.text();
    // getSetCookie() keeps each Set-Cookie as its own string (Node ≥18.14).
    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get?.('set-cookie') ?? '').split(/,(?=\s*\w+=)/).filter(Boolean);
    const cookie = setCookies.map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ') || null;
    // 8-char lower bound rules out placeholder/error tokens.
    const m = html.match(/"csrfToken"\s*:\s*"([^"]{8,})"/);
    const csrfToken = m ? m[1] : null;
    return { cookie, csrfToken };
  } catch {
    return { cookie: null, csrfToken: null };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener?.('abort', onAbort);
  }
}

export const ENDPOINT_PATH = '/api-boards/search-jobs';
export const DEFAULT_SIZE = 500;
// The API answers HTTP 500 to a larger size, so an entry's value is clamped to it.
export const MAX_SIZE = 1000;
// `consider_size` (default 500, maximum 1000) is how many jobs one request
// pulls. A full page carries `meta.sequence`, a cursor sent back in the next
// request's `meta`, so the walk reads the whole board up to max_pages
// (default 10, hard cap 100). The API orders jobs by its own score, so the
// newest jobs come first only roughly, and the walk has no age cutoff.
export const DEFAULT_MAX_PAGES = 10;
export const MAX_PAGES_CAP = 100;
const INTER_PAGE_DELAY_MS = 250;

export const meta = {
  value: 'consider',
  label: 'Consider',
  region: 'en',
};

/**
 * Consider's `timeStamp` arrives as epoch ms on some boards and an ISO string
 * on others, so both shapes are handled. Non-positive values are treated as
 * MISSING rather than as 1970 — a 0/negative stamp is a board bug, and dating
 * the posting to the epoch would make it permanently stale to the age filter.
 * Exported for tests.
 * @param {unknown} value
 * @returns {number|null} epoch ms, or null when absent/unusable
 */
export function toEpochMs(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    // Values below 1e12 are Unix seconds; at or above, already ms.
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) || ms <= 0 ? null : ms;
}

/**
 * STRUCTURAL SSRF guard. The POST target host comes from the portals.yml
 * careers_url, so pin it to a public HTTPS origin before fetching. Reject
 * non-HTTPS, IPv4/IPv6 literals, localhost, *.local, *.internal, and
 * single-label (non-public) hosts so a malicious or misconfigured careers_url
 * can't aim the POST at an internal target (127.0.0.1, 169.254.169.254
 * cloud-metadata, ::1, localhost, *.internal). Exported for tests.
 * @param {{ careers_url?: string }} entry
 * @returns {string|null} the public https origin, or null when unsafe
 */
export function resolveOrigin(entry) {
  let parsed;
  try {
    parsed = new URL((entry && entry.careers_url) || '');
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.port !== '') return null; // an explicit port is never a public board origin
  let host = parsed.hostname.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1); // strip FQDN trailing dot
  if (host.startsWith('[') || host.includes(':')) return null;        // IPv6 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;              // IPv4 literal (incl. metadata/private)
  if (host === 'localhost' || host === 'localhost.localdomain') return null;
  if (host.endsWith('.localhost') || host.endsWith('.local')) return null;
  if (host.endsWith('.internal')) return null;
  if (!host.includes('.')) return null;                              // single-label / non-public
  return parsed.origin;
}

/**
 * Human-readable location string for a Consider job: the `locations[]` array
 * joined, else `normalizedLocations` labels, else 'Remote' when the job is
 * flagged remote, else ''. Exported for tests.
 * @param {any} job
 * @returns {string}
 */
export function locationString(job) {
  if (Array.isArray(job?.locations) && job.locations.length) {
    return job.locations.filter((l) => typeof l === 'string' && l.trim()).map((l) => l.trim()).join(', ');
  }
  if (Array.isArray(job?.normalizedLocations) && job.normalizedLocations.length) {
    return job.normalizedLocations.map((l) => l?.label || l?.value).filter(Boolean).join(', ');
  }
  return job?.remote ? 'Remote' : '';
}

/**
 * Stable short id for a job url (the dedup key). Exported for tests.
 * @param {string} url
 */
export function hashUrl(url) {
  return createHash('sha1').update(String(url)).digest('hex').slice(0, 16);
}

/**
 * Normalize a single Consider job row into the web-ui rich job shape, or null
 * when it is not ingestible (no destination url). Exported for tests.
 *
 * Field mapping:
 *   - url:      `url` || `applyUrl`, absolutized against the board origin;
 *               a row with neither is dropped (url is the dedup key).
 *   - id:       `consider-<hash of url>`.
 *   - title:    `title`.
 *   - company:  `companyName`, falling back to the portal entry name.
 *   - location: see locationString.
 *   - remote:   isRemote/workplaceType/relocates derived from the `remote`
 *               boolean, mirroring manfred.mjs (known→Remote/Onsite, else '').
 *   - date:     toEpochMs(timeStamp) → ISO string, else ''.
 *
 * @param {any} job
 * @param {{ origin?: string, company?: any }} [ctx]
 */
export function normalizeConsiderJob(job, { origin, company } = {}) {
  if (!job || typeof job !== 'object') return null;
  const rawUrl = job.url || job.applyUrl || '';
  if (!rawUrl) return null;
  let url;
  try {
    const parsed = new URL(rawUrl, origin);
    // The url is the dedup key and a display link only — never fetched — but a
    // javascript:/data:/http: scheme has no business in the pipeline, so the
    // row is dropped rather than carried through.
    if (parsed.protocol !== 'https:') return null;
    url = parsed.toString();
  } catch {
    return null;
  }

  // A blank title reads as an untitled row in the scan table; drop it.
  const title = typeof job.title === 'string' ? job.title.trim() : '';
  if (!title) return null;

  const remoteFlag = job.remote;
  const isRemote = remoteFlag === true;
  const workplaceType = remoteFlag === true ? 'Remote' : remoteFlag === false ? 'Onsite' : '';

  const ms = toEpochMs(job.timeStamp);

  return {
    id: `consider-${hashUrl(url)}`,
    title,
    company: job.companyName || (company && company.name) || '',
    url,
    salary: '',
    location: locationString(job),
    isRemote,
    workplaceType,
    relocates: false,
    date: ms != null ? new Date(ms).toISOString() : '',
    snippet: '',
    source: 'consider',
  };
}

/**
 * Fetch + normalize a Consider board, walking the whole board through
 * `meta.sequence`. The origin is (re)derived from the portal entry's
 * careers_url via the structural `resolveOrigin` guard — the security
 * boundary — so even a wrongly-built endpoint can't aim the request off a
 * public host.
 *
 * Page 0 failing THROWS (dead-board contract: nothing succeeded before it, so
 * portal-health records a real failure rather than "live but empty"); a later
 * page failing after its retries keeps the partials and warns. All requests
 * retry on a transient failure through the shared helper.
 *
 * @param {string} _endpoint tile endpoint from buildEndpoint (signature parity;
 *   the actual POST url is derived from the guarded origin below).
 * @param {{ fetchImpl?: typeof fetch, signal?: AbortSignal, company?: any,
 *           sleep?: Function }} [opts]
 */
export async function fetchConsider(_endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company, sleep = delay } = opts;

  const origin = resolveOrigin(company || {});
  if (!origin) throw new Error('consider: needs an https careers_url on a public host');

  const board = company && company.consider_board;
  if (!board) throw new Error("consider: needs a 'consider_board' id in portals.yml");

  const rawSize = company && company.consider_size;
  const size = Number.isInteger(rawSize) && rawSize > 0 ? Math.min(rawSize, MAX_SIZE) : DEFAULT_SIZE;

  const rawMaxPages = (company || {}).max_pages;
  const maxPages = Number.isInteger(rawMaxPages) && rawMaxPages > 0
    ? Math.min(rawMaxPages, MAX_PAGES_CAP)
    : DEFAULT_MAX_PAGES;
  const name = (company && company.name) || origin;

  // Consider rejects the POST without a session cookie + csrfToken from the
  // anonymous GET /jobs handshake (#2764). Degrades to null/null on failure.
  const { cookie, csrfToken } = await acquireCsrfHandshake(origin, fetchImpl, signal);
  const csrfHeaders = {};
  if (cookie) csrfHeaders.cookie = cookie;
  if (csrfToken) csrfHeaders['x-csrf-token'] = csrfToken;

  const rows = [];
  const seen = new Set();
  let total = null;
  let sequence = null;
  // Declared outside the loop so the cap check below can tell a walk that used
  // every page it was allowed from one that ended on its own: every `break`
  // leaves `page` below `maxPages`.
  let page = 0;
  for (; page < maxPages; page++) {
    if (page > 0) await sleep(INTER_PAGE_DELAY_MS, signal);

    let json;
    let jobs;
    try {
      json = await fetchJsonWithRetry(fetchImpl, origin + ENDPOINT_PATH, {
        method: 'POST',
        // redirect:'error' so a 3xx from the (config-driven) board host can't be
        // followed to a private/metadata IP — the host guard above pins the first hop.
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          referer: origin + '/jobs',
          ...csrfHeaders,
        },
        body: JSON.stringify({
          meta: sequence ? { size, sequence } : { size },
          board: { id: String(board), isParent: true },
          query: { promoteFeatured: true },
        }),
        signal,
        sleep,
      });
      // Page-1 shape guard (v1.242.0): a 200 without a jobs array is a changed
      // API or a challenge page and must throw, not read as an empty board.
      // Later pages keep the partials (same idiom as the catch below).
      jobs = page === 0
        ? requireArray(requireContainer(json, 'Consider board', 'jobs').jobs, 'Consider jobs')
        : (Array.isArray(json?.jobs) ? json.jobs : []);
      if (Number.isInteger(json?.total)) total = json.total;
    } catch (err) {
      // Page 0 failing means the board is unreachable — nothing succeeded
      // before it, so the failure propagates and portal-health records a real
      // failure. A later page keeps what was read.
      if (page === 0) throw err;
      const attempts = err?.attempts;
      const attemptsText = attempts === undefined
        ? 'an unknown number of attempts'
        : `${attempts} attempt${attempts === 1 ? '' : 's'}`;
      const cause = err instanceof Error ? err.message : String(err);
      console.error(`⚠️  consider: ${name} truncated at page ${page + 1} of ${maxPages} after ${attemptsText} (${rows.length} jobs): ${cause}`);
      break;
    }

    for (const job of jobs) {
      const normalized = normalizeConsiderJob(job, { origin, company });
      if (normalized && !seen.has(normalized.url)) {
        seen.add(normalized.url);
        rows.push(normalized);
      }
    }
    if (page === 0 && jobs.length > 0 && rows.length === 0) {
      // Raw rows arrived but none produced a usable https url — envelope drift,
      // not an empty board.
      throw new Error(`consider: ${jobs.length} job(s) returned but none parsed (title/https-url missing)`);
    }

    // The board ended: a short page, no cursor, or a cursor that does not move.
    // Leaves `page` below the ceiling, so the cap check after the loop stays
    // silent.
    const next = json?.meta?.sequence;
    if (jobs.length < size || !next || next === sequence) break;
    sequence = next;
  }

  // The page cap ended the walk while the board still had a cursor left, so
  // the list is partial. At the hard ceiling a higher max_pages is clamped
  // back to it, so raising the entry's value would read nothing more.
  if (page >= maxPages) {
    const of = total !== null ? ` of ${total}` : '';
    const advice = maxPages >= MAX_PAGES_CAP
      ? `the ${MAX_PAGES_CAP}-page hard cap, so raising max_pages reads no more`
      : 'raise max_pages on this entry for more';
    console.error(`⚠️  consider: ${name} truncated at max_pages=${maxPages} (${rows.length}${of} jobs) — ${advice}`);
  }
  return rows;
}
