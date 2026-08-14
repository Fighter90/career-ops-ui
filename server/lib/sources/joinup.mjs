// @ts-check
/**
 * joinup.ch source — Swiss startup job platform (Typesense-backed Next.js).
 *
 * Implements the web-ui source contract (rich job objects + `meta` for auto-discovery). Detected from a
 * `careers_url` whose host is joinup.ch.
 *
 * The browse page server-renders the newest page of results into __NEXT_DATA__
 * at props.pageProps.serverState.initialResults.jobs.results[0].hits[]. The full
 * board (~1000 jobs) lives behind a Typesense search key injected at runtime
 * (not in the static bundle), so we read the SSR'd newest page — results are
 * created-DESC, so this reliably catches the latest postings, which is what a
 * periodic scan needs. Older joinup roles are typically also tracked directly
 * via their company's ATS (Getro / Personio / Ashby / …).
 *
 * Each hit: { title|headline, startup (employer), slug, location, created }.
 * Public posting URL: https://joinup.ch/job/{slug}
 *
 * SINGLE-request board — no pagination. So the dead-board contract collapses to
 * its simplest form (parity with manfred): the sole request IS
 * "page 1", and because nothing has succeeded before it, a fetch failure OR a
 * missing/unparseable __NEXT_DATA__ THROWS rather than being swallowed into an
 * empty result. A scraper break is not an empty board — failing closed lets
 * scan/portal-health record a real failure instead of quietly dropping the
 * source with a silent zero.
 *
 * Host-pinned + `redirect:'error'` (SSRF-safe): the URL fetched is always the
 * constant BROWSE_URL, never a caller-supplied endpoint. Used by the joinup
 * adapter (server/lib/portals/adapters/joinup.mjs).
 */
import { fetchText } from '../http-json.mjs';

export const BROWSE_URL = 'https://joinup.ch/browse/jobs';

// Host detect()/matches() anchor. Matches joinup.ch and any subdomain, and
// rejects path-spoofed / look-alike hosts (evil.example/joinup.ch, notjoinup.ch).
export const JOINUP_HOST_RE = /(^|\.)joinup\.ch$/i;

export const meta = {
  value: 'joinup',
  label: 'JOINUP',
  region: 'en',
};

/**
 * Defence-in-depth host guard: HTTPS + a joinup.ch host. Throws on failure,
 * returns the same URL when valid. The fetch always targets BROWSE_URL, so this
 * is belt-and-suspenders. Exported for tests.
 * @param {string} url
 * @returns {string}
 */
export function assertJoinupUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`joinup: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`joinup: URL must use HTTPS: ${url}`);
  if (!JOINUP_HOST_RE.test(parsed.hostname)) {
    throw new Error(`joinup: untrusted hostname "${parsed.hostname}" — must be joinup.ch`);
  }
  return url;
}

/**
 * Coerce joinup's `created` into epoch ms. The SSR'd payload carries an ISO
 * string, with numeric epochs on a few older records; both shapes are handled.
 * Non-positive / unparseable values are treated as MISSING (null) rather than
 * dating the posting to 1970. Exported for tests.
 * @param {unknown} value
 * @returns {number|null}
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
 * Normalize one joinup hit into the web-ui rich job shape, or null when it is
 * not ingestible (no slug, or no title/headline). Exported for tests.
 *
 * joinup's SSR'd hit carries NO workplace/remote signal (unlike manfred's
 * `remotePercentage`), so isRemote/workplaceType/relocates take the same neutral
 * values manfred's derivation yields for a hit with no remote signal:
 * isRemote false, workplaceType '' (unknown — not "Onsite"), relocates false.
 *
 * @param {any} hit
 * @param {string} [fallbackCompany] used when the hit has no `startup`
 * @returns {object|null}
 */
export function normalizeJoinupHit(hit, fallbackCompany = '') {
  if (!hit || typeof hit !== 'object') return null;
  const slug = typeof hit.slug === 'string' ? hit.slug.trim() : '';
  const title = hit.title || hit.headline || '';
  if (!slug || !title) return null;

  const location = typeof hit.location === 'string'
    ? hit.location
    : (hit.location?.name || hit.location?.city || '');

  const ms = toEpochMs(hit.created);

  return {
    id: `joinup-${slug}`,
    title,
    company: hit.startup || fallbackCompany || '',
    url: `https://joinup.ch/job/${slug}`,
    salary: '',
    location,
    isRemote: false,
    workplaceType: '',
    relocates: false,
    date: ms != null ? new Date(ms).toISOString() : '',
    snippet: '',
    source: 'joinup',
  };
}

/**
 * Parse a joinup browse page's HTML into web-ui job objects. Extracts the
 * `<script id="__NEXT_DATA__">…</script>` payload, reads
 * props.pageProps.serverState.initialResults.jobs.results[0].hits[], keeps only
 * hits with a slug AND a title/headline, and dedupes by url. Exported for tests.
 *
 * FAILS CLOSED: a missing __NEXT_DATA__ tag OR an unparseable payload THROWS —
 * the script tag existing is not evidence the JSON is usable, and a silent zero
 * would look like an empty board and quietly drop the source from every scan.
 * A structurally valid payload with no hits is a genuinely empty board → [].
 *
 * @param {string} html raw browse-page HTML
 * @param {{ company?: object }} [opts]
 * @returns {object[]}
 */
export function parseJoinupHtml(html, opts = {}) {
  const { company } = opts;
  const m = typeof html === 'string'
    ? html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    : null;
  if (!m) {
    throw new Error('joinup: page is missing __NEXT_DATA__ (structure changed?)');
  }

  let hits = [];
  try {
    const data = JSON.parse(m[1]);
    const results = data?.props?.pageProps?.serverState?.initialResults?.jobs?.results;
    hits = Array.isArray(results) && results[0]?.hits ? results[0].hits : [];
  } catch (err) {
    throw new Error(`joinup: failed to parse __NEXT_DATA__ — ${/** @type {Error} */ (err).message}`);
  }

  const fallbackCompany = (company && typeof company.name === 'string' && company.name.trim())
    ? company.name.trim()
    : '';

  const out = [];
  const seen = new Set();
  for (const hit of hits) {
    const job = normalizeJoinupHit(hit, fallbackCompany);
    if (job && !seen.has(job.url)) {
      seen.add(job.url);
      out.push(job);
    }
  }
  return out;
}

/**
 * Fetch + normalize the joinup board. A SINGLE host-pinned request to the
 * constant BROWSE_URL (joinup.ch, HTTPS), `redirect:'error'`. A transport
 * failure (fetchText throws on non-2xx) or a missing/unparseable __NEXT_DATA__
 * propagates — the dead-board contract for a single-request board.
 *
 * @param {string} [endpoint] adapter-built endpoint (always BROWSE_URL); the
 *   fetch is host-pinned to BROWSE_URL regardless, so this is accepted for the
 *   registry contract but never used as the fetch target.
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchJoinup(endpoint = BROWSE_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company } = opts;
  // Host-pinned: fetch the constant BROWSE_URL, never a caller-supplied value.
  assertJoinupUrl(BROWSE_URL);
  const html = await fetchText(fetchImpl, BROWSE_URL, { signal, redirect: 'error' });
  return parseJoinupHtml(html, { company });
}
