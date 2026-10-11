/**
 * PageUp source — scrapes the public vendor-hosted careers listing pages.
 *   GET https://careers.pageuppeople.com/{tenant}/{site}/{lang}/listing/?page=N&page-items=100
 *
 * Single-company adapter, `provider: pageup` + `careers_url` on the vendor
 * host. Ported from the parent's providers/pageup.mjs (parity v1.248.8); the
 * parsing is deliberately a series of bounded steps (indexOf scans, `[^<>]*`
 * tag matches) rather than one regex per row — a pattern that lets `[^>]*` or
 * `[\s\S]*?` run to the end of the input goes quadratic on a broken page.
 *
 * Tenants also front the same site on a branded domain (jobs.hku.hk is tenant
 * 932). Those are deliberately NOT claimed: a hostname can't identify PageUp.
 * Point the entry at the vendor-host URL instead.
 */
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';

const UA = BROWSER_LIKE_USER_AGENT;

export const meta = {
  value: 'pageup',
  label: 'PageUp',
  region: 'en',
};

export const ORIGIN = 'https://careers.pageuppeople.com';

// The `page-items` the listing asks for. Every tenant checked (2026-10,
// parent) honoured it; a tenant that clamps it lower still paginates
// correctly — see the stop rule in fetchPageup.
export const PAGE_SIZE = 100;
// Override with `max_pages` on the portal entry (a positive integer), capped
// so a config typo can't turn one portals.yml line into an unbounded loop.
export const DEFAULT_MAX_PAGES = 20;
export const MAX_PAGES_CAP = 200;
// Courtesy delay between pages — only multi-page tenants pay it.
export const INTER_PAGE_DELAY_MS = 250;

// {tenant}/{site}/{lang} — the prefix every public page of a tenant sits under.
export const TENANT_PATH_RE = /^\/(\d+)\/([A-Za-z0-9_-]+)\/([A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})?)(?:\/|$)/;

/**
 * Defence-in-depth endpoint check: HTTPS on exactly the vendor host. The
 * adapter resolves the config from this URL, so a branded-domain override
 * (jobs.hku.hk) is rejected before any request is made.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertPageupUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`pageup: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`pageup: URL must use HTTPS: ${url}`);
  }
  if (parsed.hostname !== 'careers.pageuppeople.com') {
    throw new Error(`pageup: untrusted hostname "${parsed.hostname}" — must be careers.pageuppeople.com (a branded domain is not claimed; point the entry at the vendor host)`);
  }
  return url;
}

/**
 * {tenant, site, lang} from a vendor-host URL, or null.
 * `api` takes precedence over `careers_url` (mirrors greenhouse/icims).
 * @param {{api?: unknown, careers_url?: unknown}} entry
 * @returns {{tenant: string, site: string, lang: string} | null}
 */
export function resolveConfig(entry) {
  for (const raw of [entry?.api, entry?.careers_url]) {
    if (typeof raw !== 'string' || !raw) continue;
    let parsed;
    try { parsed = new URL(raw); } catch { continue; }
    if (parsed.origin !== ORIGIN) continue;
    const m = parsed.pathname.match(TENANT_PATH_RE);
    if (!m) continue;
    return { tenant: m[1], site: m[2], lang: m[3] };
  }
  return null;
}

// TENANT_PATH_RE admits only URL-safe characters, so the segments need no
// further encoding.
const listingUrl = (cfg, page) =>
  `${ORIGIN}/${cfg.tenant}/${cfg.site}/${cfg.lang}/listing/?page=${page}&page-items=${PAGE_SIZE}`;

/**
 * Resolve the page cap: a positive integer `max_pages` on the entry, capped.
 * @param {{max_pages?: unknown}} entry
 */
export function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/** Remove HTML comments; an unterminated one swallows the rest. @param {string} s */
function stripComments(s) {
  let out = '';
  let pos = 0;
  for (;;) {
    const open = s.indexOf('<!--', pos);
    if (open === -1) return out + s.slice(pos);
    out += s.slice(pos, open);
    const close = s.indexOf('-->', open + 4);
    if (close === -1) return out;
    pos = close + 3;
  }
}

/** The value of one attribute on an opening-tag string. @param {string} tag @param {string} name */
function attr(tag, name) {
  // The lookbehind keeps `data-href` from being read as `href`.
  const m = tag.match(new RegExp(`(?<![\\w-])${name}=["']([^"'<>]*)["']`, 'i'));
  return m ? m[1] : null;
}

/** Whether an opening tag's class list contains `token` as a whole token. */
const hasClass = (tag, token) => (attr(tag, 'class') ?? '').split(/\s+/).includes(token);

/**
 * Parse one PageUp listing page. Exported for unit tests.
 *
 * Only the `<tbody id="search-results-content">` table is read: the same page
 * repeats every posting in a hidden "recent jobs" block, and reading the whole
 * document would return each one twice.
 *
 * `valid: false` is never an empty board. `reason` says which way the page is
 * unrecognised: 'no-table' (the results table is missing — a login, error or
 * challenge page) or 'no-jobs-parsed' (the table links postings but none could
 * be read — the markup moved). An empty, well-formed table is `valid: true`
 * with no jobs.
 *
 * @param {string} html
 * @param {{tenant: string, site: string, lang: string}} cfg
 * @param {string} companyName
 * @returns {{valid: boolean, reason?: string, linkCount: number, hasMore: boolean,
 *   jobs: Array<{title: string, url: string, company: string, location: string}>}}
 */
export function parsePageupListing(html, cfg, companyName) {
  const doc = String(html);
  const open = doc.match(/<tbody\b[^<>]*(?<![\w-])id=["']search-results-content["'][^<>]*>/i);
  if (!open) return { valid: false, reason: 'no-table', linkCount: 0, hasMore: false, jobs: [] };
  const start = (open.index ?? 0) + open[0].length;
  const close = doc.slice(start).search(/<\/tbody\s*>/i);
  const end = close === -1 ? doc.length : start + close;
  // A tenant can leave a commented-out duplicate of each row in the table.
  const bodyText = stripComments(doc.slice(start, end));

  const jobs = [];
  // Posting anchors seen, before any is dropped as malformed — the page's own
  // row count, which is what the short-page stop in fetchPageup compares.
  let linkCount = 0;
  // Opening and closing anchor positions are each collected in one pass and
  // walked together, so pairing them stays linear even when no anchor closes.
  const opens = [...bodyText.matchAll(/<a\b[^<>]*>/gi)];
  const closes = [...bodyText.matchAll(/<\/a\s*>/gi)].map(m => m.index ?? 0);
  let nextClose = 0;
  for (let i = 0; i < opens.length; i++) {
    const tag = opens[i];
    // `job-link` is one token in a class list a tenant can theme.
    if (!hasClass(tag[0], 'job-link')) continue;
    linkCount++;
    const href = attr(tag[0], 'href');
    if (!href) continue;
    let parsed;
    try { parsed = new URL(decodeEntities(href), ORIGIN); } catch { continue; }
    // A listing should never link a posting on another host or another tenant.
    if (parsed.origin !== ORIGIN) continue;
    const m = parsed.pathname.match(/^\/(\d+)\/([A-Za-z0-9_-]+)\/[^/]+\/job\/(\d+)(?:\/|$)/);
    if (!m || m[1] !== cfg.tenant || m[2] !== cfg.site) continue;
    const textStart = (tag.index ?? 0) + tag[0].length;
    while (nextClose < closes.length && closes[nextClose] < textStart) nextClose++;
    const textEnd = closes[nextClose];
    // An anchor that never closes would otherwise take its title from the
    // next posting's row: its text has to end before the next anchor opens.
    const nextOpen = opens[i + 1]?.index;
    if (textEnd === undefined || (nextOpen !== undefined && nextOpen < textEnd)) continue;
    const title = htmlToText(bodyText.slice(textStart, textEnd));
    if (!title) continue;
    jobs.push({
      title,
      // Rebuilt from the numeric id alone: the slug after it is derived from
      // the title, so it changes when a posting is retitled and would make the
      // same posting look new to the dedup key. The id-only URL resolves.
      url: `${ORIGIN}/${cfg.tenant}/${cfg.site}/${cfg.lang}/job/${m[3]}`,
      company: companyName,
      location: '',
    });
  }

  // The table has posting anchors, or links a posting path, but nothing was
  // read from it. Keyed on those rather than on row count, so a "no jobs
  // found" message row in an empty table still reads as an empty board.
  if (jobs.length === 0 && (linkCount > 0 || /\/job\/\d/.test(bodyText))) {
    return { valid: false, reason: 'no-jobs-parsed', linkCount, hasMore: false, jobs: [] };
  }

  // The "More Jobs" link sits after the table.
  const tail = doc.slice(end);
  let hasMore = false;
  if (tail.includes('more-link')) {
    for (const tag of stripComments(tail).matchAll(/<a\b[^<>]*>/gi)) {
      if (hasClass(tag[0], 'more-link')) { hasMore = true; break; }
    }
  }
  return { valid: true, linkCount, hasMore, jobs };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch + normalize the PageUp listing for one tenant (paginated).
 * Mirrors the parent's fetch(): stop on no-fresh pages, on a short page
 * without a "More Jobs" link, or at the page cap (which tags the result
 * array `pageupTruncated`, the web-ui partial-board convention).
 *
 * @param {string} endpoint - a vendor-host listing URL (asserted here).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object, delayMs?: number }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchPageup(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company, delayMs = INTER_PAGE_DELAY_MS } = opts;
  assertPageupUrl(endpoint);
  const entry = company ?? {};
  const cfg = resolveConfig({ api: endpoint, careers_url: entry.careers_url, ...entry });
  if (!cfg) throw new Error(`pageup: cannot derive a careers.pageuppeople.com tenant URL from ${endpoint}`);

  const maxPages = resolveMaxPages(entry);
  const jobs = [];
  const seen = new Set();
  // Why pagination stopped. Only 'cap' earns the truncation flag.
  let truncated = false;
  for (let page = 1; page <= maxPages; page++) {
    if (page > 1 && delayMs > 0) await sleep(delayMs);
    if (signal?.aborted) break;
    let res;
    try {
      res = await fetchImpl(listingUrl(cfg, page), {
        signal,
        redirect: 'error',
        headers: { 'User-Agent': UA, Accept: 'text/html' },
      });
    } catch (err) {
      // The first page failing means there is no board to report on.
      if (page === 1) throw err;
      // Later pages: keep what was already collected.
      truncated = truncated || page === maxPages;
      break;
    }
    if (!res.ok) {
      const err = new Error(`pageup: HTTP ${res.status} (${listingUrl(cfg, page)})`);
      err.status = res.status;
      if (page === 1) throw err;
      break;
    }
    const html = await res.text();
    const parsed = parsePageupListing(html, cfg, String(entry.name ?? ''));
    if (!parsed.valid) {
      // On the first page there is nothing to salvage; later, keep the pages
      // already collected, as for a fetch error.
      if (page === 1) throw new Error(`pageup: returned a listing page with ${parsed.reason === 'no-table' ? 'no search-results table — likely a login, error or challenge page, not zero postings' : 'posting links but none could be read — markup changed'}`);
      break;
    }

    let fresh = 0;
    for (const job of parsed.jobs) {
      if (seen.has(job.url)) continue;
      seen.add(job.url);
      fresh++;
      jobs.push(normalize(job, entry));
    }
    // Nothing new: past the last page, or a tenant repeating its last page
    // for an out-of-range `page`, which would otherwise loop to the ceiling.
    if (fresh === 0) break;
    // A short page with no "More Jobs" link is the last one. Both signals
    // are required, so a tenant that clamps `page-items` below PAGE_SIZE
    // keeps paginating instead of being cut off after its first page.
    if (!parsed.hasMore && parsed.linkCount < PAGE_SIZE) break;
    if (page === maxPages) truncated = true;
  }
  if (truncated) jobs.pageupTruncated = true;
  return jobs;
}

function normalize(job, entry) {
  const url = job.url;
  return {
    id: `pageup-${job.url.split('/').pop()}`,
    title: job.title,
    company: job.company || String(entry.name ?? ''),
    url,
    salary: '',
    location: job.location || '',
    isRemote: /remote|удал[её]н/i.test(job.title),
    workplaceType: '',
    relocates: false,
    date: '',
    snippet: '',
    source: 'pageup',
  };
}
