/**
 * Workday CXS public jobs API wrapper (BETA).
 *
 * Workday hosts each customer at `<tenant>.wd<N>.myworkdayjobs.com`
 * (N is usually 1, 5, or 12). The unauthenticated jobs feed lives at
 *   POST https://<tenant>.wd<N>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs
 * with body `{ appliedFacets: {}, limit, offset, searchText: "" }`.
 *
 * Marked beta because:
 *   - The endpoint per-customer (site path varies)
 *   - Some customers gate the feed behind a CAPTCHA on /wday/cxs/...
 *   - Pagination requires a POST loop; we only fetch the first page.
 *
 * v1.16.0 — graceful CAPTCHA / 4xx fallback. Instead of throwing
 * (which used to break the whole scan), the wrapper returns an
 * empty job array and annotates the result with a fallback hint
 * so /#/scan can render 🔒 chips for blocked tenants. Callers can
 * opt back into the throw behaviour via `opts.strict=true`.
 *
 * Fallback detection rules:
 *   - 4xx (403, 404, 429) — CAPTCHA or tenant-not-public
 *   - non-JSON response (HTML CAPTCHA page) — same outcome
 * Both → returns []. Caller can inspect `lastWorkdayFallback` for
 * audit / activity-log purposes.
 *
 * Help bundle suggestion (career-ops.org/docs/.../set-up-playwright):
 * for a CAPTCHA-gated Workday board, fall back to the AI scan
 * (`/career-ops scan`) which drives a real browser via Playwright.
 */
import { BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';

const PAGE_LIMIT = 100;

// Workday's LIST endpoint answers a posting attached to more than one location
// with a COUNT where every other posting carries a place: `"53 Locations"`. It
// is not a location, and `buildLocationFilter` matches by case-insensitive
// substring — so a role open in Austin AND 52 other cities matches no
// `allow: [austin]` entry and is dropped, while the same role listed singly
// passes. Measured upstream across three tenants (60 postings each): 53 of 291
// were placeholders, i.e. the ordinary case, not an edge one.
//
// Anchored, and `Locations?` singular-tolerant, so it cannot fire on a real
// place that merely contains a digit and the word ("100 Locations Plaza").
const MULTI_LOCATION_PLACEHOLDER_RE = /^\s*\d+\s+locations?\s*$/i;

// How many detail GETs one entry may spend resolving placeholders. The
// enrichment is one extra GET per placeholder posting, and a 2,000-posting
// tenant at the measured rate would add ~1,000 requests — a different kind of
// scan than the caller asked for. Past the cap the placeholder is left VISIBLE
// rather than faked, so an unresolved posting never reads as a resolved one.
export const MAX_DETAIL_REQUESTS = 200;

/**
 * True when a Workday list location is the count-placeholder, not a place.
 * @param {unknown} location `locationsText` as the list endpoint returned it.
 * @returns {boolean}
 */
export function isMultiLocationPlaceholder(location) {
  return typeof location === 'string' && MULTI_LOCATION_PLACEHOLDER_RE.test(location);
}

/**
 * The real places behind a placeholder, from the CXS detail document.
 *
 * `jobPostingInfo.location` holds the primary place and `.additionalLocations`
 * the rest; there is no `locationsText` at this level, so there is nothing else
 * to read. Joined with `' · '` — the separator greenhouse/ashby/gem already use
 * for exactly this. Deduped, since a tenant that repeats the primary inside
 * `additionalLocations` would otherwise ship it twice into a user-visible field.
 * @param {unknown} detail Parsed detail document.
 * @returns {string} `' · '`-joined places, or '' when the document has none.
 */
export function locationsFromDetail(detail) {
  const info = detail && typeof detail === 'object' ? detail.jobPostingInfo : null;
  if (!info || typeof info !== 'object') return '';
  const extra = Array.isArray(info.additionalLocations) ? info.additionalLocations : [];
  const places = [info.location, ...extra]
    .filter((x) => typeof x === 'string' && x.trim() !== '')
    .map((x) => x.trim());
  return [...new Set(places)].join(' · ');
}

/**
 * The posting's real publication date, from the detail document.
 *
 * The list endpoint offers only `postedOn` — relative prose ("Posted 3 Days
 * Ago") that tops out at an unbounded "30+ Days Ago". The detail document
 * carries `jobPostingInfo.startDate`, an absolute date, so a posting we already
 * paid a GET for can be dated exactly instead of approximately — and every
 * other web-ui source already emits an ISO date here.
 *
 * Deliberately stricter than `Date.parse`, whose fallback for a non-ISO string
 * is implementation-defined: anything that is not a bare `YYYY-MM-DD` is left
 * alone rather than guessed at.
 * @param {unknown} detail Parsed detail document.
 * @returns {string} An ISO `YYYY-MM-DD`, or '' when there is no usable date.
 */
export function dateFromDetail(detail) {
  const info = detail && typeof detail === 'object' ? detail.jobPostingInfo : null;
  const raw = info && typeof info === 'object' ? info.startDate : undefined;
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
}

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs for the rationale.
export const meta = {
  value: 'workday',
  label: 'Workday',
  region: 'en',
};

// Module-level snapshot of the last fallback reason. Scanner uses
// this for status reporting via /#/scan Active Companies card.
// v1.17.0 — exposed via getLastWorkdayFallback() too so SSE consumers
// (server/lib/routes/scan.mjs) don't have to rely on ESM live bindings.
export let lastWorkdayFallback = null;

export function getLastWorkdayFallback() {
  return lastWorkdayFallback;
}

function setFallback(apiUrl, reason) {
  lastWorkdayFallback = { apiUrl, reason, at: new Date().toISOString() };
}

export async function fetchWorkday(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, strict = false, resolveMultiLocation = true } = opts;
  // Some tenants front their CXS API with Cloudflare bot management (seen
  // live upstream: geico) that 500s requests missing ordinary browser
  // headers. A real Chrome UA + accept-language + matching origin/referer
  // clears it without per-tenant config.
  // Derive origin + site from the CXS URL itself:
  //   https://<tenant>.wdN.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs
  const headers = {
    'User-Agent': BROWSER_LIKE_USER_AGENT,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  try {
    const u = new URL(apiUrl);
    const site = (u.pathname.match(/^\/wday\/cxs\/[^/]+\/([^/]+)\//) || [])[1];
    headers.Origin = u.origin;
    headers.Referer = site ? `${u.origin}/${site}/` : `${u.origin}/`;
  } catch {
    /* malformed apiUrl → fetch below will surface the real error */
  }
  let res;
  try {
    res = await fetchImpl(apiUrl, {
      method: 'POST',
      signal,
      headers,
      body: JSON.stringify({
        appliedFacets: {},
        limit: PAGE_LIMIT,
        offset: 0,
        searchText: '',
      }),
    });
  } catch (e) {
    // Network-level error (DNS, connect, timeout). Treat as fallback
    // unless caller opted into strict mode.
    if (strict) throw e;
    setFallback(apiUrl, `network: ${e.message}`);
    return [];
  }
  if (!res.ok) {
    // 4xx / 5xx — CAPTCHA / tenant gone / WAF / etc. Graceful fallback.
    const reason = `HTTP ${res.status}`;
    if (strict) {
      const err = new Error(`Workday: ${reason} (${apiUrl})`);
      err.status = res.status;
      err.fallback = true;
      throw err;
    }
    setFallback(apiUrl, reason);
    return [];
  }
  // Some CAPTCHA gates serve HTML with 200; detect by trying to parse
  // as JSON and bailing softly on parse error.
  let data;
  try {
    data = await res.json();
  } catch (e) {
    if (strict) throw e;
    setFallback(apiUrl, 'non-JSON response (likely CAPTCHA HTML)');
    return [];
  }
  // The Workday CXS response wraps job rows under `jobPostings`.
  const base = apiUrl.replace(/\/wday\/cxs\/.+$/, '');
  const jobs = (data.jobPostings || []).map((j) => normalize(j, base));
  if (resolveMultiLocation) {
    await resolvePlaceholders(jobs, data.jobPostings || [], apiUrl, { fetchImpl, signal, headers });
  }
  return jobs;
}

/**
 * Replace each count-placeholder location with the posting's real places.
 *
 * One GET per placeholder posting against the CXS *detail* document — the same
 * externalPath against the CXS base rather than the careers host. A failed or
 * placeless document leaves the posting exactly as the list returned it: a
 * visible "53 Locations" is honest about what we could not resolve, whereas a
 * blanked location would silently pass every filter.
 *
 * @param {object[]} jobs Normalized jobs, mutated in place.
 * @param {object[]} raw  The matching list rows (for `externalPath`).
 * @param {string} apiUrl The CXS jobs endpoint.
 */
async function resolvePlaceholders(jobs, raw, apiUrl, { fetchImpl, signal, headers }) {
  // `…/wday/cxs/<tenant>/<site>/jobs` → `…/wday/cxs/<tenant>/<site>`
  const cxsBase = apiUrl.replace(/\/jobs\/?$/, '');
  const detailHeaders = { ...headers, Accept: 'application/json' };
  delete detailHeaders['Content-Type'];
  let spent = 0;
  for (let i = 0; i < jobs.length; i++) {
    if (spent >= MAX_DETAIL_REQUESTS) break;
    if (!isMultiLocationPlaceholder(jobs[i].location)) continue;
    const path = raw[i] && raw[i].externalPath;
    if (typeof path !== 'string' || !path) continue;
    spent += 1;
    let detail;
    try {
      const res = await fetchImpl(`${cxsBase}${path}`, { method: 'GET', signal, headers: detailHeaders });
      if (!res.ok) continue;
      detail = await res.json();
    } catch {
      continue; // a transient detail failure must not fail the board
    }
    const places = locationsFromDetail(detail);
    if (places === '') continue;
    jobs[i].location = places;
    const isRemote = /remote|anywhere/i.test(places) || /\bremote\b/i.test(jobs[i].title || '');
    jobs[i].isRemote = isRemote;
    jobs[i].workplaceType = isRemote ? 'Remote' : (/hybrid/i.test(places) ? 'Hybrid' : 'Onsite');
    const started = dateFromDetail(detail);
    if (started) jobs[i].date = started;
  }
}

function normalize(j, base) {
  const path = j.externalPath || '';
  const url = path.startsWith('http') ? path : (base + path);
  const loc = j.locationsText || j.bulletFields?.[0] || '';
  const isRemote = /remote|anywhere/i.test(loc) || /\bremote\b/i.test(j.title || '');
  const hybrid = /hybrid/i.test(loc);
  return {
    id: `wd-${j.bulletFields?.[1] || j.title}`,
    title: j.title || '',
    company: '',  // Workday CXS doesn't echo the tenant name in payload.
    url,
    salary: '',
    location: loc,
    isRemote,
    workplaceType: isRemote ? 'Remote' : (hybrid ? 'Hybrid' : 'Onsite'),
    relocates: /\b(visa|relocation|sponsorship)\b/i.test(j.title || ''),
    date: j.postedOn || '',
    snippet: '',
    source: 'workday',
  };
}
