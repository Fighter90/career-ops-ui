// @ts-check
/**
 * HiBob source — the careers sites the HR platform's "Bob" hiring module hosts
 * for each customer, one tenant per `tracked_companies:` entry. Ported from
 * the parent's providers/hibob.mjs (upstream #6502).
 *
 *   tracked_companies:
 *     - name: Acme
 *       careers_url: https://acme.careers.hibob.com/jobs
 *
 * A tenant is one label under `careers.hibob.com`. Some labels carry a suffix
 * HiBob adds (`acme-641e1b39232b`); the label is used exactly as the host
 * shows it. Any path on the tenant host is claimed, so a posting link
 * (`/jobs/<uuid>`) or an apply link (`/jobs/<uuid>/apply`) resolves to the
 * board it belongs to as well as the board root.
 *
 * The board page is a single-page app shell. The app reads every posting from
 * one JSON endpoint on the tenant host:
 *
 *   GET https://<tenant>.careers.hibob.com/api/job-ad
 *   companyidentifier: <tenant>
 *
 * The `companyidentifier` header names the tenant (the request is refused
 * without it) and is the tenant label in lower case, the same value the app
 * sends. No cookie, token or login is involved. The answer is
 * `{ filterGroups, jobAdDetails: [...], jobOpeningMetadata }` — every posting
 * in `jobAdDetails`, no pagination (the page renders the list in a virtual
 * scroll over that one array). Each posting carries its full text
 * (description, responsibilities, requirements, benefits), so one request
 * also fills `description` (capped via the shared htmlToText).
 *
 * A posting may carry a pay range (`payTransparencyMinSalary`,
 * `payTransparencyMaxSalary`, `payTransparencySalaryCurrency`,
 * `payTransparencySalaryPayPeriod`); the page shows it as
 * "48,000 – 55,000 EUR Annual". It becomes a salary only when the period is
 * `Annual`, the one value seen on the tenants read; any other period leaves
 * it off rather than guess a multiplier. A bound of 0 means "not set".
 *
 * A label that is not a tenant answers 401 with an HTML error page; that is
 * reported as a 404 ("no such careers site") so dead-board handling reads it
 * as a missing board rather than an auth wall. The message avoids the word
 * "network" on purpose: a tenant label may contain it, and a label must never
 * read as a network failure.
 *
 * Deviations from the parent provider for the web-ui source contract: the
 * fetch goes through the shared fetchJsonWithRetry (injected fetchImpl,
 * redirect:'error' default; the web-ui transport has no per-body byte cap —
 * the DESCRIPTION_CAP keeps snippets bounded); the rows are normalized to
 * the scanner's job shape (id/source/date/…); a malformed 200 throws
 * (_shape.mjs semantics — never an empty board).
 */
import { fetchJsonWithRetry } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';
import { requireObject, requireArray } from './_shape.mjs';

export const meta = {
  value: 'hibob',
  label: 'HiBob',
  region: 'en',
};

export const HIBOB_CAREERS_SUFFIX = '.careers.hibob.com';
export const TENANT_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * The tenant label of a HiBob careers URL, or null when the URL is not one.
 * Only the hostname is read; the path, query and port are ignored.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function resolveHibobTenant(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith(HIBOB_CAREERS_SUFFIX)) return null;
  const tenant = host.slice(0, -HIBOB_CAREERS_SUFFIX.length);
  return TENANT_LABEL_RE.test(tenant) ? tenant : null;
}

/** @param {{ api?: unknown, careers_url?: unknown } | null | undefined} entry */
export function resolveTenant(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return resolveHibobTenant(entry.api) || resolveHibobTenant(entry.careers_url);
}

/** The canonical API endpoint for one tenant label (the adapter's shape). */
export function apiOriginFor(tenant) {
  return `https://${tenant}${HIBOB_CAREERS_SUFFIX}/api/job-ad`;
}

/**
 * Defence-in-depth endpoint check: HTTPS on exactly a tenant host
 * (`<tenant>.careers.hibob.com`), default port only. Runs on the endpoint the
 * adapter resolved, before any request.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertHibobUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`hibob: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`hibob: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`hibob: a non-default port is not allowed: ${url}`);
  if (!resolveHibobTenant(url)) {
    throw new Error(`hibob: untrusted hostname "${parsed.hostname}" — must be https://<tenant>.careers.hibob.com`);
  }
  return url;
}

/** @param {unknown} value */
function toEpochMs(value) {
  if (typeof value !== 'string' || !value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** @param {unknown} value */
function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Annual salary of a posting, or null when it states no usable figure.
 * A one-sided range fills the other bound from it, like `ashby.mjs`.
 * @param {any} row
 * @returns {{min: number, max: number, currency: string} | null}
 */
export function parseHibobSalary(row) {
  if (str(row?.payTransparencySalaryPayPeriod).toLowerCase() !== 'annual') return null;
  /** @param {unknown} v */
  const amount = (v) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const min = amount(row.payTransparencyMinSalary);
  const max = amount(row.payTransparencyMaxSalary);
  if (min == null && max == null) return null;
  const low = /** @type {number} */ (min ?? max);
  const high = /** @type {number} */ (max ?? min);
  return { min: Math.min(low, high), max: Math.max(low, high), currency: str(row.payTransparencySalaryCurrency).toUpperCase() };
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
 * "<site>, <country>", with the country left out when the site name already
 * contains it, and "Remote" added for a remote posting whose site does not
 * say so.
 * @param {any} row
 */
export function locationOf(row) {
  const site = str(row.site);
  const country = str(row.country);
  const parts = [site];
  if (country && !site.toLowerCase().includes(country.toLowerCase())) parts.push(country);
  if (str(row.workspaceTypeId) === 'remote' && !/\bremote\b/i.test(site)) parts.push('Remote');
  return parts.filter(Boolean).join(', ');
}

/**
 * Parses an `/api/job-ad` answer. Exported for unit tests.
 *
 * Throws when `jobAdDetails` is not an array (the envelope changed — a
 * malformed 200 never reads as an empty board); an empty array is an empty
 * board. A row without a title or a usable id is skipped.
 *
 * @param {any} json
 * @param {string} origin - `https://<tenant>.careers.hibob.com`
 * @param {string} company
 * @returns {Array<{title: string, url: string, company: string, location: string,
 *   postedAt?: number, language?: string, salary?: object, description?: string}>}
 */
export function parseHibobJobAds(json, origin, company) {
  const body = requireObject(json, 'hibob job-ad response');
  const rows = requireArray(body.jobAdDetails, 'hibob jobAdDetails');
  const jobs = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const title = str(row.title);
    const id = str(row.id);
    if (!title || !id) continue;
    // A lone surrogate in a host-controlled id must drop the one posting,
    // never abort the loop and lose the board.
    const seg = safeEncodeURIComponent(id);
    if (seg === null) continue;
    /** @type {{title: string, url: string, company: string, location: string, postedAt?: number, language?: string, salary?: object, description?: string}} */
    const job = { title, url: `${origin}/jobs/${seg}`, company, location: locationOf(row) };
    const postedAt = toEpochMs(row.publishedAt);
    if (postedAt !== undefined) job.postedAt = postedAt;
    const language = str(row.language);
    if (language) job.language = language;
    const salary = parseHibobSalary(row);
    if (salary) job.salary = salary;
    const description = htmlToText(
      ['description', 'responsibilities', 'requirements', 'benefits']
        .map((key) => (typeof row[key] === 'string' ? row[key] : ''))
        .filter(Boolean)
        .join('<br>'),
    );
    if (description) job.description = description;
    jobs.push(job);
  }
  return jobs;
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  return {
    id: `hibob-${row.url}`,
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
    source: 'hibob',
  };
}

/**
 * Fetch + normalize one HiBob tenant board (one request for the whole board).
 * The origin is rebuilt from the tenant label alone, so no path or port from
 * the entry reaches the request; the endpoint is re-validated first
 * (assertHibobUrl). A 401 — an unknown tenant label — is reported as a
 * missing board (status 404), never as an auth wall or network failure.
 *
 * @param {string} endpoint - the tenant URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchHibob(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company, sleep: sleepFn } = opts;
  // Host allowlist before any request (SSRF guard).
  assertHibobUrl(endpoint);
  signal?.throwIfAborted();
  const tenant = resolveHibobTenant(endpoint);
  if (!tenant) {
    throw new Error(`hibob: ${company?.name ?? 'entry'} is not a HiBob careers site (https://<tenant>.careers.hibob.com)`);
  }
  const origin = `https://${tenant}${HIBOB_CAREERS_SUFFIX}`;
  let json;
  try {
    json = await fetchJsonWithRetry(fetchImpl, `${origin}/api/job-ad`, {
      redirect: 'error',
      headers: { accept: 'application/json', companyidentifier: tenant },
      signal,
      // Injectable for tests: a suite skips the retry backoff's wall clock.
      sleep: sleepFn,
    });
  } catch (err) {
    if (/** @type {any} */ (err)?.status === 401) {
      // The message leaves out the tenant label: a label may contain the word
      // "network", which would read as a network failure downstream.
      const gone = /** @type {Error & { status?: number }} */ (
        new Error('hibob: not a HiBob careers site (HTTP 401) — check the tenant label in careers_url')
      );
      gone.status = 404;
      throw gone;
    }
    throw err;
  }
  return parseHibobJobAds(json, origin, String(company?.name ?? '')).map(normalize);
}
