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
 * Ported from parent career-ops `providers/radancy.mjs` into the web-ui source
 * contract (rich job objects + `meta`). The list carries no posting date, so
 * `date` is always ''. Branded hosts carry no stable Radancy token, so there
 * is NO host regex / auto-detection — tenants are wired with an explicit
 * `provider: radancy` and a search-jobs `api:`/careers_url; the endpoint is
 * then pinned to the tenant host the adapter derived from the entry (same
 * model as successfactors), enforced HTTPS + `redirect:'error'` and a
 * /search-jobs path shape via assertRadancyUrl. Safety caps preserved from
 * the parent: MAX_PAGES=200, MAX_JOBS=2000.
 *
 * Used by the radancy adapter (server/lib/portals/adapters/radancy.mjs).
 */
import { fetchText, delay } from '../http-json.mjs';

export const meta = {
  value: 'radancy',
  label: 'Radancy',
  region: 'en',
};

// Endpoint path shape the fetcher accepts (defence in depth — radancy has no
// pinnable vendor host, so we pin the URL SHAPE instead).
export const RADANCY_LIST_RE = /\/[a-z]{2}\/search-jobs$/i;

const MAX_PAGES = 200; // safety cap (~15/page ⇒ up to ~3000 postings)
const MAX_JOBS = 2000; // cap total postings pulled
const PAGE_DELAY_MS = 150; // polite pacing — full walks are >100 sequential requests

const REMOTE_RE = /remote|anywhere|distributed|home\s*office/i;

// Minimal HTML entity decoder — mirrors the other HTML-scraping sources.
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** @param {string} s */
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      // String.fromCodePoint throws RangeError outside 0..0x10FFFF or on a lone
      // surrogate half — a malformed/adversarial entity must degrade to the
      // original text, never crash the whole parse.
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
  if (u.protocol !== 'https:') return null; // https only (web-ui hardening; parent also allowed http)
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
 * Parse one search-results page into rich job objects. Anchors on the stable
 * generic `search-results-list__` class prefix, reads title + location within
 * one <li>, resolves the relative href against the tenant origin. Rows without
 * a title or a resolvable URL are dropped; ids dedup within the page.
 * Exported for unit tests.
 * @param {string} html @param {string} origin @param {string} [companyName]
 */
export function parseResults(html, origin, companyName = '') {
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
    const isRemote = REMOTE_RE.test(title) || REMOTE_RE.test(location);
    seen.add(id);
    out.push({
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
    });
  }
  return out;
}

/** Resolve the page cap: positive integer `max_pages`, else default. */
function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES);
  return MAX_PAGES;
}

/**
 * Fetch + normalize a Radancy tenant's postings by walking ?p=N (1-based)
 * until an empty page, a no-fresh-ids page (server clamped ?p= to the last
 * page, or looped), or MAX_JOBS. A transient mid-scan failure keeps the jobs
 * collected so far — it never discards earlier pages.
 * @param {string} endpoint search-jobs list URL (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchRadancy(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertRadancyUrl(endpoint);
  const origin = new URL(endpoint).origin;
  const name = (company && typeof company.name === 'string' && company.name.trim()) ? company.name.trim() : 'Radancy';

  const maxPages = resolveMaxPages(company);
  const jobs = [];
  const seen = new Set();

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
    } catch {
      break; // keep jobs collected so far — a transient mid-scan failure shouldn't discard earlier pages
    }
    if (rows.length === 0) break; // past the last page

    let fresh = 0;
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      fresh++;
      jobs.push(row);
    }
    // No new ids → the server clamped ?p= to the last page (or looped). Stop.
    if (fresh === 0) break;
    if (jobs.length >= MAX_JOBS) break;
  }
  return jobs.slice(0, MAX_JOBS);
}
