// @ts-check
/**
 * iCIMS source — scrapes the classic public hosted-portal search pages served
 * at `careers-<tenant>.icims.com`. Ported from parent career-ops
 * `providers/icims.mjs` into the web-ui source contract (rich job objects +
 * `meta` for auto-discovery).
 *
 * DISTINCT from the `jibeapply` source: that one targets JibeApply (iCIMS's
 * apply product); this one targets the classic iCIMS hosted job-search portal.
 * Keep them separate.
 *
 * Canonical URL: `https://careers-<tenant>.icims.com/jobs/search?ss=1`. The
 * `in_iframe=1` variant selects the lighter portal-only markup, and `pr` is the
 * 0-based page index. List pages carry title / location / URL but NO posted
 * date — the parent has an `enrichDate()` hook that fetches each detail page's
 * JSON-LD for `datePosted`, but the web-ui in-process scanner returns jobs
 * directly and does NOT support a per-job enrich hook, so that hook is OMITTED
 * here: every job is returned undated (`date: ''`), same as other web-ui
 * sources that carry no list-page date.
 *
 * Per-tenant: the portal origin comes from the company entry's `api:` /
 * careers_url, host-pinned to a `*.icims.com` https host. `redirect: 'error'`
 * closes the SSRF redirect vector. Used by the icims adapter
 * (server/lib/portals/adapters/icims.mjs).
 */
import { fetchText, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

// Hosts the adapter/source auto-claim: any `*.icims.com` subdomain (the
// per-tenant portal). Bare `icims.com` and look-alikes (`evilicims.com`) are
// rejected — the leading dot keeps `icims.com` a whole trailing label.
export const ICIMS_HOST_RE = /\.icims\.com$/i;

const MAX_PAGES = 30; // ~20 postings/page → 600 postings; iCIMS tenants rarely exceed that.
const MAX_JOBS = 1000; // cap total postings pulled per tenant.

export const meta = {
  value: 'icims',
  label: 'iCIMS',
  region: 'en',
};

// Browser-like UA: iCIMS serves 200 to a browser-like UA but risks WAF
// interstitials for a generic UA (same as workday / glints).
const HEADERS = {
  'user-agent': BROWSER_LIKE_USER_AGENT,
  'accept-language': 'en-US,en;q=0.9',
  accept: 'text/html',
};

// Minimal HTML entity decoder — job titles carry named (&amp;) and numeric
// (&#252; / &#xfc;) entities; we only need the handful that show up in titles /
/** @param {string} s */

/**
 * Defence-in-depth host guard on the endpoint the adapter builds. The portal
 * origin is per-tenant, so the endpoint is host-pinned to whatever the adapter
 * derived from the entry; this enforces HTTPS + a literal `*.icims.com` host.
 * @param {string} url
 */
export function assertIcimsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`icims: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`icims: URL must use HTTPS: ${url}`);
  if (!ICIMS_HOST_RE.test(parsed.hostname)) throw new Error(`icims: host must be *.icims.com: ${url}`);
  return url;
}

/**
 * Resolve the tenant portal origin from a company entry. `api:` takes
 * precedence over careers_url (mirrors greenhouse / ashby). Only an https
 * `*.icims.com` host is accepted; anything else yields null.
 * @param {{ api?: string, careers_url?: string }} company
 * @returns {string|null} https origin (e.g. "https://careers-acme.icims.com") or null
 */
export function resolveTenantOrigin(company) {
  for (const raw of [company && company.api, company && company.careers_url]) {
    if (typeof raw !== 'string' || !raw) continue;
    let u;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    if (u.protocol !== 'https:') continue;
    if (!ICIMS_HOST_RE.test(u.hostname)) continue;
    return u.origin;
  }
  return null;
}

// `ss=1` is the portal search flag; `in_iframe=1` selects the lighter markup.
// The adapter passes this as the endpoint; fetchIcims sets `pr` per page.
/** @param {string} origin */
export const icimsSearchUrl = (origin) => `${origin}/jobs/search?ss=1&in_iframe=1`;

/**
 * Parse one iCIMS search-results page into web-ui job objects. Exported for
 * tests. Postings are `<li class="iCIMS_JobCardItem">` cards: the posting URL
 * is in an anchor href (`/jobs/{id}/{title-slug}/job`, query stripped), the
 * title in the anchor's `<h3>`, the location in the span following the card's
 * `field-label` "Location" label. Cards whose href resolves off-origin are
 * dropped (defence in depth — a portal page should never link a posting on
 * another host). Rows without a usable url or title are dropped.
 *
 * @param {string} html
 * @param {string} origin        e.g. "https://careers-acme.icims.com"
 * @param {string} [companyName] job.company value
 */
export function parseIcimsSearchPage(html, origin, companyName = '') {
  if (typeof html !== 'string' || !origin) return [];
  let originStr;
  try {
    originStr = new URL(origin).origin;
  } catch {
    return [];
  }
  const jobs = [];
  const seen = new Set();
  const cards = html.split('iCIMS_JobCardItem').slice(1);
  for (const card of cards) {
    const href = card.match(/href="([^"]*\/jobs\/\d+\/[^"/]+\/job[^"]*)"/);
    if (!href) continue;
    let parsed;
    // Resolve against the portal origin so a documented *relative* posting href
    // (/jobs/{id}/{slug}/job) isn't silently dropped — some tenants emit those.
    // The origin check below still rejects any link that resolves off-host
    // (including protocol-relative `//other-host/...`).
    try {
      parsed = new URL(decodeEntities(href[1]), originStr);
    } catch {
      continue;
    }
    if (parsed.origin !== originStr) continue;
    // Attributes allowed on <h3>: tenants theme their portals, and a bare-tag
    // regex would silently drop a themed `<h3 class="…">` card.
    const title = card.match(/<h3\b[^>]*>\s*([\s\S]*?)<\/h3>/);
    if (!title || !title[1].trim()) continue;
    const idM = parsed.pathname.match(/\/jobs\/(\d+)\//);
    const id = idM ? idM[1] : parsed.pathname;
    if (seen.has(id)) continue;
    seen.add(id);
    // `field-label` is one token in a themed class list, not reliably the last
    // one; the lookarounds keep it a whole token so a longer hyphenated class
    // (`field-label-inline`) doesn't count as a match.
    const location = card.match(/<span\b[^>]*class=["'][^"']*(?<![\w-])field-label(?![\w-])[^"']*["'][^>]*>\s*Location\s*<\/span>\s*<span\b[^>]*>\s*([\s\S]*?)<\/span>/);
    jobs.push({
      id: `icims-${id}`,
      title: decodeEntities(title[1].replace(/\s+/g, ' ').trim()),
      company: companyName,
      url: `${parsed.origin}${parsed.pathname}`,
      salary: '',
      location: location ? decodeEntities(location[1].replace(/\s+/g, ' ').trim()) : '',
      isRemote: false,
      workplaceType: '',
      relocates: false,
      date: '', // iCIMS list pages carry no date; see the enrichDate note at top.
      snippet: '',
      source: 'icims',
    });
  }
  return jobs;
}

/**
 * Fetch + normalize an iCIMS tenant's job list (paginated by `pr`). Fail-soft:
 * stops on the first empty page, on a page that repeats the previous page's
 * first URL (some tenants re-serve the last page for an out-of-range `pr`),
 * when no fresh ids appear, and at the page/job caps.
 *
 * @param {string} endpoint tenant search URL (host-pinned, from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchIcims(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertIcimsUrl(endpoint);
  const base = new URL(endpoint);
  const origin = base.origin;
  const fallbackCompany = (company && typeof company.name === 'string') ? company.name : '';

  const out = [];
  const seen = new Set();
  let prevFirstUrl = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const pageUrl = new URL(base.href);
    pageUrl.searchParams.set('pr', String(page));
    const html = await fetchText(fetchImpl, pageUrl.href, { signal, redirect: 'error', headers: HEADERS });
    const pageJobs = parseIcimsSearchPage(html, origin, fallbackCompany);
    if (pageJobs.length === 0) break; // past the last page
    // A repeated first URL means the tenant re-served the previous page for an
    // out-of-range `pr` — stop instead of looping to the page cap.
    if (pageJobs[0].url === prevFirstUrl) break;
    prevFirstUrl = pageJobs[0].url;

    let fresh = 0;
    for (const job of pageJobs) {
      if (seen.has(job.id)) continue;
      seen.add(job.id);
      fresh += 1;
      out.push(job);
    }
    if (fresh === 0) break; // whole page was duplicates → we've looped
    if (out.length >= MAX_JOBS) break;
  }
  return out.slice(0, MAX_JOBS);
}
