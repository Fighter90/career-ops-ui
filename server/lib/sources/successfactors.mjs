// @ts-check
/**
 * SAP SuccessFactors source — Recruiting Marketing (RMK, ex-jobs2web) career
 * sites (Career Site Builder's branded job boards). These are the portals big
 * industrials run at their own domains (jobs.zf.com, jobs.schaeffler.com,
 * jobs.hensoldt.net, jobs.sap.com, …) — all served by the same SF RMK backend.
 *
 * Implements the web-ui
 * source contract (rich job objects + `meta` for auto-discovery). The RMK
 * backend exposes a public, no-auth job-list fragment endpoint:
 *   GET {origin}/tile-search-results/?startrow={N}
 * returning an HTML fragment (not JSON) of `<li class="job-tile job-id-{id}">`
 * blocks. We parse those with a tiny regex tile extractor (no html dependency).
 *
 * Per-tenant: the endpoint origin comes from the company entry's `api:` /
 * careers_url (host-pinned). Detection is either an explicit
 * `provider: successfactors` or a literal *.successfactors.(eu|com) /
 * jobs2web.com host — the branded RMK hosts carry no "successfactors" string,
 * so those must be wired with an explicit provider.
 *
 * Host-pinned + `redirect:'error'` (SSRF-safe). RMK carries no posting date in
 * the list fragment, so `date` is always ''. Used by the successfactors adapter
 * (server/lib/portals/adapters/successfactors.mjs).
 */
import { fetchText } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

// Hosts detect() auto-claims (the trusted SF/jobs2web hosts). Branded
// RMK portals (jobs.zf.com …) are NOT auto-claimed — they carry an explicit
// `provider: successfactors` in portals.yml, which bypasses host detection.
export const SF_HOST_RE = /(?:^|\.)(?:successfactors\.(?:eu|com)|jobs2web\.com)$/i;

const MAX_PAGES = 40; // default cap on request count (RMK tile pagination)
const MAX_JOBS = 1000; // default cap on total postings pulled per site
// Opt-in ceilings (parent #6697). An entry may raise the defaults with
// `max_pages` / `max_jobs` up to these bounds; without either key the
// defaults above apply unchanged. On RMK a `max_pages` below the default is
// NOT honored downward — the tile walk has no other config knob, and a
// lower cap would only shrink coverage silently.
const RMK_MAX_PAGES_CEILING = 400;
const MAX_JOBS_CEILING = 10000;

export const meta = {
  value: 'successfactors',
  label: 'SAP SuccessFactors',
  region: 'en',
};

/**
 * Defence-in-depth guard on the endpoint built by the adapter. The RMK
 * origin is per-tenant, so the endpoint is host-pinned to whatever the adapter
 * derived from the entry's `api:`/careers_url: `expectedHost` (the tenant
 * hostname, from the company entry) must match the endpoint host EXACTLY —
 * a same-scheme lookalike (`jobs.zf.com.evil.test`) must not pass. When no
 * tenant host is derivable the check degrades to HTTPS + a real host.
 * @param {string} url
 * @param {string|null} [expectedHost] tenant hostname pinned by the adapter
 */
export function assertSuccessfactorsUrl(url, expectedHost = null) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`successfactors: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`successfactors: URL must use HTTPS: ${url}`);
  if (!parsed.hostname) throw new Error(`successfactors: URL has no hostname: ${url}`);
  if (expectedHost && parsed.hostname.toLowerCase() !== String(expectedHost).toLowerCase()) {
    throw new Error(
      `successfactors: endpoint host "${parsed.hostname}" does not match the tenant host "${expectedHost}": ${url}`,
    );
  }
  return url;
}

/**
 * Host guard (parent #6697), applied before any request: a SuccessFactors
 * board is a public https site on a named domain (jobs.sap.com, jobs.zf.com,
 * jobs.schaeffler.com, careers.te.com, *.successfactors.eu/.com, ...).
 * Branded RMK domains are tenant-chosen and cannot be listed, so the
 * allowlist is "public named host": no credentials, no
 * loopback/private/link-local/metadata address, no bare IP, no non-default
 * port, and https only. Exported for tests.
 * @param {URL} u
 */
export function isAllowedHost(u) {
  if (u.protocol !== 'https:') return false;
  if (u.username || u.password || u.port) return false;
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!h.includes('.') || h.startsWith('[')) return false; // single-label or IPv6 literal
  if (/^\d+(?:\.\d+){0,3}$/.test(h) || /^0x[0-9a-f]+$/i.test(h)) return false; // IPv4 in any spelling
  if (/(^|\.)(localhost|local|internal|localdomain|home\.arpa|lan)$/.test(h)) return false;
  return true;
}

/** Positive integer config value, else null. */
function posInt(v) {
  return Number.isInteger(v) && v > 0 ? v : null;
}

/**
 * Resolve the RMK caps for one entry (parent #6697): the default MAX_PAGES /
 * MAX_JOBS, raised by a positive-integer `max_pages` / `max_jobs` up to the
 * ceilings. `raised` is true when the entry asks for more than the defaults —
 * the only case that adds request volume. A `max_pages` below the default is
 * ignored (see RMK_MAX_PAGES_CEILING above). Exported for tests.
 * @param {{max_pages?: unknown, max_jobs?: unknown}} entry
 * @returns {{maxPages: number, maxJobs: number, raised: boolean}}
 */
export function resolveLimits(entry) {
  const mp = posInt(entry?.max_pages);
  const mj = posInt(entry?.max_jobs);
  const maxPages = mp !== null ? Math.max(MAX_PAGES, Math.min(mp, RMK_MAX_PAGES_CEILING)) : MAX_PAGES;
  const maxJobs = mj !== null ? Math.min(mj, MAX_JOBS_CEILING) : MAX_JOBS;
  return { maxPages, maxJobs, raised: maxPages > MAX_PAGES || maxJobs > MAX_JOBS };
}

/**
 * Resolve the tenant BASE — origin plus any
 * brand/tenant path prefix. Some holding companies run several acquired
 * brands off one shared RMK instance, disambiguated by a path segment
 * instead of a separate domain (careers.nemetschek.com/Bluebeam/ vs
 * .../Vectorworks/); collapsing to the origin would silently return the
 * parent brand's postings. A trailing known-endpoint segment — /search/
 * (the page tenants commonly configure as careers_url) or
 * /tile-search-results/ (an `api:` pointing straight at the endpoint this
 * module builds) — is stripped so it never doubles onto itself. Single-domain
 * tenants have an empty pathname, so base === origin unchanged.
 *
 * Returns null when the configured URL is missing, unparseable, or fails the
 * public-https host guard (#6697) — a loopback, private, bare-IP or
 * credentialed URL is refused HERE, before any request is made.
 *
 * @param {{ api?: string, careers_url?: string }} company
 * @returns {string|null} https base ("origin[/Brand]") or null
 */
export function resolveTenantBase(company) {
  const raw = String((company && (company.api || company.careers_url)) || '').trim();
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!isAllowedHost(u) || !u.hostname) return null;
  // A saved-search category page, /go/<Category>/<numericId>[/<offset>]/, is not a
  // brand prefix: in front of /tile-search-results/ it answers 200 with zero
  // tiles (a healthy-looking empty board). Strip it; a brand segment in FRONT of
  // /go/ survives (/Bluebeam/go/X/123/ -> /Bluebeam).
  const path = u.pathname
    .replace(/\/go\/[^/]+\/\d+(?:\/\d+)?\/?$/i, '')
    .replace(/\/(?:search|tile-search-results)\/?$/i, '')
    .replace(/\/+$/, '');
  return u.origin + path;
}

function clean(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// RMK job paths encode the city as the leading slug segment:
//   /job/{City-Words}-{Title-Words}-{reqCode}/{id}/
// When the tenant doesn't render a dedicated city field we recover the city by
// stripping the title (and trailing code) off the front slug. We anchor on the
// first two title words — a prefix the slug always reproduces verbatim, unlike
// the title's tail where punctuation like "(m/w/d)" gets mangled.
/** @param {string} dataUrl @param {string} title */
export function cityFromSlug(dataUrl, title) {
  let path;
  try {
    path = decodeURIComponent(dataUrl);
  } catch {
    path = dataUrl;
  }
  const m = path.match(/\/job\/([^/]+)\//);
  if (!m) return '';
  const slug = m[1].toLowerCase();
  const words = title.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!words || !words.length) return '';
  // Anchor on the first two title words, allowing ANY run of non-alphanumerics
  // between them — in the slug those words may be joined by "-", "-amp-" (a
  // decoded "&"), or several hyphens, none of which survive the title's split.
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let anchorRe;
  try {
    anchorRe = new RegExp(words.slice(0, 2).map(esc).join('[^\\p{L}\\p{N}]+'), 'u');
  } catch {
    return '';
  }
  const hit = slug.match(anchorRe);
  if (!hit || hit.index === undefined || hit.index <= 0) return '';
  return slug
    .slice(0, hit.index)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Parse one RMK tile-search fragment into web-ui job objects. Exported for
 * tests. Each `<li class="job-tile job-id-{id}">` carries a `data-url` (job
 * path), a `jobTitle-link` title, and — when the tenant renders it — a city
 * value div. Rows without a title or a usable url are dropped.
 *
 * @param {string} html raw HTML fragment body
 * @param {{ jobBase: string, fallbackCompany?: string }} ctx
 *   jobBase — the tenant origin used to absolutize relative job paths + the
 *   host every emitted url is pinned to; fallbackCompany — job.company value.
 */
export function parseSuccessfactors(html, { jobBase, fallbackCompany = '' } = {}) {
  if (typeof html !== 'string' || !jobBase) return [];
  let baseHost;
  try {
    baseHost = new URL(jobBase).hostname;
  } catch {
    return [];
  }
  const out = [];
  const seen = new Set();
  const tileRe = /<li class="job-tile job-id-(\d+)\b[\s\S]*?<\/li>/g;
  let t;
  while ((t = tileRe.exec(html)) !== null) {
    const id = t[1];
    if (seen.has(id)) continue;
    const block = t[0];

    const urlM = block.match(/data-url="([^"]+)"/);
    if (!urlM) continue;

    const titleM = block.match(/class="jobTitle-link[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    const title = titleM ? clean(titleM[1]) : '';
    if (!title) continue;

    // data-url is an HTML attribute, so a literal "&" arrives as &amp;. Decode
    // entities (but not percent-encoding — %28 etc. stays) before both url
    // building and slug parsing.
    const path = decodeEntities(urlM[1]);
    const url = /^https?:\/\//i.test(path)
      ? path
      : jobBase + (path.startsWith('/') ? path : '/' + path);

    // Host-pin every emitted url: an absolute data-url pointing off-tenant is
    // dropped (keeps a stray external link out of the scan results).
    let urlHost;
    try {
      urlHost = new URL(url).hostname;
    } catch {
      continue;
    }
    if (urlHost !== baseHost) continue;

    // Anchor on id="…-section-city-value"> — the value div. The sibling label
    // span references the same id, so a looser match would swallow the label.
    // The jobs API can render the value with a trailing comma ("Bend, OR,
    // USA," — upstream #6139); clean() is shared with titles, which may
    // legitimately end in a comma, so the artifact comma comes off the
    // location cell only. Interior commas and a postal code stay.
    const cityM = block.match(/id="[^"]*-section-city-value">([\s\S]*?)<\/div>/);
    const location = cityM ? clean(cityM[1]).replace(/,+$/, '').trim() : cityFromSlug(path, title);

    seen.add(id);
    out.push({
      id: `successfactors-${id}`,
      title,
      company: fallbackCompany,
      url,
      salary: '',
      location,
      isRemote: false,
      workplaceType: '',
      relocates: false,
      date: '',
      snippet: '',
      source: 'successfactors',
    });
  }
  return out;
}

/**
 * Names the entry and the knobs that raise the cap that stopped the read, in
 * the wording the parent uses for the same situation (#6697).
 * @param {{name?: string}} company @param {string} what @param {number} maxPages @param {number} maxJobs
 */
function warnTruncated(company, what, maxPages, maxJobs) {
  console.error(`⚠️  successfactors: ${company?.name || 'tenant'} truncated at max_pages=${maxPages}, max_jobs=${maxJobs} (${what}) — raise max_pages and/or max_jobs on this entry for more`);
}

/**
 * Fetch + normalize an RMK tenant's job list (paginated by `startrow`).
 *
 * A fetch failure must THROW, not be swallowed into []: an unreachable board is
 * UNREACHABLE, not empty, so scan/portal-health record a failure instead of
 * "live but empty" (meituan/tencent idiom). The `startrow` fetch is left
 * uncaught precisely so a transport error propagates. This web-ui port carries
 * only the RMK tile scraper (no CSB JSON fallback), so there is no post-RMK CSB
 * `probe` carve-out to preserve. Dead-board contract: a
 * page-0 failure (nothing ever fetched) THROWS so scan/portal-health record a
 * real failure; a mid-pagination failure after ≥1 successful page keeps the
 * partials already collected (a transient page-N 5xx/404 must NOT discard the
 * scraped tiles nor get a live tenant quarantined as permanently dead).
 *
 * Caps are the entry's opt-in `max_pages` / `max_jobs` (#6697) clamped to the
 * ceilings; a cap that ends the walk while the board was still delivering new
 * postings warns on stderr and the returned array is tagged with the
 * canonical `truncated` shape. The walk advances by the SOURCE's rows — the
 * raw `job-id-N` ids — not by the tiles that survived parsing: a title-less
 * tile must neither end the walk nor leave the next offset overlapping.
 *
 * @param {string} endpoint tenant tile-search endpoint (host-pinned, from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchSuccessfactors(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  // #6697 — a configured URL that fails the public-https host guard is
  // refused HERE, before any request: localhost, a private/loopback/link-local
  // or bare-IP address, a credentialed or non-default-port URL is a miswire,
  // not a board.
  const configuredRaw = String(company.api || company.careers_url || '').trim();
  if (configuredRaw && !resolveTenantBase(company)) {
    throw new Error(`successfactors: cannot resolve a public https host for ${company.name || 'entry'}`);
  }
  // Exact-host pin: the endpoint must live on the same host the entry's
  // `api:`/careers_url names (the adapter derives both from the entry, so a
  // mismatch means a miswire — refuse before any I/O). Without a tenant URL
  // on the entry the check degrades to HTTPS + real host.
  const tenantBase = resolveTenantBase(company);
  assertSuccessfactorsUrl(endpoint, tenantBase ? new URL(tenantBase).hostname : null);
  const base = new URL(endpoint);
  const jobBase = base.origin;
  const fallbackCompany = (company && typeof company.name === 'string') ? company.name : '';
  const { maxPages, maxJobs } = resolveLimits(company);

  const out = [];
  const seen = new Set();
  // The raw `job-id-N` ids the SOURCE returned, page by page: fullness and
  // freshness are judged on these, not on the parsed tiles (a title-less tile
  // must not end the walk or shift the next offset onto itself).
  const seenRaw = new Set();
  let startrow = 0;
  let succeededOnce = false;
  // True when the loop ended on a cap while the last page was still
  // delivering new postings — i.e. the board very likely has more. The RMK
  // fragment carries no total, so the warning can only say "at least".
  let capped = false;
  let pageSize = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const pageUrl = new URL(base.href);
    pageUrl.searchParams.set('startrow', String(startrow));
    let html;
    try {
      html = await fetchText(fetchImpl, pageUrl.href, {
        signal,
        redirect: 'error',
        headers: { accept: 'text/html' },
      });
    } catch (err) {
      // Dead-board contract: a failure with NO successful request means the
      // board is unreachable, not empty — THROW so scan/portal-health record a
      // real failure. A mid-pagination failure after ≥1 successful page keeps
      // the partials already scraped (a transient page-N 5xx/404 must not
      // discard them, nor get a live tenant quarantined as permanently dead).
      if (!succeededOnce) throw err;
      break;
    }
    succeededOnce = true;
    // Shape contract (Phase 2), first page only: the documented container of
    // an RMK fragment is its `<li class="job-tile …">` blocks. A 200 with
    // NONE of them is a Cloudflare challenge page or a template change —
    // that must THROW (loud), never read as a healthy-but-empty board.
    // A later page legitimately ends the walk with zero tiles, so the guard
    // is startrow-0-only.
    if (page === 0 && !html.includes('job-tile')) {
      throw new Error(`successfactors: fragment carries no job tiles — challenge page or template change? (${pageUrl.href})`);
    }
    // Pagination follows the rows the source returned, not the ones
    // parseSuccessfactors kept (parent #6697).
    const rawIds = [...html.matchAll(/<li class="job-tile job-id-(\d+)/g)].map((m) => m[1]);
    if (rawIds.length === 0) break;
    const rawTiles = rawIds.length;
    if (page === 0) pageSize = rawTiles;
    const tiles = parseSuccessfactors(html, { jobBase, fallbackCompany });

    const fresh = rawIds.filter((id) => !seenRaw.has(id)).length;
    for (const id of rawIds) seenRaw.add(id);
    for (const tile of tiles) {
      if (seen.has(tile.id)) continue;
      seen.add(tile.id);
      out.push(tile);
    }
    // No new ids this page → server ignored the offset (or we've looped). Stop.
    if (fresh === 0) break;
    if (out.length >= maxJobs || page === maxPages - 1) {
      // A short final page means the board ended on its own, not at the cap.
      capped = out.length >= maxJobs || rawTiles >= pageSize;
      break;
    }
    startrow += rawTiles;
  }
  if (capped) {
    // The parent adds only this stderr warning for RMK (#6697): the fragment
    // carries no total, so the canonical partial-read tag stays off and the
    // scan log carries the cap notice.
    warnTruncated(company, `stopped at ${Math.min(out.length, maxJobs)} jobs, more were still being returned`, maxPages, maxJobs);
  }
  // The cap is checked between pages, so the last page can overshoot it.
  return out.slice(0, maxJobs);
}
