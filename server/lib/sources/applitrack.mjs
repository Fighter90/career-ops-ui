// @ts-check
/**
 * Frontline AppliTrack source — K-12 school districts hosted at
 * `https://www.applitrack.com/<slug>/onlineapp/`. One entry under
 * `tracked_companies:` is one district.
 *
 *   GET https://www.applitrack.com/{slug}/onlineapp/jobpostings/Output.asp?all=1
 *   → a JS script that document.write()s the whole vacancy list as HTML
 *
 * Ported from parent career-ops `providers/applitrack.mjs` and rewritten to the
 * web-ui source contract (12-field job objects + `meta` for auto-discovery).
 *
 * Why Output.asp: the public board is a shell page that loads this script.
 * Fetching the script directly returns every posting in ONE plain request, so
 * there is no pagination and no browser. MAX_JOBS caps the emitted rows
 * instead of a page cap. Dead-board contract: a failure on that one request
 * propagates, so the scanner logs it per company (fail-soft across companies)
 * and can quarantine a permanent 404/410.
 *
 * SSRF: the host is a fixed literal (`www.applitrack.com`), matched exactly,
 * never by substring. The district slug is the only variable part and is
 * charset-checked (`[a-z0-9_-]`, max 64), so it cannot inject a path. Every
 * request uses `redirect:'error'`, and `fetchText` adds the DNS-rebinding
 * guard on the real network path. The endpoint is re-validated before any I/O.
 *
 * Optional entry field `default_location` (e.g. "Kalama, WA"): AppliTrack's
 * per-posting Location is a site name ("District", "Woodland High School")
 * that often names no place, and location_filter needs one to match. When the
 * site name lacks the default's city, the default is appended.
 *
 *   tracked_companies:
 *     - name: Example School District
 *       careers_url: https://www.applitrack.com/exampledistrict/onlineapp/
 *       default_location: Exampleville, WA   # optional
 *       enabled: true
 *
 * Encoding: the script is served as Windows-1252 but `fetchText` decodes
 * UTF-8, so a non-ASCII byte (an en dash in a title) arrives as U+FFFD. Parent
 * quirk, kept on purpose: it is stripped rather than shown as a replacement
 * character.
 *
 * Used by the applitrack adapter (server/lib/portals/adapters/applitrack.mjs).
 */
import {
  fetchText,
  delay,
  computeRetryDelayMs,
  REDIRECT_REFUSAL_CAUSE_MESSAGE,
  BROWSER_LIKE_USER_AGENT,
} from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

export const meta = {
  value: 'applitrack',
  label: 'AppliTrack',
  region: 'en',
};

/** Hosts accepted on a configured careers_url. Requests always go to www. */
export const APPLITRACK_HOSTS = new Set(['www.applitrack.com', 'applitrack.com']);
const FETCH_HOST = 'www.applitrack.com';
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const OUTPUT_PATH_RE = /^\/([a-z0-9][a-z0-9_-]{0,63})\/onlineapp\/jobpostings\/Output\.asp$/;

/** Cap total postings emitted per district (single-response feed). */
export const MAX_JOBS = 1000;
// Matches the parent's fetchTextWithRetry budget: 1 attempt + 2 retries on a
// transient failure (429, 5xx, or a network error without a status).
const RETRIES = 2;
const RETRY_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 4000;

const HEADERS = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  accept: 'application/javascript, text/javascript;q=0.9, */*;q=0.8',
};

/**
 * District slug from an applitrack.com careers URL, or null. HTTPS only, the
 * host must be exactly `www.applitrack.com` or `applitrack.com` (so a
 * path-spoofed `https://evil.example/www.applitrack.com/…` or a lookalike
 * `www.applitrack.com.evil.example` is refused), and the first path segment
 * must pass the slug charset check. The slug is lower-cased.
 *
 * Exported for tests and for the adapter.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function resolveApplitrackSlug(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !APPLITRACK_HOSTS.has(parsed.hostname)) return null;
  const slug = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
  return SLUG_RE.test(slug) ? slug.toLowerCase() : null;
}

/**
 * The district's `onlineapp` base URL (detail links hang off it).
 * @param {string} slug
 */
export function buildBaseUrl(slug) {
  return `https://${FETCH_HOST}/${slug}/onlineapp`;
}

/**
 * The Output.asp script URL for a validated slug.
 * @param {string} slug
 */
export function buildOutputUrl(slug) {
  return `${buildBaseUrl(slug)}/jobpostings/Output.asp?all=1`;
}

/**
 * Throwing guard for the fetch slot: the endpoint must be exactly the
 * Output.asp URL buildOutputUrl produces. Returns the slug.
 * @param {string} url
 * @returns {string}
 */
export function assertApplitrackUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`applitrack: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`applitrack: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== FETCH_HOST || parsed.username || parsed.password || parsed.port) {
    throw new Error(`applitrack: untrusted hostname "${parsed.hostname}" — must be ${FETCH_HOST}`);
  }
  const m = parsed.pathname.match(OUTPUT_PATH_RE);
  if (!m || parsed.search !== '?all=1' || parsed.hash) {
    throw new Error(`applitrack: unexpected endpoint path: ${url}`);
  }
  return m[1];
}

/**
 * Markup → plain text: tags stripped, entities decoded, U+FFFD dropped,
 * whitespace collapsed.
 * @param {string} s
 */
function text(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, ' '))
    .replace(/�/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * "9/21/2026" → epoch ms (UTC midnight), or undefined for anything that is not
 * a real calendar date. Date.UTC rolls an impossible date over (13/45 → a real
 * day in 2027) instead of returning NaN, so the calendar date must survive the
 * round trip.
 *
 * Exported for tests.
 * @param {unknown} value
 * @returns {number|undefined}
 */
export function parseApplitrackDate(value) {
  const m = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const [year, month, day] = [Number(m[3]), Number(m[1]), Number(m[2])];
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return undefined;
  return ms;
}

/**
 * Parse an AppliTrack `Output.asp` body into web-ui job objects.
 *
 * The HTML sits inside JS string literals, so quotes arrive backslash-escaped.
 * Every posting starts with `<table class='title'>` holding its title and
 * `JobID: <n>`; its fields follow as `<span class="label">Name:</span> …
 * <span class="normal">Value</span>`.
 *
 * - Empty/blank body → [] (nothing to parse).
 * - A body with no `function applyFor` — the script prelude every real
 *   response carries — is not this endpoint, so it throws rather than reading
 *   as an empty board forever.
 * - A block with no JobID or no title is skipped; a repeated JobID keeps the
 *   first.
 *
 * Exported for tests.
 * @param {unknown} body
 * @param {string} companyName
 * @param {string} base e.g. "https://www.applitrack.com/acme/onlineapp"
 * @param {string} [defaultLocation]
 */
export function parseApplitrackOutput(body, companyName, base, defaultLocation = '') {
  if (typeof body !== 'string' || !body.trim()) return [];
  if (!body.includes('function applyFor')) {
    throw new Error('applitrack: response is not an AppliTrack Output.asp script (no applyFor prelude)');
  }
  const html = body.replace(/\\'/g, "'").replace(/\\"/g, '"');
  const fallback = typeof defaultLocation === 'string' ? defaultLocation.trim() : '';
  const cityName = fallback.split(',')[0].trim().toLowerCase();
  const slug = new URL(base).pathname.split('/').filter(Boolean)[0] || '';

  const jobs = [];
  const seen = new Set();
  for (const block of html.split(/<table class='title'/i).slice(1)) {
    const id = (block.match(/JobID:\s*(\d+)/i) || [])[1];
    const title = text((block.match(/<td id='wrapword'[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);

    /** @param {string} name */
    const field = (name) => {
      const re = new RegExp(`${name}:\\s*</span>[\\s\\S]*?<span class=['"]normal['"][^>]*>([\\s\\S]*?)</span>`, 'i');
      return text((block.match(re) || [])[1] || '');
    };
    const site = field('Location');
    const location = site && (!cityName || site.toLowerCase().includes(cityName))
      ? site
      : [site, fallback].filter(Boolean).join(' - ');
    const postedAt = parseApplitrackDate(field('Date Posted'));
    const isRemote = /\bremote\b/i.test(location);

    jobs.push({
      id: `applitrack-${slug}-${id}`,
      title,
      company: companyName,
      // `id` is digits only (matched above), so nothing here needs encoding.
      url: `${base}/default.aspx?AppliTrackJobId=${id}&AppliTrackLayoutMode=detail&AppliTrackViewPosting=1`,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: postedAt === undefined ? '' : new Date(postedAt).toISOString().slice(0, 10),
      snippet: field('Position Type'),
      source: 'applitrack',
    });
    if (jobs.length >= MAX_JOBS) break;
  }
  return jobs;
}

/**
 * `fetchText` with the parent's retry budget. Only transient failures are
 * retried: HTTP 429, HTTP 5xx, and network errors that carry no status. A
 * permanent 4xx, and a refused redirect (undici's `unexpected redirect`), are
 * rethrown at once.
 * @param {Function} fetchImpl
 * @param {string} url
 * @param {{ signal?: AbortSignal, sleep: (ms: number, signal?: AbortSignal) => Promise<void>,
 *           retryDelayMs: number }} o
 */
async function fetchTextWithRetry(fetchImpl, url, { signal, sleep, retryDelayMs }) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      return await fetchText(/** @type {any} */ (fetchImpl), url, { signal, headers: HEADERS, redirect: 'error' });
    } catch (err) {
      lastErr = err;
      const status = err && typeof err.status === 'number' ? err.status : undefined;
      const redirectRefusal = status === undefined
        && err instanceof TypeError
        && err?.cause?.message === REDIRECT_REFUSAL_CAUSE_MESSAGE;
      const transient = !redirectRefusal && (status === undefined || status === 429 || status >= 500);
      if (!transient || attempt === RETRIES || signal?.aborted) throw err;
      await sleep(computeRetryDelayMs({
        attempt, baseDelayMs: retryDelayMs, maxDelayMs: RETRY_MAX_DELAY_MS, retryAfter: err?.retryAfter,
      }), signal);
    }
  }
  throw lastErr;
}

/**
 * Fetch and normalize one AppliTrack district.
 *
 * The endpoint is re-validated before any I/O (host literal, slug charset,
 * exact Output.asp path). The single request failing is a real error and
 * propagates.
 *
 * @param {string} endpoint Output.asp URL from the adapter's buildEndpoint
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any,
 *           sleep?: (ms: number, signal?: AbortSignal) => Promise<void>, retryDelayMs?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchApplitrack(endpoint, opts = {}) {
  const {
    fetchImpl = fetch,
    signal,
    company = {},
    sleep = delay,
    retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  const slug = assertApplitrackUrl(endpoint);
  const name = company && typeof company.name === 'string' ? company.name.trim() : '';
  const defaultLocation = company && typeof company.default_location === 'string' ? company.default_location : '';

  const body = await fetchTextWithRetry(fetchImpl, buildOutputUrl(slug), { signal, sleep, retryDelayMs });
  return parseApplitrackOutput(body, name, buildBaseUrl(slug), defaultLocation);
}
