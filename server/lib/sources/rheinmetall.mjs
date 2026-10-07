// @ts-check
/**
 * Rheinmetall source — SSR vacancy list at
 *   https://www.rheinmetall.com/{lang}/career/vacancies?page=N
 *
 * Implements the web-ui source contract (rich job objects + `meta` for
 * auto-discovery). Single company, zero-token: the Nuxt vacancy list is
 * SERVER-rendered, so plain
 * `?page=N` pagination works over bare HTTP (~10 unique jobs/page, ~1350
 * total). No XHR API is exposed; the underlying Cornerstone TalentLink tenant
 * has no anonymous REST endpoint either, so parsing the SSR list is the path.
 *
 * Card markup (one card per posting, three <a> copies of the same link inside):
 *   <div class="flex gap-0.5 group">
 *     <a href="/en/job/{slug}/{id}" …>…</a>
 *     … <div class="text-sm font-bold md:text-xl mb-2">{Title}</div> …
 *     … <div class="flex flex-wrap mr-6"> {Company GmbH} | {City} </div> …
 *   </div>
 * We split on the card wrapper and read each field within one card only —
 * pairing fields across card boundaries would attribute the NEXT card's title
 * to the previous card's id.
 *
 * The list carries no posting date; `date` stays '' (consumers treat an absent
 * date as "unknown", never as stale). Host-pinned to rheinmetall.com; every
 * fetch uses `redirect:'error'` (SSRF-safe).
 *
 * Used by the rheinmetall adapter (server/lib/portals/adapters/rheinmetall.mjs).
 */
import { fetchText, delay } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

export const DEFAULT_LIST_URL = 'https://www.rheinmetall.com/en/career/vacancies';
// Host match — rheinmetall.com or any subdomain. Anchored so a path or suffix
// spoof (evil.com/x.rheinmetall.com, rheinmetall.com.evil.com) fails.
export const RHEINMETALL_HOST_RE = /^(?:[a-z0-9-]+\.)*rheinmetall\.com$/i;
const MAX_PAGES = 150; // safety cap (~1350 postings at 10/page); tune via company.max_pages
const MAX_JOBS = 1500; // cap total postings pulled
const PAGE_DELAY_MS = 150; // polite pacing — full walks are >100 sequential requests

// The documented envelope of the SSR list (v1.242.0 Phase 2): the vacancy
// cards render inside this container on every list page — even an empty one.
// A page-1 200 WITHOUT it is a challenge/interstitial or a markup change,
// never an empty board. Exported for tests.
export const RHEINMETALL_LIST_ENVELOPE_RE = /class="gap-4 md:gap-6 flex flex-col"/;

export const meta = {
  value: 'rheinmetall',
  label: 'Rheinmetall',
  region: 'en',
};

function clean(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertRheinmetallUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`rheinmetall: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`rheinmetall: URL must use HTTPS: ${url}`);
  if (!RHEINMETALL_HOST_RE.test(parsed.hostname)) {
    throw new Error(`rheinmetall: untrusted hostname "${parsed.hostname}" — must be rheinmetall.com`);
  }
  return url;
}

/**
 * Resolve the vacancy-list URL from a company's api:/careers_url. Keeps an
 * explicit locale list URL (/de/career/vacancies); any other rheinmetall.com
 * URL (e.g. the branded career hub) defaults to the EN list. Returns null for
 * foreign/spoofed hosts. Exported for the adapter + tests.
 * @param {{ api?: string, careers_url?: string }} company
 */
export function resolveListUrl(company) {
  const raw = (company && (company.api || company.careers_url)) || '';
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;
    if (!RHEINMETALL_HOST_RE.test(u.hostname)) return null;
    // The apex 301s to www (same registrable domain). Pin it here so the
    // transport's redirect:'error' never refuses a URL detect() accepts
    // (parent #4080 follow-up).
    if (u.hostname.toLowerCase() === 'rheinmetall.com') u.hostname = 'www.rheinmetall.com';
    if (/\/career\/vacancies\/?$/.test(u.pathname)) return `${u.origin}${u.pathname.replace(/\/$/, '')}`;
    return `${u.origin}/en/career/vacancies`;
  } catch {
    return null;
  }
}

/**
 * Parse one SSR vacancy page into raw {id, title, url, location} records.
 * Exported for tests.
 * @param {string} html @param {string} origin
 */
export function parseVacancies(html, origin) {
  if (typeof html !== 'string') return [];
  const out = [];
  const seen = new Set();
  // Card wrapper split; slice(0) is the page head before the first card.
  const blocks = html.split(/<div class="flex gap-0\.5 group">/).slice(1);
  for (const block of blocks) {
    const link = block.match(/href="(\/[a-z]{2}\/job\/[^"]+\/(\d+))"/);
    if (!link) continue;
    const id = link[2];
    if (seen.has(id)) continue;
    // Title div: the md:text-xl card headline. Fall back to the URL slug when
    // the markup shifts, so a styling change degrades titles instead of
    // dropping postings.
    const titleM = block.match(/md:text-xl[^"]*">([\s\S]*?)<\/div>/);
    let title;
    if (titleM) {
      title = clean(titleM[1]);
    } else {
      // Fallback: reconstruct the title from the URL slug. decodeURIComponent
      // throws URIError on a malformed percent-sequence in the scraped href, so
      // decode defensively — a bad link falls back to its raw slug instead of
      // aborting the whole page's parse loop.
      const slug = link[1].split('/')[3] || '';
      let decoded;
      try { decoded = decodeURIComponent(slug); } catch { decoded = slug; }
      title = clean(decoded.replace(/_/g, ' '));
    }
    if (!title) continue;
    // "{Company GmbH} | {City}" line; the city is what location filters need.
    const orgM = block.match(/class="flex flex-wrap mr-6">([\s\S]*?)<\/div>/);
    const org = orgM ? clean(orgM[1]) : '';
    const city = org.includes('|') ? org.split('|').pop().trim() : '';
    seen.add(id);
    out.push({ id, title, url: origin + link[1], location: city });
  }
  return out;
}

/** Resolve the page cap: positive integer `max_pages` on the company, else default. */
function resolveMaxPages(company) {
  const v = company?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES);
  return MAX_PAGES;
}

/**
 * Fetch + normalize the Rheinmetall SSR vacancy list (paginated via ?page=N,
 * 1-based). A page-1 failure (transport OR a 200 without the documented list
 * container) THROWS — the board is unreachable/defended, not empty. A
 * transient mid-scan failure keeps the jobs collected so far and logs; it
 * never discards earlier pages. Stops on an empty page, on a page bringing no
 * fresh ids (the server clamps past-the-end pages to the last page), or at
 * MAX_JOBS.
 * @param {string} endpoint list URL (host-pinned to rheinmetall.com)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchRheinmetall(endpoint = DEFAULT_LIST_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertRheinmetallUrl(endpoint);
  const origin = new URL(endpoint).origin;
  const fallbackCompany = (company && typeof company.name === 'string' && company.name.trim())
    ? company.name.trim() : 'Rheinmetall';

  const maxPages = resolveMaxPages(company);
  const jobs = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages; page += 1) {
    if (page > 1) await delay(PAGE_DELAY_MS, signal);
    let html;
    try {
      html = await fetchText(fetchImpl, `${endpoint}?page=${page}`, {
        signal,
        redirect: 'error',
        headers: { accept: 'text/html' },
      });
    } catch (err) {
      if (page === 1) throw err; // page 1 failing means the board is unreachable, not empty
      console.warn(`  ⚠ rheinmetall: ${fallbackCompany} — page ${page} failed after ${jobs.length} postings; keeping partials (${err.message})`);
      break;
    }
    const rows = parseVacancies(html, origin);
    if (rows.length === 0) {
      if (page === 1 && !RHEINMETALL_LIST_ENVELOPE_RE.test(html)) {
        // Phase-2: a page-1 200 with zero cards is only "empty" when the page
        // still carries the documented list container (it renders even when
        // the board has no postings). Without it this is a Cloudflare
        // challenge or an unknown interstitial — never an empty board.
        throw new Error(`rheinmetall: page 1 of ${endpoint} has no vacancy-list container — challenge/interstitial or markup change, not an empty board`);
      }
      if (page === 1) console.warn(`rheinmetall: page 1 returned no vacancy cards for ${fallbackCompany} — markup may have changed`);
      break; // past the last page
    }

    let fresh = 0;
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      fresh += 1;
      jobs.push({
        id: `rheinmetall-${row.id}`,
        title: row.title,
        company: fallbackCompany,
        url: row.url,
        salary: '',
        location: row.location,
        isRemote: false,
        workplaceType: '',
        relocates: false,
        date: '', // the list carries no posting date
        snippet: '',
        source: 'rheinmetall',
      });
    }
    // No new ids → the server clamped ?page= to the last page (or looped). Stop.
    if (fresh === 0) break;
    if (jobs.length >= MAX_JOBS) break;
  }
  return jobs.slice(0, MAX_JOBS);
}
