// @ts-check
/**
 * BWI source — scrapes the self-hosted careers site of BWI GmbH (the German
 * armed forces' IT service provider). Single-company source (like
 * hecklerkoch / rheinmetall): a tracked_companies entry selects it with
 * `provider: bwi` or a `careers_url` on the pinned host:
 *
 *   tracked_companies:
 *     - name: BWI GmbH
 *       provider: bwi
 *       careers_url: https://www.bwi.de/karriere/stellenangebote
 *       enabled: true
 *       bwi:
 *         fetchDetails: true   # optional: real title + city for security-adjacent postings
 *         detailLimit: 45      # optional max detail requests when fetchDetails=true (1-100)
 *
 * No third-party ATS is involved, so none of the feed-based sources match.
 * Two structured sources, both server-rendered, both zero-token:
 *
 *   1. The listing page embeds ONE `application/ld+json` CollectionPage whose
 *      `mainEntity` is an ItemList of EVERY open position (272 on 2026-08-21,
 *      parent) — not just the ~15 cards painted above the fold. Items carry a
 *      `url` and nothing else, so the title has to come from the slug.
 *   2. Each detail page embeds a proper `JobPosting` with title, datePosted
 *      and a `jobLocation.address.addressLocality`.
 *
 * By default a scan is ONE request: the listing. Every job ships with a title
 * rebuilt from its slug and an empty location, which the scanner's
 * location_filter treats as pass.
 *
 * Detail enrichment is opt-in: with `bwi.fetchDetails: true` the source also
 * reads the detail page of the postings whose slug looks security-adjacent,
 * for the real title and the city, capped at `bwi.detailLimit` requests
 * (default 45). Enrichment failure is never fatal: the job keeps its
 * slug-derived title. The RELEVANT pattern is deliberately wider than
 * portals.yml's title_filter — it exists to pick enrichment candidates, not
 * to filter, so a miss costs a location string and never a job.
 *
 * Ported from the parent's providers/bwi.mjs (parity v1.253.0).
 * Deviations from the parent, per the web-ui source contract:
 *   - the parent's ctx transport (ctx.fetchText / ctx.sleep / ctx.maxPages
 *     health-probe path) does not exist here; the source fetches through the
 *     injected fetchImpl with a local retry budget, and web-ui's scanner has
 *     no probe path (enrichment is bounded by its own budget alone);
 *   - the detail budget is enforced by wrapping the injected fetchImpl, so
 *     retries are counted exactly as the parent counted them at the transport.
 */
import { decodeEntities } from '../html-entities.mjs';
import {
  fetchText,
  delay,
  computeRetryDelayMs,
  REDIRECT_REFUSAL_CAUSE_MESSAGE,
  BROWSER_LIKE_USER_AGENT,
} from '../http-json.mjs';

const UA = BROWSER_LIKE_USER_AGENT;

export const meta = {
  value: 'bwi',
  label: 'BWI',
  region: 'en',
};

export const LIST_URL = 'https://www.bwi.de/karriere/stellenangebote';
export const ALLOWED_HOST = 'www.bwi.de';

// Parent retry budget (1 attempt + 2 retries on a transient failure).
export const RETRIES = 2;
export const RETRY_DELAY_MS = 500;
export const RETRY_MAX_DELAY_MS = 8000;

// Pause between detail requests (same pacing as the parent's peoplesoft).
export const INTER_REQUEST_DELAY_MS = 300;

// Wide on purpose — see the note above. Picks enrichment candidates only.
const RELEVANT = /security|secops|sicherheit|soc|cyber|forensik|forensic|incident|detection|siem|analyst|defense|abwehr/i;
export const DETAIL_BUDGET = 45;
export const DETAIL_LIMIT_MAX = 100;

/**
 * Reject anything that is not an HTTPS URL on the BWI careers host. Detail
 * URLs come out of the listing page's JSON-LD, i.e. from remote content, so
 * they are validated before being fetched.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertBwiUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`bwi: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`bwi: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== ALLOWED_HOST)
    throw new Error(`bwi: untrusted hostname "${parsed.hostname}" — must be ${ALLOWED_HOST}`);
  return url;
}

const JOB_URL_RE = /"url":\s*"(https:\/\/www\.bwi\.de\/karriere\/stellenangebote\/job\/[^"]+)"/g;
const LD_JSON_RE = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Read the `bwi:` block of an entry: fetchDetails is opt-in (true only), and
 * detailLimit is a cap in 1..100 — it is never what turns enrichment on.
 * @param {any} entry
 * @returns {{ fetchDetails: boolean, detailLimit: number }}
 */
export function parseBwiConfig(entry) {
  const cfg = (entry && entry.bwi) || {};
  const n = Number(cfg.detailLimit);
  return {
    fetchDetails: cfg.fetchDetails === true,
    detailLimit: Number.isInteger(n) && n >= 1 && n <= DETAIL_LIMIT_MAX ? n : DETAIL_BUDGET,
  };
}

// Trailing `-m-w-d-69624` / `-m-d-w-69624` / bare `-69624` is boilerplate, not title.
const SLUG_TAIL_RE = /-(?:m-w-d|m-d-w|w-m-d|d-m-w)?-?\d{4,6}$/i;

/**
 * Rebuild a readable title from a posting URL's slug — the listing's ItemList
 * carries no title, only the URL. The `(m/w/d)` gender marker is boilerplate
 * in the slug but restored as a suffix.
 * @param {string} url
 * @returns {string}
 */
export function slugToTitle(url) {
  let slug;
  try {
    slug = new URL(url).pathname.split('/').pop() || '';
  } catch {
    return '';
  }
  const gendered = /-(?:m-w-d|m-d-w|w-m-d|d-m-w)-?\d{4,6}$/i.test(slug);
  const core = slug.replace(SLUG_TAIL_RE, '');
  if (!core) return '';
  const words = core
    .split('-')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(' ') + (gendered ? ' (m/w/d)' : '');
}

/**
 * Every on-host https job URL in the listing page's CollectionPage ItemList,
 * deduplicated, first-seen order. The regex matches ONLY
 * `https://www.bwi.de/karriere/stellenangebote/job/…`, so an off-host or
 * plain-HTTP url embedded in the same JSON-LD is never collected.
 * @param {string} html
 * @returns {string[]}
 */
export function collectJobUrls(html) {
  const urls = [];
  const seen = new Set();
  for (const m of String(html).matchAll(JOB_URL_RE)) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      urls.push(m[1]);
    }
  }
  return urls;
}

/**
 * The JobPosting ld+json block of a detail page. Detail pages carry several
 * ld+json blocks (and sometimes a malformed one); only the JobPosting is
 * useful, null when there is none.
 * @param {string} html
 * @returns {any}
 */
export function parseJobPosting(html) {
  for (const m of String(html).matchAll(LD_JSON_RE)) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue; // malformed block — try the next one
    }
    if (data && data['@type'] === 'JobPosting') return data;
  }
  return null;
}

function localityOf(posting) {
  const loc = posting?.jobLocation;
  const first = Array.isArray(loc) ? loc[0] : loc;
  const city = first?.address?.addressLocality;
  return typeof city === 'string' ? city.trim() : '';
}

/**
 * `fetchText` with the parent's retry budget. Only transient failures are
 * retried: HTTP 429, HTTP 5xx, and network errors that carry no status. A
 * permanent 4xx (which is how the exhausted detail budget surfaces), and a
 * refused redirect (undici's `unexpected redirect`), are rethrown at once.
 * @param {Function} fetchImpl
 * @param {string} url
 * @param {{ signal?: AbortSignal, retries: number, retryDelayMs: number,
 *           headers: Record<string, string> }} o
 */
async function fetchTextWithRetry(fetchImpl, url, { signal, retries, retryDelayMs, headers }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchText(/** @type {any} */ (fetchImpl), url, { signal, headers, redirect: 'error' });
    } catch (err) {
      lastErr = err;
      const status = err && typeof err.status === 'number' ? err.status : undefined;
      const redirectRefusal = status === undefined
        && err instanceof TypeError
        && err?.cause?.message === REDIRECT_REFUSAL_CAUSE_MESSAGE;
      const transient = !redirectRefusal && (status === undefined || status === 429 || status >= 500);
      if (!transient || attempt === retries || signal?.aborted) throw err;
      await delay(computeRetryDelayMs({
        attempt, baseDelayMs: retryDelayMs, maxDelayMs: RETRY_MAX_DELAY_MS, retryAfter: err?.retryAfter,
      }), signal);
    }
  }
  throw lastErr;
}

const PAGE_HEADERS = { 'User-Agent': UA, Accept: 'text/html' };

/**
 * Fetch + normalize the BWI listing (one request) with optional bounded
 * detail enrichment.
 *
 * @param {string} endpoint - the listing URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           detailDelayMs?: number, retries?: number, retryDelayMs?: number }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchBwi(endpoint, opts = {}) {
  const {
    fetchImpl = fetch,
    signal,
    company = {},
    detailDelayMs = INTER_REQUEST_DELAY_MS,
    retries = RETRIES,
    retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  const entry = company ?? {};
  assertBwiUrl(endpoint);

  const listing = await fetchTextWithRetry(fetchImpl, endpoint, { signal, retries, retryDelayMs, headers: PAGE_HEADERS });
  const urls = collectJobUrls(listing);
  const jobs = urls
    .map(url => ({ url, title: slugToTitle(url), location: '' }))
    .filter(j => j.title)
    .map(j => normalize(j, entry));

  // Detail enrichment is opt-in, and never on by default: a scan is ONE
  // request unless the entry asks for more. detailLimit caps the loop; it is
  // never what turns it on.
  const { fetchDetails, detailLimit } = parseBwiConfig(entry);
  if (!fetchDetails) return jobs;

  // detailLimit caps HTTP requests, retries included: fetchTextWithRetry may
  // make several attempts per posting, so the budget is counted at the
  // transport, not per candidate. Once it is spent the next attempt fails
  // with a non-retryable error and the loop stops.
  let requests = 0;
  const budgetedFetch = async (url, fetchOpts) => {
    if (requests >= detailLimit) {
      const err = new Error('bwi: detail request budget exhausted');
      // A 4xx status marks the error non-retryable in the retry helper.
      err.status = 400;
      throw err;
    }
    requests++;
    return fetchImpl(url, fetchOpts);
  };

  for (const job of jobs) {
    if (requests >= detailLimit) break;
    if (signal?.aborted) break;
    if (!RELEVANT.test(job.url)) continue;
    if (detailDelayMs > 0) await delay(detailDelayMs, signal);
    try {
      // assertBwiUrl() runs before the request is built, so a hostile URL
      // throws here and is never fetched or retried.
      const posting = parseJobPosting(
        await fetchTextWithRetry(budgetedFetch, assertBwiUrl(job.url), { signal, retries, retryDelayMs, headers: PAGE_HEADERS }),
      );
      if (!posting) continue;
      if (typeof posting.title === 'string' && posting.title.trim()) {
        job.title = decodeEntities(posting.title);
      }
      job.location = decodeEntities(localityOf(posting));
    } catch {
      // Detail enrichment is best-effort — keep the slug-derived title.
    }
  }

  return jobs;
}

function normalize(j, entry) {
  return {
    id: `bwi-${j.url.split('/').pop()}`,
    title: j.title,
    company: String(entry?.name ?? ''),
    url: j.url,
    salary: '',
    location: j.location || '',
    isRemote: /remote|удал[её]н/i.test(j.title),
    workplaceType: '',
    relocates: false,
    date: '',
    snippet: '',
    source: 'bwi',
  };
}
