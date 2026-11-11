// @ts-check
/**
 * Generic employer job sitemap source (CAR-254 port of the parent's
 * providers/sitemap.mjs, upstream #6631). Target list: `tracked_companies:`,
 * one employer per entry, explicit-only (`provider: sitemap`).
 *
 * Some employers expose no public ATS API, or the ATS API host disallows
 * crawlers, while their own careers site publishes a standard sitemap
 * (https://www.sitemaps.org/protocol.html) listing every live job URL. This
 * source reads that sitemap:
 *
 *   - name: ExampleCo
 *     provider: sitemap
 *     careers_url: https://careers.example.com/jobs/
 *     sitemap:
 *       url: https://careers.example.com/sitemap.xml
 *       job_path: '^/jobs/(?<posting_id>\d+)/(?<slug>[^/]+)/?$'
 *       index_filter: 'jobs'   # optional: regex over child <loc> in a sitemapindex
 *       max_sitemaps: 50       # optional: child sitemaps read from an index (1..1000)
 *       fetchDetails: false    # optional: JSON-LD JobPosting enrichment
 *       detailLimit: 25        # optional: 1..200 detail pages per scan
 *
 * `job_path` is a regex over each `<loc>` pathname. It must declare a
 * `(?<slug>…)` group, which supplies the title. `(?<posting_id>…)` maps to
 * `externalId` (the ATS posting id) and `(?<req_id>…)` to `requisitionId`
 * (the employer's requisition id).
 *
 * Compliance. Every sitemap, child sitemap and detail URL is checked
 * against the site's robots.txt (RFC 9309) through robots-check.mjs before
 * it is fetched: a disallowed top-level sitemap is a named error, a
 * disallowed child or detail page is skipped and reported. robots-check
 * fails closed (5xx, timeouts, a soft-200 page that is not a robots.txt all
 * deny) and caches one policy per origin per process, inside RFC 9309
 * §2.4's 24-hour ceiling. The gate is injectable (opts.robotsGate) so tests
 * run offline.
 *
 * Protocol rules applied (sitemaps.org 0.9):
 *   - A sitemap file holds at most 50,000 URLs and 50 MB uncompressed: rows
 *     past 50,000 are dropped with a warning, and a body over 50 MB (checked
 *     after the read — the web-ui transport has no mid-stream body cap) is a
 *     named error. Gzipped (`.gz`) sitemaps are refused with a named error.
 *   - URLs in a sitemap, and child sitemaps in an index, must be on the
 *     sitemap's own host; anything else is dropped.
 *   - A sitemap index may not list another index: one found is skipped and
 *     reported, so the walk is depth 1 by construction.
 *   - `<lastmod>` is a modification date, not a publication date, so it is
 *     NOT mapped to a posting date (the same call the eploy source makes).
 *
 * Detail enrichment (opt-in) reads schema.org JobPosting JSON-LD
 * (https://schema.org/JobPosting) for the exact title, location,
 * description and datePosted. It is bounded by `detailLimit`, paced,
 * retry-wrapped, skipped while probing (`opts.maxPages`), and fails open: a
 * detail page that errors keeps the sitemap row. career-ops does not work
 * around bot protection; on a site that challenges its User-Agent, leave
 * fetchDetails off. An optional `titleWanted(title)` hook (the parent's
 * scan.mjs passes one; the web-ui scanner passes none today) narrows the
 * enrichment candidates to the titles the scan keeps, so detail requests
 * scale with relevant postings rather than board size.
 *
 * Truncation is never silent: every cap that drops rows or sitemaps prints
 * a `⚠️  sitemap:` line naming the knob to raise.
 *
 * Used by the sitemap adapter (server/lib/portals/adapters/sitemap.mjs).
 */
import { robotsAllows } from '../robots-check.mjs';
import { titleFromSlug } from './eploy.mjs';
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { fetchTextWithRetry, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';

// Slug-to-title logic is eploy's; re-exported so callers of this module keep one import.
export { titleFromSlug };

export const meta = {
  value: 'sitemap',
  label: 'Sitemap',
  region: 'en',
};

/** sitemaps.org: at most 50,000 URLs per sitemap file. */
export const MAX_URLS_PER_SITEMAP = 50_000;
/** sitemaps.org: at most 50 MB (52,428,800 bytes) per file, uncompressed. */
export const MAX_SITEMAP_BYTES = 52_428_800;
const DEFAULT_MAX_SITEMAPS = 50;
const MAX_SITEMAPS_CAP = 1000;
const DEFAULT_DETAIL_LIMIT = 25;
const DETAIL_LIMIT_CAP = 200;
const DETAIL_BATCH = 3;
const DETAIL_PACE_MS = 250;

const HEADERS_XML = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  accept: 'application/xml, text/xml;q=0.9, */*;q=0.8',
};
const HEADERS_HTML = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.8',
};

/** Clamp to an integer in [min, max], using `def` when the value is not numeric. */
function intInRange(val, def, min, max) {
  if (val === undefined || val === null || val === '') return def;
  const n = Number(val);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** @param {unknown} value */
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** @param {string} message */
function warn(message) {
  console.error(`⚠️  sitemap: ${message}`);
}

/**
 * The sitemap URL comes from portals.yml and names an arbitrary employer
 * host, so there is no vendor allowlist to check (the eploy shape). Refuse
 * what can never be a public careers site; the central DNS guard in
 * http-json covers DNS-level private addresses on every real request.
 * @param {unknown} raw
 * @returns {URL|null}
 */
export function resolveSitemapUrl(raw) {
  let parsed;
  try {
    parsed = new URL(text(raw));
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return null;
  let host = parsed.hostname.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (host.startsWith('[') || host.includes(':')) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  if (host === 'localhost' || host === 'localhost.localdomain') return null;
  if (host.endsWith('.local') || host.endsWith('.internal')) return null;
  if (!host.includes('.')) return null;
  parsed.hash = '';
  return new URL(`https://${host}${parsed.pathname}${parsed.search}`);
}

/**
 * @param {unknown} source
 * @param {string} field
 * @returns {RegExp}
 */
function compileRegex(source, field) {
  const pattern = text(source);
  if (!pattern) throw new Error(`sitemap: ${field} is required`);
  try {
    return new RegExp(pattern);
  } catch (err) {
    throw new Error(`sitemap: ${field} is not a valid regex (${/** @type {Error} */ (err).message})`);
  }
}

/**
 * Validate one entry's `sitemap:` block. Throws a descriptive error on a
 * config problem so the run reports it against the entry. Exported for tests.
 * @param {any} entry
 */
export function parseSitemapConfig(entry) {
  const cfg = entry?.sitemap && typeof entry.sitemap === 'object' ? entry.sitemap : {};
  const url = resolveSitemapUrl(cfg.url);
  if (!url) {
    throw new Error(`sitemap: entry "${text(entry?.name) || '(unnamed)'}" needs sitemap.url, a public https URL`);
  }
  if (/\.gz$/i.test(url.pathname)) {
    throw new Error('sitemap: gzipped sitemaps (.gz) are not supported; point sitemap.url at the uncompressed XML');
  }
  const jobPath = compileRegex(cfg.job_path, 'job_path');
  if (!/\(\?<slug>/.test(jobPath.source)) {
    throw new Error('sitemap: job_path must declare a (?<slug>...) group for the title');
  }
  return {
    url,
    jobPath,
    indexFilter: text(cfg.index_filter) ? compileRegex(cfg.index_filter, 'index_filter') : null,
    maxSitemaps: intInRange(cfg.max_sitemaps, DEFAULT_MAX_SITEMAPS, 1, MAX_SITEMAPS_CAP),
    fetchDetails: cfg.fetchDetails === true,
    detailLimit: intInRange(cfg.detailLimit, DEFAULT_DETAIL_LIMIT, 1, DETAIL_LIMIT_CAP),
  };
}

/**
 * Same host as the sitemap (sitemaps.org's same-site rule), https, no
 * credentials or port.
 * @param {URL} url
 * @param {URL} sitemapUrl
 */
function isSameSiteUrl(url, sitemapUrl) {
  return url.protocol === 'https:'
    && !url.username
    && !url.password
    && !url.port
    && url.hostname.toLowerCase().replace(/\.$/, '') === sitemapUrl.hostname.toLowerCase();
}

/** @param {string} block */
function locOf(block) {
  const raw = block.match(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/i)?.[1];
  if (!raw) return '';
  return decodeEntities(raw.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim());
}

/**
 * Remove XML comments with a linear scan (not a regex replace, which can
 * leave a `<!--` behind when comments abut or nest). An unterminated `<!--`
 * drops the rest of the document, so a root it swallowed reads as truncated.
 * Exported for tests.
 * @param {string} xml
 */
export function stripXmlComments(xml) {
  let out = '';
  let i = 0;
  for (;;) {
    const open = xml.indexOf('<!--', i);
    if (open === -1) return out + xml.slice(i);
    out += xml.slice(i, open);
    const close = xml.indexOf('-->', open + 4);
    if (close === -1) return out;
    i = close + 3;
  }
}

/**
 * Classify and read one sitemap document. Exported for tests.
 *
 * @param {unknown} raw
 * @returns {{kind: 'urlset', locs: string[]} | {kind: 'index', locs: string[]}}
 * @throws when the body is empty, or neither a `<urlset>` nor a
 *   `<sitemapindex>` (a challenge or login page must not read as zero jobs).
 */
export function parseSitemapDocument(raw) {
  // A 200 with no body is not a sitemap: a valid empty board is an empty
  // <urlset>, so a zero-byte answer must not read as zero jobs.
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('sitemap: empty response (expected an XML <urlset> or <sitemapindex>)');
  }
  // XML comments are not markup: a `<url>` or `</urlset>` inside one must not
  // count as an entry or close a truncated root.
  const xml = stripXmlComments(raw);
  // A root that opens but never closes is a truncated body, not a short
  // board (sitemaps.org requires the closing tag; the eploy source applies
  // the same rule to its company sitemap). A self-closing empty root is
  // complete.
  /** @param {string} tag */
  const complete = (tag) => new RegExp(`<${tag}\\b[^>]*\\/>|<${tag}\\b[^>]*>[\\s\\S]*<\\/${tag}\\s*>`, 'i').test(xml);
  /** @param {string} tag */
  const incomplete = (tag) => new Error(`sitemap: truncated response (<${tag}> without a closing </${tag}>)`);
  if (/<sitemapindex\b[^>]*>/i.test(xml)) {
    if (!complete('sitemapindex')) throw incomplete('sitemapindex');
    const locs = [];
    for (const m of xml.matchAll(/<sitemap\b[^>]*>([\s\S]*?)<\/sitemap\s*>/gi)) {
      const loc = locOf(m[1]);
      if (loc) locs.push(loc);
    }
    return { kind: 'index', locs };
  }
  if (/<urlset\b[^>]*>/i.test(xml)) {
    if (!complete('urlset')) throw incomplete('urlset');
    const locs = [];
    for (const m of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url\s*>/gi)) {
      const loc = locOf(m[1]);
      if (loc) locs.push(loc);
    }
    return { kind: 'urlset', locs };
  }
  throw new Error('sitemap: unexpected response (expected an XML <urlset> or <sitemapindex>)');
}

/**
 * Turn `<loc>` values into parent-shape job rows: same host, path matches
 * job_path, one row per URL (and per posting id when the URL carries one).
 * Exported for tests.
 *
 * @param {string[]} locs
 * @param {{ url: URL, jobPath: RegExp }} cfg
 * @param {string} company
 */
export function jobsFromLocs(locs, cfg, company) {
  const jobs = [];
  const seen = new Set();
  for (const loc of locs) {
    let parsed;
    try { parsed = new URL(loc); } catch { continue; }
    if (!isSameSiteUrl(parsed, cfg.url)) continue;
    const match = parsed.pathname.match(cfg.jobPath);
    const slug = match?.groups?.slug;
    if (!slug) continue;
    const title = titleFromSlug(slug);
    if (!title) continue;
    const postingId = text(match.groups?.posting_id);
    const reqId = text(match.groups?.req_id);
    parsed.hash = '';
    const key = postingId || parsed.href;
    if (seen.has(key)) continue;
    seen.add(key);
    /** @type {any} */
    const job = { title, url: parsed.href, company, location: '' };
    if (postingId) job.externalId = postingId;
    if (reqId) job.requisitionId = reqId;
    jobs.push(job);
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
 * schema.org JobPosting from a detail page's JSON-LD. Malformed or missing
 * data yields `{}` (no enrichment), never a throw. Exported for tests.
 * @param {unknown} html
 * @returns {{title?: string, location?: string, description?: string, postedAt?: number}}
 */
export function parseJobPostingJsonLd(html) {
  if (typeof html !== 'string' || !html.trim()) return {};
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    let parsed;
    try { parsed = JSON.parse(match[1]); } catch { continue; }
    const posting = flattenJsonLd(parsed).find(isJobPosting);
    if (!posting) continue;
    const jobLocations = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation];
    const location = jobLocations.map((item) => locationFromAddress(item?.address)).filter(Boolean).join('; ');
    const date = Date.parse(text(posting.datePosted));
    /** @type {{title?: string, location?: string, description?: string, postedAt?: number}} */
    const out = {};
    const title = decodeEntities(text(posting.title));
    if (title) out.title = title;
    if (location) out.location = location;
    const description = htmlToText(posting.description);
    if (description) out.description = description;
    if (Number.isFinite(date)) out.postedAt = date;
    return out;
  }
  return {};
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  return {
    id: `sitemap-${row.url}`,
    title: row.title,
    company: row.company,
    url: row.url,
    salary: '',
    location: row.location || '',
    isRemote: /remote|удал[её]н/i.test(`${row.title} ${row.location}`),
    workplaceType: '',
    relocates: false,
    // <lastmod> is a modification date, deliberately never a posting date.
    date: typeof row.postedAt === 'number' ? new Date(row.postedAt).toISOString() : '',
    snippet: row.description || '',
    ...(row.description ? { description: row.description } : {}),
    ...(row.externalId ? { externalId: row.externalId } : {}),
    ...(row.requisitionId ? { requisitionId: row.requisitionId } : {}),
    source: 'sitemap',
  };
}

/**
 * Fetch + normalize one employer's job sitemap.
 *
 * @param {string} endpoint - the sitemap URL from the adapter (re-validated
 *   here against the entry's own config before any request).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any,
 *           sleep?: (ms: number) => Promise<void>, maxPages?: number,
 *           robotsGate?: (url: string) => Promise<{allowed: boolean, code: string, reason: string}>,
 *           titleWanted?: (title: string) => boolean }} [opts]
 *   `robotsGate` defaults to robots-check.mjs `robotsAllows`; tests inject
 *   one so no robots.txt is fetched over the network. `maxPages` (a positive
 *   integer) is the probe budget: one request on a urlset, one child of an
 *   index, no detail pages. `titleWanted` is the parent scan ctx hook; the
 *   scanner threads its compiled title filter as the hook since CAR-264
 *   (#6673), so opt-in detail enrichment narrows to the postings this scan
 *   keeps.
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchSitemap(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, sleep: sleepFn, maxPages, robotsGate = robotsAllows, titleWanted } = opts;
  const company = opts.company ?? {};
  const name = text(company?.name) || '(unnamed)';
  const cfg = parseSitemapConfig(company);
  // The endpoint the adapter built must be exactly the entry's sitemap URL.
  if (resolveSitemapUrl(endpoint)?.href !== cfg.url.href) {
    throw new Error(`sitemap: ${name}: endpoint ${endpoint} does not match the configured sitemap.url ${cfg.url.href}`);
  }
  const probing = Number.isInteger(maxPages) && /** @type {number} */ (maxPages) > 0;
  const pause = sleepFn || ((ms) => delay(ms, signal));

  /**
   * @param {URL} url
   */
  async function readSitemap(url) {
    const xml = await fetchTextWithRetry(fetchImpl, url.href, {
      redirect: 'error',
      headers: HEADERS_XML,
      ...(signal ? { signal } : {}),
    });
    // The web-ui transport has no mid-stream body cap; enforce the protocol's
    // 50 MB file limit once the body is read (a larger file is refused, not
    // truncated).
    if (Buffer.byteLength(xml, 'utf8') > MAX_SITEMAP_BYTES) {
      throw new Error(`sitemap: ${name}: ${url.href} is larger than the protocol's ${MAX_SITEMAP_BYTES}-byte limit`);
    }
    return parseSitemapDocument(xml);
  }

  /**
   * @param {string[]} locs
   * @param {string} label
   */
  function capUrls(locs, label) {
    if (locs.length <= MAX_URLS_PER_SITEMAP) return locs;
    warn(`${name}: ${label} lists ${locs.length} URLs, over the protocol's ${MAX_URLS_PER_SITEMAP}-per-file limit; read the first ${MAX_URLS_PER_SITEMAP}`);
    return locs.slice(0, MAX_URLS_PER_SITEMAP);
  }

  const rootVerdict = await robotsGate(cfg.url.href);
  if (!rootVerdict.allowed) {
    const err = new Error(`sitemap: ${name}: robots.txt ${rootVerdict.reason} (${rootVerdict.code}); not fetching ${cfg.url.href}`);
    /** @type {any} */ (err).code = rootVerdict.code;
    throw err;
  }

  const root = await readSitemap(cfg.url);
  /** @type {string[]} */
  let locs = [];
  if (root.kind === 'urlset') {
    locs = capUrls(root.locs, cfg.url.href);
  } else {
    const children = [];
    let readable = 0;
    for (const loc of root.locs) {
      let child;
      try { child = new URL(loc); } catch { continue; }
      if (!isSameSiteUrl(child, cfg.url)) continue;
      if (cfg.indexFilter && !cfg.indexFilter.test(child.href)) continue;
      if (/\.gz$/i.test(child.pathname)) {
        warn(`${name}: skipped gzipped child sitemap ${child.href} (not supported)`);
        continue;
      }
      children.push(child);
    }
    // The probe only needs to see one child answer.
    const limit = probing ? 1 : cfg.maxSitemaps;
    if (!probing && children.length > limit) {
      warn(`${name}: sitemap index lists ${children.length} child sitemaps; read the first ${limit}, raise sitemap.max_sitemaps on this entry for the rest`);
    }
    for (const child of children.slice(0, limit)) {
      const verdict = await robotsGate(child.href);
      if (!verdict.allowed) {
        warn(`${name}: skipped child sitemap ${child.href}: robots.txt ${verdict.reason}`);
        continue;
      }
      let doc;
      try {
        doc = await readSitemap(child);
      } catch (err) {
        if (probing) throw err;
        warn(`${name}: child sitemap ${child.href} failed (${/** @type {Error} */ (err).message}); its jobs are missing from this scan`);
        continue;
      }
      if (doc.kind === 'index') {
        warn(`${name}: skipped nested sitemap index ${child.href} (the protocol forbids index-in-index)`);
        continue;
      }
      locs.push(...capUrls(doc.locs, child.href));
      readable++;
    }
    // An index that lists children but yields no readable job sitemap is
    // broken or misconfigured (index_filter typo, every child off-host,
    // .gz, robots-denied, failing or nested), not an empty board.
    // An index with no <sitemap> entries is broken too: an employer with
    // no open jobs publishes an empty <urlset>, the one valid empty board.
    if (root.locs.length === 0) {
      throw new Error(`sitemap: ${name}: the sitemap index at ${cfg.url.href} lists no child sitemaps`);
    }
    if (readable === 0) {
      throw new Error(children.length === 0
        ? `sitemap: ${name}: the sitemap index lists ${root.locs.length} child sitemaps but none is usable (same host, not .gz${cfg.indexFilter ? `, matching index_filter ${cfg.indexFilter.source}` : ''})`
        : `sitemap: ${name}: none of the ${Math.min(children.length, limit)} child sitemaps read could be used (robots-denied, failed or nested; see the warnings above)`);
    }
  }

  const jobs = jobsFromLocs(locs, cfg, text(company?.name));
  // A probe reads one child of an index, which may be a non-job sitemap.
  if (locs.length > 0 && jobs.length === 0 && !(probing && root.kind === 'index')) {
    throw new Error(`sitemap: ${name}: ${locs.length} sitemap URLs but none matched job_path ${cfg.jobPath.source}; the site's URL scheme may have changed`);
  }
  if (!cfg.fetchDetails || probing) return jobs.map(normalize);

  const wanted = typeof titleWanted === 'function' ? jobs.filter((job) => titleWanted(job.title)) : jobs;
  const candidates = wanted.slice(0, cfg.detailLimit);
  if (wanted.length > candidates.length) {
    warn(`${name}: ${wanted.length} postings qualify for detail enrichment; enriched ${candidates.length}, raise sitemap.detailLimit on this entry for the rest`);
  }
  let denied = 0;
  for (let i = 0; i < candidates.length; i += DETAIL_BATCH) {
    const batch = candidates.slice(i, i + DETAIL_BATCH);
    await Promise.all(batch.map(async (job) => {
      try {
        const detailUrl = new URL(job.url);
        if (!isSameSiteUrl(detailUrl, cfg.url)) return;
        const verdict = await robotsGate(detailUrl.href);
        if (!verdict.allowed) { denied++; return; }
        const html = await fetchTextWithRetry(fetchImpl, detailUrl.href, {
          redirect: 'error',
          headers: HEADERS_HTML,
          ...(signal ? { signal } : {}),
        });
        const detail = parseJobPostingJsonLd(html);
        if (detail.title) job.title = detail.title;
        if (detail.location) job.location = detail.location;
        if (detail.description) job.description = detail.description;
        if (Number.isFinite(detail.postedAt)) job.postedAt = detail.postedAt;
      } catch {
        // Enrichment is opt-in: keep the sitemap row on any failure.
      }
    }));
    if (i + DETAIL_BATCH < candidates.length) await pause(DETAIL_PACE_MS);
  }
  if (denied > 0) warn(`${name}: robots.txt disallows ${denied} detail page(s); those rows keep their sitemap title`);
  return jobs.map(normalize);
}
