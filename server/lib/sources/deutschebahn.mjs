// @ts-check
/**
 * Deutsche Bahn source — single-company careers board on the custom db.jobs
 * portal (the branded Avature front; jobs.deutschebahngroup.careers just
 * 302-redirects into it). The search page exposes a server-rendered results
 * endpoint that paginates:
 *
 *   GET {origin}/service/search/de-de/{searchId}
 *       ?qli=true&query=&sort=score&itemsPerPage=20&pageNum={N}
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
 * Ported from parent career-ops `providers/deutschebahn.mjs` into the web-ui
 * source contract (rich job objects + `meta`). The board runs into the
 * thousands, so ITEMS_PER_PAGE + MAX_PAGES + MAX_JOBS bound the walk and the
 * scanner's title_filter does the real narrowing. Host-pinned to db.jobs (or
 * any *.db.jobs subdomain) via DEUTSCHEBAHN_HOST_RE, https only, and every
 * fetch uses `redirect:'error'` (SSRF-safe).
 *
 * Used by the deutschebahn adapter (server/lib/portals/adapters/deutschebahn.mjs).
 */
import { fetchText, delay } from '../http-json.mjs';

export const meta = {
  value: 'deutschebahn',
  label: 'Deutsche Bahn',
  region: 'en',
};

// db.jobs or any *.db.jobs subdomain — anchored so db.jobs.evil.com can't spoof.
export const DEUTSCHEBAHN_HOST_RE = /^(?:[a-z0-9-]+\.)*db\.jobs$/i;
export const DEFAULT_SEARCH_ID = '5441588';

const ITEMS_PER_PAGE = 20; // DB's default page size
const MAX_PAGES = 60; // safety cap on request count (60*20 = 1200 postings)
const MAX_JOBS = 1000; // cap total postings pulled
const PAGE_DELAY_MS = 150; // polite pacing between page requests

// Robust HTML entity decoder — named (&amp;) and numeric (&#252; / &#xfc;)
// entities. A malformed/out-of-range numeric entity (e.g. `&#99999999;` or a
// lone surrogate half `&#xD800;`) degrades to the literal text instead of
// throwing a RangeError and aborting the whole parse. Hex/decimal are matched
// separately so a decimal entity can't absorb trailing hex letters.
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** @param {string} s */
function decodeEntities(s) {
  return String(s).replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      const valid = Number.isFinite(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
      return valid ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

/** @param {string} s */
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

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await delay(PAGE_DELAY_MS, signal);
    const url = `${cfg.searchBase}?qli=true&query=&sort=score&itemsPerPage=${ITEMS_PER_PAGE}&pageNum=${page}`;
    const html = await fetchText(fetchImpl, url, { signal, redirect: 'error', headers: { accept: 'text/html' } });
    const rows = parseHits(html, cfg.origin, name);
    if (rows.length === 0) break; // past the last page

    let fresh = 0;
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      fresh++;
      jobs.push(row);
      if (jobs.length >= MAX_JOBS) break;
    }
    if (fresh === 0) break; // server clamped pageNum / looped
    if (jobs.length >= MAX_JOBS) break;
  }
  return jobs.slice(0, MAX_JOBS);
}
