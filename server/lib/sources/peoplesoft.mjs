// @ts-check
// TODO: split by concern (HTML extraction vs session transport) — 400–800 LOC band.
/**
 * PeopleSoft Fluid Candidate Gateway source (public, no-auth; live upstream
 * 2026-09: recruit.uwo.ca, careers.torontomu.ca, hr.mcmaster.ca, wsib.ca).
 * Ported from parent career-ops `providers/peoplesoft.mjs`. NO REST API: a
 * stateful HTML app (PeopleTools ICAJAX postbacks) needing a cookie session
 * across GET → POST → GET, scraped by stable element ids (no DOM parser).
 *
 * ── Detection ─────────────────────────────────────────────────────────────
 * Every tenant runs on its own branded domain, so a hostname can never be the
 * signal. The URL PATH is: the Fluid job-search page always lives at
 *   /psc/{site}/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL
 * ({site} = the tenant's PeopleSoft site segment, e.g. "uwo1"). That component
 * name is a PeopleTools implementation signature, not a brand guess.
 *
 * ── Flow ──────────────────────────────────────────────────────────────────
 *   1. GET  {search}?Page=HRS_APP_SCHJOB_FL&Action=U&FOCUS=Applicant&SiteId=1
 *      Sets the session cookies; the HTML's `form[name="win0"]` carries the
 *      full postback state.
 *   2. "Load more" is a POST replay of EVERY `win0` field with
 *      `ICAction=HRS_AGNT_RSLT_I$hdown$0`, to the form's own action URL,
 *      same cookies; rows are deduped by job-opening id across pages.
 *   3. (opt-in) GET {search}?Page=HRS_APP_JBPST_FL&…&JobOpeningId=&PostingSeq=
 *      for the description. PostingSeq=1 first, then 2 — a dead PostingSeq can
 *      land on an UNRELATED posting, so the returned id must match.
 *
 * ── The most important correctness rule ───────────────────────────────────
 * A response with no `form[name="win0"]` is NOT "zero postings" — it is a
 * login / session-expired / WAF challenge page. parseSearchPage() reports it
 * as `valid:false`, and the fetcher THROWS on page one instead of returning [].
 *
 * ── Transport and SSRF (web-ui divergence from the parent) ────────────────
 * The web-ui helpers in http-json.mjs default to `redirect:'error'`, and
 * `fetchResponse` throws on any non-2xx without exposing `Location` or the
 * 3xx hop's Set-Cookie. PeopleSoft's portal bootstrap answers even the
 * correct URL with one or more SAME-ORIGIN 302s that set PSJSESSIONID, so
 * `redirect:'error'` would fail every real tenant. This module therefore
 * calls the injected `fetchImpl` directly with `redirect:'manual'` and follows
 * redirects itself, re-validating EVERY hop with assertPeoplesoftUrl() —
 * HTTPS, exact tenant origin, no private/loopback literal — and throwing the
 * moment a hop leaves the origin (at most MAX_REDIRECTS hops). No host
 * allowlist is possible (self-hosted, per-institution domains, same reason as
 * successfactors' branded RMK hosts); origin pinning is the guard.
 * safe-fetch.mjs (DNS-pinned connections) is not used: it is GET-only and
 * returns no response headers, so it can neither POST the replay nor carry
 * the cookie jar. Known limitation: the per-request DNS check below
 * (guardResolvedHost) is a lookup-then-connect check, so it narrows but does
 * not close a DNS-rebinding TOCTOU window the way safe-fetch's pinning does.
 *
 * Used by the peoplesoft adapter (server/lib/portals/adapters/peoplesoft.mjs).
 */
import { promises as dns } from 'node:dns';
import { BROWSER_LIKE_USER_AGENT, withPinnedEncoding, computeRetryDelayMs, delay } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText, DESCRIPTION_CAP } from '../html-to-text.mjs';
import { isPrivateOrLoopbackHost } from '../security.mjs';

export const meta = {
  value: 'peoplesoft',
  label: 'PeopleSoft Candidate Gateway',
  region: 'en',
};

// The Fluid search page's fixed path. Capture 1 = {site}, used to rebuild every
// other URL — never trusted from anywhere else in the input URL.
export const PS_SEARCH_PATH_RE = /^\/psc\/([^/]+)\/EMPLOYEE\/HRMS\/c\/HRS_HRAM_FL\.HRS_CG_SEARCH_FL\.GBL$/i;

const SEARCH_PAGE_PARAM = 'HRS_APP_SCHJOB_FL';
const DETAIL_PAGE_PARAM = 'HRS_APP_JBPST_FL';
/** The fixed "load more results" ICAction literal. */
export const LOAD_MORE_ACTION = 'HRS_AGNT_RSLT_I$hdown$0';

// Absolute ceiling on load-more POSTs, independent of max_pages and of any
// page-reported total — a tampered response can't make an unbounded POST loop.
export const DEFAULT_MAX_LOAD_MORE = 20; // PeopleSoft's own anonymous cap is ~100 results
export const MAX_LOAD_MORE_CAP = 100;
export const DEFAULT_DETAIL_LIMIT = 25;
export const MAX_REDIRECTS = 10; // bound on PeopleSoft's own bootstrap bounces
const INTER_REQUEST_DELAY_MS = 300; // polite pacing between hops on one tenant
const RETRY_POLICY = { retries: 2, baseDelayMs: 500, maxDelayMs: 8000 };

// Fluid serves degraded/legacy markup to a bare default UA on some tenants.
const BASE_HEADERS = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml',
};

const REMOTE_RE = /\bremote\b/i;

// ── Config / URLs ─────────────────────────────────────────────────────────

/**
 * Resolve a portal entry to a PeopleSoft tenant config, or null. `api:` wins
 * over `careers_url`. HTTPS only; the anchored path signature is required;
 * a private/loopback literal host is refused. Never throws.
 * @param {any} company
 * @returns {{origin: string, site: string, searchUrl: string} | null}
 */
export function resolveConfig(company) {
  for (const raw of [company?.api, company?.careers_url]) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    let u;
    try {
      u = new URL(raw.trim());
    } catch {
      continue;
    }
    if (u.protocol !== 'https:' || !u.hostname) continue;
    if (isPrivateOrLoopbackHost(u.hostname)) continue;
    const m = u.pathname.match(PS_SEARCH_PATH_RE);
    if (!m) continue;
    const site = m[1];
    return { origin: u.origin, site, searchUrl: buildSearchUrl(u.origin, site) };
  }
  return null;
}

/** @param {string} origin @param {string} site */
export function buildSearchUrl(origin, site) {
  const u = new URL(`${origin}/psc/${site}/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL`);
  u.searchParams.set('Page', SEARCH_PAGE_PARAM);
  u.searchParams.set('Action', 'U');
  u.searchParams.set('FOCUS', 'Applicant');
  u.searchParams.set('SiteId', '1');
  return u.href;
}

/**
 * @param {{origin: string, site: string}} config
 * @param {string} jobId
 * @param {number} postingSeq
 */
export function buildDetailUrl(config, jobId, postingSeq) {
  const u = new URL(`${config.origin}/psc/${config.site}/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL`);
  u.searchParams.set('Page', DETAIL_PAGE_PARAM);
  u.searchParams.set('Action', 'U');
  u.searchParams.set('FOCUS', 'Applicant');
  u.searchParams.set('JobOpeningId', jobId);
  u.searchParams.set('PostingSeq', String(postingSeq));
  u.searchParams.set('SiteId', '1');
  return u.href;
}

/**
 * SSRF guard for every URL this source fetches: HTTPS, and EXACTLY the
 * resolved tenant origin (the load-more form action and every redirect
 * Location are page-controlled). Pass no config to check HTTPS + a public
 * literal host only (used on the adapter-built endpoint).
 * @param {string} url @param {{origin: string}} [config]
 */
export function assertPeoplesoftUrl(url, config) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`peoplesoft: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`peoplesoft: URL must use HTTPS: ${url}`);
  if (!parsed.hostname) throw new Error(`peoplesoft: URL has no hostname: ${url}`);
  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    throw new Error(`peoplesoft: refusing private/loopback host "${parsed.hostname}"`);
  }
  if (config && parsed.origin !== config.origin) {
    throw new Error(`peoplesoft: untrusted origin "${parsed.origin}" — must be ${config.origin}`);
  }
  return url;
}

// ── Cookie jar ────────────────────────────────────────────────────────────
// csod.mjs replays one bootstrap Set-Cookie verbatim; PeopleSoft can ROTATE
// its session cookie across GET → POST → GET, so cookies are merged after
// every hop (last value per name wins, like a browser jar).

/** @returns {Map<string, string>} */
export function createCookieJar() {
  return new Map();
}

/**
 * Merge Set-Cookie values into the jar. Only the leading name=value pair is
 * kept (attributes are browser-storage rules). Junk entries are ignored.
 * @param {Map<string, string>} jar @param {unknown} setCookies
 */
export function updateCookieJar(jar, setCookies) {
  for (const raw of Array.isArray(setCookies) ? setCookies : []) {
    if (typeof raw !== 'string') continue;
    const pair = raw.split(';', 1)[0].trim();
    const eq = pair.indexOf('=');
    if (eq <= 0) continue; // no '=', or an empty name — not a cookie
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return jar;
}

/** @param {Map<string, string>} jar @returns {string} */
export function cookieHeader(jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

/**
 * Every Set-Cookie on a response. getSetCookie() keeps each header separate
 * (Node ≥ 18.14); the fallback splits a joined value only at a comma that
 * starts a new `name=` pair, so an `Expires=Wed, 21 Oct …` date survives.
 * @param {any} headers
 * @returns {string[]}
 */
export function readSetCookies(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const joined = typeof headers.get === 'function' ? headers.get('set-cookie') : null;
  if (typeof joined !== 'string' || !joined) return [];
  return joined.split(/,(?=\s*[^;,=\s]+=)/).map((s) => s.trim()).filter(Boolean);
}

// ── id-anchored HTML extraction (no DOM parser dependency) ────────────────

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Raw inner HTML of the first element carrying `id="{id}"`, tag-agnostic,
 * tracking nested same-tag depth. PeopleSoft was observed live emitting ids
 * UNQUOTED (`id=HRS_SCH_PSTDSC_DESCRLONG$0 >`), so quoted and unquoted forms
 * both match. null when absent or when no close tag exists (never guess);
 * '' for a self-closing tag.
 * @param {string} html @param {string} id
 * @returns {string | null}
 */
export function extractById(html, id) {
  const str = String(html);
  const idEsc = escapeRegExp(id);
  const idAttrRe = new RegExp(`\\bid=(?:"${idEsc}"|'${idEsc}'|${idEsc}(?=[\\s>]))`);
  const idMatch = idAttrRe.exec(str);
  if (!idMatch) return null;
  const idPos = idMatch.index;
  const tagStart = str.lastIndexOf('<', idPos);
  if (tagStart === -1) return null;
  const tagOpenEnd = str.indexOf('>', idPos);
  if (tagOpenEnd === -1) return null;
  const tagNameMatch = str.slice(tagStart + 1, tagStart + 40).match(/^([a-zA-Z][a-zA-Z0-9]*)/);
  if (!tagNameMatch) return null;
  const tagName = tagNameMatch[1];
  if (str[tagOpenEnd - 1] === '/') return ''; // <input … id="x" />
  const tagRe = new RegExp(`<${tagName}\\b[^>]*>|</${tagName}\\s*>`, 'gi');
  tagRe.lastIndex = tagOpenEnd + 1;
  let depth = 1;
  let m;
  while ((m = tagRe.exec(str))) {
    if (m[0][1] === '/') {
      depth--;
      if (depth === 0) return str.slice(tagOpenEnd + 1, m.index);
    } else {
      depth++;
    }
  }
  return null;
}

/** extractById() + strip tags + decode entities + collapse whitespace. */
export function extractTextById(html, id) {
  const raw = extractById(html, id);
  if (raw === null) return null;
  return decodeEntities(raw.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Attribute tokenizer for one tag; boolean attributes come back `true`. */
function parseAttrs(attrString) {
  /** @type {Record<string, string | true>} */
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|[^\s"'>]+))?/g;
  let m;
  while ((m = re.exec(attrString))) {
    const name = m[1].toLowerCase();
    out[name] = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[2] !== undefined ? m[2] : true;
  }
  return out;
}

/**
 * `form[name="win0"]` state: every input/select/textarea name→value plus the
 * form's `action`. The ICAJAX replay needs the FULL state, not just the fields
 * this module reads. Unchecked checkboxes/radios are omitted (browser rule).
 * @param {string} html
 * @returns {{ action: string | null, fields: Record<string, string> } | null}
 */
export function parseFormState(html) {
  const str = String(html);
  const openMatch = /<form\b[^>]*\bname=["']win0["'][^>]*>/i.exec(str);
  if (!openMatch) return null;
  const closeIdx = str.toLowerCase().indexOf('</form>', openMatch.index);
  const formHtml = closeIdx === -1 ? str.slice(openMatch.index) : str.slice(openMatch.index, closeIdx);
  const actionMatch = /\baction=["']([^"']*)["']/i.exec(openMatch[0]);

  /** @type {Record<string, string>} */
  const fields = {};
  for (const m of formHtml.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = parseAttrs(m[1]);
    if (typeof attrs.name !== 'string' || !attrs.name) continue;
    const type = typeof attrs.type === 'string' ? attrs.type.toLowerCase() : 'text';
    if ((type === 'checkbox' || type === 'radio') && attrs.checked === undefined) continue;
    fields[decodeEntities(attrs.name)] = decodeEntities(typeof attrs.value === 'string' ? attrs.value : '');
  }
  for (const m of formHtml.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const attrs = parseAttrs(m[1]);
    if (typeof attrs.name !== 'string' || !attrs.name) continue;
    const optMatch = /<option\b([^>]*)\bselected\b[^>]*>/i.exec(m[2]) || /<option\b([^>]*)>/i.exec(m[2]);
    const optAttrs = optMatch ? parseAttrs(optMatch[1]) : {};
    fields[decodeEntities(attrs.name)] = decodeEntities(typeof optAttrs.value === 'string' ? optAttrs.value : '');
  }
  for (const m of formHtml.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi)) {
    const attrs = parseAttrs(m[1]);
    if (typeof attrs.name !== 'string' || !attrs.name) continue;
    fields[decodeEntities(attrs.name)] = decodeEntities(m[2]);
  }
  return { action: actionMatch ? decodeEntities(actionMatch[1]) : null, fields };
}

// ── Search-page parsing ───────────────────────────────────────────────────

/**
 * Total from the result counter. Locale-grouped digits ("1.234", "1 234",
 * "1,234") are joined first; "of N" wins; otherwise the LAST integer, since
 * localized counters are position-first ("Ligne 1 sur 96", "Zeile 1 von 96").
 * @param {string | null | undefined} text
 */
export function parseReportedTotal(text) {
  if (!text) return null;
  const normalized = String(text).replace(/(\d)[\s .,](?=\d{3}(?:\D|$))/g, '$1');
  const ofMatch = normalized.match(/of\s+(\d+)/i);
  if (ofMatch) return Number(ofMatch[1]);
  const numbers = normalized.match(/\d+/g);
  return numbers ? Number(numbers[numbers.length - 1]) : null;
}

/**
 * SCH_OPENED is US M/D/YYYY on every tenant observed. Anything else → undefined
 * (never guess a format); out-of-range / rolled-over dates (4/31) rejected.
 * @param {unknown} raw @returns {number | undefined}
 */
export function parsePeopleSoftDate(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const ms = Date.UTC(year, month - 1, day);
  if (new Date(ms).getUTCDate() !== day) return undefined;
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * Parse one search-results response. `valid:false` when `form[name="win0"]` is
 * absent (login / session-expired / challenge — NEVER zero postings);
 * `valid:true, rows:[]` is the genuine "alive, no matches" case. Row fields use
 * PeopleTools' `{field}$N` grid-instance ids (verified live). jobId + title are
 * required per row; location / department / date are tenant-configurable
 * columns and optional.
 * @param {string} html
 */
export function parseSearchPage(html) {
  const str = String(html);
  if (!/<form\b[^>]*\bname=["']win0["']/i.test(str)) {
    return { valid: false, errorReason: 'unexpected-page', rows: [], reportedTotal: null, formAction: null, formFields: {} };
  }
  const formState = parseFormState(str) || { action: null, fields: {} };
  const reportedTotal = parseReportedTotal(extractTextById(str, 'win0divHRS_AGNT_RSLT_Irowcnt$0'));

  const rowIndices = [];
  const rowRe = /\bid=(?:["']HRS_AGNT_RSLT_I\$0_row_(\d+)["']|HRS_AGNT_RSLT_I\$0_row_(\d+)(?=[\s>]))/g;
  let rm;
  while ((rm = rowRe.exec(str))) rowIndices.push(rm[1] ?? rm[2]);

  const rows = [];
  for (const idx of rowIndices) {
    const jobId = extractTextById(str, `HRS_APP_JBSCH_I_HRS_JOB_OPENING_ID$${idx}`);
    const title = extractTextById(str, `SCH_JOB_TITLE$${idx}`);
    if (!jobId || !title) continue; // no dedup key / nothing to show
    const postedRaw = extractTextById(str, `SCH_OPENED$${idx}`);
    rows.push({
      jobId,
      title,
      location: extractTextById(str, `LOCATION$${idx}`) || '',
      department: extractTextById(str, `HRS_APP_JBSCH_I_HRS_DEPT_DESCR$${idx}`) || '',
      postedRaw: postedRaw || null,
      postedAt: parsePeopleSoftDate(postedRaw),
    });
  }

  return {
    valid: true,
    errorReason: null,
    rows,
    // A counter below this page's own row count cannot be the total — keep it
    // unknown so a partial walk is never declared complete.
    reportedTotal: reportedTotal !== null && reportedTotal < rows.length ? null : reportedTotal,
    formAction: formState.action,
    formFields: formState.fields,
  };
}

// ── Detail-page parsing ───────────────────────────────────────────────────

/**
 * Parse a job detail page, verifying identity. No job-id element →
 * `unexpected-page`; a different id → `job-id-mismatch` (a dead PostingSeq
 * served an unrelated posting). Both are rejected so the caller tries
 * PostingSeq=2. Sections (`win0divHRS_SCH_PSTDSC_row$N`, quoted or unquoted)
 * are joined in DOM order into plain-text `descriptionText`.
 * @param {string} html @param {string} expectedJobId
 */
export function parseJobDetail(html, expectedJobId) {
  const str = String(html);
  const returnedJobId = extractTextById(str, 'HRS_SCH_WRK2_HRS_JOB_OPENING_ID');
  if (returnedJobId === null) return { valid: false, reason: 'unexpected-page', jobId: null };
  if (returnedJobId.trim() !== String(expectedJobId).trim()) {
    return { valid: false, reason: 'job-id-mismatch', jobId: returnedJobId };
  }

  const sectionIndices = []; // DOM order via one forward scan
  const secRe = /\bid=(?:["']win0divHRS_SCH_PSTDSC_row\$(\d+)["']|win0divHRS_SCH_PSTDSC_row\$(\d+)(?=[\s>]))/g;
  let sm;
  while ((sm = secRe.exec(str))) sectionIndices.push(sm[1] ?? sm[2]);

  /** @type {{label: string, text: string}[]} */
  const sections = [];
  for (const idx of sectionIndices) {
    const labelRaw = extractById(str, `HRS_SCH_WRK_DESCR100$${idx}lbl`);
    const bodyRaw = extractById(str, `HRS_SCH_PSTDSC_DESCRLONG$${idx}`);
    if (labelRaw === null && bodyRaw === null) continue;
    sections.push({ label: labelRaw !== null ? htmlToText(labelRaw) : '', text: htmlToText(bodyRaw || '') });
  }
  const descriptionText = sections
    .map((s) => (s.label ? `${s.label}\n` : '') + s.text)
    .join('\n\n')
    .trim()
    .slice(0, DESCRIPTION_CAP);

  return {
    valid: true,
    reason: null,
    jobId: returnedJobId,
    title: extractTextById(str, 'HRS_SCH_WRK2_POSTING_TITLE') || '',
    location: extractTextById(str, 'HRS_SCH_WRK_HRS_DESCRLONG') || '',
    sections,
    descriptionText,
  };
}

// ── Session transport ─────────────────────────────────────────────────────

/**
 * DNS guard (defence-in-depth): refuse a tenant host that resolves to a
 * private/loopback/metadata address. Fail-open on a resolver error (an
 * unresolvable host cannot be connected to either). `lookup` is injectable so
 * tests never touch DNS. Lookup-then-connect: see the TOCTOU note in the header.
 * @param {string} url @param {(host: string) => Promise<{address: string}>} lookup
 */
async function guardResolvedHost(url, lookup) {
  const { hostname } = new URL(url);
  let address;
  try {
    ({ address } = await lookup(hostname));
  } catch {
    return;
  }
  if (isPrivateOrLoopbackHost(address)) {
    const err = new Error(`peoplesoft: refusing ${hostname} — resolves to non-public address ${address}`);
    /** @type {any} */ (err).code = 'ECAREEROPS_BLOCKED_ADDRESS';
    throw err;
  }
}

// Transient = 429, any 5xx, or a network/timeout error (no HTTP status).
const isTransient = (err) => {
  const status = err && typeof err.status === 'number' ? err.status : undefined;
  return status === undefined || status === 429 || status >= 500;
};

/**
 * One GET/POST under the session: manual same-origin redirect following
 * (every Location re-validated), Set-Cookie merged at every hop, 301/302/303
 * downgrade to a bodiless GET, 307/308 keep method+body. Transient failures
 * (429 / 5xx / network) are retried with backoff; a permanent 4xx or an SSRF
 * refusal is thrown at once. Non-2xx errors carry `.status`.
 * @param {any} session
 * @param {'GET' | 'POST'} method @param {string} url @param {string} [body]
 * @returns {Promise<string>}
 */
async function requestWithSession(session, method, url, body) {
  const { config, jar, fetchImpl, signal, lookup, retryDelayMs } = session;
  let currentUrl = assertPeoplesoftUrl(url, config);
  let currentMethod = method;
  let currentBody = body;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await guardResolvedHost(currentUrl, lookup);
    const cookie = cookieHeader(jar);
    const headers = withPinnedEncoding({
      ...BASE_HEADERS,
      ...(currentMethod === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    });
    const res = await withRetry(async () => {
      const r = await fetchImpl(currentUrl, {
        method: currentMethod,
        headers,
        body: currentMethod === 'GET' ? undefined : currentBody,
        signal,
        redirect: 'manual',
      });
      const status = Number(r?.status) || 0;
      if (status >= 300 && status < 400) return r;
      if (!r?.ok && !(status >= 200 && status < 300)) {
        updateCookieJar(jar, readSetCookies(r?.headers));
        const err = new Error(`HTTP ${status} (${currentUrl})`);
        /** @type {any} */ (err).status = status;
        /** @type {any} */ (err).retryAfter = r?.headers?.get?.('retry-after') ?? null;
        throw err;
      }
      return r;
    }, signal, retryDelayMs);

    updateCookieJar(jar, readSetCookies(res.headers));
    const status = Number(res.status) || 0;
    if (status >= 300 && status < 400) {
      const location = res.headers?.get?.('location');
      if (!location) throw new Error(`peoplesoft: redirect (HTTP ${status}) with no Location from ${currentUrl}`);
      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl).href;
      } catch {
        throw new Error(`peoplesoft: redirect (HTTP ${status}) carried an unparseable Location: ${location}`);
      }
      currentUrl = assertPeoplesoftUrl(nextUrl, config); // throws if the hop leaves the origin
      if (status !== 307 && status !== 308) {
        currentMethod = 'GET';
        currentBody = undefined;
      }
      continue;
    }
    return await res.text();
  }
  throw new Error(`peoplesoft: exceeded ${MAX_REDIRECTS} redirects following ${url}`);
}

async function withRetry(request, signal, baseDelayMs) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request();
    } catch (err) {
      if (attempt === RETRY_POLICY.retries || !isTransient(err) || signal?.aborted) throw err;
      await delay(computeRetryDelayMs({
        attempt,
        baseDelayMs,
        maxDelayMs: RETRY_POLICY.maxDelayMs,
        retryAfter: err?.retryAfter,
      }), signal);
    }
  }
}

/**
 * Build a tenant session: an empty cookie jar plus the transport knobs.
 * @param {{origin: string, site: string, searchUrl: string}} config
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, lookup?: Function, retryDelayMs?: number }} [opts]
 */
export function createSession(config, opts = {}) {
  return {
    config,
    jar: createCookieJar(),
    fetchImpl: opts.fetchImpl || fetch,
    signal: opts.signal,
    lookup: opts.lookup || ((host) => dns.lookup(host, { verbatim: true })),
    retryDelayMs: Number.isFinite(opts.retryDelayMs) ? opts.retryDelayMs : RETRY_POLICY.baseDelayMs,
  };
}

/** GET the search page under a session, parsed. @param {any} session */
export async function fetchSearchPage(session) {
  return parseSearchPage(await requestWithSession(session, 'GET', session.config.searchUrl));
}

/**
 * "Load more": POST the ENTIRE form state back to the form's action with
 * ICAction overridden. The action is page-controlled, so it is pinned to the
 * tenant origin BEFORE any network call.
 * @param {{formAction: string | null, formFields: Record<string, string>}} state
 * @param {any} session
 */
export async function fetchAdditionalResults(state, session) {
  const { config } = session;
  let actionUrl = config.searchUrl; // no action captured — fall back, don't fail
  if (state.formAction) {
    try {
      // Relative to the page that served the form, not the origin: a bare
      // `HRS_HRAM_FL…GBL?…` action lives beside the search page.
      actionUrl = new URL(state.formAction, config.searchUrl).href;
    } catch { /* keep searchUrl */ }
  }
  assertPeoplesoftUrl(actionUrl, config);
  const body = new URLSearchParams({ ...state.formFields, ICAction: LOAD_MORE_ACTION }).toString();
  return parseSearchPage(await requestWithSession(session, 'POST', actionUrl, body));
}

/**
 * One job's detail under the session: PostingSeq=1, then 2. Best-effort —
 * null when neither yields a matching page.
 * @param {any} session @param {string} jobId
 */
export async function fetchJobDetail(session, jobId) {
  for (const seq of [1, 2]) {
    const html = await requestWithSession(session, 'GET', buildDetailUrl(session.config, jobId, seq));
    const detail = parseJobDetail(html, jobId);
    if (detail.valid) return detail;
  }
  return null;
}

// ── Entry config ──────────────────────────────────────────────────────────

const intInRange = (val, def, min, max) => (Number.isFinite(Number(val))
  ? Math.min(max, Math.max(min, Math.trunc(Number(val)))) : def);

/**
 * `max_pages` is a TOTAL page count (initial GET included), so the load-more
 * budget is `max_pages - 1` — max_pages:1 means the initial GET only.
 * @param {any} company
 */
export function resolveMaxLoadMore(company) {
  const v = company?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v - 1, MAX_LOAD_MORE_CAP);
  return DEFAULT_MAX_LOAD_MORE;
}

/** Per-entry `peoplesoft: { fetchDetails, detailLimit }` block. @param {any} company */
export function parseEntryConfig(company) {
  const cfg = (company && typeof company.peoplesoft === 'object' && company.peoplesoft) || {};
  return {
    fetchDetails: cfg.fetchDetails === true,
    detailLimit: intInRange(cfg.detailLimit, DEFAULT_DETAIL_LIMIT, 1, 100),
  };
}

// ── Fetcher ───────────────────────────────────────────────────────────────

/**
 * Fetch + normalize one PeopleSoft tenant's postings.
 *
 * Page one failing, or not being a `win0` page, THROWS (unreachable / login
 * wall ≠ empty). A load-more failure keeps the rows already collected and
 * tags the array with `peoplesoftIncomplete` (an extra array property, like
 * the parent's icimsTruncated; not a job field). Completeness is only claimed
 * when a reported total was reached, or — with no total — when a load-more
 * page brought nothing new and the ICStateNum advanced.
 *
 * `opts.maxPages` (a health-probe budget) caps TOTAL requests for the listing
 * walk, skips detail enrichment and the incomplete marker, and lets a
 * load-more failure propagate. `opts.delayMs` / `opts.retryDelayMs` /
 * `opts.lookup` are test hooks.
 *
 * @param {string} endpoint canonical search URL (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any,
 *           maxPages?: number, delayMs?: number, retryDelayMs?: number,
 *           lookup?: Function }} [opts]
 */
export async function fetchPeoplesoft(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertPeoplesoftUrl(endpoint);
  const config = resolveConfig({ api: endpoint });
  const name = (company && typeof company.name === 'string' && company.name.trim()) ? company.name.trim() : '';
  if (!config) {
    throw new Error(`peoplesoft: cannot resolve a Candidate Gateway search URL for ${name || endpoint}`);
  }
  const session = createSession(config, { fetchImpl, signal, lookup: opts.lookup, retryDelayMs: opts.retryDelayMs });
  const delayMs = Number.isFinite(opts.delayMs) ? Number(opts.delayMs) : INTER_REQUEST_DELAY_MS;
  const probing = Number.isInteger(opts.maxPages) && Number(opts.maxPages) > 0;
  const maxLoadMore = probing ? Math.max(0, Number(opts.maxPages) - 1) : resolveMaxLoadMore(company);

  const firstPage = await fetchSearchPage(session);
  if (!firstPage.valid) {
    throw new Error(
      `peoplesoft: ${name || config.origin} returned an unrecognized search response (no form[name="win0"]) — `
        + `likely a login/session-expired/challenge page, not zero postings (reason: ${firstPage.errorReason})`,
    );
  }

  const byId = new Map(firstPage.rows.map((row) => [row.jobId, row]));
  let reportedTotal = firstPage.reportedTotal;
  let currentState = firstPage;
  let loadMoreCount = 0;
  let stopCause = null;
  let stopDetail = '';

  while (loadMoreCount < maxLoadMore) {
    if (reportedTotal !== null && byId.size >= reportedTotal) break;
    if (signal?.aborted) { stopCause = 'aborted'; break; }
    await delay(delayMs, signal);
    const postedStateNum = currentState.formFields?.ICStateNum;
    let next;
    try {
      next = await fetchAdditionalResults(currentState, session);
    } catch (err) {
      if (probing) throw err;
      stopCause = 'load-more-fetch-failed';
      stopDetail = (err && err.message) || String(err);
      break;
    }
    loadMoreCount++;
    if (!next.valid) { stopCause = 'load-more-response-unrecognized'; break; }
    if (next.reportedTotal !== null) reportedTotal = next.reportedTotal;
    let fresh = 0;
    for (const row of next.rows) {
      if (byId.has(row.jobId)) continue;
      byId.set(row.jobId, row);
      fresh++;
    }
    currentState = next;
    if (fresh === 0) {
      const returnedStateNum = next.formFields?.ICStateNum;
      stopCause = postedStateNum !== undefined && returnedStateNum === postedStateNum
        ? 'load-more-stale-state'
        : 'load-more-no-progress';
      break;
    }
  }

  const reachedKnownTotal = reportedTotal !== null && byId.size >= reportedTotal;
  const cleanlyExhausted = reachedKnownTotal || (reportedTotal === null && stopCause === 'load-more-no-progress');
  const complete = probing || cleanlyExhausted;
  if (!complete) {
    if (!stopCause) stopCause = 'pagination-ceiling-reached';
    const totalDesc = reportedTotal === null ? 'an unknown total of' : `${reportedTotal} reported`;
    const why = {
      'load-more-fetch-failed': `load-more request failed${stopDetail ? `: ${stopDetail}` : ''}`,
      'load-more-response-unrecognized': 'a load-more response was not recognizable',
      'load-more-no-progress': 'the load-more response contained no new postings',
      'load-more-stale-state': 'the load-more response repeated the posted ICStateNum without advancing',
      aborted: 'the scan was aborted',
    }[stopCause] || "raise max_pages on this entry, or this may be PeopleSoft's own ~100-result anonymous-session cap";
    console.warn(`  ⚠ peoplesoft: ${name || config.origin} — parsed ${byId.size} of ${totalDesc} postings; ${why}.`);
  }

  const host = new URL(config.origin).hostname;
  const jobs = [...byId.values()].map((row) => {
    const isRemote = REMOTE_RE.test(row.location);
    return {
      id: `peoplesoft-${host}-${row.jobId}`,
      title: row.title,
      company: name,
      // PostingSeq=1 is the canonical public posting URL.
      url: buildDetailUrl(config, row.jobId, 1),
      salary: '',
      location: row.location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: typeof row.postedAt === 'number' ? new Date(row.postedAt).toISOString() : '',
      snippet: '',
      source: 'peoplesoft',
      _jobId: row.jobId,
    };
  });

  // Opt-in enrichment; skipped while probing. SEQUENTIAL on purpose: every
  // hop reads and rewrites the one shared cookie jar, so parallel detail
  // fetches would race on a rotating session cookie.
  const { fetchDetails, detailLimit } = parseEntryConfig(company);
  if (fetchDetails && !probing) {
    for (const job of jobs.slice(0, detailLimit)) {
      if (signal?.aborted) break;
      await delay(delayMs, signal);
      try {
        const detail = await fetchJobDetail(session, job._jobId);
        if (detail?.descriptionText) /** @type {any} */ (job).description = detail.descriptionText;
      } catch {
        // Enrichment only — keep the listing row.
      }
    }
  }

  /** @type {any} */
  const out = jobs.map(({ _jobId, ...job }) => job);
  if (!complete) {
    out.peoplesoftIncomplete = { complete: false, reason: stopCause, collected: byId.size, reportedTotal };
  }
  return out;
}
