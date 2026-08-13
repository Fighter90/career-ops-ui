// @ts-check
/**
 * SAP SuccessFactors source — Recruiting Marketing (RMK, ex-jobs2web) career
 * sites (Career Site Builder's branded job boards). These are the portals big
 * industrials run at their own domains (jobs.zf.com, jobs.schaeffler.com,
 * jobs.hensoldt.net, jobs.sap.com, …) — all served by the same SF RMK backend.
 *
 * Ported from parent career-ops `providers/successfactors.mjs` into the web-ui
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

// Hosts detect() auto-claims (the parent's trusted SF/jobs2web hosts). Branded
// RMK portals (jobs.zf.com …) are NOT auto-claimed — they carry an explicit
// `provider: successfactors` in portals.yml, which bypasses host detection.
export const SF_HOST_RE = /(?:^|\.)(?:successfactors\.(?:eu|com)|jobs2web\.com)$/i;

const MAX_PAGES = 40; // safety cap on request count
const MAX_JOBS = 1000; // cap total postings pulled per site

export const meta = {
  value: 'successfactors',
  label: 'SAP SuccessFactors',
  region: 'en',
};

/**
 * Defence-in-depth host guard on the endpoint built by the adapter. The RMK
 * origin is per-tenant, so the endpoint is host-pinned to whatever the adapter
 * derived from the entry's `api:`/careers_url; this only enforces HTTPS + a
 * real host (the adapter is the one that pins the specific tenant host).
 * @param {string} url
 */
export function assertSuccessfactorsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`successfactors: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`successfactors: URL must use HTTPS: ${url}`);
  if (!parsed.hostname) throw new Error(`successfactors: URL has no hostname: ${url}`);
  return url;
}

/**
 * Parent #2099 (post-v1.22.0): resolve the tenant BASE — origin plus any
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
  if (u.protocol !== 'https:' || !u.hostname) return null;
  const path = u.pathname
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
    const cityM = block.match(/id="[^"]*-section-city-value">([\s\S]*?)<\/div>/);
    const location = cityM ? clean(cityM[1]) : cityFromSlug(path, title);

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
 * Fetch + normalize an RMK tenant's job list (paginated by `startrow`).
 *
 * A fetch failure must THROW, not be swallowed into []: an unreachable board is
 * UNREACHABLE, not empty, so scan/portal-health record a failure instead of
 * "live but empty" (meituan/tencent idiom). The `startrow` fetch is left
 * uncaught precisely so a transport error propagates. This web-ui port carries
 * only the RMK tile scraper (no CSB JSON fallback), so there is no post-RMK CSB
 * `probe` carve-out to preserve. Dead-board contract (parent v1.25.0 #2379): a
 * page-0 failure (nothing ever fetched) THROWS so scan/portal-health record a
 * real failure; a mid-pagination failure after ≥1 successful page keeps the
 * partials already collected (a transient page-N 5xx/404 must NOT discard the
 * scraped tiles nor get a live tenant quarantined as permanently dead).
 *
 * @param {string} endpoint tenant tile-search endpoint (host-pinned, from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchSuccessfactors(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertSuccessfactorsUrl(endpoint);
  const base = new URL(endpoint);
  const jobBase = base.origin;
  const fallbackCompany = (company && typeof company.name === 'string') ? company.name : '';

  const out = [];
  const seen = new Set();
  let startrow = 0;
  let succeededOnce = false;
  for (let page = 0; page < MAX_PAGES; page += 1) {
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
    const tiles = parseSuccessfactors(html, { jobBase, fallbackCompany });
    if (tiles.length === 0) break;

    let fresh = 0;
    for (const tile of tiles) {
      if (seen.has(tile.id)) continue;
      seen.add(tile.id);
      fresh += 1;
      out.push(tile);
    }
    // No new ids this page → server ignored the offset (or we've looped). Stop.
    if (fresh === 0) break;
    if (out.length >= MAX_JOBS) break;
    startrow += tiles.length;
  }
  // The cap is checked between pages, so the last page can overshoot it.
  // (parent career-ops parity, #1528)
  return out.slice(0, MAX_JOBS);
}
