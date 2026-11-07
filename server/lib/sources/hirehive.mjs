// @ts-check
/**
 * HireHive source — a single-company ATS adapter for `tracked_companies:`.
 * Ported from the parent's providers/hirehive.mjs (upstream #6503). Every
 * employer has a board at `https://<tenant>.hirehive.com/`; detection claims
 * that root and any path under it, so a posting link in either form
 * (`/<title-slug>-<shortid>` or `/job/<number>/<title-slug>`) resolves to the
 * board it belongs to.
 *
 * Data path: the board page is server-rendered HTML, and every tenant also
 * serves a public, anonymous jobs API — `GET <origin>/api/v2/jobs` (no
 * cookie, token or extra header) — that lists the same postings. Its envelope
 * is `{ meta, links, items[] }`, and each item carries the title, the
 * posting's `hosted_url`, a free-text location plus a country, the language,
 * the published date and the full description, so a scan needs no
 * per-posting request.
 *
 * Pagination: the API pages with `page` / `page_size` (`page_size` accepts at
 * most 100). The walk stops when `meta.has_next_page` is false or a page
 * holds fewer items than `page_size` (the RAW page length decides, never a
 * count field), and never goes past `max_pages` on the entry (default 20,
 * at most 100). Per the web-ui source contract, a page-1 failure throws (so
 * a broken board is loud) while a later-page failure keeps what is already
 * collected and warns — a partial board never silently reads as a complete
 * one.
 *
 * Group boards: one tenant can list postings that live on other tenants of
 * the same group; `hosted_url` then names that other `*.hirehive.com` host,
 * which is the posting's real page, so it is kept as the job URL.
 *
 * Salary: `compensation_tiers[]` carries the pay the posting page shows. Only
 * a tier whose `type` is `range_salary` or `fixed_salary` is displayed there;
 * a `none` tier can still hold a figure that the page does not show and that
 * can disagree with the posting text, so it is never read. Only the `year`
 * interval is used, because its figures are already annual.
 *
 * Failure answers: an unknown tenant answers `404 {"message":"Company not
 * found"}`, which is reported as a 404 naming the tenant. A tenant with no
 * open roles answers 200 with an empty `items` array, which is an empty
 * board. The vendor's own service hosts (see VENDOR_LABELS) are not boards
 * and are never claimed.
 *
 * Deviations from the parent provider for the web-ui source contract: the
 * fetches go through the shared fetchJsonWithRetry (injected fetchImpl,
 * redirect:'error' default) and the courtesy pause through the shared delay
 * (injectable via opts.sleep for tests); the rows are normalized to the
 * scanner's job shape (id/source/date/…); a malformed 200 throws
 * (_shape.mjs semantics — never an empty board).
 */
import { fetchJsonWithRetry, delay } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { requireObject, requireArray } from './_shape.mjs';

export const meta = {
  value: 'hirehive',
  label: 'HireHive',
  region: 'en',
};

export const HIREHIVE_HOST_RE = /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.hirehive\.com$/;

// Labels under hirehive.com that serve the vendor's own site, login or apply
// flow rather than a tenant board: `curl -sI https://<label>.hirehive.com/`
// answers with the marketing site or a redirect to the login service.
const VENDOR_LABELS = new Set(['www', 'app', 'accounts', 'apply']);

export const PAGE_SIZE = 100;
export const DEFAULT_MAX_PAGES = 20;
export const MAX_PAGES_CAP = 100;
const INTER_PAGE_DELAY_MS = 200;

/**
 * Defence-in-depth endpoint check: HTTPS on exactly a tenant host
 * (`<tenant>.hirehive.com`, never a vendor service label), default port only.
 * Runs on the endpoint the adapter resolved, before any request.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertHireHiveUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`hirehive: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`hirehive: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`hirehive: a non-default port is not allowed: ${url}`);
  if (!hireHiveTenantOf(parsed.hostname)) {
    throw new Error(`hirehive: untrusted hostname "${parsed.hostname}" — must be https://<tenant>.hirehive.com`);
  }
  return url;
}

/**
 * The tenant label of a `<tenant>.hirehive.com` host, or null for any other
 * host and for the vendor's own service hosts.
 * @param {string} hostname
 * @returns {string | null}
 */
export function hireHiveTenantOf(hostname) {
  const m = String(hostname || '').toLowerCase().match(HIREHIVE_HOST_RE);
  if (!m || VENDOR_LABELS.has(m[1])) return null;
  return m[1];
}

/**
 * `https://<tenant>.hirehive.com`, rebuilt from the tenant label of the
 * entry's `api` or `careers_url`. The input's path, query and port are never
 * read.
 * @param {{ api?: unknown, careers_url?: unknown } | null | undefined} entry
 * @returns {string | null}
 */
export function resolveOrigin(entry) {
  const raw = [entry?.api, entry?.careers_url].find((v) => typeof v === 'string' && v.trim());
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const tenant = hireHiveTenantOf(parsed.hostname);
  return tenant ? `https://${tenant}.hirehive.com` : null;
}

/** The canonical jobs-API endpoint for one tenant origin (the adapter's shape). */
export function jobsApiFor(origin) {
  return `${origin}/api/v2/jobs`;
}

/** @param {any} entry */
export function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/** @param {unknown} value */
function toEpochMs(value) {
  if (!value || typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** @param {unknown} v */
function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * The posting page URL from `hosted_url`, accepted only on an https
 * `<tenant>.hirehive.com` host.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function postingUrl(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || !hireHiveTenantOf(u.hostname)) return null;
  return u.href;
}

/**
 * Location text: the employer's free-text `location`, followed by the country
 * name when the text does not already contain it, so a country-based
 * location filter can match a posting whose text names only a city.
 * @param {any} item
 * @returns {string}
 */
export function buildLocation(item) {
  const text = str(item?.location);
  const country = str(item?.country?.name);
  if (!country) return text;
  if (!text) return country;
  return text.toLowerCase().includes(country.toLowerCase()) ? text : `${text}, ${country}`;
}

const SALARY_TYPES = new Set(['range_salary', 'fixed_salary']);

/** @param {unknown} v */
function positive(v) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Annual salary from the first displayed yearly tier, or null.
 * @param {any} tiers
 * @returns {{min?: number, max?: number, currency?: string} | null}
 */
export function parseSalary(tiers) {
  if (!Array.isArray(tiers)) return null;
  for (const tier of tiers) {
    if (!tier || !SALARY_TYPES.has(tier.type) || tier.interval !== 'year') continue;
    const min = positive(tier.min_value);
    const max = positive(tier.max_value);
    if (min === undefined && max === undefined) continue;
    const lo = min ?? max;
    const hi = max ?? min;
    /** @type {{min?: number, max?: number, currency?: string}} */
    const salary = lo <= hi ? { min: lo, max: hi } : { min: hi, max: lo };
    const currency = str(tier.currency_code).toUpperCase();
    if (currency) salary.currency = currency;
    return salary;
  }
  return null;
}

/** Salary display text for the scanner's string salary column. */
function salaryText(salary) {
  if (!salary) return '';
  const cur = salary.currency || '';
  if (salary.min != null && salary.max != null) return `${salary.min}–${salary.max} ${cur}`.trim();
  if (salary.min != null) return `≥ ${salary.min} ${cur}`.trim();
  return `≤ ${salary.max} ${cur}`.trim();
}

/**
 * Map one API item to a parsed job, or null when it lacks a title or a
 * usable posting URL.
 * @param {any} item
 * @param {string} companyName
 */
export function parseHireHiveJob(item, companyName) {
  if (!item || typeof item !== 'object') return null;
  const title = str(item.title);
  const url = postingUrl(item.hosted_url);
  if (!title || !url) return null;
  /** @type {{title: string, url: string, company: string, location: string, postedAt?: number, language?: string, salary?: object, description?: string}} */
  const job = { title, url, company: companyName, location: buildLocation(item) };
  const postedAt = toEpochMs(item.published_date);
  if (postedAt !== undefined) job.postedAt = postedAt;
  const language = str(item.language?.code);
  if (language) job.language = language;
  const description = htmlToText(item.description?.html) || str(item.description?.text);
  if (description) job.description = description;
  const salary = parseSalary(item.compensation_tiers);
  if (salary) job.salary = salary;
  return job;
}

/**
 * Read one `/api/v2/jobs` page. Throws when the body is not the documented
 * `{ items: [] }` envelope (a malformed 200 never reads as an empty board).
 * @param {any} json
 * @param {string} companyName
 * @returns {{ jobs: object[], rawCount: number, hasNext: boolean }}
 */
export function parseHireHivePage(json, companyName) {
  const body = requireObject(json, 'hirehive jobs page');
  const rows = requireArray(body.items, 'hirehive items');
  const jobs = [];
  for (const item of rows) {
    const job = parseHireHiveJob(item, companyName);
    if (job) jobs.push(job);
  }
  return { jobs, rawCount: rows.length, hasNext: body.meta?.has_next_page !== false };
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  return {
    id: `hirehive-${row.url}`,
    title: row.title,
    company: row.company,
    url: row.url,
    salary: salaryText(row.salary),
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: '',
    relocates: false,
    date: typeof row.postedAt === 'number' ? new Date(row.postedAt).toISOString() : '',
    snippet: row.description || '',
    language: row.language || '',
    source: 'hirehive',
  };
}

/**
 * Fetch + normalize one `<tenant>.hirehive.com` board, walking `page` /
 * `page_size` until the source says stop. The endpoint is re-validated
 * against the pinned host shape before any request (assertHireHiveUrl); a
 * page-1 failure throws (a 404 reads as "no such HireHive tenant"), while a
 * later-page failure keeps the jobs already collected and warns.
 *
 * @param {string} endpoint - the jobs-API URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           maxPages?: number, sleep?: (ms: number) => Promise<void> }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchHireHive(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company, sleep: sleepFn } = opts;
  // Host allowlist before any request (SSRF guard): the adapter resolved this
  // endpoint from the entry; re-validate it here.
  assertHireHiveUrl(endpoint);
  signal?.throwIfAborted();
  const origin = resolveOrigin({ careers_url: endpoint });
  if (!origin) {
    throw new Error(`hirehive: no <tenant>.hirehive.com board in careers_url/api for ${company?.name}`);
  }
  const who = String(company?.name ?? '');
  const ctxMaxPages = Number(opts.maxPages);
  const probing = ctxMaxPages > 0;
  const pagesToFetch = probing ? Math.min(resolveMaxPages(company), ctxMaxPages) : resolveMaxPages(company);
  const pause = sleepFn || ((ms) => delay(ms, signal));

  /** @type {any[]} */
  const collected = [];
  const seen = new Set();
  let stoppedAtCap = false;
  for (let page = 1; page <= pagesToFetch; page++) {
    if (page > 1) await pause(INTER_PAGE_DELAY_MS);
    const url = `${origin}/api/v2/jobs?page=${page}&page_size=${PAGE_SIZE}`;
    let parsed;
    try {
      const json = await fetchJsonWithRetry(fetchImpl, url, { redirect: 'error', signal, sleep: pause });
      parsed = parseHireHivePage(json, who);
    } catch (err) {
      if (page === 1) {
        if (/** @type {any} */ (err)?.status === 404) {
          const gone = new Error(`hirehive: ${origin} answered 404 — no such HireHive tenant`);
          /** @type {any} */ (gone).status = 404;
          throw gone;
        }
        throw err;
      }
      // Nothing lost by stopping: a later-page failure keeps what a complete
      // first walk already collected (web-ui partials contract).
      console.error(`  ⚠ hirehive: ${who || origin} page ${page} failed (${/** @type {any} */ (err)?.message ?? err}) — keeping the ${seen.size} jobs collected so far`);
      break;
    }
    for (const job of parsed.jobs) {
      if (seen.has(job.url)) continue;
      seen.add(job.url);
      collected.push(job);
    }
    if (!parsed.hasNext || parsed.rawCount < PAGE_SIZE) break;
    if (page === pagesToFetch && !probing) stoppedAtCap = true;
  }
  if (stoppedAtCap) {
    console.warn(`hirehive: ${who || origin} has more than ${pagesToFetch * PAGE_SIZE} postings; raise max_pages on this entry`);
  }
  return collected.map(normalize);
}
