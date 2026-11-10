// @ts-check
/**
 * TurboHire source — single-company ATS adapter for `tracked_companies:`.
 * Ported from the parent's providers/turbohire.mjs (upstream #6712, CAR-254).
 *
 * Auto-detects a tenant careers site, `https://<tenant>.turbohire.co` (any
 * path, so a /job/publicjobs/<id> posting link resolves to its board).
 *
 * The careers page is a client-side app. This source makes the same three
 * zero-auth requests the page makes for every visitor, all to TurboHire's
 * API host:
 *
 *   1. GET  /api/token/noauth: the anonymous token the page fetches before
 *      anything else. It answers 403 "Invalid request." unless the request
 *      carries the careers page's Origin and Referer, which a visitor's
 *      browser sends with it, so this request sends the tenant's own origin.
 *      The later requests do not need them.
 *   2. GET  /api/publicorganizations?accountName=<tenant>: the tenant's org
 *      id. An unknown tenant answers 404. The id is cached per tenant (30
 *      days, the parent's provider-id-cache semantics) in a module Map, or
 *      the `idCache` opt when the caller supplies one.
 *   3. POST /api/careerpagev2/filteredjobs?orgId=<id>&pageType=0 with `{}`:
 *      every posting on the public careers page, in one response (no
 *      pagination), with the description inline.
 *
 * pageType 0 is the public careers page, the value the careers page itself
 * sends. The API takes other values for boards a visitor does not see; this
 * source never requests them.
 *
 * Deviations from the parent provider for the web-ui source contract: the
 * fetches go through the shared fetchJsonWithRetry (injected fetchImpl,
 * redirect:'error' default); the rows are normalized to the scanner's job
 * shape (id/source/date/…); a response holding fewer rows than its own
 * `Total` warns AND tags the result array `truncated` (the canonical
 * CAR-256 partial-board shape), so a silently cut response is never
 * presented as the whole board.
 *
 * Each row also names the recruiter who created the posting. Only the
 * fields mapped below are read, so nothing else from a row is kept.
 *
 * Used by the turbohire adapter (server/lib/portals/adapters/turbohire.mjs).
 */
import { fetchJsonWithRetry } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';

export const meta = {
  value: 'turbohire',
  label: 'TurboHire',
  region: 'en',
};

const API_ORIGIN = 'https://thapi.azurewebsites.net';
const PAGE_TYPE_CAREER_PAGE = 0;

export const TENANT_HOST_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.turbohire\.co$/;
// TurboHire's own hosts: the recruiter app, the reports API and the website.
const VENDOR_LABELS = new Set(['app', 'api', 'www']);
const ORG_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL_GUID = '00000000-0000-0000-0000-000000000000';
// What a row carries in ClientName when the posting hides its end employer.
const HIDDEN_CLIENT = '[REDACTED]';

// One coercion for ATS-native identifiers: a string or number, trimmed,
// empty treated as absent (absent beats wrong — parent _ids.mjs semantics).
/** @param {unknown} raw @returns {string|undefined} */
function coerceId(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const s = String(raw).trim();
  return s === '' ? undefined : s;
}

/**
 * The tenant subdomain and careers-site origin for an entry, or null.
 * @param {any} entry
 * @returns {{tenant: string, origin: string} | null}
 */
export function resolveTenant(entry) {
  for (const raw of [entry?.api, entry?.careers_url]) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    let parsed;
    try {
      parsed = new URL(raw.trim());
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:') continue;
    const m = parsed.hostname.match(TENANT_HOST_RE);
    if (!m || VENDOR_LABELS.has(m[1])) continue;
    return { tenant: m[1], origin: `https://${m[1]}.turbohire.co` };
  }
  return null;
}

/**
 * `https://<tenant>.turbohire.co/` from an entry, or null. The input's path,
 * query and port are never read (resolveTenant rebuilds the origin from the
 * tenant label).
 * @param {any} entry
 * @returns {string | null}
 */
export function resolveOrigin(entry) {
  const board = resolveTenant(entry);
  return board ? `${board.origin}/` : null;
}

/**
 * Defence-in-depth endpoint check: HTTPS on exactly a tenant host
 * (`<tenant>.turbohire.co`, never a vendor service label), default port
 * only. Runs on the endpoint the adapter resolved, before any request.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertTurbohireUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`turbohire: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`turbohire: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`turbohire: a non-default port is not allowed: ${url}`);
  const m = parsed.hostname.toLowerCase().match(TENANT_HOST_RE);
  if (!m || VENDOR_LABELS.has(m[1])) {
    throw new Error(`turbohire: untrusted hostname "${parsed.hostname}" — must be https://<tenant>.turbohire.co`);
  }
  return url;
}

/** @param {unknown} value @returns {boolean} */
function isOrgId(value) {
  return typeof value === 'string' && ORG_ID_RE.test(value) && value !== NIL_GUID;
}

/** @param {unknown} json @returns {string} */
function describeKeys(json) {
  if (json && typeof json === 'object' && !Array.isArray(json)) return `[${Object.keys(json).join(', ')}]`;
  return Array.isArray(json) ? 'an array' : typeof json;
}

/**
 * The URL path segment for a posting id. TurboHire ships the obfuscated id
 * already percent-encoded (a base64 `/` arrives as `%2F`) and puts it in the
 * link unchanged, so it is decoded once and re-encoded through the shared
 * helper, which gives back the same text. A malformed escape or a lone
 * surrogate cannot become a working link, so that posting is dropped (null).
 * @param {unknown} raw
 * @returns {string | null}
 */
export function postingSegment(raw) {
  const id = coerceId(raw);
  if (id === undefined) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    return null;
  }
  return safeEncodeURIComponent(decoded);
}

/**
 * Every listed site, joined with "; ". `Location` is a JSON string holding an
 * array of `{Address}` objects; an already-parsed array is accepted too.
 * @param {unknown} raw
 * @returns {string}
 */
export function jobLocation(raw) {
  let sites = raw;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return '';
    try {
      sites = JSON.parse(text);
    } catch {
      // Not JSON: a plain address string is still a location; broken JSON is not.
      return text.startsWith('[') || text.startsWith('{') ? '' : decodeEntities(text).replace(/\s+/g, ' ').trim();
    }
  }
  if (!Array.isArray(sites)) return '';
  /** @type {string[]} */
  const parts = [];
  for (const site of sites) {
    const address = site && typeof site === 'object' ? site.Address : undefined;
    if (typeof address !== 'string') continue;
    const label = decodeEntities(address).replace(/\s+/g, ' ').trim();
    if (label && !parts.includes(label)) parts.push(label);
  }
  return parts.join('; ');
}

/** @param {string} name @returns {string} */
function compactName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The employer a posting names. A group tenant can show the subsidiary that
 * is hiring (`ShowClientName`, `ClientName`); otherwise the entry's own
 * name. A client name that is only the entry's name spelled differently
 * ("TataMotors" for the "Tata Group" entry) keeps the entry's spelling.
 * @param {any} row
 * @param {string} fallback
 * @returns {string}
 */
export function employerName(row, fallback) {
  if (row?.ShowClientName === true && typeof row.ClientName === 'string') {
    const name = decodeEntities(row.ClientName).replace(/\s+/g, ' ').trim();
    const sameAsEntry = typeof fallback === 'string' && compactName(name) === compactName(fallback);
    if (name && name !== HIDDEN_CLIENT && !sameAsEntry) return name;
  }
  return fallback;
}

/**
 * `PublishedDate` is an ISO timestamp in UTC. `UpdatedDate` has no zone and
 * moves on every edit, so it is not read.
 * @param {any} row
 * @returns {number | undefined}
 */
function postedAtMs(row) {
  if (typeof row?.PublishedDate !== 'string' || !row.PublishedDate) return undefined;
  const parsed = Date.parse(row.PublishedDate);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse a `filteredjobs` response in the parent's row shape. Exported for
 * unit tests.
 *
 * `{Result: []}` is an empty board; any other envelope throws, so a silent
 * API change does not read as zero postings forever. A single malformed row
 * is dropped.
 *
 * @param {any} json
 * @param {string} companyName
 * @param {{tenant: string, origin: string}} board
 * @returns {Array<{title: string, url: string, company: string, location: string,
 *                    postedAt?: number, requisitionId?: string, description?: string}>}
 */
export function parseTurbohireResponse(json, companyName, board) {
  if (!json || typeof json !== 'object' || Array.isArray(json) || !Array.isArray(json.Result)) {
    throw new Error(`turbohire: unexpected response — expected a Result array, got: ${describeKeys(json)}`);
  }
  /** @type {Array<Record<string, any>>} */
  const jobs = [];
  const seen = new Set();
  for (const row of json.Result) {
    if (!row || typeof row !== 'object') continue;
    const title = typeof row.JobTitle === 'string' ? decodeEntities(row.JobTitle).replace(/\s+/g, ' ').trim() : '';
    const seg = postingSegment(row.JobIdObfuscated);
    if (!title || seg === null) continue;
    const url = `${board.origin}/job/publicjobs/${seg}`;
    if (seen.has(url)) continue;
    seen.add(url);
    /** @type {Record<string, any>} */
    const job = {
      title,
      url,
      company: employerName(row, companyName),
      location: jobLocation(row.Location),
    };
    const postedAt = postedAtMs(row);
    if (postedAt !== undefined) job.postedAt = postedAt;
    const requisitionId = coerceId(row.JobCode);
    if (requisitionId !== undefined) job.requisitionId = requisitionId;
    const description = htmlToText(row.JobDescV2);
    if (description) job.description = description;
    jobs.push(job);
  }
  return jobs;
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  return {
    id: `turbohire-${row.url}`,
    title: row.title,
    company: row.company,
    url: row.url,
    salary: '',
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: '',
    relocates: false,
    date: typeof row.postedAt === 'number' ? new Date(row.postedAt).toISOString() : '',
    snippet: row.description || '',
    ...(row.description ? { description: row.description } : {}),
    ...(row.requisitionId !== undefined ? { requisitionId: row.requisitionId } : {}),
    source: 'turbohire',
  };
}

// The parent keeps the org id in a persisted provider-id-cache between
// scans; web-ui has no such store, so the cache is a per-process Map with
// the same freshness rules (30 days), overridable per call via opts.idCache.
const DEFAULT_RECHECK_MS = 30 * 24 * 60 * 60 * 1000;
const defaultOrgCache = new Map();

/** Forget every cached TurboHire org id (tests). */
export function clearTurbohireOrgCache() {
  defaultOrgCache.clear();
}

/**
 * The parent's cachedLookup semantics: a cached value younger than
 * DEFAULT_RECHECK_MS is used without a request; a lookup that fails with an
 * error `isGone` accepts deletes the cached id and rethrows (the board is
 * gone); any other failure keeps the value already known.
 * @template T
 * @param {Map<string, any> | undefined} cache
 * @param {string} key
 * @param {() => Promise<T>} lookup
 * @param {{ isValid: (v: unknown) => boolean, isGone?: (err: any) => boolean }} opts
 * @returns {Promise<T>}
 */
async function cachedOrgId(cache, key, lookup, { isValid, isGone = () => false }) {
  const store = cache || defaultOrgCache;
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

/**
 * The anonymous token, requested with the careers page's Origin and Referer.
 * @param {Function} fetchImpl
 * @param {{tenant: string, origin: string}} board
 * @param {{ signal?: AbortSignal, sleep?: (ms: number) => Promise<void> }} io
 * @returns {Promise<string>}
 */
async function anonymousToken(fetchImpl, board, io) {
  const json = await fetchJsonWithRetry(fetchImpl, `${API_ORIGIN}/api/token/noauth`, {
    redirect: 'error',
    headers: { accept: 'application/json', origin: board.origin, referer: `${board.origin}/` },
    ...(io.signal ? { signal: io.signal } : {}),
    ...(io.sleep ? { sleep: io.sleep } : {}),
  });
  const token = /** @type {any} */ (json)?.access_token;
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error(`turbohire: the anonymous token request returned no access_token, got: ${describeKeys(json)}`);
  }
  return token.trim();
}

/**
 * The tenant's org id. A 404 means no such tenant: the error says so and
 * keeps its status, so the cached id is dropped.
 * @param {Function} fetchImpl
 * @param {{tenant: string, origin: string}} board
 * @param {string} token
 * @param {{ signal?: AbortSignal, sleep?: (ms: number) => Promise<void> }} io
 * @returns {Promise<string>}
 */
async function lookupOrgId(fetchImpl, board, token, io) {
  let json;
  try {
    json = await fetchJsonWithRetry(fetchImpl, `${API_ORIGIN}/api/publicorganizations?accountName=${board.tenant}`, {
      redirect: 'error',
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      ...(io.signal ? { signal: io.signal } : {}),
      ...(io.sleep ? { sleep: io.sleep } : {}),
    });
  } catch (err) {
    if (/** @type {any} */ (err)?.status === 404) {
      throw Object.assign(new Error(`turbohire: no TurboHire tenant "${board.tenant}" (the organization lookup answered 404)`), { status: 404 });
    }
    throw err;
  }
  const orgId = /** @type {any} */ (json)?.OrgID;
  if (!isOrgId(orgId)) {
    throw new Error(`turbohire: the organization lookup for "${board.tenant}" returned no org id, got: ${describeKeys(json)}`);
  }
  return orgId;
}

/**
 * Fetch + normalize one `<tenant>.turbohire.co` board: the anonymous token,
 * the cached org id, then one POST of the full public job list.
 *
 * @param {string} endpoint - the tenant careers origin (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any,
 *           idCache?: Map<string, any>, sleep?: (ms: number) => Promise<void>,
 *           maxPages?: number }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchTurbohire(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {}, idCache, sleep: sleepFn } = opts;
  assertTurbohireUrl(endpoint);
  const board = resolveTenant({ careers_url: endpoint });
  if (!board) {
    throw new Error(`turbohire: cannot derive a tenant for ${company?.name} — set careers_url to https://<tenant>.turbohire.co/`);
  }
  const who = String(company?.name ?? board.tenant);
  const io = { signal, sleep: sleepFn };
  const token = await anonymousToken(fetchImpl, board, io);
  const orgId = await cachedOrgId(idCache, board.tenant, () => lookupOrgId(fetchImpl, board, token, io), {
    isValid: isOrgId,
    isGone: (err) => err?.status === 404,
  });
  const json = await fetchJsonWithRetry(
    fetchImpl,
    `${API_ORIGIN}/api/careerpagev2/filteredjobs?orgId=${orgId}&pageType=${PAGE_TYPE_CAREER_PAGE}`,
    {
      method: 'POST',
      redirect: 'error',
      headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: '{}',
      ...(signal ? { signal } : {}),
      ...(sleepFn ? { sleep: sleepFn } : {}),
    },
  );
  const jobs = parseTurbohireResponse(json, company.name, board);
  const total = /** @type {any} */ (json).Total;
  let truncated = null;
  if (Number.isFinite(total) && total > jobs.length) {
    // CAR-256: a response cut below its own Total is a partial board — say so,
    // never present it as the whole one.
    console.error(`⚠️  turbohire: ${who} returned ${jobs.length} of ${total} postings in one response`);
    truncated = {
      reason: `the API returned ${jobs.length} of its own Total ${total} postings in one response`,
      fetched: jobs.length,
      total,
    };
  }
  const normalized = /** @type {any} */ (jobs.map(normalize));
  if (truncated) normalized.truncated = truncated;
  return normalized;
}
