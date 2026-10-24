// @ts-check
/**
 * Kalibrr source — reads the public job-board search JSON that kalibrr.com's
 * own job board calls. Board-wide source wired with `provider: kalibrr` in
 * portals.yml (Kalibrr is a job board aggregator, not a company ATS, so it is
 * never auto-detected from a careers_url):
 *
 *   tracked_companies:
 *     - name: Kalibrr
 *       provider: kalibrr
 *       enabled: true
 *       searchKeywords: "engineer"   # optional server-side `text` filter
 *       pageSize: 100                # optional (default 100; 500 accepted live)
 *       max_pages: 20                # optional, capped at 200
 *
 * Kalibrr (kalibrr.com) is a South-East Asian board, Indonesia-heavy (99 of the
 * first 100 live rows) with the Philippines and Thailand behind it. The endpoint
 * is a public, no-auth JSON search at /kjs/job_board/search, paginated by
 * limit/offset, with a server-side keyword filter in the `text` param.
 *
 * Three board facts the source is built around:
 *
 *   - The response's `count` is the TOTAL number of matches, not the page size,
 *     so the loop stops on `offset >= count`. Traversing that total with no
 *     facet filter is what keeps a scan complete rather than a slice of a
 *     promoted view (Source Indexing Policy rule 3). The API does expose
 *     `is_featured` and `priority_score`; neither is ever used as a filter here,
 *     and neither is read as a signal.
 *
 *   - Every posting is employer-attributed (`company.name`) and the posting page
 *     is the canonical URL — `https://www.kalibrr.com/c/{company code}/jobs/{id}/{slug}`.
 *     Kalibrr's own page emits exactly this URL in its <link rel="canonical">.
 *     The company-code segment is cosmetic (any value resolves to the same page),
 *     but the real code is used when present so links match what the site emits.
 *
 *   - `apply_redirect_url` (set on ~12% of rows) is deliberately NOT used as the
 *     URL: it is an opaque shortener (bit.ly/…), which Source Indexing Policy
 *     rule 2 excludes — the same call the parent's telegram-channel.mjs makes.
 *     The posting page carries the real apply path.
 *
 * Salary is deliberately not attached. The API publishes a month/day figure
 * (`salary_interval: "month"` on 31% of live rows, `"day"` on some) while the
 * normalized row's `salary` is annualized compensation — attaching a monthly
 * number there would be read as a yearly one by the scanner's salary filter.
 * The figures stay unused until they can be annualized honestly.
 *
 * Ported from the parent's providers/kalibrr.mjs (parity v1.253.0).
 * Deviations from the parent, per the web-ui source contract:
 *   - the parent's ctx transport (ctx.fetch* / ctx.sleep) does not exist here;
 *     the source fetches through the injected fetchImpl via the shared
 *     fetchJsonWithRetry (the mirror of the parent's own retry helper), and the
 *     courtesy pause between pages is the abort-aware delay() the other
 *     web-ui sources use;
 *   - web-ui's scanner has no probe path (the parent's ctx.maxPages), so the
 *     entry's own max_pages is the only cap, and a stop at it tags the result
 *     array `kalibrrTruncated` — the web-ui partial-board convention (the
 *     parent only warns, and never flags a probe-capped walk);
 *   - rows normalize into the web-ui 12-field shape: postedAt becomes `date`,
 *     the flattened description becomes `snippet` (the scanner's content
 *     filter reads it), and the feed's own id becomes the row id.
 */
import { htmlToText } from '../html-to-text.mjs';
import { fetchJsonWithRetry, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';

const UA = BROWSER_LIKE_USER_AGENT;

export const meta = {
  value: 'kalibrr',
  label: 'Kalibrr',
  region: 'en',
};

export const DEFAULT_API = 'https://www.kalibrr.com/kjs/job_board/search';
export const SITE_ORIGIN = 'https://www.kalibrr.com';
export const TRUSTED_HOST = 'www.kalibrr.com';
export const DEFAULT_PAGE_SIZE = 100;
export const PAGE_SIZE_CAP = 500;
export const DEFAULT_MAX_PAGES = 20;
export const MAX_PAGES_CAP = 200;
// Applied to pages past the first only. Kalibrr answers a 100-row page in about
// 500 ms live and never pushed back on back-to-back requests, so this stays at
// the low end of the guide's 150-250 ms range rather than gold-plating a source
// that never complained.
export const INTER_PAGE_DELAY_MS = 200;

// Parent retry budget (1 attempt + 2 retries on a transient failure).
export const RETRIES = 2;

/**
 * Defence-in-depth endpoint check: HTTPS on exactly the Kalibrr host.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertKalibrrUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`kalibrr: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`kalibrr: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`kalibrr: a non-default port is not allowed: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`kalibrr: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/** Resolve a positive-integer entry field, falling back to a default and capped. */
function boundedPositiveInt(value, fallback, cap) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, cap);
}

/**
 * Resolve the page size: a positive integer `pageSize` on the entry, capped.
 * @param {{pageSize?: unknown}} entry
 */
export function resolvePageSize(entry) {
  return boundedPositiveInt(entry?.pageSize, DEFAULT_PAGE_SIZE, PAGE_SIZE_CAP);
}

/**
 * Resolve the page cap: a positive integer `max_pages` on the entry, capped.
 * @param {{max_pages?: unknown}} entry
 */
export function resolveMaxPages(entry) {
  return boundedPositiveInt(entry?.max_pages, DEFAULT_MAX_PAGES, MAX_PAGES_CAP);
}

/**
 * Parse the ISO timestamp Kalibrr sends (e.g. "2026-09-23T11:55:37.266927+00:00").
 * @param {unknown} value
 * @returns {number|undefined} epoch ms
 */
function toEpochMs(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const ms = Date.parse(value.trim());
  return Number.isNaN(ms) ? undefined : ms;
}

/**
 * Build the canonical posting URL. Both `id` and `slug` come from the payload;
 * the company `code` segment is cosmetic, so a missing one falls back to the
 * placeholder segment that still resolves (verified live).
 *
 * Every segment is host-controlled, so each goes through
 * `safeEncodeURIComponent`: a value like `a/../../x?y#z` would otherwise escape
 * its segment and produce a URL that is not the posting's, and `url` is the
 * scanner's dedup key. The helper returns null for a lone surrogate, and the
 * posting is dropped instead of a URIError aborting the whole page.
 *
 * @param {any} job
 * @returns {string}
 */
function buildJobUrl(job) {
  const id = safeEncodeURIComponent(job?.id ?? '');
  if (!id) return '';
  const rawCode = typeof job?.company?.code === 'string' && job.company.code.trim() ? job.company.code.trim() : '-';
  const code = safeEncodeURIComponent(rawCode);
  const rawSlug = typeof job.slug === 'string' ? job.slug.trim() : '';
  const slug = rawSlug ? safeEncodeURIComponent(rawSlug) : '';
  if (code === null || slug === null) return '';
  const path = slug ? `/c/${code}/jobs/${id}/${slug}` : `/c/${code}/jobs/${id}`;
  const url = `${SITE_ORIGIN}${path}`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== TRUSTED_HOST) return '';
  } catch {
    return '';
  }
  return url;
}

/**
 * Normalize one Kalibrr job row into the canonical parsed shape.
 * Exported for tests.
 *
 * Field mapping:
 *   - title:    `name`
 *   - url:      /c/{company.code}/jobs/{id}/{slug} on kalibrr.com
 *   - company:  `company.name` → `company_name` → the portal entry's name
 *   - location: `google_location.address_components` city/region/country, with
 *               "Remote" appended when `is_work_from_home` is set
 *   - postedAt: `activation_date` (when the posting went live), else `created_at`
 *   - description: `description` + `qualifications`, flattened from HTML so
 *               the scanner's content filter can match against plain text
 *
 * @param {any} job — raw row from /kjs/job_board/search
 * @param {string} [fallbackCompany]
 * @returns {{ title: string, url: string, company: string, location: string, externalId: string, description?: string, postedAt?: number } | null}
 */
export function normalizeKalibrrJob(job, fallbackCompany) {
  if (!job || typeof job !== 'object') return null;

  const title = typeof job.name === 'string' ? job.name.trim() : '';
  if (!title) return null;

  const url = buildJobUrl(job);
  if (!url) return null; // an id-less (or off-host) row cannot be deduped or linked

  const externalId = String(job.id);

  const name = typeof job.company?.name === 'string' ? job.company.name.trim() : '';
  const company =
    name || (typeof job.company_name === 'string' && job.company_name.trim()) || fallbackCompany || '';

  const parts = [];
  const addr = job.google_location?.address_components;
  if (addr && typeof addr === 'object') {
    for (const key of ['city', 'region', 'country']) {
      const v = typeof addr[key] === 'string' ? addr[key].trim() : '';
      if (v && !parts.includes(v)) parts.push(v);
    }
  }
  if (job.is_work_from_home === true) parts.push('Remote');

  /** @type {{ title: string, url: string, company: string, location: string, externalId: string, description?: string, postedAt?: number }} */
  const out = { title, url, company, location: parts.join(', '), externalId };

  const description = htmlToText([job.description, job.qualifications].filter(Boolean).join(' '));
  if (description) out.description = description;

  const postedAt = toEpochMs(job.activation_date) ?? toEpochMs(job.created_at);
  if (postedAt != null) out.postedAt = postedAt;

  return out;
}

const SNIPPET_CAP = 500;

/**
 * Parse one page of the /kjs/job_board/search envelope. Exported for unit
 * tests (the parent validated the envelope inline; the pure helper keeps the
 * fetch loop thin).
 *
 * Page 0 is strict: a 200 whose body is `null`, `{}` or a bare `[]` is not
 * "nothing matched" on a board of thousands — it is a shape change, and
 * returning [] would read as an empty board forever. Only an object carrying
 * an own `jobs` key answers page 0 honestly. Later pages stay lenient (the
 * guide's empty-body branch): `null`, `{}`, `[]`, `{jobs: null}` and
 * `{jobs: []}` all mean "the endpoint answered, nothing more" — rowsLength 0
 * ends the walk naturally. On either page, a body carrying unexpected keys or
 * a `jobs` that is not an array is a shape change worth throwing on (never a
 * quiet empty board).
 *
 * @param {any} json
 * @param {{ offset?: number, fallbackCompany?: string }} [opts]
 * @returns {{ jobs: Array<{title: string, url: string, company: string, location: string, description?: string, postedAt?: number}>, total: number|null, rowsLength: number }}
 */
export function parseKalibrrPage(json, { offset = 0, fallbackCompany = '' } = {}) {
  if (offset === 0) {
    const isEnvelope = json !== null
      && typeof json === 'object'
      && !Array.isArray(json)
      && Object.hasOwn(json, 'jobs');
    if (!isEnvelope) {
      const got = json === null || json === undefined
        ? String(json)
        : Array.isArray(json)
          ? `an array of ${json.length}`
          : typeof json === 'object'
            ? `keys: [${Object.keys(json).join(', ')}]`
            : typeof json;
      throw new Error(
        `kalibrr: unexpected API response at offset 0 — expected { jobs: [...] }, got ${got}`,
      );
    }
  } else if (json == null || Object.keys(json ?? {}).length === 0) {
    // Null, an empty object and an empty array all carry no keys — the
    // parent's own empty-body test.
    return { jobs: [], total: null, rowsLength: 0 };
  }
  if (!Object.hasOwn(json, 'jobs')) {
    const got = Array.isArray(json) ? `an array of ${json.length}` : typeof json === 'object' ? `keys: [${Object.keys(json).join(', ')}]` : typeof json;
    throw new Error(
      `kalibrr: unexpected API response at offset ${offset} — expected { jobs: [...] }, got ${got}`,
    );
  }
  const rows = json.jobs;
  if (rows == null) return { jobs: [], total: null, rowsLength: 0 };
  if (!Array.isArray(rows)) {
    throw new Error(`kalibrr: \`jobs\` is not an array at offset ${offset}`);
  }
  const total = Number.isFinite(json.count) && json.count >= 0 ? json.count : null;
  const jobs = [];
  for (const row of rows) {
    const normalized = normalizeKalibrrJob(row, fallbackCompany);
    if (normalized) jobs.push(normalized);
  }
  return { jobs, total, rowsLength: rows.length };
}

function normalize(row, entry) {
  return {
    // The feed's own job id — NOT the URL slug, which churns on title edits
    // and would mint a new row id (and a duplicate tracker row) per rename.
    id: `kalibrr-${row.externalId}`,
    title: row.title,
    company: row.company || String(entry?.name ?? ''),
    url: row.url,
    salary: '',
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(row.title),
    workplaceType: row.location.includes('Remote') ? 'Remote' : '',
    relocates: false,
    date: row.postedAt != null ? new Date(row.postedAt).toISOString() : '',
    snippet: row.description ? String(row.description).slice(0, SNIPPET_CAP) : '',
    source: 'kalibrr',
  };
}

/**
 * Fetch + normalize the Kalibrr board search (paginated by limit/offset).
 * Mirrors the parent's fetch(): `count` (the total match count) is the honest
 * stop condition with a short page as the fallback; a first-page fetch failure
 * throws (a broken board is not an empty one) while a later-page failure keeps
 * the pages already collected; a stop at the max_pages cap tags the result
 * array `kalibrrTruncated`.
 *
 * @param {string} endpoint - the search API URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           delayMs?: number, retries?: number }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchKalibrr(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {}, delayMs = INTER_PAGE_DELAY_MS, retries = RETRIES } = opts;
  const entry = company ?? {};
  // Host allowlist before any request (SSRF guard): the adapter resolved this
  // endpoint (the entry's api or the default); re-validate it here.
  const api = assertKalibrrUrl(endpoint);
  const pageSize = resolvePageSize(entry);
  const maxPages = resolveMaxPages(entry);
  // `text` is the API's own keyword filter. It serverside-narrows the set
  // instead of re-ranking it, so an entry that sets it still traverses every
  // match (preferred over fetching the whole board, per rule 3's spirit).
  const keywords = typeof entry.searchKeywords === 'string' ? entry.searchKeywords.trim() : '';
  const fallbackCompany = typeof entry.name === 'string' ? entry.name : '';

  const out = [];
  const seen = new Set();
  let offset = 0;
  let total = null;
  // Set only when the walk stops on the entry/DEFAULT page cap while the board
  // still had matches. Never set by a fetch error (a broken board is not a
  // truncated one), so the advice to raise `max_pages` cannot misfire.
  let truncated = false;

  for (let page = 0; page < maxPages; page++) {
    if (page > 0 && delayMs > 0) await delay(delayMs, signal);
    // A scan aborted before page 0 must fail loud, not report an empty board;
    // past page 0 a break keeps the partials.
    if (page === 0) signal?.throwIfAborted();
    else if (signal?.aborted) break;

    const url = new URL(api);
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('offset', String(offset));
    if (keywords) url.searchParams.set('text', keywords);

    let parsed;
    try {
      const json = await fetchJsonWithRetry(fetchImpl, url.href, {
        signal,
        redirect: 'error',
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        retries,
      });
      // Parse INSIDE the try: a later-page shape throw keeps the pages
      // already collected (partials, the later-page invariant) instead of
      // discarding them; on page 0 the throw propagates — the first page
      // failing means there is no board to report on.
      parsed = parseKalibrrPage(json, { offset, fallbackCompany });
    } catch (err) {
      // A first-page failure means the board itself is unreachable or has
      // changed shape: fail loud rather than report a quiet empty board, which
      // is indistinguishable from a healthy quiet one. A later page keeps what
      // was already collected.
      if (page === 0) throw err;
      console.error(`⚠️  kalibrr: ${entry.name} truncated at offset ${offset} (${out.length} jobs): ${err.message}`);
      break;
    }

    const { jobs: pageJobs, total: pageTotal, rowsLength } = parsed;
    if (total === null && pageTotal !== null) total = pageTotal;

    for (const row of pageJobs) {
      if (seen.has(row.url)) continue;
      seen.add(row.url);
      out.push(normalize(row, entry));
    }

    offset += pageSize;
    // `count` is the total match count, so it is the honest stop condition.
    // A short page is the fallback when `count` is absent or moves mid-loop.
    if (total !== null && offset >= total) break;
    if (rowsLength < pageSize) break;
    // Reached the last permitted page with matches still on the board.
    if (page === maxPages - 1) truncated = true;
  }

  if (truncated) {
    console.error(`⚠️  kalibrr: ${entry.name} truncated at max_pages=${maxPages} with ${total === null ? 'more' : total} matches on the board — raise max_pages to walk further`);
    out.kalibrrTruncated = true;
  }
  return out;
}
