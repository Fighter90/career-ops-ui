/**
 * Arbeitnow source — board-wide aggregator feed (EU/DACH-heavy, international).
 *   GET https://www.arbeitnow.com/api/job-board-api  → { data: [...], links, meta }
 *
 * Implements the web-ui source
 * contract (rich job objects + `meta` for auto-discovery).
 *
 * The full board is fetched (single page of the public feed) so the en-scanner's
 * title_filter can gate on configured titles. The host is pinned to
 * www.arbeitnow.com and the fetch uses `redirect:'error'` (SSRF-safe).
 *
 * Used by the arbeitnow adapter (server/lib/portals/adapters/arbeitnow.mjs).
 *
 * Response shape:
 *   { data: [ { slug, company_name, title, description, remote, url, tags,
 *               job_types, location, created_at } ], links, meta }
 */
import { fetchJson, labeledHttpError } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';

const UA = 'career-ops-web-ui/1.0';
const TRUSTED_HOST = 'www.arbeitnow.com';

export const FEED_URL = 'https://www.arbeitnow.com/api/job-board-api';

export const meta = {
  value: 'arbeitnow',
  label: 'Arbeitnow',
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertArbeitnowUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`arbeitnow: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`arbeitnow: URL must use HTTPS: ${url}`);
  }
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`arbeitnow: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/** Convert epoch seconds to 'YYYY-MM-DD' string; returns '' when absent/invalid. */
function epochSecondsToDate(created_at) {
  if (!Number.isFinite(created_at)) return '';
  const d = new Date(created_at * 1000);
  return d.toISOString().slice(0, 10);
}

// The parent's coerceId (providers/_ids.mjs): accept a string or a number,
// trim it, treat empty as absent. ABSENT BEATS WRONG — an id that cannot be
// coerced returns undefined rather than a placeholder.
/**
 * @param {unknown} raw
 * @returns {string|undefined}
 */
function coerceId(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const s = String(raw).trim();
  return s === '' ? undefined : s;
}

/**
 * Normalize a single Arbeitnow job item into the web-ui rich 12-field shape.
 * Returns null if the item lacks a title or a valid https arbeitnow.com URL.
 * The feed's own posting id (`slug`) always lands in the row id when the feed
 * carries a usable one (the parent's externalId contract); the row id falls
 * back to the url otherwise.
 *
 * @param {any} j
 * @returns {object|null}
 */
function normalize(j) {
  if (!j || typeof j !== 'object') return null;

  const title = typeof j.title === 'string' ? j.title.trim() : '';
  if (!title) return null;

  // url must be an absolute https posting link on www.arbeitnow.com.
  let url = '';
  const rawUrl = typeof j.url === 'string' ? j.url.trim() : '';
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'https:' && parsed.hostname === TRUSTED_HOST) {
        url = parsed.href;
      }
    } catch {
      // malformed URL → dropped below
    }
  }
  if (!url) return null;

  const company =
    typeof j.company_name === 'string' && j.company_name.trim()
      ? j.company_name.trim()
      : 'Arbeitnow';

  // Build location: use j.location, append "Remote" when j.remote is true.
  const baseLocation = typeof j.location === 'string' ? j.location.trim() : '';
  const location = [baseLocation, j.remote === true ? 'Remote' : '']
    .filter(Boolean)
    .join(', ');

  // Derive workplace type from the remote flag.
  const isRemote = j.remote === true;
  const workplaceType = isRemote ? 'Remote' : 'Onsite';

  // Stable id: prefer slug field (coerced — the feed's own posting id), fall
  // back to the url (stable posting URL).
  const externalId = coerceId(j.slug);
  const id = `arbeitnow-${externalId || url}`;

  // `description` arrives as HTML in the same list payload (no per-job
  // request), so it is free. The en-scanner's content_filter
  // (`j.description ?? j.snippet`) and the years_min reader match on it;
  // empty/garbage → '' (the "no signal" path both handle). (parent #6439)
  return {
    id,
    title,
    company,
    url,
    salary: '',
    location,
    isRemote,
    workplaceType,
    relocates: false,
    date: epochSecondsToDate(j.created_at),
    snippet: '',
    description: htmlToText(j.description),
    source: 'arbeitnow',
  };
}

/**
 * Fetch + normalize the Arbeitnow public feed.
 *
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchArbeitnow(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertArbeitnowUrl(feedUrl);
  const json = await fetchJson(fetchImpl, feedUrl, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  }).catch((e) => { throw labeledHttpError(e, 'Arbeitnow'); });
  if (!json || !Array.isArray(json.data)) {
    throw new Error(
      `Arbeitnow: unexpected API response — expected { data: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
    );
  }
  return json.data
    .map((j) => normalize(j))
    .filter(Boolean);
}
