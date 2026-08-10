// @ts-check
/**
 * Consider source — VC "talent network" portfolio boards on getconsider.com
 * (Founderful, Creandum, Balderton, Lightspeed, Notion Capital, …).
 *
 * Ported from parent career-ops `providers/consider.mjs` into the web-ui source
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
 * `consider_board`. `consider_size` (default 500) caps how many newest/featured
 * jobs are pulled in the single request.
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
import { fetchJson } from '../http-json.mjs';

export const ENDPOINT_PATH = '/api-boards/search-jobs';
export const DEFAULT_SIZE = 500;

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
 * cloud-metadata, ::1, localhost, *.internal). Ported EXACTLY from the parent
 * provider's `resolveOrigin`. Exported for tests.
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
  let host = parsed.hostname.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1); // strip FQDN trailing dot
  if (host.startsWith('[') || host.includes(':')) return null;        // IPv6 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;              // IPv4 literal (incl. metadata/private)
  if (host === 'localhost' || host === 'localhost.localdomain') return null;
  if (host.endsWith('.local') || host.endsWith('.internal')) return null;
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
    url = new URL(rawUrl, origin).toString();
  } catch {
    return null;
  }

  const remoteFlag = job.remote;
  const isRemote = remoteFlag === true;
  const workplaceType = remoteFlag === true ? 'Remote' : remoteFlag === false ? 'Onsite' : '';

  const ms = toEpochMs(job.timeStamp);

  return {
    id: `consider-${hashUrl(url)}`,
    title: typeof job.title === 'string' ? job.title : (job.title || ''),
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
 * Fetch + normalize a Consider board in a SINGLE host-pinned POST. The origin
 * is (re)derived from the portal entry's careers_url via the structural
 * `resolveOrigin` guard — the security boundary — so even a wrongly-built
 * endpoint can't aim the request off a public host. A fetch failure THROWS
 * (dead-board contract: one request, nothing succeeded before it), so
 * portal-health records a real failure rather than "live but empty".
 *
 * @param {string} _endpoint tile endpoint from buildEndpoint (signature parity;
 *   the actual POST url is derived from the guarded origin below).
 * @param {{ fetchImpl?: typeof fetch, signal?: AbortSignal, company?: any }} [opts]
 */
export async function fetchConsider(_endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company } = opts;

  const origin = resolveOrigin(company || {});
  if (!origin) throw new Error('consider: needs an https careers_url on a public host');

  const board = company && company.consider_board;
  if (!board) throw new Error("consider: needs a 'consider_board' id in portals.yml");

  const rawSize = company && company.consider_size;
  const size = Number.isInteger(rawSize) && rawSize > 0 ? rawSize : DEFAULT_SIZE;

  const json = await fetchJson(fetchImpl, origin + ENDPOINT_PATH, {
    signal,
    method: 'POST',
    // redirect:'error' so a 3xx from the (config-driven) board host can't be
    // followed to a private/metadata IP — the host guard above pins the first hop.
    redirect: 'error',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      referer: origin + '/jobs',
    },
    body: JSON.stringify({
      meta: { size },
      board: { id: String(board), isParent: true },
      query: { promoteFeatured: true },
    }),
  });

  const jobs = Array.isArray(json && json.jobs) ? json.jobs : [];
  const out = [];
  const seen = new Set();
  for (const j of jobs) {
    const normalized = normalizeConsiderJob(j, { origin, company });
    if (normalized && !seen.has(normalized.url)) {
      seen.add(normalized.url);
      out.push(normalized);
    }
  }
  return out;
}
