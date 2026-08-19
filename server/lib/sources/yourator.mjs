/**
 * Yourator source — yourator.co, a Taiwanese tech/digital job board focused on
 * startups. Board-wide public JSON API, no auth, no cookie, no Referer:
 *
 *   GET https://www.yourator.co/api/v4/jobs?page=N
 *   → { payload: { hasMore, currentPage, nextPage, jobs: [ { id, name, path,
 *       salary, lastActiveAt, location, companyId, tags, company: { brand, … },
 *       thirdPartyUrl, externalSource } ], recommendedJobs, trendingKeywords } }
 *
 * Implements the web-ui source contract (rich job objects + `meta` for
 * auto-discovery). Used by the yourator adapter
 * (server/lib/portals/adapters/yourator.mjs).
 *
 * --- Design notes (ported from the parent career-ops provider) --------------
 *
 * Emitted URL / dedup key. Each posting may carry `thirdPartyUrl` — the
 * employer's own ATS page (teamdoor.io, Greenhouse, Lever, BambooHR, Breezy, or
 * a self-hosted careers site) — and that is the emitted URL: the shortest
 * verifiable path to the employer. The Yourator posting page (SITE_ORIGIN +
 * `path`) is the fallback, used when a row has no usable thirdPartyUrl.
 *
 * The emitted URL is accepted from any https: origin and is NOT host-pinned: it
 * is display-only and never fetched by this source, so the host lock belongs on
 * the API URLs we actually request (assertYouratorUrl), not on the URLs we hand
 * downstream. Non-https and malformed values fall back to the Yourator page.
 *
 * UTM stripping. Some rows arrive with the board's ad-campaign parameters
 * appended (`utm_source=yourator&utm_medium=ads&utm_campaign=…`). Only `utm_*`
 * keys are removed from the emitted URL — so the same role reached through the
 * employer's direct ATS provider dedups to the same key — while any functional
 * query parameter (a job id, a tenant slug) survives.
 *
 * Complete inventory. The API exposes no free-text search parameter — q /
 * keyword / search / term / query / title are all silently ignored, returning
 * the unfiltered board — so the source walks EVERY page until `payload.hasMore`
 * turns false and lets the scanner's title/content/location filters decide.
 * DEFAULT_MAX_PAGES is a safety bound above the observed page count, not a
 * coverage setting.
 *
 * Employer attribution. `company.brand` carries the real employer, not the
 * aggregator's name, so tracker rows land under the actual employer.
 *
 * No postedAt. The API publishes only `lastActiveAt`, a localized relative
 * string ("一天內更新"), with no absolute timestamp anywhere in the payload — so
 * `date` is emitted empty rather than guessed.
 */
import { fetchJson, delay } from '../http-json.mjs';

const SITE_ORIGIN = 'https://www.yourator.co';
export const FEED_URL = `${SITE_ORIGIN}/api/v4/jobs`;

// HTTPS-only host lock for every URL this source actually fetches. Anchored so
// `notyourator.co`, `yourator.co.evil.com`, and `www.yourator.co.evil.com` are
// all rejected while `yourator.co` and `www.yourator.co` pass.
export const YOURATOR_HOST_RE = /^(?:www\.)?yourator\.co$/i;

// Safety bound only — the loop stops on payload.hasMore. The live board was ~88
// pages; this leaves room to grow without silently truncating.
const DEFAULT_MAX_PAGES = 120;
const MAX_PAGES_CAP = 500;
// Every request after the first pays it (courtesy inter-page pause).
const PAGE_DELAY_MS = 200;

export const meta = {
  value: 'yourator',
  label: 'Yourator',
  region: 'en',
};

/**
 * Host-pin guard for the API URLs actually fetched. HTTPS-only, pinned to
 * yourator.co. Exported for unit tests.
 * @param {string} url
 */
export function assertYouratorUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`yourator: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`yourator: URL must use HTTPS: ${url}`);
  if (!YOURATOR_HOST_RE.test(parsed.hostname)) {
    throw new Error(`yourator: untrusted hostname "${parsed.hostname}" — must be yourator.co`);
  }
  return url;
}

/** tiny stable hash (djb2) → base36, for postings with no native id. */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/**
 * Resolve a posting's canonical URL — the shortest verifiable path to the
 * employer the board exposes.
 *
 * Prefers `thirdPartyUrl` (the employer's own ATS page), with the board's
 * `utm_*` ad parameters stripped. Accepts any https: origin — the value is
 * display-only and never fetched here. Falls back to the Yourator posting page
 * when thirdPartyUrl is absent, non-https or malformed. Returns '' when neither
 * is usable, and the caller drops the row.
 *
 * `path` must be site-root-relative: "//evil.example/x" resolves away from
 * SITE_ORIGIN under the WHATWG URL parser (as does a leading "/\"), so those
 * shapes are rejected before parsing rather than after.
 *
 * @param {any} j
 * @returns {string}
 */
export function resolveYouratorUrl(j) {
  const raw = typeof j.thirdPartyUrl === 'string' ? j.thirdPartyUrl.trim() : '';
  if (raw) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'https:') {
        for (const key of [...parsed.searchParams.keys()]) {
          if (key.toLowerCase().startsWith('utm_')) parsed.searchParams.delete(key);
        }
        return parsed.href;
      }
    } catch {
      // malformed — fall through to the board page
    }
  }

  const rawPath = typeof j.path === 'string' ? j.path.trim() : '';
  if (!rawPath.startsWith('/') || rawPath.startsWith('//') || rawPath.startsWith('/\\')) return '';
  try {
    const parsed = new URL(rawPath, SITE_ORIGIN);
    if (parsed.protocol === 'https:' && YOURATOR_HOST_RE.test(parsed.hostname)) return parsed.href;
  } catch {
    // malformed path → unusable
  }
  return '';
}

/**
 * Normalize a single Yourator job into the web-ui job shape. Rows without a
 * title or a usable URL are dropped (returns null). Exported for unit tests.
 *
 * Field mapping:
 *   - title:    `name`, trimmed.
 *   - url:      see resolveYouratorUrl.
 *   - company:  `company.brand`, falling back to the entry name, then "Yourator".
 *   - salary:   `salary`, trimmed when present.
 *   - location: `location` — a Taiwanese city name, e.g. "臺北市".
 *   - date:     never emitted; the API publishes no absolute timestamp.
 *
 * @param {any} j
 * @param {string} [fallbackCompany]
 * @returns {object | null}
 */
export function normalizeYouratorJob(j, fallbackCompany) {
  if (!j || typeof j !== 'object') return null;

  const title = typeof j.name === 'string' ? j.name.trim() : '';
  if (!title) return null;

  const url = resolveYouratorUrl(j);
  if (!url) return null;

  const brand = typeof j.company?.brand === 'string' ? j.company.brand.trim() : '';
  const company = brand || fallbackCompany || 'Yourator';
  const salary = typeof j.salary === 'string' ? j.salary.trim() : '';
  const location = typeof j.location === 'string' ? j.location.trim() : '';
  const native = j.id != null ? String(j.id) : djb2(url);

  return {
    id: `yourator-${native}`,
    title,
    company,
    url,
    salary,
    location,
    isRemote: false,
    workplaceType: 'Onsite',
    relocates: false,
    date: '', // no absolute postedAt in the payload; see header note
    snippet: '',
    source: 'yourator',
  };
}

/**
 * Parse one page of the /api/v4/jobs payload into web-ui Jobs. Tolerant of a
 * malformed payload: a missing/non-array `payload.jobs` yields no jobs and
 * `hasMore: false`, which stops the walk. Exported for unit tests.
 * @param {any} json
 * @param {string} [fallbackCompany]
 * @returns {{ jobs: object[], hasMore: boolean }}
 */
export function parseYouratorPage(json, fallbackCompany) {
  const jobsRaw = json?.payload?.jobs;
  if (!Array.isArray(jobsRaw)) return { jobs: [], hasMore: false };
  const hasMore = json?.payload?.hasMore === true;
  const jobs = [];
  for (const j of jobsRaw) {
    const normalized = normalizeYouratorJob(j, fallbackCompany);
    if (normalized) jobs.push(normalized);
  }
  return { jobs, hasMore };
}

/** Resolve the page cap: a positive integer `max_pages` on the entry, capped. */
function resolveMaxPages(company) {
  const v = company?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * Fetch + normalize the whole Yourator board, walking pages until the API's own
 * `payload.hasMore` end-of-board signal turns false (the API has no free-text
 * search parameter, so the default view IS the complete inventory).
 *
 * Fail-soft: a first-page failure throws (a dead board reads as a failure); a
 * mid-run blip keeps the jobs collected so far (same idiom as meituan/tencent).
 *
 * @param {string} apiUrl API endpoint (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchYourator(apiUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertYouratorUrl(apiUrl);

  const maxPages = resolveMaxPages(company);
  const fallbackCompany = company.name;
  const out = [];
  let succeededOnce = false;

  for (let page = 1; page <= maxPages; page++) {
    const url = `${apiUrl}?page=${page}`;
    // redirect:'error' prevents SSRF via server-side redirects.
    assertYouratorUrl(url);

    let json;
    try {
      json = await fetchJson(fetchImpl, url, { redirect: 'error', signal });
    } catch (err) {
      if (!succeededOnce) throw err;
      console.error(`  ⚠ yourator: page ${page} failed (${err.message}) — keeping the ${out.length} jobs collected so far`);
      return out;
    }
    succeededOnce = true;

    const { jobs, hasMore } = parseYouratorPage(json, fallbackCompany);
    out.push(...jobs);

    // `hasMore` is the API's own end-of-board signal and the only stop
    // condition. A short-page heuristic is deliberately NOT used — maxPages
    // already bounds a runaway walk, and a single short intermediate page would
    // silently truncate the board.
    if (hasMore !== true) break;
    if (page < maxPages) await delay(PAGE_DELAY_MS, signal);
  }

  return out;
}
