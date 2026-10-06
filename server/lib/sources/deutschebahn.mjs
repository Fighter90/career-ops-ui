// @ts-check
/**
 * Deutsche Bahn source — single-company careers board on the custom db.jobs
 * portal (the branded Avature front; jobs.deutschebahngroup.careers just
 * 302-redirects into it). The search page exposes a server-rendered results
 * endpoint that paginates:
 *
 *   GET {origin}/service/search/de-de/{searchId}
 *       ?qli=true&query=&sort=pubExternalDate_tdt&itemsPerPage=1000&pageNum={N}
 *
 * A posting db.jobs can't render blanks any page that holds it: the page
 * comes back as the results shell with neither hits nor a result count. Such
 * a posting sorts first under `score` (an empty query) and under ascending
 * publication date, and last under descending date, so the walk sorts
 * newest-first, which keeps it out of the pages MAX_JOBS reaches and keeps the
 * most recent postings. Postings that tie on the sort key come back in a
 * different order per request, so consecutive pages overlap and skip postings
 * at their boundaries; one 1000-hit page covers MAX_JOBS in a single request,
 * which keeps those boundaries rare. Every results page also carries the total
 * hit count: <span class="result-count" data-count="3.596"> (German thousands
 * separator; data-count="0" on a genuinely empty search).
 *
 * {searchId} is the DB search-config id (5441588 at time of writing) — stable
 * per portal, so we pin it from the entry's api:/careers_url, defaulting to the
 * well-known id. Each result is:
 *   <a href="/de-de/Suche/{slug}-{routeId}?jobId={jobId}" data-job-id="{jobId}" …>
 *     <h3 class="m-search-hit__title"><span class="m-search-hit__title-text">{Title}</span>…</h3>
 *     …<ul class="m-search-hit__items"><li …><i aria-label="Arbeitsort"></i> {City} </li>…</ul>
 *   </a>
 * data-job-id is the dedup key; the href resolves to the public posting.
 *
 * Implements the web-ui
 * source contract (rich job objects + `meta`). The board runs into the
 * thousands, so ITEMS_PER_PAGE + MAX_PAGES + MAX_JOBS bound the walk and the
 * scanner's title_filter does the real narrowing. Host-pinned to db.jobs (or
 * any *.db.jobs subdomain) via DEUTSCHEBAHN_HOST_RE, https only, and every
 * fetch uses `redirect:'error'` (SSRF-safe).
 *
 * Used by the deutschebahn adapter (server/lib/portals/adapters/deutschebahn.mjs).
 */
import { fetchText, delay } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

export const meta = {
  value: 'deutschebahn',
  label: 'Deutsche Bahn',
  region: 'en',
};

// db.jobs or any *.db.jobs subdomain — anchored so db.jobs.evil.com can't spoof.
export const DEUTSCHEBAHN_HOST_RE = /^(?:[a-z0-9-]+\.)*db\.jobs$/i;
export const DEFAULT_SEARCH_ID = '5441588';

const ITEMS_PER_PAGE = 1000; // large pages keep tie-order drift rare (see header)
const MAX_PAGES = 5; // safety cap on request count (5*1000 = 5000 postings)
const MAX_JOBS = 1000; // cap total postings pulled
const PAGE_DELAY_MS = 150; // polite pacing between page requests
const PAGE_TIMEOUT_MS = 30_000; // a 1000-hit page is ~4MB and takes several seconds
const SORT = 'pubExternalDate_tdt'; // newest first; see header for why not `score`

function clean(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Resolve the search-config base from a company entry's api:/careers_url.
 * Accepts either a full /service/search/de-de/{id} URL, or any db.jobs URL that
 * carries the numeric search id in its path; falls back to the well-known id.
 * https only. Returns null when the host isn't db.jobs.
 * @param {any} company
 */
export function resolveConfig(company) {
  const raw = String((company && (company.api || company.careers_url)) || '').trim();
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.host.toLowerCase();
  if (!DEUTSCHEBAHN_HOST_RE.test(host)) return null;
  const idM = u.pathname.match(/\/service\/search\/de-de\/(\d+)/) || u.pathname.match(/\/(\d{6,})(?:[/?]|$)/);
  const searchId = idM ? idM[1] : DEFAULT_SEARCH_ID;
  return {
    origin: u.origin,
    searchBase: `${u.origin}/service/search/de-de/${searchId}`,
  };
}

/**
 * Parse one search-results fragment into normalized web-ui jobs. Deduped by
 * data-job-id within the page; the fetch loop dedups again across pages.
 * Exported for unit tests.
 * @param {string} html @param {string} origin @param {string} [companyName]
 */
export function parseHits(html, origin, companyName = 'Deutsche Bahn') {
  if (typeof html !== 'string') return [];
  const company = (typeof companyName === 'string' && companyName.trim()) ? companyName.trim() : 'Deutsche Bahn';
  const out = [];
  const seen = new Set();
  // Each hit is an <a class="m-search-hit" href data-job-id> … </a>.
  const re = /<a\b[^>]*class="[^"]*m-search-hit\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const anchor = m[0];
    const inner = m[1];
    const hrefM = anchor.match(/href="([^"]+)"/);
    const idM = anchor.match(/data-job-id="([^"]+)"/);
    if (!hrefM) continue;
    const href = decodeEntities(hrefM[1]);
    const key = idM ? idM[1] : href;
    if (seen.has(key)) continue;
    const titleM = inner.match(/m-search-hit__title-text"[^>]*>([\s\S]*?)<\/span>/i);
    const title = titleM ? clean(titleM[1]) : '';
    if (!title) continue;
    // Location: the <li> whose icon is aria-label="Arbeitsort".
    const locM = inner.match(/aria-label="Arbeitsort"[^>]*><\/i>([\s\S]*?)<\/li>/i);
    let url;
    try {
      url = new URL(href, origin).href;
    } catch {
      continue;
    }
    seen.add(key);
    out.push({
      id: `deutschebahn-${key}`,
      title,
      company,
      url,
      salary: '',
      location: locM ? clean(locM[1]) : '',
      isRemote: false,
      workplaceType: '',
      relocates: false,
      date: '',
      snippet: '',
      source: 'deutschebahn',
    });
  }
  return out;
}

/**
 * Number of hit anchors the page carries, before parseHits drops malformed or
 * repeated rows — the page size the source actually returned.
 * @param {string} html
 */
export function countHitAnchors(html) {
  if (typeof html !== 'string') return 0;
  return (html.match(/<a\b[^>]*class="[^"]*m-search-hit\b[^"]*"/gi) || []).length;
}

/**
 * Total hit count from the results header, or null when the page has no
 * results section (the shell db.jobs renders for a page it can't render).
 * @param {string} html
 */
export function parseResultCount(html) {
  if (typeof html !== 'string') return null;
  const m = html.match(/class="result-count"[^>]*data-count="([\d.]+)"/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * A page parseHits found nothing on must carry no posting-shaped link
 * (`?jobId={digits}`); one that does still has postings the hit selector no
 * longer matches. Applies to every page: on a later page the header always
 * carries the board total, so this is the only signal separating the end of
 * the board from a markup change.
 * @param {string} html @param {string} url
 */
export function assertNoUnparsedHits(html, url) {
  if (!/href="[^"]*[?&](?:amp;)?jobId=\d+/.test(String(html ?? ''))) return;
  throw new Error(`deutschebahn: ${url} still contains posting links but no hit could be parsed — the listing markup changed`);
}

/**
 * Number of distinct posting ids linked on the page that no hit anchor carries
 * — postings the hit selector misses on a page where it still matches others.
 * @param {string} html
 */
export function countMissedPostingLinks(html) {
  if (typeof html !== 'string') return 0;
  const idOf = (s) => s.match(/[?&](?:amp;)?jobId=(\d+)/)?.[1];
  const hitIds = new Set();
  for (const a of html.match(/<a\b[^>]*class="[^"]*m-search-hit\b[^"]*"[^>]*>/gi) || []) {
    const id = idOf(a);
    if (id) hitIds.add(id);
  }
  const missed = new Set();
  for (const link of html.match(/href="[^"]*[?&](?:amp;)?jobId=\d+/g) || []) {
    const id = idOf(link);
    if (id && !hitIds.has(id)) missed.add(id);
  }
  return missed.size;
}

/**
 * A first page with no parsed hits is a genuinely empty board only when its
 * header says data-count="0" and it carries no posting-shaped link. A missing
 * header (results shell) or a positive count (hit markup changed) is a broken
 * scan and throws, so it never reads as "DB has no jobs".
 * @param {string} html @param {string} url
 */
export function assertEmptyFirstPage(html, url) {
  assertNoUnparsedHits(html, url);
  const count = parseResultCount(html);
  if (count === 0) return;
  if (count === null) throw new Error(`deutschebahn: ${url} rendered the results shell with no hits and no result count — db.jobs blanks a page holding a posting it can't render, or the search request is no longer served`);
  throw new Error(`deutschebahn: ${url} reports ${count} postings but no hit could be parsed — the listing markup changed`);
}

/** Resolve the page cap: positive integer `max_pages`, else the default. */
function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES);
  return MAX_PAGES;
}

/**
 * Fetch + normalize the DB search feed (paginated via `pageNum`, 0-based).
 * @param {string} endpoint search-config base URL (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchDeutschebahn(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const cfg = resolveConfig({ ...company, api: company.api || endpoint, careers_url: company.careers_url || endpoint });
  if (!cfg) throw new Error(`deutschebahn: cannot resolve db.jobs search id for ${company.name || endpoint}`);
  const name = (company && typeof company.name === 'string' && company.name.trim()) ? company.name.trim() : 'Deutsche Bahn';
  const maxPages = resolveMaxPages(company);
  const jobs = [];
  const seen = new Set();

  // Why the walk stopped: `cap` (max_pages ran out after a full page) unless
  // an exit below names another reason.
  let stopReason = 'cap';
  let lastHtml = '';
  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await delay(PAGE_DELAY_MS, signal);
    const url = `${cfg.searchBase}?qli=true&query=&sort=${SORT}&itemsPerPage=${ITEMS_PER_PAGE}&pageNum=${page}`;
    let html;
    try {
      const timeout = AbortSignal.timeout(PAGE_TIMEOUT_MS);
      const sig = signal ? AbortSignal.any([signal, timeout]) : timeout;
      html = await fetchText(fetchImpl, url, { signal: sig, redirect: 'error', headers: { accept: 'text/html' } });
    } catch (err) {
      // A failed first page is a dead board; a caller abort always propagates.
      // A later page that fails keeps the pages already collected.
      if (page === 0 || signal?.aborted) throw err;
      console.warn(`deutschebahn: ${name}: page ${page} failed (${err?.message ?? err}) — keeping the ${jobs.length} collected so far`);
      stopReason = 'fetch-error';
      break;
    }
    lastHtml = html;
    const rows = parseHits(html, cfg.origin, name);
    if (rows.length === 0) {
      stopReason = 'complete';
      if (page === 0) {
        assertEmptyFirstPage(html, url);
      } else {
        assertNoUnparsedHits(html, url);
        // An empty page whose offset is still inside the reported total means
        // the walk was cut short, not that the board ended.
        const count = parseResultCount(html);
        if (count !== null && page * ITEMS_PER_PAGE < count) {
          console.warn(`deutschebahn: ${name}: page ${page} came back empty with ${count} postings reported — keeping the ${jobs.length} collected so far`);
        }
      }
      break; // past the last page
    }

    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      jobs.push(row);
      if (jobs.length >= MAX_JOBS) break;
    }
    const missed = countMissedPostingLinks(html);
    if (missed > 0) {
      console.warn(`deutschebahn: ${name}: page ${page} links ${missed} posting(s) no hit anchor carries — the hit markup may have a new variant`);
    }
    if (jobs.length >= MAX_JOBS) {
      stopReason = 'max-jobs';
      break;
    }
    // The stop reads the hit count the source returned, never the parsed or
    // post-dedup count: tie-order drift can make a full page repeat earlier
    // hits while later pages still hold unseen postings.
    if (countHitAnchors(html) < ITEMS_PER_PAGE) {
      stopReason = 'complete'; // short page: the board ended
      break;
    }
  }
  // max_pages ran out on a full page: warn so a truncated board doesn't pass
  // as complete, unless the reported total shows the walk covered the board.
  if (stopReason === 'cap') {
    const count = parseResultCount(lastHtml);
    if (count === null || maxPages * ITEMS_PER_PAGE < count) {
      console.warn(`deutschebahn: ${name}: stopped at ${maxPages} pages (${jobs.length} postings); raise max_pages on this entry`);
    }
  }
  return jobs.slice(0, MAX_JOBS);
}
