// @ts-check
/**
 * Remotli source — remotli.ch, a curated board of remote roles at Swiss
 * companies (paid in CHF). Public JSON API, no auth:
 *
 *   https://remotli.ch/api/jobs?page=N&limit=50&remote=all
 *   → { jobs: [ { jobs: {...}, companies: {...} }, ... ],
 *       pagination: { page, limit, total, totalPages } }
 *
 * Ported from parent career-ops `providers/remotli.mjs` into the web-ui source
 * contract (rich job objects + `meta` for auto-discovery).
 *
 * Two shape notes measured on the live feed (parent parity):
 *
 *   1. Doubly-nested rows. Each element of the top-level `jobs` array is a JOIN
 *      row `{ jobs, companies }`, and the posting itself lives under `.jobs`.
 *      The real employer is carried in the row (`job.company` / `companies.name`)
 *      — NOT collapsed to "Remotli" — so tracker rows land under the employer
 *      and a cross-listing dedups against the employer's own ATS.
 *   2. `remote=all` is REQUIRED for full coverage — without it the API serves its
 *      remote-first default view (~43% of the board). Filtering is the scanner's
 *      job, so we take everything and let it decide.
 *
 * Liveness is built in: rows carry `status`, and we emit only `active` (fails
 * closed — a missing/blank/non-string status is rejected, so a dropped field
 * never publishes closed roles as dead links).
 *
 * URL policy (Source Indexing Policy rule 2 — the shortest verifiable path to
 * the employer). The emitted `url` prefers the posting's own `applyUrl` (the
 * employer's ATS page) and is DISPLAY-ONLY: it is accepted from ANY https origin
 * and is NEVER fetched here, so it is intentionally NOT host-pinned. The host
 * lock lives on the API URLs this source actually requests (assertRemotliUrl +
 * `redirect:'error'`), pinned to remotli.ch. A missing / non-https / malformed
 * applyUrl falls back to the board page `https://remotli.ch/jobs/<slug>`.
 *
 * Host-pinned + `redirect:'error'` (SSRF-safe). Used by the remotli adapter
 * (server/lib/portals/adapters/remotli.mjs).
 */
import { fetchJson } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

const ORIGIN = 'https://remotli.ch';
const API_PATH = '/api/jobs';
// `remote=all` disables the board's work-mode filter so we walk its COMPLETE
// inventory (Source Indexing Policy rule 3); filtering is the scanner's job.
const ALL_WORK_MODES = 'remote=all';
// The server caps `limit` at 50 regardless of what is requested, so ask for the
// cap and page through.
const PAGE_SIZE = 50;
const DEFAULT_MAX_PAGES = 20;
const SNIPPET_MAX = 500;
const HOST_RE = /^(www\.)?remotli\.ch$/i;

/** Canonical first-page base endpoint (adapter default). */
export const FEED_BASE = `${ORIGIN}${API_PATH}`;

export const meta = {
  value: 'remotli',
  label: 'Remotli',
  region: 'en',
};

/**
 * Defence-in-depth host guard on any URL this source fetches: HTTPS + remotli.ch
 * only. Throws on failure. The endpoint the adapter builds and every paged URL
 * derived from it pass through here. Exported for tests.
 * @param {string} url
 * @returns {string} the same URL if valid
 */
export function assertRemotliUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`remotli: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`remotli: URL must use HTTPS: ${url}`);
  if (!HOST_RE.test(parsed.hostname)) {
    throw new Error(`remotli: untrusted hostname "${parsed.hostname}" — must be remotli.ch`);
  }
  return url;
}

/**
 * NaN-safe Date.parse — `|| undefined` would also coerce a valid epoch 0.
 * Returns epoch ms, or undefined when the value is absent/unparseable. Exported
 * for tests.
 * @param {unknown} value
 * @returns {number|undefined}
 */
export function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(/** @type {string} */ (value));
  return Number.isNaN(parsed) ? undefined : parsed;
}

// Minimal HTML entity decoder (inlined, mirroring server/lib/sources/
// agenticjobs.mjs — web-ui has no shared decoder). Named entities + numeric
// (&#252; / &#xfc;), with a codepoint-range guard so a malformed/adversarial
// entity (e.g. "&#99999999;") can't throw a RangeError from String.fromCodePoint

/** @param {string} s */

/**
 * Description → plain text for content filters and the snippet. Strip once, then
 * decode once — the house order, and the correct one for this API (it decodes on
 * the way out and always answers with real HTML). A second strip after the
 * decode is deliberately NOT added — it re-introduced two HIGH CodeQL alerts
 * (js/double-escaping, js/bad-tag-filter) on the parent before the API stopped
 * mixing entity-encoded and raw-HTML descriptions row by row. Exported for tests.
 * @param {unknown} html
 * @returns {string}
 */
export function htmlToText(html) {
  if (typeof html !== 'string' || !html) return '';
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Canonical URL for a posting. Prefers `applyUrl` (the employer's ATS page),
 * accepted from any https origin — it is display-only and never fetched here, so
 * the host lock stays on the API URLs the source requests. Falls back to the
 * board page when applyUrl is absent, non-https or malformed. Returns '' when
 * neither is usable (the caller drops the row).
 * @param {any} job
 * @param {string} safeSlug already validated as path-safe, or '' if it was not
 */
function resolveUrl(job, safeSlug) {
  const raw = typeof job.applyUrl === 'string' ? job.applyUrl.trim() : '';
  if (raw) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'https:') return parsed.href;
    } catch {
      // malformed — fall through to the board page
    }
  }
  return safeSlug ? `${ORIGIN}/jobs/${safeSlug}` : '';
}

/**
 * Fold `location` together with any extra `allLocations` into one string,
 * de-duplicating case-insensitively. Exported for tests.
 * @param {any} job
 * @returns {string}
 */
export function resolveLocation(job) {
  const primary = typeof job?.location === 'string' ? job.location.trim() : '';
  const all = Array.isArray(job?.allLocations)
    ? job.allLocations.filter((l) => typeof l === 'string' && l.trim()).map((l) => l.trim())
    : [];
  /** @type {string[]} */
  const merged = [];
  for (const l of [primary, ...all]) {
    if (l && !merged.some((m) => m.toLowerCase() === l.toLowerCase())) merged.push(l);
  }
  return merged.join('; ');
}

/** @param {unknown} v @returns {number|null} */
function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Render remotli's salaryMin/Max/Currency into the web-ui shape's STRING salary
 * field ('' when there is no comp data). The web-ui job shape carries salary as
 * a display string (used as `comp` downstream), not a structured object — same
 * convention as the agenticjobs/manfred sources. Inverted bounds are ordered;
 * a one-sided range renders as "from"/"up to". Exported for tests.
 * @param {any} job
 * @returns {string}
 */
export function resolveSalary(job) {
  const min = numOrNull(job?.salaryMin);
  const max = numOrNull(job?.salaryMax);
  if (min == null && max == null) return '';
  const currency = typeof job?.salaryCurrency === 'string' ? job.salaryCurrency.trim().toUpperCase() : '';
  const cur = currency ? ` ${currency}` : '';
  if (min != null && max != null) {
    return `${Math.min(min, max)}–${Math.max(min, max)}${cur}`;
  }
  if (min != null) return `from ${min}${cur}`;
  return `up to ${max}${cur}`;
}

/** Stable non-crypto hash (djb2) for the id fallback when no safe slug exists. */
function shortHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Normalize one API join row `{ jobs, companies }` into the web-ui rich job
 * shape, or null when the row is unusable or not currently open. Exported for
 * tests.
 *
 * Field mapping:
 *   - title:    `jobs.title`, trimmed (rows without one are dropped).
 *   - url:      resolveUrl — applyUrl preferred, board page fallback.
 *   - company:  `jobs.company` → `companies.name` → entry name → "Remotli".
 *   - salary:   salaryMin/Max/Currency → display string.
 *   - location: resolveLocation (folds allLocations).
 *   - date:     publishedAt/createdAt → YYYY-MM-DD (web-ui house form), else ''.
 *   - snippet:  htmlToText(description), capped, else ''.
 *   - isRemote/workplaceType derived from the location string; relocates false.
 *
 * @param {any} row
 * @param {string} [fallbackCompany]
 */
export function normalizeRemotliJob(row, fallbackCompany) {
  if (!row || typeof row !== 'object') return null;
  const job = row.jobs && typeof row.jobs === 'object' ? row.jobs : null;
  if (!job) return null;

  const title = typeof job.title === 'string' ? job.title.trim() : '';
  if (!title) return null;

  // Only currently-open roles. Fail closed: anything not exactly `active` —
  // including a missing/blank/non-string status — is rejected, so the liveness
  // guarantee does not depend on the API always sending the field.
  const status = typeof job.status === 'string' ? job.status.trim().toLowerCase() : '';
  if (status !== 'active') return null;

  // The slug is validated only where it gets interpolated into a URL (the board
  // fallback). A row with an unsafe slug but a good applyUrl is still emitted.
  const slug = typeof job.slug === 'string' ? job.slug.trim() : '';
  const safeSlug = slug && !/[^a-z0-9._~-]/i.test(slug) ? slug : '';
  const url = resolveUrl(job, safeSlug);
  if (!url) return null;

  const companies = row.companies && typeof row.companies === 'object' ? row.companies : {};
  const company =
    (typeof job.company === 'string' && job.company.trim()) ||
    (typeof companies.name === 'string' && companies.name.trim()) ||
    (typeof fallbackCompany === 'string' && fallbackCompany.trim()) ||
    'Remotli';

  const location = resolveLocation(job);
  const isRemote = /\bremote\b/i.test(location);
  const postedAt = toEpochMs(job.publishedAt || job.createdAt);
  const description = htmlToText(job.description);

  return {
    id: `remotli-${safeSlug || shortHash(url)}`,
    title,
    company,
    url,
    salary: resolveSalary(job),
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : '',
    relocates: false,
    date: postedAt !== undefined ? new Date(postedAt).toISOString().slice(0, 10) : '',
    snippet: description ? description.slice(0, SNIPPET_MAX) : '',
    source: 'remotli',
  };
}

/**
 * Build the `?page=N&limit=50&remote=all` URL off the host-pinned base endpoint.
 * @param {URL} base
 * @param {number} page
 */
function pageUrl(base, page) {
  return `${base.origin}${base.pathname}?page=${page}&limit=${PAGE_SIZE}&${ALL_WORK_MODES}`;
}

/**
 * Fetch + normalize the remotli board. Pages through `?page=N&limit=50&remote=all`
 * (1-based) up to `pagination.totalPages`, capped by `company.max_pages` else
 * DEFAULT_MAX_PAGES, deduping by url. Host-pinned, `redirect:'error'` (SSRF-safe).
 *
 * Dead-board contract (parent v1.25.0): a page-1 failure — or a page-1 body that
 * is not `{ jobs: [...] }` — means we cannot tell a live board from a broken one,
 * so it THROWS and surfaces as a dead target. Once one page has parsed, the board
 * is provably reachable and a later transient failure keeps the partials already
 * collected (the succeededOnce guard).
 *
 * @param {string} endpoint host-pinned base endpoint (adapter default: FEED_BASE)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any }} [opts]
 */
export async function fetchRemotli(endpoint = FEED_BASE, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertRemotliUrl(endpoint);
  const base = new URL(endpoint);

  const cap =
    Number.isInteger(company?.max_pages) && company.max_pages > 0
      ? company.max_pages
      : DEFAULT_MAX_PAGES;
  const fallbackCompany =
    company && typeof company.name === 'string' && company.name.trim() ? company.name.trim() : undefined;

  /** @type {any[]} */
  const out = [];
  const seen = new Set();
  let totalPages = 1;
  // Proof of life. Only a well-formed page-1 response sets this; a page-1 failure
  // or malformed body must throw. Once set, a later transient failure keeps what
  // was already collected.
  let succeededOnce = false;

  for (let page = 1; page <= Math.min(cap, totalPages); page += 1) {
    const url = pageUrl(base, page);
    assertRemotliUrl(url);

    /** @type {any[]} */
    let rows;
    try {
      const data = await fetchJson(fetchImpl, url, { signal, redirect: 'error' });
      if (!data || typeof data !== 'object' || !Array.isArray(data.jobs)) {
        throw new Error(
          `remotli: unexpected API response — expected { jobs: [...] }, got ${data === null ? 'null' : typeof data}`,
        );
      }
      rows = data.jobs;
      const reported = Number(data.pagination?.totalPages);
      if (Number.isInteger(reported) && reported > 0) totalPages = reported;
    } catch (err) {
      if (!succeededOnce) throw err;
      break; // keep the pages already collected — a mid-scan blip isn't a dead board
    }

    // Set only after the shape check passed, so a malformed body never counts as
    // proof of life.
    succeededOnce = true;

    for (const row of rows) {
      const job = normalizeRemotliJob(row, fallbackCompany);
      if (job && !seen.has(job.url)) {
        seen.add(job.url);
        out.push(job);
      }
    }

    // A short page means the board ended early — stop rather than trust the count.
    if (rows.length < PAGE_SIZE) break;
  }

  return out;
}
