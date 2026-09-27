// @ts-check
/**
 * Eploy source — reads a tenant's public `/live-jobs.xml` sitemap, which lists
 * the tenant's complete live vacancy inventory:
 *
 *   GET {careers origin}/live-jobs.xml
 *   → <urlset><url><loc>https://{host}/vacancies/{id}/{slug}.html</loc>…</url></urlset>
 *
 * Ported from parent career-ops `providers/eploy.mjs` and rewritten to the
 * web-ui source contract (12-field job objects + `meta` for auto-discovery).
 *
 * Why the sitemap: the Eploy results page is an ASP.NET Web Forms pager whose
 * stateful POST flow needs cookies and redirects between pages. The sitemap is
 * anonymous, server-rendered, served on branded careers domains as well as on
 * `<tenant>.eploy.net`, and fits in one request. A single request means no page
 * cap applies. The dead-board contract is simple: a failure on that one request
 * propagates, so the scanner logs it and can quarantine a permanent 404/410.
 *
 * Per-tenant with arbitrary branded domains: branded hosts share no suffix, so
 * the adapter matches an explicit `provider: eploy` only. Since there is no
 * suffix to pin, `resolveEployOrigin` rejects anything that is not a public
 * HTTPS hostname: no IP literals, no loopback or internal names, no
 * single-label hosts, no credentials, no custom port. Every fetch uses
 * `redirect:'error'`, and `fetchText` adds the DNS-rebinding guard on the real
 * network path.
 *
 * `<loc>` values are host-controlled data. Only the tenant's own origin and a
 * canonical `*.eploy.net` host are accepted, and only on the
 * `/vacancies/{id}/{slug}.html` path, so a hostile sitemap cannot redirect the
 * opt-in detail fetches to an arbitrary host.
 *
 * `<lastmod>` is deliberately NOT mapped to `date`: it is a modification
 * timestamp, not the publication date. Without detail enrichment the title is
 * rebuilt from the job-page slug and the location stays empty.
 *
 * Optional enrichment (per entry):
 *
 *   tracked_companies:
 *     - name: Example employer
 *       provider: eploy
 *       careers_url: https://careers.example.com/vacancies/
 *       eploy:
 *         fetchDetails: false  # optional; exact title/location/JD enrichment
 *         detailLimit: 25      # 1..100, default 25
 *
 * Detail pages are fetched in batches of 3 with a 250 ms pause between batches.
 * Each detail is fail-soft: an error keeps the sitemap row as it was.
 *
 * Used by the eploy adapter (server/lib/portals/adapters/eploy.mjs).
 */
import {
  fetchText,
  delay,
  computeRetryDelayMs,
  REDIRECT_REFUSAL_CAUSE_MESSAGE,
  BROWSER_LIKE_USER_AGENT,
} from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText } from '../html-to-text.mjs';

export const meta = {
  value: 'eploy',
  label: 'Eploy',
  region: 'en',
};

export const FEED_PATH = '/live-jobs.xml';
const JOB_PATH_RE = /^\/vacancies\/(\d+)\/([^/?#]+)\.html\/?$/i;
export const DETAIL_BATCH = 3;
export const DETAIL_PACE_MS = 250;
const DEFAULT_DETAIL_LIMIT = 25;
const MAX_DETAIL_LIMIT = 100;
const SNIPPET_CAP = 500;
// Matches the parent's fetchTextWithRetry budget: 1 attempt + 2 retries on a
// transient failure (429, 5xx, or a network error without a status).
const RETRIES = 2;
const RETRY_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 4000;

const HEADERS_XML = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  accept: 'application/xml, text/xml;q=0.9, */*;q=0.8',
};
const HEADERS_HTML = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.8',
};

/** @param {unknown} value */
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Parse a configured careers URL into its public HTTPS origin, or null.
 *
 * Eploy supports arbitrary branded domains, so there is no host suffix to pin
 * against. This keeps that flexibility while refusing loopback, IP literals,
 * internal-only names, single-label hosts, credentials and custom ports.
 * Redirects are refused separately on every request.
 *
 * Exported for tests and for the adapter.
 * @param {unknown} raw careers URL (or a feed URL on the same origin)
 * @returns {URL|null}
 */
export function resolveEployOrigin(raw) {
  let parsed;
  try {
    parsed = new URL(text(raw));
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return null;
  let host = parsed.hostname.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (!host) return null;
  if (host.startsWith('[') || host.includes(':')) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  if (host === 'localhost' || host === 'localhost.localdomain' || host.endsWith('.localhost')) return null;
  if (host.endsWith('.local') || host.endsWith('.internal')) return null;
  if (!host.includes('.')) return null;
  return new URL(`https://${host}`);
}

/**
 * The live-jobs sitemap URL for a validated origin.
 * @param {URL} origin
 */
export function buildFeedUrl(origin) {
  return new URL(FEED_PATH, origin).href;
}

/**
 * Throwing guard for the fetch slot: returns the validated origin.
 * @param {string} url
 * @returns {URL}
 */
export function assertEployUrl(url) {
  const origin = resolveEployOrigin(url);
  if (!origin) throw new Error(`eploy: "${url}" is not a public HTTPS careers URL`);
  return origin;
}

/**
 * A branded sitemap normally links to its own origin. Some tenants publish the
 * canonical `<tenant>.eploy.net` job URL instead. Only those two forms are
 * accepted. An arbitrary off-site `<loc>` is data, and does not widen the
 * fetch boundary.
 *
 * Exported for tests.
 * @param {URL} url
 * @param {URL} origin
 */
export function isAllowedJobUrl(url, origin) {
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const sameHost = host === origin.hostname.toLowerCase();
  const eployHost = host.endsWith('.eploy.net') && host !== 'eploy.net';
  return url.protocol === 'https:'
    && !url.username
    && !url.password
    && !url.port
    && !url.search
    && !url.hash
    && (sameHost || eployHost)
    && JOB_PATH_RE.test(url.pathname);
}

const ACRONYMS = new Map([
  ['ai', 'AI'], ['api', 'API'], ['cio', 'CIO'], ['cto', 'CTO'], ['eu', 'EU'],
  ['hcm', 'HCM'], ['hr', 'HR'], ['it', 'IT'], ['ml', 'ML'], ['qa', 'QA'],
  ['uk', 'UK'], ['ui', 'UI'], ['ux', 'UX'],
]);

/**
 * Rebuild a readable title from a job-page slug. A double hyphen marks a
 * separator (`implementation-consultant--hcm` becomes
 * `Implementation Consultant - HCM`). Each word is capitalized and a small set
 * of known acronyms is upper-cased. Parent quirk, kept on purpose: small words
 * are capitalized too ("Learning And Development Advisor").
 *
 * Exported for tests.
 * @param {string} slug
 */
export function titleFromSlug(slug) {
  let decoded;
  try { decoded = decodeURIComponent(slug); } catch { decoded = slug; }
  return decoded.split(/--+/).map((segment) => segment
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => {
      const acronym = ACRONYMS.get(word.toLowerCase());
      return acronym || (word ? word[0].toUpperCase() + word.slice(1) : '');
    })
    .join(' ')
    .trim())
    .filter(Boolean)
    .join(' - ');
}

/**
 * Parse the standard Eploy live-jobs sitemap into web-ui job objects.
 *
 * An empty body, or a valid empty `<urlset>`, is an empty board. A non-empty
 * body that is not a sitemap throws, so a login page or a template change
 * cannot pass as zero vacancies. One vacancy ID listed on both the branded
 * and the `*.eploy.net` host is kept once, and the first `<loc>` wins.
 *
 * Exported for tests.
 * @param {unknown} xml
 * @param {URL} origin validated tenant origin
 * @param {string} [company]
 */
export function parseEploySitemap(xml, origin, company = '') {
  if (typeof xml !== 'string' || !xml.trim()) return [];
  if (!/<urlset\b[^>]*>/i.test(xml)) {
    throw new Error('eploy: unexpected live-jobs.xml response (expected an XML urlset)');
  }

  const originHost = origin.hostname.toLowerCase();
  const jobs = [];
  const seen = new Set();
  for (const match of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url\s*>/gi)) {
    const rawLoc = match[1].match(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/i)?.[1];
    if (!rawLoc) continue;
    let parsed;
    try { parsed = new URL(decodeEntities(rawLoc.trim())); } catch { continue; }
    if (!isAllowedJobUrl(parsed, origin)) continue;
    const path = parsed.pathname.match(JOB_PATH_RE);
    const vacancyId = path?.[1];
    if (!path || !vacancyId || seen.has(vacancyId)) continue;
    const title = titleFromSlug(path[2]);
    if (!title) continue;
    seen.add(vacancyId);
    jobs.push({
      id: `eploy-${originHost}-${vacancyId}`,
      title,
      company: text(company),
      url: parsed.href,
      salary: '',
      location: '',
      isRemote: false,
      workplaceType: '',
      relocates: false,
      date: '',
      snippet: '',
      source: 'eploy',
    });
  }
  return jobs;
}

/** @param {any} address */
function locationFromAddress(address) {
  if (!address || typeof address !== 'object') return '';
  const country = typeof address.addressCountry === 'object'
    ? text(address.addressCountry?.name)
    : text(address.addressCountry);
  return [...new Set([
    text(address.addressLocality), text(address.addressRegion), country,
  ].filter(Boolean))].join(', ');
}

/** @param {any} value */
function isJobPosting(value) {
  const type = value?.['@type'];
  return type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
}

/** @param {any} value @returns {any[]} */
function flattenJsonLd(value) {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== 'object') return [];
  return [value, ...flattenJsonLd(value['@graph'])];
}

/**
 * Parse an Eploy detail page. Two shapes have been seen: newer themes emit a
 * schema.org JobPosting JSON-LD block, and legacy themes expose Web Forms
 * location fields plus an HTML meta description. Malformed detail data gives
 * no enrichment. Parent quirk, kept on purpose: when no usable JSON-LD is
 * found, the legacy branch always returns `{ location, description }`, even
 * when both are empty.
 *
 * Exported for tests.
 * @param {unknown} html
 * @returns {{ title?: string, location?: string, description?: string, postedAt?: number }}
 */
export function parseEployDetail(html) {
  if (typeof html !== 'string' || !html.trim()) return {};
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    let parsed;
    try { parsed = JSON.parse(match[1]); } catch { continue; }
    const posting = flattenJsonLd(parsed).find(isJobPosting);
    if (!posting) continue;
    const jobLocations = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation];
    const location = jobLocations.map((item) => locationFromAddress(item?.address)).filter(Boolean).join('; ');
    const date = Date.parse(text(posting.datePosted));
    return {
      title: htmlToText(text(posting.title)),
      location,
      description: htmlToText(posting.description),
      ...(Number.isFinite(date) ? { postedAt: date } : {}),
    };
  }

  const locationBlock = html.match(/id=["'][^"']*VacV_(?:All)?Location(?:ID)?[^"']*["'][\s\S]{0,1200}?class=["']content["'][^>]*>([\s\S]*?)<\/div\s*>/i)?.[1] || '';
  const metaDescription = html.match(/<meta\b(?=[^>]*\bname=["']description["'])(?=[^>]*\bcontent=["']([\s\S]*?)["'])[^>]*>/i)?.[1] || '';
  return {
    location: htmlToText(locationBlock),
    description: htmlToText(metaDescription),
  };
}

/** Clamp to an integer in [min, max], using `def` when the value is not numeric. */
function intInRange(val, def, min, max) {
  if (val === undefined || val === null || val === '') return def;
  const n = Number(val);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * Read the entry's optional `eploy:` block. Exported for tests.
 * @param {any} company
 */
export function parseEployConfig(company) {
  const cfg = company && typeof company.eploy === 'object' && company.eploy ? company.eploy : {};
  return {
    fetchDetails: cfg.fetchDetails === true,
    detailLimit: intInRange(cfg.detailLimit, DEFAULT_DETAIL_LIMIT, 1, MAX_DETAIL_LIMIT),
  };
}

/**
 * `fetchText` with the parent's retry budget. Only transient failures are
 * retried: HTTP 429, HTTP 5xx, and network errors that carry no status. A
 * permanent 4xx, and a refused redirect (undici's `unexpected redirect`), are
 * rethrown at once.
 * @param {Function} fetchImpl
 * @param {string} url
 * @param {{ signal?: AbortSignal, headers: Record<string,string>,
 *           sleep: (ms: number, signal?: AbortSignal) => Promise<void>, retryDelayMs: number }} o
 */
async function fetchTextWithRetry(fetchImpl, url, { signal, headers, sleep, retryDelayMs }) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      return await fetchText(/** @type {any} */ (fetchImpl), url, { signal, headers, redirect: 'error' });
    } catch (err) {
      lastErr = err;
      const status = err && typeof err.status === 'number' ? err.status : undefined;
      const redirectRefusal = status === undefined
        && err instanceof TypeError
        && err?.cause?.message === REDIRECT_REFUSAL_CAUSE_MESSAGE;
      const transient = !redirectRefusal && (status === undefined || status === 429 || status >= 500);
      if (!transient || attempt === RETRIES || signal?.aborted) throw err;
      await sleep(computeRetryDelayMs({
        attempt, baseDelayMs: retryDelayMs, maxDelayMs: RETRY_MAX_DELAY_MS, retryAfter: err?.retryAfter,
      }), signal);
    }
  }
  throw lastErr;
}

/**
 * Apply a parsed detail onto a sitemap row. Only non-empty fields overwrite.
 * @param {any} job
 * @param {ReturnType<typeof parseEployDetail>} detail
 */
function applyDetail(job, detail) {
  if (text(detail.title)) job.title = text(detail.title);
  if (text(detail.location)) {
    job.location = text(detail.location);
    job.isRemote = /\bremote\b/i.test(job.location);
    if (job.isRemote) job.workplaceType = 'Remote';
  }
  if (text(detail.description)) {
    job.description = text(detail.description);
    job.snippet = job.description.slice(0, SNIPPET_CAP);
  }
  if (Number.isFinite(detail.postedAt)) {
    job.date = new Date(/** @type {number} */ (detail.postedAt)).toISOString().slice(0, 10);
  }
}

/**
 * Fetch and normalize one Eploy tenant.
 *
 * The endpoint's origin is re-validated before any I/O. The sitemap request
 * failing is a real error and propagates. Detail enrichment is opt-in,
 * bounded by `detailLimit`, batched, paced, and fail-soft per job. When
 * `maxPages` is a positive integer (a bounded probe), details are skipped.
 *
 * @param {string} endpoint feed URL from the adapter's buildEndpoint
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any, maxPages?: number,
 *           sleep?: (ms: number, signal?: AbortSignal) => Promise<void>, retryDelayMs?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchEploy(endpoint, opts = {}) {
  const {
    fetchImpl = fetch,
    signal,
    company = {},
    maxPages,
    sleep = delay,
    retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  const origin = assertEployUrl(endpoint);
  const feedUrl = buildFeedUrl(origin);
  const io = { signal, sleep, retryDelayMs };

  const xml = await fetchTextWithRetry(fetchImpl, feedUrl, { ...io, headers: HEADERS_XML });
  const jobs = parseEploySitemap(xml, origin, text(company?.name));

  const probing = Number.isInteger(maxPages) && /** @type {number} */ (maxPages) > 0;
  const { fetchDetails, detailLimit } = parseEployConfig(company);
  if (!fetchDetails || probing || jobs.length === 0) return jobs;

  const candidates = jobs.slice(0, detailLimit);
  for (let i = 0; i < candidates.length; i += DETAIL_BATCH) {
    if (signal?.aborted) break;
    const batch = candidates.slice(i, i + DETAIL_BATCH);
    await Promise.all(batch.map(async (job) => {
      try {
        const detailUrl = new URL(job.url);
        if (!isAllowedJobUrl(detailUrl, origin)) return;
        const html = await fetchTextWithRetry(fetchImpl, detailUrl.href, { ...io, headers: HEADERS_HTML });
        applyDetail(job, parseEployDetail(html));
      } catch {
        // Detail lookup is opt-in enrichment. Keep the sitemap row on failure.
      }
    }));
    if (i + DETAIL_BATCH < candidates.length) await sleep(DETAIL_PACE_MS, signal);
  }
  return jobs;
}
