// @ts-check
/**
 * Avature source — parses the public, no-auth Avature career-site job list at
 *   GET {origin}/careers/SearchJobs?jobOffset=N
 * (or a tenant's explicit /SearchJobs path). Avature is a per-tenant ATS: every
 * company runs its own `*.avature.net` origin (or a branded custom domain that
 * proxies Avature), so there is no single canonical endpoint — the URL comes
 * from the company entry's `api:` / `careers_url` and is host-pinned to it.
 *
 * Ported from parent career-ops `providers/avature.mjs` into the web-ui source
 * contract (rich job objects + `meta` for auto-discovery). The list page is a
 * server-rendered document of `<article class="article article--result">`
 * blocks; each carries an `<a class="link" href=".../JobDetail/...">` title
 * link and a "Posted DD-Mon-YYYY" subtitle. It is parsed in-process with a tiny
 * regex tag extractor (no XML/HTML dependency — the repo ships none).
 *
 * SSRF defence: `assertAvatureUrl` requires HTTPS + an Avature host, and the
 * fetch uses `redirect:'error'`. Off-host JobDetail anchors are dropped by the
 * parser so a hijacked page can't inject an external apply URL.
 *
 * Used by the avature adapter (server/lib/portals/adapters/avature.mjs).
 */
import { fetchText } from '../http-json.mjs';

// Avature hosts: the shared `*.avature.net` cluster (per-tenant subdomain) and
// the bare apex. Branded custom domains are supported only when the entry pins
// `provider: avature` + an `api:` on the Avature origin (host-pinned there).
export const AVATURE_HOST_RE = /^(?:[a-z0-9][a-z0-9-]*\.)?avature\.net$/i;
const PAGE_SIZE = 6; // Avature serves exactly 6 results per page
const DEFAULT_MAX_PAGES = 50; // ~300 postings; override via entry.max_pages
const MAX_PAGES_CAP = 200;

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export const meta = {
  value: 'avature',
  label: 'Avature',
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertAvatureUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`avature: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`avature: URL must use HTTPS: ${url}`);
  if (!AVATURE_HOST_RE.test(parsed.hostname)) {
    throw new Error(`avature: untrusted hostname "${parsed.hostname}" — must match (*.)avature.net`);
  }
  return url;
}

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#8226': '•' };
/** @param {string} s */
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z0-9]+);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[String(body).toLowerCase()] ?? m;
  });
}

/** Strip tags + collapse whitespace. @param {string} s */
function clean(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// "Posted 02-May-2026" → ISO date `YYYY-MM-DD` (UTC). '' when absent/unparseable.
/** @param {string} block */
function parsePostedIso(block) {
  const m = block.match(/Posted\s+(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (!m) return '';
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon === undefined) return '';
  const ms = Date.UTC(Number(m[3]), mon, Number(m[1]));
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10);
}

// Best-effort location: some tenants tag it with a list-item-location span or a
// map-marker glyph; most render none, so this returns ''.
/** @param {string} block */
function parseLocation(block) {
  const m =
    block.match(/list-item-location[^>]*>([\s\S]*?)<\/span>/i) ||
    block.match(/class="[^"]*\blocation\b[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|li)>/i) ||
    block.match(/glyphicon-map-marker[\s\S]{0,80}?>([^<]{2,60})</i);
  return m ? clean(m[1]) : '';
}

/**
 * Parse an Avature SearchJobs list page into web-ui job objects. Exported for
 * tests. Rows without a title or a JobDetail URL are dropped; a JobDetail
 * anchor that resolves off the tenant origin is dropped (anti-injection).
 *
 * @param {string} html raw page body
 * @param {{ origin: string, fallbackCompany?: string }} ctx
 *   `origin` is the validated tenant origin (e.g. `https://acme.avature.net`);
 *   relative hrefs resolve against it and off-origin absolute hrefs are dropped.
 */
export function parseAvature(html, ctx = /** @type {any} */ ({})) {
  if (typeof html !== 'string') return [];
  const origin = typeof ctx.origin === 'string' ? ctx.origin : '';
  const company = (typeof ctx.fallbackCompany === 'string' && ctx.fallbackCompany.trim())
    ? ctx.fallbackCompany.trim()
    : '';
  let originHost = '';
  try {
    originHost = origin ? new URL(origin).hostname.toLowerCase() : '';
  } catch { /* origin unusable → all absolute urls treated as off-host */ }

  const out = [];
  const re = /<article class="article article--result"[\s\S]*?<\/article>/g;
  let a;
  while ((a = re.exec(html)) !== null) {
    const block = a[0];
    // JobDetail path may or may not sit under /careers/ (branded tenants vary),
    // so anchor on JobDetail/ itself rather than a fixed prefix.
    const urlM = block.match(/<a[^>]*class="link"[^>]*href="([^"]*\/JobDetail\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!urlM) continue;
    const title = clean(urlM[2]);
    if (!title) continue;

    let url = decodeEntities(urlM[1]);
    if (/^https?:\/\//i.test(url)) {
      // Absolute href — keep only if it lands on the tenant origin.
      let host = '';
      try {
        host = new URL(url).hostname.toLowerCase();
      } catch {
        continue;
      }
      if (!originHost || host !== originHost) continue;
    } else {
      if (!origin) continue; // no base to resolve a relative href against
      url = origin + (url.startsWith('/') ? url : '/' + url);
    }

    const idM = url.match(/\/JobDetail\/[^/]*\/(\d+)/);
    out.push({
      id: `avature-${idM ? idM[1] : url}`,
      title,
      company,
      url,
      salary: '',
      location: parseLocation(block),
      isRemote: false,
      workplaceType: '',
      relocates: false,
      date: parsePostedIso(block),
      snippet: '',
      source: 'avature',
    });
  }
  return out;
}

/** Resolve the origin + SearchJobs URL from a host-pinned endpoint. */
function resolveSearch(endpoint) {
  const u = new URL(endpoint); // already asserted by fetchAvature
  // Honour an explicit SearchJobs path (branded tenants may prefix a locale,
  // e.g. /en_US/searchjobs/SearchJobs); otherwise default to the classic path.
  const searchPath = /\/SearchJobs\b/i.test(u.pathname)
    ? u.pathname.replace(/\/+$/, '')
    : '/careers/SearchJobs';
  return { origin: u.origin, searchUrl: `${u.origin}${searchPath}` };
}

/** Resolve the page cap: a positive integer `max_pages` on the entry, capped. */
function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * Fetch + normalize an Avature tenant's SearchJobs list (paginated by jobOffset
 * in steps of 6). Stops on an empty page, a page that adds no fresh rows (offset
 * ignored / looped), a short page, or the page cap.
 *
 * @param {string} endpoint host-pinned Avature URL (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchAvature(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertAvatureUrl(endpoint);
  const { origin, searchUrl } = resolveSearch(endpoint);
  const maxPages = resolveMaxPages(company);
  const fallbackCompany = (company && typeof company.name === 'string') ? company.name : '';

  const out = [];
  const seen = new Set();
  for (let page = 0; page < maxPages; page += 1) {
    const html = await fetchText(fetchImpl, `${searchUrl}?jobOffset=${page * PAGE_SIZE}`, {
      signal,
      redirect: 'error',
      headers: { accept: 'text/html' },
    });
    const rows = parseAvature(html, { origin, fallbackCompany });
    if (rows.length === 0) break;

    let fresh = 0;
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      fresh += 1;
      out.push(row);
    }
    if (fresh === 0) break; // offset ignored / looped
    if (rows.length < PAGE_SIZE) break; // last page
  }
  return out;
}
