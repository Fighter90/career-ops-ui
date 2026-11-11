// @ts-check
/**
 * Talentlink source — Lumesse TalentLink (Cornerstone) career sites read
 * through their FO REST API. Parent career-ops `providers/talentlink.mjs`
 * parity (upstream PR #6790, CAR-258). One employer per entry, so entries go
 * under `tracked_companies:`.
 *
 * Supported generation: the "FO widget" career page, served on a tenant
 * subdomain `https://{tenant}.recruitmentplatform.com/{site path}/index.html`,
 * or on an employer's own domain under any page name (explicit
 * `provider: talentlink` — branded domains are never auto-detected). The site
 * path differs per tenant (empty, `internal`, `FO/{code}/components`, ...).
 * The page, and each posting page of the site, is a static shell whose markup
 * names the FO API host and the site id, in one of two attribute sets:
 *   data-lumesse-fo-host="emea3.recruitmentplatform.com"
 *   data-lumesse-site-tech-id="ABCDE0123456789ABCDEFGHIJ"
 * or, on the accessible (WCAG) widget, with the scheme on the host:
 *   data-talentlink-fo-host="https://emea3.recruitmentplatform.com"
 *   data-talentlink-fo-site-tech-id="ABCDE0123456789ABCDEFGHIJ"
 * The widget then calls the FO REST API on that host with a fixed guest login
 * that every visitor's browser sends:
 *   headers  username: {siteId}:guest:FO, password: guest
 *   GET  https://{foHost}/fo/rest/config                  → navigationPages.jobDescriptionURL
 *   GET  https://{foHost}/fo/rest/jobs/criteria           → list names (location)
 *   POST https://{foHost}/fo/rest/jobs?firstResult=N&maxResults=100
 *        &sortBy=DPOSTINGSTART&sortOrder=desc  body {"searchCriteria":{}}
 *        → {globals: {jobsCount}, jobs: [{id, jobFields, customFields}]}, or
 *          {globals: {jobsCount: 0}} without `jobs` for an empty board
 * The API answers XML unless the request asks for JSON, so every call sends
 * `accept: application/json`.
 *
 * Left out: the older "syndicated" generation, a page that loads
 * `/syndicated/lay/jsoutputinitrapido.cfm` scripts from the shared host and has
 * no FO widget. fetch() names it in its error.
 *
 * Fields. The list columns are configured per tenant: the title is `jobTitle`;
 * location values sit in numbered list fields (`SLOVLIST{n}`) whose meaning
 * only the tenant's search criteria name (`LOV{n}.lovName`, "Location",
 * "Country", "Based at") tells. A list item can be bound to an item of another
 * list (a city to its country); a bound value missing from the row is
 * appended. `WorkMode` ("Remote", "Hybrid", "On-site") appends "Remote" /
 * "Hybrid" to the location string, which the row's isRemote/workplaceType
 * flags read. `language` is the locale of the posting's own apply link
 * (`langCode=de_DE` → `de-DE`); one posting has one language, so one job per
 * posting. `requisitionId` is `jobNumber`, the job reference the posting page
 * shows. `postedAt` is `DPOSTINGSTART`, present only when the tenant lists
 * that column. The description sections (`customFields`) come in the list
 * response.
 *
 * Posting URLs are `{jobDescriptionURL}?jobId={id}`. The config names that
 * page relative to the career page (`details.html`) or absolute on the career
 * page's own host (`https://careers.example.org/jobdescription.html`); a
 * value on any other host, or not https, falls back to `details.html` next to
 * the career page.
 *
 * The FO host, the site id and the posting page are cached per process (the
 * parent keeps them in its persisted provider-id-cache with the same
 * freshness rules — 30 days, overridable per call via the `idCache` opt), so
 * a scan reads the page and the config again only when the cached values are
 * old, and the board counts as gone when the page answers 404 / 410. The site
 * id belongs to one career site, not to the tenant: one tenant can run
 * several sites with different ids. When the FO API refuses the cached values
 * (403), they are dropped so the next scan reads the page again.
 *
 * Pagination: PAGE_SIZE rows per request, DEFAULT_MAX_PAGES unless the entry
 * sets `max_pages` (capped at MAX_PAGES_CAP). A short page or reaching
 * `jobsCount` ends the walk. A walk stopped by the page cap or by a failed
 * page marks the returned array with the canonical partial-read shape
 * (`markTruncated`, board-truncation.mjs) and warns.
 *
 * Failures: an unknown tenant subdomain answers 404. A tenant host answers
 * 403 for a path with no career page, and the FO API answers 403 for an
 * unknown site id; both are rethrown with status 404, since there is no board
 * there to authenticate to.
 *
 * Deviations from the parent provider for the web-ui source contract:
 *   - the fetches go through the shared fetchTextWithRetry /
 *     fetchJsonWithRetry (injected fetchImpl, redirect:'error'); the rows are
 *     normalized to the scanner's job shape (id/source/date/isRemote/…);
 *   - the parent's ctx.maxPages probe seam (verify-portals) is deliberately
 *     not ported — web-ui's adapter contract has no probe parameter (the
 *     apple full_board precedent, CAR-268); the portals health route probes
 *     careers_url by its own logic.
 *
 * Used by the talentlink adapter (server/lib/portals/adapters/talentlink.mjs).
 */
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText, DESCRIPTION_CAP } from '../html-to-text.mjs';
import { fetchJsonWithRetry, fetchTextWithRetry, delay } from '../http-json.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';
import { markTruncated } from '../board-truncation.mjs';

export const meta = {
  value: 'talentlink',
  label: 'TalentLink',
  region: 'en',
};

const PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 20; // 2000 postings
const MAX_PAGES_CAP = 200;
const INTER_PAGE_DELAY_MS = 250;
export const VENDOR_HOST_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.recruitmentplatform\.com$/;
const FO_HOST_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:recruitmentplatform|lumessetalentlink|sabatalentlink)\.com$/;
const SITE_ID_RE = /^[A-Z0-9]{10,40}$/;
const PATH_SEGMENT_RE = /^[A-Za-z0-9_-]{1,64}$/;
const PAGE_FILE_RE = /^[A-Za-z0-9_-]{1,64}\.html?$/;
const LOCATION_LIST_RE = /locat|countr|city|county|region|destination|based at|office|standort|\bland\b|\bort\b|pays|ville|lieu|sede|ubicaci|pa[ií]s|ciudad|citt[aà]|miasto|lokalizac/i;

/** @param {unknown} raw @returns {string|undefined} */
function coerceId(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const s = String(raw).trim();
  return s === '' ? undefined : s;
}

/**
 * Career page and directory for an entry. The host is rebuilt from the
 * hostname alone; the directory segments are checked against PATH_SEGMENT_RE
 * and the page file against PAGE_FILE_RE. A URL that names a page
 * (`index.html`, `details.html`, `jobsearch.html`) keeps it; a directory URL
 * gets `index.html`. The query is dropped.
 * @param {string} raw
 * @param {{vendorOnly?: boolean}} [opts]
 * @returns {{pageUrl: string, boardDir: string} | null}
 */
export function resolveBoard(raw, { vendorOnly = true } = {}) {
  if (typeof raw !== 'string' || !raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  if (vendorOnly && !VENDOR_HOST_RE.test(host)) return null;
  const segments = u.pathname.split('/').filter(Boolean);
  const file = segments.length && !u.pathname.endsWith('/') && segments[segments.length - 1].includes('.') ? segments.pop() : 'index.html';
  if (!PAGE_FILE_RE.test(file) || !segments.every((s) => PATH_SEGMENT_RE.test(s))) return null;
  const boardDir = `https://${host}/${segments.map((s) => `${s}/`).join('')}`;
  return { pageUrl: `${boardDir}${file}`, boardDir };
}

/**
 * Read the FO host and site id from a career page.
 * @param {string} html
 * @returns {{foHost: string, siteId: string}}
 */
export function parseBoardPage(html) {
  const text = typeof html === 'string' ? html : '';
  const host = text.match(/data-(?:lumesse|talentlink)-fo-host="([^"]*)"/);
  const site = text.match(/data-(?:lumesse-site|talentlink-fo-site)-tech-id="([^"]*)"/);
  if (!host || !site) {
    if (/\/syndicated\/lay\//.test(text)) {
      throw new Error('talentlink: this page uses the syndicated job list, which this provider does not read');
    }
    throw new Error('talentlink: no FO widget on the page (no FO host / site id attributes)');
  }
  const foHost = host[1].trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/$/, '');
  const siteId = site[1].trim();
  if (!FO_HOST_RE.test(foHost)) throw new Error(`talentlink: FO host "${foHost}" is not a TalentLink host`);
  if (!SITE_ID_RE.test(siteId)) throw new Error('talentlink: site id on the page has an unexpected format');
  return { foHost, siteId };
}

/**
 * Location lists from a criteria response: which `SLOVLIST{n}` fields hold a
 * location, and the values each list item is bound to.
 * @param {any} criteria
 * @returns {{fields: Set<string>, boundTo: Map<string, string[]>, boundTargets: Set<string>}}
 */
export function parseCriteria(criteria) {
  const fields = new Set();
  const boundTo = new Map();
  const boundTargets = new Set();
  if (!criteria || typeof criteria !== 'object') return { fields, boundTo, boundTargets };
  /** @type {Map<unknown, string>} */
  const labelByValue = new Map();
  const lists = Object.entries(criteria).filter(([, v]) => v && typeof v === 'object' && Array.isArray(v.items));
  for (const [, list] of lists) {
    for (const it of list.items) {
      if (it && typeof it.label === 'string') labelByValue.set(it.value, it.label.trim());
    }
  }
  for (const [key, list] of lists) {
    const m = key.match(/^LOV(\d+)$/);
    if (!m || typeof list.lovName !== 'string' || !LOCATION_LIST_RE.test(list.lovName)) continue;
    fields.add(`SLOVLIST${m[1]}`);
    for (const it of list.items) {
      if (!it || typeof it.label !== 'string' || !Array.isArray(it.bindTo)) continue;
      const targets = it.bindTo.map((v) => labelByValue.get(v)).filter((s) => typeof s === 'string' && s);
      if (!targets.length) continue;
      boundTo.set(it.label.trim().toLowerCase(), targets);
      for (const t of targets) boundTargets.add(t.toLowerCase());
    }
  }
  return { fields, boundTo, boundTargets };
}

/**
 * The posting page a site's config names, resolved against the career page.
 * @param {unknown} configured `navigationPages.jobDescriptionURL`
 * @param {{pageUrl: string, boardDir: string}} board
 * @returns {string}
 */
export function resolveDetailPage(configured, board) {
  const fallback = `${board.boardDir}details.html`;
  if (typeof configured !== 'string' || !configured.trim()) return fallback;
  let u;
  try {
    u = new URL(configured.trim(), board.boardDir);
  } catch {
    return fallback;
  }
  if (u.protocol !== 'https:' || u.hostname !== new URL(board.pageUrl).hostname) return fallback;
  const segments = u.pathname.split('/').filter(Boolean);
  const file = segments.pop() || '';
  if (!PAGE_FILE_RE.test(file) || !segments.every((s) => PATH_SEGMENT_RE.test(s))) return fallback;
  return `https://${u.hostname}/${segments.map((s) => `${s}/`).join('')}${file}`;
}

/** @param {unknown} v */
function isSiteValues(v) {
  if (typeof v !== 'string') return false;
  const [host, id, detail, extra] = v.split(' ');
  return extra === undefined && FO_HOST_RE.test(host || '') && SITE_ID_RE.test(id || '') && /^https:\/\/[^\s?#]+$/.test(detail || '');
}

/** @param {unknown} value */
function toEpochMs(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || !value) return undefined;
  const parsed = /^\d+$/.test(value) ? Number(value) : Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** @param {unknown} s */
function clean(s) {
  return typeof s === 'string' ? decodeEntities(s).replace(/\s+/g, ' ').trim() : '';
}

/**
 * @param {Record<string, any>} f
 * @param {ReturnType<typeof parseCriteria>} loc
 */
function buildLocation(f, loc) {
  const places = [];
  for (const key of Object.keys(f)) {
    if (!loc.fields.has(key)) continue;
    const v = clean(f[key]);
    if (v) places.push(v);
  }
  for (const v of [...places]) {
    for (const t of loc.boundTo.get(v.toLowerCase()) || []) places.push(t);
  }
  const seen = new Set();
  const unique = places.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // A value another value is bound to (a country) goes after the bound one.
  unique.sort((a, b) => Number(loc.boundTargets.has(a.toLowerCase())) - Number(loc.boundTargets.has(b.toLowerCase())));
  const parts = [unique.join(', ')].filter(Boolean);
  const modes = Array.isArray(f.WorkMode) ? f.WorkMode.map((m) => clean(m).toLowerCase()) : [];
  if (modes.includes('remote')) parts.push('Remote');
  if (modes.includes('hybrid')) parts.push('Hybrid');
  return parts.join(' · ');
}

/** @param {unknown} applicationUrl */
function languageOf(applicationUrl) {
  if (typeof applicationUrl !== 'string') return undefined;
  const m = applicationUrl.match(/[?&]langCode=([A-Za-z]{2,3})(?:_([A-Za-z0-9]{2,8}))?(?:&|$)/);
  if (!m) return undefined;
  return m[2] ? `${m[1].toLowerCase()}-${m[2].toUpperCase()}` : m[1].toLowerCase();
}

/** @param {unknown} customFields */
function descriptionOf(customFields) {
  if (!Array.isArray(customFields)) return undefined;
  const parts = [];
  for (const c of customFields) {
    if (!c || typeof c !== 'object') continue;
    const title = clean(c.title);
    const body = htmlToText(c.content, { cap: Infinity });
    if (!body) continue;
    parts.push(title ? `${title}: ${body}` : body);
  }
  const text = parts.join(' ').slice(0, DESCRIPTION_CAP).trim();
  return text || undefined;
}

/**
 * Normalize one page of the FO jobs response.
 * @param {any} json
 * @param {{detailPage: string, company: string, locations: ReturnType<typeof parseCriteria>}} opts
 * @returns {{jobs: {title: string, url: string, company: string, location: string,
 *                     externalId: string, postedAt?: number, requisitionId?: string,
 *                     language?: string, description?: string}[], rawCount: number, total: number | undefined}}
 */
export function parseJobsResponse(json, { detailPage, company, locations }) {
  // An empty board, and a page past the end, answer `{globals: {jobsCount: 0}}`
  // with no `jobs` key at all.
  const globals = json && typeof json === 'object' && json.globals && typeof json.globals === 'object' ? json.globals : null;
  const emptyBoard = globals && globals.jobsCount === 0 && json.jobs === undefined;
  const rows = emptyBoard ? [] : json && typeof json === 'object' && Array.isArray(json.jobs) ? json.jobs : null;
  if (!rows) {
    const got = json && typeof json === 'object' ? Object.keys(json).join(', ') : typeof json;
    throw new Error(`talentlink: unexpected response — expected jobs[], got: [${got}]`);
  }
  const totalRaw = globals && globals.jobsCount;
  const total = Number.isInteger(totalRaw) && totalRaw >= 0 ? totalRaw : undefined;
  const jobs = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const f = row.jobFields && typeof row.jobFields === 'object' ? row.jobFields : {};
    const id = row.id ?? f.id;
    if (!(Number.isInteger(id) || (typeof id === 'string' && /^\d+$/.test(id)))) continue;
    const seg = safeEncodeURIComponent(String(id));
    if (seg === null) continue;
    const title = clean(f.jobTitle);
    if (!title) continue;
    const job = {
      title,
      url: `${detailPage}?jobId=${seg}`,
      company,
      location: buildLocation(f, locations),
      externalId: String(id),
    };
    const postedAt = toEpochMs(f.DPOSTINGSTART);
    if (postedAt !== undefined) job.postedAt = postedAt;
    const req = coerceId(f.jobNumber);
    if (req) job.requisitionId = req;
    const language = languageOf(f.applicationUrl);
    if (language) job.language = language;
    const description = descriptionOf(row.customFields);
    if (description) job.description = description;
    jobs.push(job);
  }
  return { jobs, rawCount: rows.length, total };
}

/**
 * Resolve the page cap: a positive integer `max_pages` on the entry, capped at
 * MAX_PAGES_CAP; the default otherwise. Exported for unit tests.
 * @param {any} entry
 */
export function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/** @param {string} siteId */
function apiHeaders(siteId) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    username: `${siteId}:guest:FO`,
    password: 'guest',
  };
}

/**
 * A 403 from the tenant host or the FO API means "no board here".
 * @param {any} err
 * @param {string} message
 */
function as404(err, message) {
  if (!err || err.status !== 403) return err;
  const e = /** @type {any} */ (new Error(`${message} (HTTP 403)`));
  e.status = 404;
  e.cause = err;
  return e;
}

// The parent keeps the site pair in its persisted provider-id-cache; web-ui
// caches per process with the same freshness rules (30 days), overridable per
// call via opts.idCache.
const DEFAULT_RECHECK_MS = 30 * 24 * 60 * 60 * 1000;
const defaultSiteCache = new Map();

/** Forget every cached site pair (tests). */
export function clearTalentlinkSiteCache() {
  defaultSiteCache.clear();
}

/**
 * The parent's cachedLookup semantics (see turbohire.mjs for the full
 * contract): a cached value younger than DEFAULT_RECHECK_MS is used without a
 * request; an older one is looked up again; a gone error (404/410) deletes
 * the entry and rethrows; any other failure keeps the known value; without a
 * cache every call looks up.
 * @template T
 * @param {{ get: (key: string) => any, set: (key: string, value: any) => void, delete: (key: string) => void } | undefined} cache
 * @param {string} key
 * @param {() => Promise<T>} lookup
 * @param {{ isValid: (v: unknown) => boolean, isGone?: (err: any) => boolean }} opts
 * @returns {Promise<T>}
 */
async function cachedLookup(cache, key, lookup, { isValid, isGone = () => false }) {
  const store = cache || defaultSiteCache;
  const cached = store.get(key);
  const known = cached && isValid(cached.id) ? cached.id : undefined;
  const checkedAt = Date.parse(cached?.checkedAt ?? '');
  if (known !== undefined && Number.isFinite(checkedAt) && Date.now() - checkedAt < DEFAULT_RECHECK_MS) return known;
  let value;
  try {
    value = await lookup();
  } catch (err) {
    if (isGone(err)) {
      store.delete(key);
      throw err;
    }
    if (known !== undefined) return known;
    throw err;
  }
  store.set(key, { id: value, checkedAt: new Date().toISOString() });
  return value;
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  const isRemote = /remote|удал[её]н/i.test(`${row.title} ${row.location}`);
  return {
    id: `talentlink-${row.externalId}`,
    title: row.title,
    company: row.company,
    url: row.url,
    salary: '',
    location: row.location || '',
    isRemote,
    workplaceType: isRemote ? 'Remote' : (/hybrid/i.test(row.location) ? 'Hybrid' : ''),
    relocates: false,
    date: typeof row.postedAt === 'number' ? new Date(row.postedAt).toISOString().slice(0, 10) : '',
    snippet: '',
    ...(row.description ? { description: row.description } : {}),
    ...(row.requisitionId !== undefined ? { requisitionId: row.requisitionId } : {}),
    ...(row.language ? { language: row.language } : {}),
    externalId: row.externalId,
    source: 'talentlink',
  };
}

/**
 * Fetch + normalize the TalentLink board: read the career page for the FO
 * host + site id (cached), the config for the posting page, the search
 * criteria for the location lists, then walk the jobs list
 * PAGE_SIZE rows a request. A first-page failure throws (dead board ≠ empty
 * board, with 403s rethrown as 404 — there is no board there to authenticate
 * to); a mid-run blip keeps what's already collected and tags the board
 * partial (canonical `truncated` shape, board-truncation.mjs).
 *
 * @param {string} endpoint - the careers_url / api the adapter resolved (the
 *   source re-resolves and re-pins the board from it)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           sleep?: (ms: number) => Promise<void>,
 *           idCache?: { get: Function, set: Function, delete: Function } }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchTalentlink(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const entry = company ?? {};
  const explicit = entry?.provider === 'talentlink';
  // api takes priority over careers_url (parent parity); the endpoint the
  // adapter passed is the same value, kept for the contract's sake.
  const raw = [typeof endpoint === 'string' ? endpoint : undefined, entry?.api, entry?.careers_url]
    .find((v) => typeof v === 'string' && resolveBoard(v, { vendorOnly: !explicit }));
  const board = raw ? resolveBoard(raw, { vendorOnly: !explicit }) : null;
  if (!board) throw new Error(`talentlink: no https TalentLink career page URL for ${entry?.name}`);

  const sleep = opts.sleep || ((ms) => delay(ms, signal));

  const lookupPage = async () => {
    let html;
    try {
      html = await fetchTextWithRetry(fetchImpl, board.pageUrl, {
        signal,
        redirect: 'error',
        headers: { accept: 'text/html' },
      });
    } catch (err) {
      throw as404(err, `talentlink: no career page at ${board.pageUrl}`);
    }
    const { foHost, siteId } = parseBoardPage(html);
    let config;
    try {
      config = await fetchJsonWithRetry(fetchImpl, `https://${foHost}/fo/rest/config`, {
        signal,
        redirect: 'error',
        headers: apiHeaders(siteId),
      });
    } catch (err) {
      throw as404(err, `talentlink: site id not recognised by ${foHost}`);
    }
    const detailPage = resolveDetailPage(/** @type {any} */ (config)?.navigationPages?.jobDescriptionURL, board);
    return `${foHost} ${siteId} ${detailPage}`;
  };
  const values = await cachedLookup(opts.idCache, board.pageUrl, lookupPage, {
    isValid: isSiteValues,
    isGone: (err) => err?.status === 404 || err?.status === 410,
  });
  const [foHost, siteId, detailPage] = values.split(' ');
  const api = `https://${foHost}/fo/rest`;
  const headers = apiHeaders(siteId);

  // Location list names: one request, no postings.
  let locations = parseCriteria(null);
  try {
    locations = parseCriteria(await fetchJsonWithRetry(fetchImpl, `${api}/jobs/criteria`, {
      signal,
      redirect: 'error',
      headers,
    }));
  } catch (err) {
    console.warn(`talentlink: search criteria unavailable for ${entry.name} — locations left empty (${/** @type {any} */ (err)?.message})`);
  }

  const maxPages = resolveMaxPages(entry);
  /** @type {any[]} */
  const jobs = [];
  const seen = new Set();
  /** @type {'complete'|'cap'|'fetch-error'} */
  let stopReason = 'complete';
  let lastRaw = 0;
  let total;
  let page = 0;
  for (; page < maxPages; page++) {
    if (page > 0) await sleep(INTER_PAGE_DELAY_MS);
    const url = `${api}/jobs?firstResult=${page * PAGE_SIZE}&maxResults=${PAGE_SIZE}&sortBy=DPOSTINGSTART&sortOrder=desc`;
    let json;
    try {
      json = await fetchJsonWithRetry(fetchImpl, url, {
        method: 'POST',
        body: JSON.stringify({ searchCriteria: {} }),
        signal,
        redirect: 'error',
        headers,
      });
    } catch (err) {
      if (page === 0) {
        if (/** @type {any} */ (err)?.status === 403) (opts.idCache || defaultSiteCache).delete(board.pageUrl);
        throw as404(err, `talentlink: site id not recognised by ${foHost}`);
      }
      console.warn(`talentlink: page ${page + 1} failed for ${entry.name} — keeping ${jobs.length} postings from earlier pages (${/** @type {any} */ (err)?.message})`);
      stopReason = 'fetch-error';
      break;
    }
    const parsed = parseJobsResponse(json, { detailPage, company: entry.name, locations });
    // A past-the-end page reports jobsCount 0, so only a positive count bounds the walk.
    if (page === 0 && parsed.total) total = parsed.total;
    lastRaw = parsed.rawCount;
    for (const job of parsed.jobs) {
      if (seen.has(job.url)) continue;
      seen.add(job.url);
      jobs.push(job);
    }
    if (parsed.rawCount < PAGE_SIZE) break;
    if (total !== undefined && (page + 1) * PAGE_SIZE >= total) break;
  }
  if (stopReason === 'complete' && page >= maxPages && lastRaw >= PAGE_SIZE && (total === undefined || maxPages * PAGE_SIZE < total)) {
    stopReason = 'cap';
  }
  if (stopReason === 'cap') {
    console.error(`⚠️  talentlink: stopped at ${maxPages} pages for ${entry.name}${total !== undefined ? ` (${total} postings listed)` : ''} — raise max_pages on this entry`);
  }
  const rows = jobs.map((job) => normalize(job));
  // A partly read board says so in the return value, so the scan reports it
  // `partial` instead of presenting the cut prefix as the whole one
  // (board-truncation.mjs).
  if (stopReason !== 'complete') {
    markTruncated(rows, stopReason === 'cap' ? 'page-cap' : 'fetch-error', {
      fetched: rows.length,
      ...(total !== undefined ? { total } : {}),
    });
  }
  return rows;
}
