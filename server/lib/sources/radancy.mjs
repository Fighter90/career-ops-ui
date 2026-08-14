// @ts-check
/**
 * Radancy (TalentBrew) source — the career sites Radancy hosts for large
 * employers (careers.munichre.com and its ERGO brands, plus many others). The
 * search-results page is SERVER-rendered and paginates over bare HTTP:
 *
 *   GET {origin}/{lang}/search-jobs?p={N}      # 1-based; past-the-end → empty
 *
 * Each posting is one <li class="search-results-list__item …"> holding:
 *   <a class="search-results-list__job-link …" href="/{lang}/job/{city}/{slug}/{cat}/{id}"
 *      data-job-id="{id}">{Title}</a>
 *   <li class="…__job-info--location"><i></i><span>{City, Country}</span></li>
 * The generic `search-results-list__` class prefix is the stable TalentBrew
 * markup (a second, module-numbered `job-list-NN-list__` prefix rides
 * alongside it and varies per site) — we anchor on the generic one.
 *
 * Implements the web-ui source
 * contract (rich job objects + `meta`). The list carries no posting date, so
 * `date` is always ''. Branded hosts carry no stable Radancy token, so there
 * is NO host regex / auto-detection — tenants are wired with an explicit
 * `provider: radancy` and a search-jobs `api:`/careers_url; the endpoint is
 * then pinned to the tenant host the adapter derived from the entry (same
 * model as successfactors), enforced HTTPS + `redirect:'error'` and a
 * /search-jobs path shape via assertRadancyUrl. Safety caps: MAX_PAGES=200,
 * DEFAULT_MAX_JOBS=2000 (overridable per-entry via
 * `max_pages` / `max_jobs`).
 *
 * Two markup generations, two transports:
 *   (a) MODERN markup — <li class="search-results-list__item"> with a
 *       `search-results-list__job-link` anchor. Parsed by parseModernResults().
 *   (b) LEGACY markup — a bare <li> holding the anchor itself, no list-item
 *       class to split on (careers.unitedhealthgroup.com, kaiserpermanentejobs.org).
 *       Parsed by parseLegacyResults(); parseResults() tries modern first, then
 *       falls back to legacy. On legacy tenants the ?p=N page is catastrophically
 *       heavy (a facet blob repeated per page), so fetchRadancy prefers the JSON
 *       results-fragment endpoint (buildFragmentUrl/readFragmentTotals) when the
 *       caller supplies a `fetchJson` capability, and falls back to ?p=N otherwise.
 *
 * Used by the radancy adapter (server/lib/portals/adapters/radancy.mjs).
 */
import { fetchText, delay } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

export const meta = {
  value: 'radancy',
  label: 'Radancy',
  region: 'en',
};

// Endpoint path shape the fetcher accepts (defence in depth — radancy has no
// pinnable vendor host, so we pin the URL SHAPE instead).
export const RADANCY_LIST_RE = /\/[a-z]{2}\/search-jobs$/i;

const MAX_PAGES = 200; // safety cap (~15/page ⇒ up to ~3000 postings)
const DEFAULT_MAX_JOBS = 2000; // default cap on total postings pulled
const PAGE_DELAY_MS = 150; // polite pacing — full walks are >100 sequential requests

// Page size for the JSON results-fragment transport. 100 is honored live by the
// known legacy tenants (UHG, Kaiser); the plain ?p=N HTML page hard-codes 15.
const FRAGMENT_RECORDS_PER_PAGE = 100;

const REMOTE_RE = /remote|anywhere|distributed|home\s*office/i;

function clean(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Resolve the search-jobs list URL from api:/careers_url; default /en.
 * @param {any} company portals.yml entry
 */
export function resolveListUrl(company) {
  const raw = String(company.api || company.careers_url || '').trim();
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null; // https only (web-ui hardening)
  if (/\/search-jobs\/?$/.test(u.pathname)) return `${u.origin}${u.pathname.replace(/\/$/, '')}`;
  const lang = (u.pathname.match(/^\/([a-z]{2})(\/|$)/) || [])[1] || 'en';
  return `${u.origin}/${lang}/search-jobs`;
}

/**
 * Defence-in-depth guard on the endpoint built by the adapter: HTTPS, a real
 * host, and the /{lang}/search-jobs list-path shape.
 * @param {string} url
 */
export function assertRadancyUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`radancy: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`radancy: URL must use HTTPS: ${url}`);
  if (!parsed.hostname) throw new Error(`radancy: URL has no hostname: ${url}`);
  if (!RADANCY_LIST_RE.test(parsed.pathname)) {
    throw new Error(`radancy: endpoint must be a /{lang}/search-jobs list URL: ${url}`);
  }
  return url;
}

/**
 * Build one rich job object from parsed fields — the shared shape BOTH the
 * modern and legacy parsers emit, so the emitted contract stays identical
 * regardless of which markup generation a tenant serves.
 * @param {string} id @param {string} title @param {string} url
 * @param {string} location @param {string} companyName
 */
function makeJob(id, title, url, location, companyName) {
  const isRemote = REMOTE_RE.test(title) || REMOTE_RE.test(location);
  return {
    id: `radancy-${id}`,
    title,
    company: companyName,
    url,
    salary: '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : '',
    relocates: false,
    date: '', // the SSR list carries no posting date
    snippet: '',
    source: 'radancy',
  };
}

/**
 * Parse one search-results page (or results fragment) into rich job objects.
 * Radancy tenants serve two markup generations, so we try the MODERN
 * `search-results-list__item` markup first (existing tenants keep their exact
 * behavior) and fall back to the LEGACY bare-anchor markup only when the modern
 * parser finds nothing. Exported for unit tests.
 * @param {string} html @param {string} origin @param {string} [companyName]
 */
export function parseResults(html, origin, companyName = '') {
  const modern = parseModernResults(html, origin, companyName);
  return modern.length ? modern : parseLegacyResults(html, origin, companyName);
}

/**
 * Parse the MODERN `search-results-list__item` markup. Anchors on the stable
 * generic `search-results-list__` class prefix, reads title + location within
 * one <li>, resolves the relative href against the tenant origin. Rows without
 * a title or a resolvable URL are dropped; ids dedup within the page.
 * @param {string} html @param {string} origin @param {string} [companyName]
 */
export function parseModernResults(html, origin, companyName = '') {
  if (typeof html !== 'string') return [];
  const out = [];
  const seen = new Set();
  // Split on the stable generic list-item class; slice(0) is the page head.
  const blocks = html.split(/<li class="search-results-list__item/).slice(1);
  for (const block of blocks) {
    const link = block.match(/search-results-list__job-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const href = decodeEntities(link[1]);
    const dataIdM = block.match(/data-job-id="([^"]+)"/);
    const hrefIds = [...href.matchAll(/\/(\d+)(?=[/?#]|$)/g)];
    const id = dataIdM ? dataIdM[1] : (hrefIds.length ? hrefIds[hrefIds.length - 1][1] : href);
    if (seen.has(id)) continue;
    const title = clean(link[2]);
    if (!title) continue;
    let url;
    try {
      url = new URL(href, origin).href;
    } catch {
      continue;
    }
    const locM = block.match(/__job-info--location[\s\S]*?<span>([\s\S]*?)<\/span>/);
    const location = locM ? clean(locM[1]) : '';
    seen.add(id);
    out.push(makeJob(id, title, url, location, companyName));
  }
  return out;
}

/**
 * Parse the LEGACY markup, seen live on careers.unitedhealthgroup.com and
 * www.kaiserpermanentejobs.org: the anchor IS the row, with no list-item class
 * to split on —
 *   <li><a href="/job/{city}/{slug}/{org}/{id}" data-job-id="{id}">
 *        <h2>{Title}</h2>
 *        <span class="job-id job-info">{reqNo}</span>      (UHG only)
 *        <span class="job-location">{City, State}</span>
 *      </a>
 *      <button class="js-save-job-btn" data-job-id="{id}">…</button></li>
 * Anchored on <a> carrying BOTH data-job-id and a /job/ href, so the sibling
 * save-job <button> (which repeats data-job-id) can't produce a phantom row.
 * Attribute order is not assumed; ids dedup within the page.
 * @param {string} html @param {string} origin @param {string} [companyName]
 */
export function parseLegacyResults(html, origin, companyName = '') {
  if (typeof html !== 'string') return [];
  const out = [];
  const seen = new Set();
  // Anchors never nest, so a non-greedy run to </a> is a safe row boundary.
  const anchors = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const a of anchors) {
    const attrs = a[1];
    const inner = a[2];
    const idM = attrs.match(/data-job-id="([^"]+)"/i);
    if (!idM) continue;
    const hrefM = attrs.match(/href="([^"]+)"/i);
    if (!hrefM) continue;
    const href = decodeEntities(hrefM[1]);
    if (!/\/job\//.test(href)) continue;
    const id = idM[1];
    if (seen.has(id)) continue;

    // Title lives in the heading. Falling back to the anchor's full text would
    // swallow the req-number and location spans (UHG renders both inside the
    // anchor), so strip element content first and only then accept bare text.
    const headM = inner.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
    const title = clean(headM ? headM[1] : inner.replace(/<span[\s\S]*?<\/span>/gi, ' '));
    if (!title) continue;

    let url;
    try {
      url = new URL(href, origin).href;
    } catch {
      continue;
    }
    const locM = inner.match(/class="[^"]*job-location[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const location = locM ? clean(locM[1]) : '';
    seen.add(id);
    out.push(makeJob(id, title, url, location, companyName));
  }
  return out;
}

/**
 * Build the JSON results-fragment URL for a given 1-based page.
 *
 * SearchResultsModuleName MUST be sent — without it the server returns an empty
 * result set (silent, not an error). SearchFiltersModuleName is deliberately
 * ABSENT — sending it re-attaches a multi-megabyte facet blob to every page.
 * @param {string} listUrl Base search-jobs URL (no trailing slash).
 * @param {number} page 1-based page number.
 * @param {number} [recordsPerPage]
 */
export function buildFragmentUrl(listUrl, page, recordsPerPage = FRAGMENT_RECORDS_PER_PAGE) {
  const q = new URLSearchParams({
    ActiveFacetID: '0',
    CurrentPage: String(page),
    RecordsPerPage: String(recordsPerPage),
    Distance: '50',
    RadiusUnitType: '0',
    Keywords: '',
    Location: '',
    ShowRadius: 'False',
    IsPagination: 'True',
    CustomFacetName: '',
    FacetTerm: '',
    FacetType: '0',
    SearchResultsModuleName: 'Search Results',
    SortCriteria: '0',
    SortDirection: '0',
    SearchType: '5',
  });
  return `${listUrl}/results?${q.toString()}`;
}

/**
 * Read the server's own result/page totals out of a results fragment. The
 * fragment re-embeds <section id="search-results" data-total-results
 * data-total-pages …>, so pagination can be bounded by the server's own count.
 * @param {string} html
 * @returns {{totalResults: number|null, totalPages: number|null}}
 */
export function readFragmentTotals(html) {
  if (typeof html !== 'string') return { totalResults: null, totalPages: null };
  const num = (re) => {
    const m = html.match(re);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };
  return {
    totalResults: num(/data-total-results="(\d+)"/),
    totalPages: num(/data-total-pages="(\d+)"/),
  };
}

/** Resolve the page cap: positive integer `max_pages`, else default. */
function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES);
  return MAX_PAGES;
}

/** Resolve the total-postings cap: positive integer `max_jobs`, else default. */
function resolveMaxJobs(company) {
  const v = company && company.max_jobs;
  if (Number.isInteger(v) && v > 0) return v;
  return DEFAULT_MAX_JOBS;
}

/**
 * Fetch + normalize a Radancy tenant's postings.
 *
 * Preferred transport: the JSON results fragment (buildFragmentUrl) — on the
 * legacy-markup tenants the plain ?p=N HTML page carries a multi-megabyte facet
 * blob per page, so the fragment is dramatically cheaper. It is attempted only
 * when the caller supplies a `fetchJson` capability; any failure — non-JSON, no
 * results, endpoint absent —
 * falls through to the ?p=N walk below, so tenants without the fragment endpoint
 * (and callers that pass no fetchJson) are unaffected.
 *
 * Fallback transport: walk ?p=N (1-based) until an empty page, a no-fresh-ids
 * page (server clamped ?p= to the last page, or looped), or maxJobs. A transient
 * mid-scan failure keeps the jobs collected so far — it never discards earlier
 * pages.
 * @param {string} endpoint search-jobs list URL (from buildEndpoint)
 * @param {{ fetchImpl?: Function, fetchJson?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchRadancy(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertRadancyUrl(endpoint);
  const origin = new URL(endpoint).origin;
  const name = (company && typeof company.name === 'string' && company.name.trim()) ? company.name.trim() : 'Radancy';

  const maxPages = resolveMaxPages(company);
  const maxJobs = resolveMaxJobs(company);
  const jobs = [];
  const seen = new Set();

  // Dedupe-and-append helper shared by both transports. Returns the count of
  // rows that were fresh (not previously seen) this call.
  const push = (rows) => {
    let fresh = 0;
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      fresh++;
      jobs.push(row);
    }
    return fresh;
  };

  // Proof of life across BOTH transports: any resolved request — including a
  // fragment 200 that parses to zero rows — proves the tenant is reachable, so
  // a later HTML page-1 failure must not read as "unreachable". Only when NO
  // request on either transport ever resolved does a page-1 failure THROW, so
  // scan/portal-health record a failure instead of "live but empty"
  // (meituan/tencent idiom).
  let succeededOnce = false;

  // ── Preferred transport: the JSON results fragment ─────────────────────────
  const fetchJsonImpl = typeof opts.fetchJson === 'function' ? opts.fetchJson : null;
  if (fetchJsonImpl) {
    const fragHeaders = { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' };
    try {
      const first = await fetchJsonImpl(buildFragmentUrl(endpoint, 1), { signal, redirect: 'error', headers: fragHeaders });
      // Proof of life only for a WELL-FORMED fragment response: a string
      // `results` — even "" (zero rows) — counts, but a missing/non-string
      // `results` or a response that crashes parsing leaves this false, so a
      // failing HTML fallback still surfaces the malformed initial response
      // instead of returning [].
      const firstIsString = typeof first?.results === 'string';
      const firstHtml = firstIsString ? first.results : '';
      const firstRows = firstHtml ? parseResults(firstHtml, origin, name) : [];
      if (firstIsString) succeededOnce = true;
      if (firstRows.length) {
        const { totalResults, totalPages } = readFragmentTotals(firstHtml);
        // Bound by the server's own page count when it gives one; the local caps
        // still apply so a bogus total can't drive an unbounded walk.
        const lastPage = Math.min(totalPages ?? maxPages, maxPages);
        push(firstRows);

        for (let page = 2; page <= lastPage && jobs.length < maxJobs; page++) {
          await delay(PAGE_DELAY_MS, signal);
          let rows;
          try {
            const json = await fetchJsonImpl(buildFragmentUrl(endpoint, page), { signal, redirect: 'error', headers: fragHeaders });
            const frag = typeof json?.results === 'string' ? json.results : '';
            rows = frag ? parseResults(frag, origin, name) : [];
          } catch {
            break; // a mid-walk blip shouldn't discard earlier pages
          }
          if (rows.length === 0) break;
          if (push(rows) === 0) break; // server clamped the page — stop
        }

        // Never truncate silently: report the count actually RETURNED. jobs.length
        // is the pre-slice buffer — the page loop only checks `jobs.length < maxJobs`
        // BEFORE fetching, so the final page can push it past the cap.
        const returned = Math.min(jobs.length, maxJobs);
        if (totalResults && returned < totalResults) {
          console.error(
            `⚠️  radancy: ${name} truncated at ${returned} of ${totalResults} postings`
            + ' — raise max_jobs/max_pages on this entry for more',
          );
        }
        return jobs.slice(0, maxJobs);
      }
    } catch {
      // fall through to the HTML transport
    }
  }

  // ── Fallback transport: the ?p=N HTML walk ─────────────────────────────────
  // A page-1 failure here — when NO request on either transport ever resolved
  // (no fragment endpoint / it threw) — means the board is unreachable, not
  // empty: THROW. A resolved fragment request above, or a mid-scan failure
  // here, keeps the partials collected so far instead.
  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) await delay(PAGE_DELAY_MS, signal);
    let rows;
    try {
      const html = await fetchText(fetchImpl, `${endpoint}?p=${page}`, {
        signal,
        redirect: 'error',
        headers: { accept: 'text/html' },
      });
      rows = parseResults(html, origin, name);
    } catch (err) {
      if (!succeededOnce) throw err;
      break; // keep jobs collected so far — a transient mid-scan failure shouldn't discard earlier pages
    }
    succeededOnce = true;
    if (rows.length === 0) break; // past the last page

    // No new ids → the server clamped ?p= to the last page (or looped). Stop.
    if (push(rows) === 0) break;
    if (jobs.length >= maxJobs) break;
  }
  return jobs.slice(0, maxJobs);
}
