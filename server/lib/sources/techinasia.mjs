// @ts-check
/**
 * Tech in Asia source — queries the public Algolia search index the
 * techinasia.com jobs UI itself calls (`job_postings`). Board-wide source
 * wired with `provider: techinasia` in portals.yml (a job board aggregator,
 * not a company ATS — auto-detection is deliberately not supported):
 *
 *   tracked_companies:
 *     - name: Tech in Asia
 *       provider: techinasia
 *       enabled: true
 *       max_pages: 5             # optional, capped at 50
 *       techinasia:
 *         appId: "<algolia app id>"    # optional stopgap override when the
 *         apiKey: "<client search key>" # site's markup changes shape
 *
 * The Algolia app id + client search key are public but ROTATE WITH THE SITE'S
 * BUILD, so they are discovered fresh on every run instead of hardcoded:
 *   1. GET /jobs/search            → the current `app.<hash>.js` asset name
 *   2. GET that asset              → `apiKey:"…", appId:"…"` from its config
 *   3. POST the Algolia job_postings index with those credentials
 * The key is referer-gated, so every Algolia request sends a techinasia.com
 * Referer. Credentials ride as QUERY PARAMETERS (the app id also names the
 * host) — omitting them is a silent-looking HTTP 403.
 *
 * The board's own default view filters to Indonesia; this source deliberately
 * does NOT send that filter — it traverses the whole index and leaves targeting
 * to the scanner's title_filter/location_filter. `is_boosted` /
 * `starts_featuring_at` are never read as a filter or a signal, so paid
 * placement cannot buy position here.
 *
 * Canonical URL: the employer's own application link (`external_link`) when
 * the row exposes one, with the Tech in Asia posting page as the fallback.
 * Two kinds of external link are rejected in favour of the posting page:
 *   - a URL shortener (destination not verifiable, can change after indexing);
 *   - a link SHARED BY MORE THAN ONE posting — `url` is the scanner's dedup
 *     key, so preferring a shared intake form would collapse several real
 *     postings into one row and quietly cut the board's inventory. Every hit
 *     is collected before any is normalized so links can be counted across
 *     the whole board first.
 *
 * Salary is deliberately not attached: the index's `salary_min`/`salary_max`/
 * `salary_avg` are flags, not money (they read `1` on live rows), while the
 * normalized row's `salary` is annualized compensation.
 *
 * `published_at` is a naive "YYYY-MM-DD HH:mm:ss" with no zone; it is read as
 * UTC so the posting day does not shift with the scanning machine's timezone.
 *
 * Ported from the parent's providers/techinasia.mjs (parity v1.253.0).
 * Deviations from the parent, per the web-ui source contract:
 *   - the parent's ctx transport (ctx.fetch* / ctx.sleep / ctx.maxPages
 *     health-probe path) does not exist here; the source fetches through the
 *     injected fetchImpl with a local retry budget, and web-ui's scanner has
 *     no probe path (the entry's own max_pages is the only cap);
 *   - a stop at the max_pages cap while Algolia still reported more pages
 *     tags the result array `techinasiaTruncated` — the web-ui partial-board
 *     convention (the parent only warns);
 *   - rows normalize into the web-ui 12-field shape: `published_at` becomes
 *     `date`, the flattened description becomes a capped `snippet`, and the
 *     hit's id/objectID becomes the row id;
 *   - the discovery HTML/JS are length-capped before the credential regexes
 *     run (a changed, bloated build page fails loud at the not-found throws
 *     instead of paying an unbounded regex).
 */
import { htmlToText } from '../html-to-text.mjs';
import {
  fetchJsonWithRetry,
  fetchText,
  delay,
  computeRetryDelayMs,
  REDIRECT_REFUSAL_CAUSE_MESSAGE,
  BROWSER_LIKE_USER_AGENT,
} from '../http-json.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';

const UA = BROWSER_LIKE_USER_AGENT;

export const meta = {
  value: 'techinasia',
  label: 'Tech in Asia',
  region: 'en',
};

export const SITE_HOST = 'www.techinasia.com';
export const SITE_ORIGIN = `https://${SITE_HOST}`;
export const SEARCH_PAGE_URL = `${SITE_ORIGIN}/jobs/search`;
export const ASSET_HOST = 'static.techinasia.com';
export const INDEX = 'job_postings';
// Algolia's per-request ceiling. The whole board (~300 rows live) arrives in
// one request at this size, so pagination only matters if it grows past 1000.
export const HITS_PER_PAGE = 1000;
export const DEFAULT_MAX_PAGES = 5;
export const MAX_PAGES_CAP = 50;
// Applied to pages past the first only. Today the whole board fits in one
// request; this exists for the day it has grown past HITS_PER_PAGE.
export const INTER_PAGE_DELAY_MS = 200;

// Parent retry budget (1 attempt + 2 retries on a transient failure).
export const RETRIES = 2;
export const RETRY_DELAY_MS = 500;
export const RETRY_MAX_DELAY_MS = 8000;

/**
 * Cap on the discovery HTML/JS length before the credential regexes run. A
 * regex over unbounded remote text is unbounded work; a build page bigger
 * than this (never observed — both are well under 1 MB) fails loud at the
 * not-found throws below instead.
 */
export const MAX_DISCOVERY_BYTES = 4 * 1024 * 1024;

// Opaque redirectors: a link through one of these cannot be verified to reach
// the employer, so the source's own posting page is preferred over it.
const URL_SHORTENER_HOSTS = new Set([
  'bit.ly',
  'cutt.ly',
  'goo.gl',
  'is.gd',
  'lnkd.in',
  'rb.gy',
  'rebrand.ly',
  's.id',
  'shorturl.at',
  't.co',
  'tinyurl.com',
]);

/**
 * Pin a URL to an expected https host, default port only. Every URL this
 * source fetches (search page, hashed asset, Algolia endpoint) passes through
 * here before any request is built.
 * @param {string} url
 * @param {string} host
 * @param {string} label
 * @returns {string} the validated url
 */
export function assertTechinasiaHost(url, host, label) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`techinasia: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`techinasia: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`techinasia: a non-default port is not allowed: ${url}`);
  if (parsed.hostname !== host) {
    throw new Error(`techinasia: untrusted ${label} hostname "${parsed.hostname}" — must be ${host}`);
  }
  return url;
}

/**
 * Find the current hashed app bundle path in the served /jobs/search HTML.
 * The asset name rotates per deploy, which is why the credentials are read
 * from the live build instead of being pinned here.
 * @param {string} html
 * @returns {string} absolute https asset URL
 */
export function findAppAssetPath(html) {
  if (typeof html !== 'string') throw new Error('techinasia: app asset lookup got no HTML');
  const m = html.slice(0, MAX_DISCOVERY_BYTES).match(/\/\/static\.techinasia\.com(\/assets\/v5\/app\.[0-9a-f]{8}\.js)/);
  if (!m) throw new Error('techinasia: could not find the app bundle in /jobs/search HTML');
  return assertTechinasiaHost(`https://${ASSET_HOST}${m[1]}`, ASSET_HOST, 'asset');
}

/**
 * Pull the Algolia app id + client search key out of the app bundle's config.
 * @param {string} js
 * @returns {{ appId: string, apiKey: string }}
 */
export function parseAlgoliaCredentials(js) {
  if (typeof js !== 'string') throw new Error('techinasia: credential lookup got no bundle');
  const m = js.slice(0, MAX_DISCOVERY_BYTES).match(/apiKey:\s*"([A-Za-z0-9]{16,64})"\s*,\s*appId:\s*"([A-Za-z0-9]{6,16})"/);
  if (!m) throw new Error('techinasia: Algolia credentials not found in the app bundle');
  const [, apiKey, appId] = m;
  return { appId, apiKey };
}

/**
 * The Algolia search endpoint for an app id. The credentials ride as QUERY
 * PARAMETERS, not headers — the app id also names the host.
 * @param {string} appId
 * @param {string} apiKey
 */
export function algoliaEndpoint(appId, apiKey) {
  if (!/^[A-Za-z0-9]{6,16}$/.test(appId)) {
    throw new Error(`techinasia: unexpected Algolia app id ${JSON.stringify(appId)}`);
  }
  const host = `${appId.toLowerCase()}-dsn.algolia.net`;
  const url = new URL(`https://${host}/1/indexes/*/queries`);
  url.searchParams.set('x-algolia-agent', 'Algolia for vanilla JavaScript 3.30.0;JS Helper 2.26.1');
  url.searchParams.set('x-algolia-application-id', appId);
  url.searchParams.set('x-algolia-api-key', apiKey);
  return assertTechinasiaHost(url.href, host, 'Algolia');
}

/**
 * Parse the index's naive "YYYY-MM-DD HH:mm:ss" timestamp as UTC.
 * @param {unknown} value
 * @returns {number|undefined} epoch ms
 */
export function parsePublishedAt(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const raw = value.trim();
  // Zone-less stamps get an explicit Z so the day is the same on every
  // machine; anything already carrying a zone is parsed as-is.
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : ms;
}

/**
 * The row's verifiable external application link, or '' when it has none
 * worth using. Rejects non-https and shortener hosts.
 * @param {any} hit
 * @returns {string}
 */
export function externalLinkOf(hit) {
  const external = typeof hit?.external_link === 'string' ? hit.external_link.trim() : '';
  if (!external) return '';
  try {
    const parsed = new URL(external);
    if (parsed.protocol !== 'https:') return '';
    if (URL_SHORTENER_HOSTS.has(parsed.hostname.toLowerCase())) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

/**
 * The employer's own application link when the row exposes a verifiable one,
 * otherwise the Tech in Asia posting page.
 *
 * @param {any} hit
 * @param {Set<string>} [sharedLinks] — external links used by more than one
 *   posting. A link in this set is not that posting's own path, so the
 *   posting page is preferred instead (one intake form, several roles).
 * @returns {string}
 */
export function resolveTechInAsiaUrl(hit, sharedLinks) {
  const external = externalLinkOf(hit);
  if (external && !(sharedLinks && sharedLinks.has(external))) return external;

  const rawId = typeof hit?.id === 'string'
    ? hit.id.trim()
    : typeof hit?.objectID === 'string' ? hit.objectID.trim() : '';
  // The id is host-controlled and becomes a path segment, so it is
  // percent-encoded: `x/../../about` would otherwise point at a different
  // techinasia.com path, and the URL is also the scanner's dedup key. The
  // helper returns null for a lone surrogate, which drops the posting instead
  // of aborting the page. `externalLinkOf` needs no encoding — it returns an
  // already-parsed, normalised URL.
  const id = rawId ? safeEncodeURIComponent(rawId) : '';
  return id ? `${SITE_ORIGIN}/jobs/${id}` : '';
}

/**
 * Normalize one Algolia hit into the intermediate parsed shape (the web-ui
 * `normalize()` folds it into the 12-field row). Exported for tests.
 *
 * Field mapping:
 *   - title:    `title`
 *   - url:      `external_link` when it is a verifiable https link no other
 *               posting uses, else https://www.techinasia.com/jobs/{id}
 *   - company:  `company` (a JSON string in the index, an object tolerated)
 *               → `name`, falling back to the portal entry's name
 *   - location: `city.name` + `city.country_name`, with "Remote" appended
 *               when `is_remote` is truthy
 *   - postedAt: `published_at` (naive stamp, read as UTC)
 *   - description: `description`, flattened from HTML for content_filter
 *
 * @param {any} hit
 * @param {string} [fallbackCompany]
 * @param {Set<string>} [sharedLinks]
 * @returns {{ title: string, url: string, company: string, location: string, description?: string, postedAt?: number, externalId: string } | null}
 */
export function normalizeTechInAsiaJob(hit, fallbackCompany, sharedLinks) {
  if (!hit || typeof hit !== 'object') return null;

  const title = typeof hit.title === 'string' ? hit.title.trim() : '';
  if (!title) return null;

  const url = resolveTechInAsiaUrl(hit, sharedLinks);
  if (!url) return null; // no id and no external link → nothing to dedup or link

  const externalId = typeof hit.objectID === 'string'
    ? hit.objectID.trim()
    : typeof hit.id === 'string' ? hit.id.trim() : '';

  // `company` travels as a JSON-encoded string in the index; tolerate a real
  // object too so a payload change is a non-event.
  let companyName = '';
  const raw = hit.company;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.name === 'string') companyName = parsed.name.trim();
    } catch {
      // not JSON → leave empty, fall back below
    }
  } else if (raw && typeof raw === 'object' && typeof raw.name === 'string') {
    companyName = raw.name.trim();
  }
  const company = companyName || (typeof fallbackCompany === 'string' ? fallbackCompany : '');

  const parts = [];
  const city = hit.city;
  if (city && typeof city === 'object') {
    for (const key of ['name', 'country_name']) {
      const v = typeof city[key] === 'string' ? city[key].trim() : '';
      if (v && !parts.includes(v)) parts.push(v);
    }
  }
  if (hit.is_remote) parts.push('Remote');

  /** @type {{ title: string, url: string, company: string, location: string, description?: string, postedAt?: number, externalId: string }} */
  const out = { title, url, company, location: parts.join(', '), externalId };

  // Decode-then-strip via the shared helper — never a local strip-then-decode:
  // stripping tags before decoding lets "&lt;script&gt;" come back out as a
  // live "<script>" (the CodeQL order bug — see html-to-text.mjs).
  const description = htmlToText(hit.description);
  if (description) out.description = description;

  const postedAt = parsePublishedAt(hit.published_at);
  if (postedAt != null) out.postedAt = postedAt;

  return out;
}

/** Resolve an optional Algolia credential override from the entry. */
function resolveCredentialOverride(entry, key) {
  const cfg = entry?.techinasia && typeof entry.techinasia === 'object' ? entry.techinasia : {};
  const v = cfg[key];
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

/**
 * Resolve the page cap: a positive integer `max_pages` on the entry (the
 * camelCase `maxPages` is accepted so a config typo is not silently ignored),
 * capped.
 * @param {{max_pages?: unknown, maxPages?: unknown}} entry
 */
export function resolveMaxPages(entry) {
  const raw = Number.isInteger(entry?.max_pages) && entry.max_pages > 0
    ? entry.max_pages
    : Number.isInteger(entry?.maxPages) && entry.maxPages > 0
      ? entry.maxPages
      : DEFAULT_MAX_PAGES;
  return Math.min(raw, MAX_PAGES_CAP);
}

/**
 * Parse one Algolia query-response page. Exported for unit tests.
 *
 * Page 0 is strict: a 200 whose body is `null` or does not carry the
 * documented `results` key is a shape change on a board of ~300 postings, not
 * an empty board — it throws naming what arrived. Later pages stay lenient
 * about a contentless answer (`null` / `{}` → natural end, rowsLength 0), but
 * a body carrying unexpected keys or a non-array `results[0].hits` still
 * throws. `results: []` is the documented envelope answering nothing — a
 * legitimate empty board on any page.
 *
 * @param {any} json
 * @param {{ page?: number }} [opts]
 * @returns {{ hits: any[], nbPages: number, rowsLength: number }}
 */
export function parseTechInAsiaPage(json, { page = 0 } = {}) {
  if (page > 0 && (json == null || (typeof json === 'object' && Object.keys(json).length === 0))) {
    return { hits: [], nbPages: 1, rowsLength: 0 };
  }
  if (json === null || json === undefined || typeof json !== 'object' || Array.isArray(json)
    || !Object.hasOwn(json, 'results')) {
    const got = json === null || json === undefined
      ? String(json)
      : Array.isArray(json)
        ? `an array of ${json.length}`
        : typeof json === 'object'
          ? `keys: [${Object.keys(json).join(', ')}]`
          : typeof json;
    throw new Error(
      `techinasia: unexpected Algolia response on page ${page} — expected results[], got: ${got}`,
    );
  }
  const result = Array.isArray(json.results) ? json.results[0] : null;
  if (!result) return { hits: [], nbPages: 1, rowsLength: 0 }; // the index answered with nothing
  if (!Array.isArray(result.hits)) {
    throw new Error(
      `techinasia: unexpected Algolia response on page ${page} — expected results[0].hits, got keys: [${Object.keys(result).join(', ')}]`,
    );
  }
  const nbPages = Number.isFinite(result.nbPages) ? result.nbPages : 1;
  return { hits: result.hits, nbPages, rowsLength: result.hits.length };
}

/**
 * `fetchText` with the parent's retry budget. Only transient failures are
 * retried: HTTP 429, HTTP 5xx, and network errors that carry no status. A
 * permanent 4xx, and a refused redirect (undici's `unexpected redirect`), are
 * rethrown at once.
 * @param {Function} fetchImpl
 * @param {string} url
 * @param {{ signal?: AbortSignal, retries: number, retryDelayMs: number,
 *           headers: Record<string, string> }} o
 */
async function fetchTextWithRetry(fetchImpl, url, { signal, retries, retryDelayMs, headers }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchText(/** @type {any} */ (fetchImpl), url, { signal, headers, redirect: 'error' });
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

const SNIPPET_CAP = 500;

function normalize(row, entry) {
  return {
    id: `techinasia-${row.externalId || row.url}`,
    title: row.title,
    company: row.company || String(entry?.name ?? ''),
    url: row.url,
    // The index's salary fields are flags, not money (see the header) — never
    // attached, so the scanner's salary filter never sees a fake number.
    salary: '',
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: row.location.includes('Remote') ? 'Remote' : '',
    relocates: false,
    date: row.postedAt != null ? new Date(row.postedAt).toISOString() : '',
    snippet: row.description ? String(row.description).slice(0, SNIPPET_CAP) : '',
    source: 'techinasia',
  };
}

/**
 * Fetch + normalize the Tech in Asia job_postings index (Algolia).
 * Mirrors the parent's fetch(): credentials are discovered fresh per run (an
 * entry `techinasia:` override short-circuits discovery), every hit is
 * collected before normalizing so shared external links can be counted, and a
 * stop at the max_pages cap while Algolia still reported more pages tags the
 * result array `techinasiaTruncated`.
 *
 * @param {string} endpoint - the /jobs/search URL pinning the host (asserted
 *   here; the actual requests are built internally from it).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           delayMs?: number, retries?: number, retryDelayMs?: number,
 *           profileKeywords?: string[] }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchTechInAsia(endpoint, opts = {}) {
  const {
    fetchImpl = fetch,
    signal,
    company = {},
    delayMs = INTER_PAGE_DELAY_MS,
    retries = RETRIES,
    retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  // A scan aborted before the first request must fail loud, never report an
  // empty board. Every return path is behind this line.
  signal?.throwIfAborted();
  // Host pin before any request (SSRF guard): the adapter resolved this
  // endpoint (the entry's api or the default); re-validate it here.
  assertTechinasiaHost(endpoint, SITE_HOST, 'search page');
  const entry = company ?? {};

  // 1. Resolve the Algolia credentials (override first, discovery otherwise).
  let appId = resolveCredentialOverride(entry, 'appId');
  let apiKey = resolveCredentialOverride(entry, 'apiKey');
  if (!appId || !apiKey) {
    // Both discovery requests are retried: they run before pagination starts,
    // so a single blip on either would otherwise fail the whole board before
    // a single page was fetched.
    const html = await fetchTextWithRetry(fetchImpl, SEARCH_PAGE_URL, {
      signal, retries, retryDelayMs, headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    const assetUrl = findAppAssetPath(html);
    const js = await fetchTextWithRetry(fetchImpl, assetUrl, {
      signal, retries, retryDelayMs, headers: { 'User-Agent': UA },
    });
    const discovered = parseAlgoliaCredentials(js);
    appId = appId || discovered.appId;
    apiKey = apiKey || discovered.apiKey;
  }
  if (!/^[A-Za-z0-9]{16,64}$/.test(apiKey)) {
    throw new Error('techinasia: unexpected Algolia client key shape');
  }
  const searchEndpoint = algoliaEndpoint(appId, apiKey);

  const maxPages = resolveMaxPages(entry);
  const fallbackCompany = typeof entry.name === 'string' ? entry.name : '';

  const out = [];
  const seen = new Set();
  // Every hit is collected before any is normalized: deciding whether a link
  // belongs to one posting or to a batch of them needs the whole board in hand.
  const hits = [];
  // Set only when the entry/DEFAULT cap stopped the walk while Algolia still
  // reported more pages. Never set by a fetch error, so the advice to raise
  // `max_pages` cannot misfire.
  let truncated = false;

  for (let page = 0; page < maxPages; page++) {
    if (page > 0 && delayMs > 0) await delay(delayMs, signal);
    // A scan aborted before page 0 must fail loud, not report an empty board;
    // past page 0 a break keeps the partials.
    if (page === 0) signal?.throwIfAborted();
    else if (signal?.aborted) break;

    const body = JSON.stringify({
      requests: [{ indexName: INDEX, params: `query=&hitsPerPage=${HITS_PER_PAGE}&page=${page}` }],
    });
    let parsed;
    try {
      const json = await fetchJsonWithRetry(fetchImpl, searchEndpoint, {
        signal,
        method: 'POST',
        // The site sends this content-type with a JSON body; matching it keeps
        // the request byte-equivalent to the one the board's own UI makes.
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
          referer: `${SITE_ORIGIN}/`,
        },
        body,
        redirect: 'error',
        retries,
      });
      // Parse INSIDE the try: a later-page shape throw keeps the pages
      // already collected (partials, the later-page invariant); on page 0 the
      // throw propagates — the first page failing means there is no board.
      parsed = parseTechInAsiaPage(json, { page });
    } catch (err) {
      if (page === 0) throw err;
      console.error(`⚠️  techinasia: ${entry.name || '(unnamed)'} truncated at page ${page} of ${maxPages} (${hits.length} hits): ${err.message}`);
      break;
    }

    hits.push(...parsed.hits);

    if (parsed.rowsLength === 0 || page + 1 >= parsed.nbPages) break;
    // Full page at the last permitted page with more pages still reported.
    if (page === maxPages - 1) truncated = true;
  }

  if (truncated) {
    console.error(`⚠️  techinasia: ${entry.name || '(unnamed)'} truncated at max_pages=${maxPages} with more pages on the board — raise max_pages to walk further`);
  }

  // Links appearing on more than one posting are not a single posting's path.
  const linkCounts = new Map();
  for (const hit of hits) {
    const link = externalLinkOf(hit);
    if (link) linkCounts.set(link, (linkCounts.get(link) || 0) + 1);
  }
  const sharedLinks = new Set([...linkCounts].filter(([, n]) => n > 1).map(([link]) => link));

  for (const hit of hits) {
    const row = normalizeTechInAsiaJob(hit, fallbackCompany, sharedLinks);
    if (!row || seen.has(row.url)) continue;
    seen.add(row.url);
    out.push(normalize(row, entry));
  }

  if (truncated) out.techinasiaTruncated = true;
  return out;
}
