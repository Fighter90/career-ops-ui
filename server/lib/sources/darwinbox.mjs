// @ts-check
/**
 * Darwinbox source — the zero-auth `alljobs` JSON endpoint behind
 * `<tenant>.darwinbox.in` career sites:
 *
 *   POST {tenant_origin}/ms/candidateapi/job/alljobs
 *   body: { companyId, page (1-based), sort_option: 'new', limit: 50 }
 *   -> { status: 'success', data: [ {id, title, jd, tool_tip_locations[],
 *        locations, posted_on, created_on, internal_job_code,
 *        salary_min, salary_max, salary_currency, salary_timeframe} ],
 *        job_counts }
 *
 * The company id MUST come from the careers URL: a tenant asked with the
 * wrong one answers with an empty `success`, so a bare tenant host is not
 * claimed — an entry carries `careers_url` (or `api:`) shaped
 * `https://<tenant>.darwinbox.in/ms/candidatev2/<companyId>/careers/...`
 * and any careers path (allJobs page, careers root, a posting permalink)
 * reduces to that id. The walk pages until a short page, paced between
 * pages, bounded by the entry's `max_pages` (default 20 → 1,000 postings;
 * hard cap 200).
 *
 * Ported from the parent's providers/darwinbox.mjs (upstream #6416).
 * Deviations for the web-ui source contract: pages go through the shared
 * fetchJsonWithRetry (injected fetchImpl, transient-only retry, redirect:
 * 'error'), rows are normalized to the scanner's 12-field job shape
 * (`salary` renders as a display string, justjoin convention), and the
 * envelope checks reuse `_shape.mjs` semantics — a malformed 200 THROWS,
 * never an empty board. `requisitionId` (the parent keeps
 * `internal_job_code` on the job) exists on the parse output only; the
 * scanner row has no such field. `opts.maxPages` (probe budget),
 * `opts.sleep` and `opts.retries` are test seams; a production scan passes
 * none of them.
 *
 * Used by the darwinbox adapter (server/lib/portals/adapters/darwinbox.mjs).
 */
import { fetchJsonWithRetry } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';
import { requireObject } from './_shape.mjs';

export const meta = {
  value: 'darwinbox',
  label: 'Darwinbox',
  region: 'en',
};

// Single-label tenant host — `acme.darwinbox.in`, never the apex, never a
// second label (`a.b.darwinbox.in`), never a look-alike suffix/prefix.
export const DARWINBOX_HOST_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.darwinbox\.in$/;
// The careers path that carries the company id.
export const CAREERS_PATH_RE = /^\/ms\/candidatev2\/([a-z0-9_-]+)\/careers(?:\/|$)/i;

const PAGE_SIZE = 50;
const DEFAULT_MAX_PAGES = 20; // 1,000 postings; the largest board sampled had 122
const MAX_PAGES_CAP = 200; // hard ceiling even for a max_pages override
const INTER_PAGE_DELAY_MS = 200;

/**
 * ABSENT BEATS WRONG (parent _ids.mjs semantics): an id that cannot be
 * coerced returns undefined rather than a placeholder — a missing key makes
 * a consumer fall back, a wrong key makes it confidently match the wrong
 * posting.
 * @param {unknown} raw
 * @returns {string | undefined}
 */
function coerceId(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const s = String(raw).trim();
  return s === '' ? undefined : s;
}

/**
 * The tenant origin and company id for an entry, or null. Only https: on a
 * single-label `<tenant>.darwinbox.in` host is accepted; the origin is
 * rebuilt from the hostname alone, so an explicit port never reaches the
 * request (the same default-port-only rule the other tenant pins use).
 * Exported for tests.
 * @param {any} entry
 * @returns {{origin: string, companyId: string} | null}
 */
export function resolveBoard(entry) {
  for (const raw of [entry?.api, entry?.careers_url]) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    let parsed;
    try {
      parsed = new URL(raw.trim());
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:' || !DARWINBOX_HOST_RE.test(parsed.hostname)) continue;
    const m = parsed.pathname.match(CAREERS_PATH_RE);
    if (m) return { origin: `https://${parsed.hostname}`, companyId: m[1] };
  }
  return null;
}

/**
 * Page cap: a positive integer `max_pages` on the entry, capped at the hard
 * ceiling; the default otherwise. Exported for tests.
 * @param {any} entry
 * @returns {number}
 */
export function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * Every listed location, joined with "; ". `locations` is the display string
 * (literally "Multiple Locations" on a multi-site posting), so it is only
 * the fallback for a row without `tool_tip_locations`. Exported for tests.
 * @param {any} row
 * @returns {string}
 */
export function jobLocation(row) {
  const tips = Array.isArray(row?.tool_tip_locations) ? row.tool_tip_locations : [];
  /** @type {string[]} */
  const parts = [];
  for (const loc of tips.length ? tips : [row?.locations]) {
    if (typeof loc !== 'string') continue;
    const label = decodeEntities(loc).replace(/\s+/g, ' ').replace(/ ,/g, ',').trim();
    if (label && !parts.includes(label)) parts.push(label);
  }
  return parts.join('; ');
}

/**
 * `posted_on` is epoch SECONDS and moves when a posting is re-released;
 * `created_on` is an ISO string for when the job was created, so only the
 * fallback.
 * @param {any} row
 * @returns {number | undefined}
 */
function postedAtMs(row) {
  if (Number.isFinite(row?.posted_on) && row.posted_on > 0) return row.posted_on * 1000;
  if (typeof row?.created_on !== 'string' || !row.created_on) return undefined;
  const parsed = Date.parse(row.created_on);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** @param {unknown} value @returns {number | undefined} */
function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Salary only for a posting that states real annual figures. Other
 * timeframes are left out rather than converted: the scanner's salary field
 * is annualized, never inferred.
 * @param {any} row
 * @returns {{min?: number, max?: number, currency?: string} | undefined}
 */
function jobSalary(row) {
  if (String(row?.salary_timeframe ?? '').trim().toLowerCase() !== 'annual') return undefined;
  const min = toAmount(row.salary_min);
  const max = toAmount(row.salary_max);
  if (min === undefined && max === undefined) return undefined;
  const currency = typeof row.salary_currency === 'string' ? row.salary_currency.trim().toUpperCase() : '';
  return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), currency };
}

/** Display string for the scanner's salary field (justjoin convention). */
function salaryString(salary) {
  if (!salary) return '';
  const currency = salary.currency || '';
  const min = salary.min != null ? String(salary.min) : '';
  const max = salary.max != null ? String(salary.max) : '';
  if (min && max) return `${min}–${max} ${currency}`.trim();
  if (min) return `≥ ${min} ${currency}`.trim();
  if (max) return `≤ ${max} ${currency}`.trim();
  return '';
}

/**
 * Parse an `alljobs` response. Exported for unit tests.
 *
 * `{status: "success", data: []}` is an empty board; any other envelope
 * throws, so a silent API change does not read as zero postings forever. A
 * single malformed row is dropped.
 *
 * @param {unknown} json
 * @param {string} companyName
 * @param {{origin: string, companyId: string}} board
 * @returns {Array<{title: string, url: string, company: string, location: string,
 *   salary?: object, description?: string, postedAt?: number, requisitionId?: string}>}
 */
export function parseDarwinboxResponse(json, companyName, board) {
  // A 200 that is not the success/data envelope is a changed API or a
  // challenge page and must throw, not read as an empty board (v1.242.0).
  requireObject(json, 'darwinbox alljobs');
  if (json.status !== 'success' || !Array.isArray(json.data)) {
    const got = Object.keys(json).join(', ');
    throw new Error(`darwinbox: unexpected response — expected status "success" and a data array, got: [${got}]`);
  }
  const jobs = [];
  for (const row of json.data) {
    if (!row || typeof row !== 'object') continue;
    const title = typeof row.title === 'string' ? decodeEntities(row.title).replace(/\s+/g, ' ').trim() : '';
    const id = coerceId(row.id);
    if (!title || id === undefined) continue;
    // A lone surrogate in a host-controlled id would throw out of this loop
    // and lose the whole board; drop just that posting instead.
    const seg = safeEncodeURIComponent(id);
    if (seg === null) continue;
    const job = {
      title,
      url: `${board.origin}/ms/candidatev2/${board.companyId}/careers/jobDetails/${seg}`,
      company: companyName,
      location: jobLocation(row),
    };
    const postedAt = postedAtMs(row);
    if (postedAt !== undefined) job.postedAt = postedAt;
    const requisitionId = coerceId(row.internal_job_code);
    if (requisitionId !== undefined) job.requisitionId = requisitionId;
    const salary = jobSalary(row);
    if (salary) job.salary = salary;
    const description = htmlToText(row.jd);
    if (description) job.description = description;
    jobs.push(job);
  }
  return jobs;
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  return {
    id: `darwinbox-${row.url}`,
    title: row.title,
    company: row.company,
    url: row.url,
    salary: salaryString(row.salary),
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: '',
    relocates: false,
    date: typeof row.postedAt === 'number' ? new Date(row.postedAt).toISOString().slice(0, 10) : '',
    snippet: row.description || '',
    source: 'darwinbox',
  };
}

/**
 * Fetch + normalize one Darwinbox tenant board, paging the `alljobs`
 * endpoint until a short page. The request URL is rebuilt from the resolved
 * board (host + company id) only — the endpoint argument is signature
 * parity, the input port and path are discarded. A fetch or envelope failure
 * on the FIRST page throws (the board is broken, not empty); a later-page
 * failure keeps the pages already collected and warns. Under `opts.maxPages`
 * (probe budget) any failure propagates unwrapped and no truncation warning
 * fires.
 *
 * @param {string} _endpoint endpoint from buildEndpoint (signature parity)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           maxPages?: number, sleep?: (ms: number) => Promise<void>,
 *           retries?: number }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchDarwinbox(_endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company } = opts;
  const board = resolveBoard(company);
  if (!board) {
    throw new Error(`darwinbox: cannot derive a board for ${company?.name || 'the entry'} — set careers_url to https://<tenant>.darwinbox.in/ms/candidatev2/<companyId>/careers/allJobs`);
  }
  // A scan aborted before the first request must fail loud, not report an
  // empty board (paylocity convention).
  signal?.throwIfAborted();
  const endpoint = `${board.origin}/ms/candidateapi/job/alljobs?companyId=${board.companyId}`;

  const maxPages = resolveMaxPages(company);
  const ctxMaxPages = Number(opts.maxPages);
  const probing = ctxMaxPages > 0;
  const pagesToFetch = probing ? Math.min(maxPages, ctxMaxPages) : maxPages;

  // Test seam; the default honors the abort signal while pacing between pages.
  const sleep = opts.sleep || ((ms) => new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason ?? new Error('aborted')); }, { once: true });
  }));

  /** @type {object[]} */
  const jobs = [];
  const seen = new Set();
  let fetched = 0;
  let total;
  // Assume the budget runs out; a short page or a failed page says otherwise.
  let stopReason = 'cap';

  for (let page = 1; page <= pagesToFetch; page++) {
    if (page > 1) await sleep(INTER_PAGE_DELAY_MS);
    let json;
    let pageJobs;
    try {
      json = await fetchJsonWithRetry(fetchImpl, endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ companyId: board.companyId, page, sort_option: 'new', limit: PAGE_SIZE }),
        signal,
        retries: opts.retries,
      });
      pageJobs = parseDarwinboxResponse(json, String(company?.name ?? ''), board);
    } catch (err) {
      // The first page failing means the board is broken, not empty, and a
      // probe needs the rejection unwrapped so a budget stop keeps its identity.
      if (probing || page === 1) throw err;
      // Keep the pages already collected rather than lose the whole board.
      const cause = err instanceof Error ? err.message : String(err);
      console.error(`⚠️  darwinbox: ${company?.name} stopped at page ${page} (${jobs.length} jobs so far): ${cause}`);
      stopReason = 'fetch-error';
      break;
    }

    for (const job of pageJobs) {
      const normalized = normalize(job);
      if (seen.has(normalized.url)) continue;
      seen.add(normalized.url);
      jobs.push(normalized);
    }

    // Count the rows the source returned, not the ones kept: a full page with
    // one malformed row is still a full page, and the board goes on.
    fetched += json.data.length;
    if (Number.isFinite(json.job_counts)) total = json.job_counts;
    if (json.data.length < PAGE_SIZE) {
      stopReason = 'complete';
      break;
    }
  }

  // A full last page is only a truncation if the source says there is more.
  if (stopReason === 'cap' && total !== undefined && fetched >= total) stopReason = 'complete';
  if (stopReason === 'cap' && !probing) {
    const summary = `${jobs.length}${total !== undefined ? ` of ${total}` : ''} jobs`;
    console.error(`⚠️  darwinbox: ${company?.name} truncated at max_pages=${maxPages} (${summary}) — raise max_pages on this entry for more`);
  }

  return jobs;
}
