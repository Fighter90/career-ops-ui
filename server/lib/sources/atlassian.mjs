// @ts-check
/**
 * Atlassian source — Atlassian runs a custom careers site (iCIMS-backed) but
 * fronts it with a single public, auth-free JSON feed of every open posting:
 *   GET https://www.atlassian.com/endpoint/careers/listings
 *
 * Each item carries title, category, a messy locations[] array, and two iCIMS
 * URLs: portalJobPost.portalUrl, the posting page (".../job"), and applyUrl,
 * the application form (".../job?mode=apply"). The posting page is the one the
 * row keeps — it is what a liveness check or a JD fetch needs to read — with
 * applyUrl as the fallback. One request returns the full board (~290 jobs on
 * 2026-09-24, parent), so there is no pagination to handle.
 *
 * Board-wide source wired up with `provider: atlassian` in portals.yml
 * (careers_url is only used for the human-facing link). Ported from the
 * parent's providers/atlassian.mjs (parity v1.253.0).
 */
import { fetchJson, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';

const UA = BROWSER_LIKE_USER_AGENT;

export const meta = {
  value: 'atlassian',
  label: 'Atlassian',
  region: 'en',
};

export const LISTINGS_URL = 'https://www.atlassian.com/endpoint/careers/listings';
export const ALLOWED_HOST = 'www.atlassian.com';

/**
 * Defence-in-depth endpoint check: HTTPS on exactly the feed host.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertAtlassianUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`atlassian: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`atlassian: URL must use HTTPS: ${url}`);
  if (parsed.port !== '') throw new Error(`atlassian: a non-default port is not allowed: ${url}`);
  if (parsed.hostname !== ALLOWED_HOST)
    throw new Error(`atlassian: untrusted hostname "${parsed.hostname}" — must be ${ALLOWED_HOST}`);
  return url;
}

// Collapse the feed's whitespace-heavy location strings (e.g.
// "San Francisco - United States -   San Francisco, California 94104 United States")
// into a single line, joining multi-location postings with "; " so the
// scanner's substring location filter still matches city/country tokens.
/**
 * @param {any} job
 * @returns {string}
 */
export function formatLocation(job) {
  const locs = Array.isArray(job?.locations) ? job.locations : [];
  return locs.map((l) => String(l).replace(/\s+/g, ' ').trim()).filter(Boolean).join('; ');
}

// Hosts a posting URL may point at: the feed's own site, and the iCIMS tenant
// the feed links to. Anchored, so a suffix spoof (icims.com.evil.example)
// never matches.
const POSTING_HOST_RE = /^(?:www\.atlassian\.com|(?:[a-z0-9-]+\.)*icims\.com)$/;

// The posting link the row keeps: the iCIMS posting page, else the apply form.
// This URL feeds liveness checks and JD fetches, so a hostile or compromised
// feed row must not turn it into a downstream SSRF target: https only, on the
// allowlist above only, no non-default port — anything else drops the row.
/**
 * @param {any} job
 * @returns {string|null}
 */
export function postingUrl(job) {
  for (const raw of [job?.portalJobPost?.portalUrl, job?.applyUrl]) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    try {
      const u = new URL(raw.trim());
      if (u.protocol === 'https:' && u.port === '' && POSTING_HOST_RE.test(u.hostname)) return raw.trim();
    } catch {
      // relative or malformed — try the next candidate
    }
  }
  return null;
}

// The parent's coerceId (providers/_ids.mjs): accept a string or a number,
// trim it, treat empty as absent. ABSENT BEATS WRONG — an id that cannot be
// coerced returns undefined rather than a placeholder.
/**
 * @param {unknown} raw
 * @returns {string|undefined}
 */
function coerceId(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const s = String(raw).trim();
  return s === '' ? undefined : s;
}

/**
 * Parse one Atlassian listings feed. Exported for unit tests.
 *
 * The feed is a bare array. Anything else means Atlassian changed the
 * endpoint's shape, and returning [] would read as "no open roles" forever —
 * name what arrived instead (the parseIbmResponse precedent in ibm.mjs).
 * Null, primitive and malformed rows are skipped, never the board.
 *
 * No postedAt. The feed's only date is portalJobPost.updatedDate, which
 * is when the posting was last EDITED — postedAt is the publication
 * date (schema.org datePosted), and the scanner's max-age filter treats it
 * as one, so an old role edited yesterday would read as new. The value is
 * also a zone-less "2026-09-11 01:00 AM", which Date.parse reads in local
 * time (a 16h spread between UTC and Asia/Tokyo). An absent date means
 * "unknown", never "stale" — same call as successfactors.
 *
 * @param {any} json
 * @param {string} companyName
 * @returns {Array<{title: string, url: string, company: string, location: string, externalId?: string}>}
 */
export function parseAtlassianListings(json, companyName) {
  if (!Array.isArray(json)) {
    const keys = json && typeof json === 'object' ? Object.keys(json).slice(0, 8).join(', ') : typeof json;
    throw new Error(`atlassian: ${LISTINGS_URL} did not return an array of listings — got ${keys}`);
  }
  /** @type {Array<{title: string, url: string, company: string, location: string, externalId?: string}>} */
  const out = [];
  for (const j of json) {
    if (!j || typeof j !== 'object') continue;
    const title = typeof j.title === 'string' ? j.title.trim() : '';
    const url = postingUrl(j);
    if (!title || !url) continue;
    const externalId = coerceId(j.id);
    out.push({
      title,
      url,
      company: companyName,
      location: formatLocation(j),
      ...(externalId ? { externalId } : {}),
    });
  }
  return out;
}

function normalize(row, entry) {
  return {
    // The parent carries the feed's own id as externalId; the web-ui row id
    // prefers it and falls back to the URL.
    id: row.externalId ? `atlassian-${row.externalId}` : `atlassian-${row.url}`,
    title: row.title,
    company: row.company || String(entry?.name ?? ''),
    url: row.url,
    salary: '',
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(row.title),
    workplaceType: '',
    relocates: false,
    date: '',
    snippet: '',
    source: 'atlassian',
  };
}

/**
 * Fetch + normalize the Atlassian listings feed (single request, whole board).
 * @param {string} endpoint - the listings URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchAtlassian(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company } = opts;
  assertAtlassianUrl(endpoint);
  // redirect:'error' blocks SSRF via server-side redirects; with the host
  // assertion above the final host is guaranteed to stay www.atlassian.com.
  const json = await fetchJson(fetchImpl, endpoint, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA },
  });
  const rows = parseAtlassianListings(json, String(company?.name ?? ''));
  return rows.map((row) => normalize(row, company));
}
