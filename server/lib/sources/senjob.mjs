// @ts-check
/**
 * Senjob source — board-wide job feed for Senegal (https://senjob.com), the
 * project's first African source. A tracked_companies entry selects it with
 * `provider: senjob`.
 *
 * This source parses HTML, which the scanner otherwise avoids. The reason is
 * worth stating: of the Senegalese boards surveyed, four are unusable for a
 * zero-auth scanner (Cloudflare "Just a moment…" interstitials, 403s, dead
 * DNS). senjob.com is plain Apache with no interstitial, and it is the only one
 * left. robots.txt disallows the CV and employer-account paths — personal data
 * this source never requests — but NOT `/offres-d-emploi.php` or the
 * `/jobseekers/*.html` postings read here.
 *
 * PARSING CONTRACT. Markup-based extraction rots, so the anchors here are the
 * two things a redesign is least likely to change:
 *
 *   1. the posting URL shape `/jobseekers/{slug}_e_{id}.html`, which carries the
 *      posting id, and
 *   2. the hidden ISO date `<span style="display:none;">YYYY-MM-DD</span>`.
 *
 * No CSS class or inline style is matched. And when a page that clearly IS a
 * listing yields nothing, this THROWS instead of returning [] — a broken parser
 * must look like a broken board, not like a country with no jobs. That
 * silent-zero failure is the whole risk of scraping and the reason for
 * `assertParsedSomething` below.
 *
 * Implements the web-ui source contract (rich job objects + `meta` for
 * auto-discovery). Host-pinned to senjob.com; every fetch uses
 * `redirect:'error'` (SSRF-safe). Used by the senjob adapter
 * (server/lib/portals/adapters/senjob.mjs).
 */
import { fetchText, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

export const DEFAULT_LIST_URL = 'https://senjob.com/offres-d-emploi.php';

// Host match — anchored so a path or suffix spoof (evil.com/x.senjob.com,
// senjob.com.evil.com) fails. Subdomains of senjob.com are accepted; the live
// board is the bare apex, and the posting-link regex hard-pins that host anyway.
export const SENJOB_HOST_RE = /^(?:[a-z0-9-]+\.)*senjob\.com$/i;

/** Pages are ~40 postings; 10 covers the live board with room to spare. */
const DEFAULT_MAX_PAGES = 10;

/** Hard ceiling on a configured `max_pages`, so one entry cannot sweep forever. */
const MAX_PAGES_CAP = 50;

/**
 * Pacing between pages of the SAME board. senjob.com is a single small Apache
 * host, not a CDN-fronted multi-tenant ATS, so this is ordinary politeness
 * rather than a measured rate limit.
 */
const INTER_PAGE_DELAY_MS = 250;

export const meta = {
  value: 'senjob',
  label: 'Senjob',
  region: 'en',
};

/** A posting link: the slug is free-form, the `_e_{id}.html` suffix is not. */
const POSTING_LINK_RE = /href="(https:\/\/senjob\.com\/jobseekers\/[^"]*?_e_(\d+)\.html)"/i;

/** The same link as an anchor, so its inner text can be read as the title. */
const POSTING_ANCHOR_RE =
  /<a\s[^>]*href="https:\/\/senjob\.com\/jobseekers\/[^"]*?_e_\d+\.html"[^>]*>([\s\S]*?)<\/a>/i;

/** The machine-readable publication date, hidden next to its localized form. */
const HIDDEN_ISO_DATE_RE = /display:\s*none;?\s*"?>\s*(\d{4}-\d{2}-\d{2})\s*</i;

/**
 * Collapse a markup fragment to its visible text.
 * Comments are stripped FIRST: the anchor bodies carry `<!-- d ico postulez -->`
 * between the title and a spacer image, and a naive tag strip would leave the
 * comment body sitting inside the title. Entities are decoded through the shared
 * decoder (single pass, C0-safe — a numeric reference outside XML 1.0 §2.2 Char
 * stays literal rather than emitting a control character or lone surrogate).
 * @param {string} fragment
 * @returns {string}
 */
export function visibleText(fragment) {
  return decodeEntities(
    String(fragment ?? '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build the list URL for a page. Page 1 is the bare base — the board links it
 * that way, and `?page=1` is not a form it advertises.
 * @param {string} base list URL (host-pinned)
 * @param {number} page 1-based page number
 */
export function buildListUrl(base, page) {
  return page <= 1 ? base : `${base}?page=${page}`;
}

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertSenjobUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`senjob: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`senjob: URL must use HTTPS: ${url}`);
  if (!SENJOB_HOST_RE.test(parsed.hostname)) {
    throw new Error(`senjob: untrusted hostname "${parsed.hostname}" — must be senjob.com`);
  }
  return url;
}

/**
 * Resolve the listing URL from a company's api/careers_url. Any on-host
 * senjob.com URL collapses to that origin's canonical `/offres-d-emploi.php`
 * board; foreign/spoofed/http hosts return null. Exported for the adapter + tests.
 * @param {{ api?: string, careers_url?: string }} company
 */
export function resolveListUrl(company) {
  const raw = (company && (company.api || company.careers_url)) || '';
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;
    if (!SENJOB_HOST_RE.test(u.hostname)) return null;
    return `${u.origin}/offres-d-emploi.php`;
  } catch {
    return null;
  }
}

/**
 * Parse one listing page into raw {id, title, url, location, date} records.
 *
 * Rows are split on `<tr`, not on a fixed character window: a posting's title
 * link and its dates live in sibling cells, and the board repeats "sticky" rows
 * across pages. Merging by posting id is what makes both harmless — the first
 * row to carry a title sets it, any row carrying a date fills it in, and a
 * repeat contributes nothing new instead of producing a duplicate. Exported for
 * tests.
 *
 * @param {string} html Raw listing page.
 * @returns {{id: string, title: string, url: string, location: string, date: string}[]}
 */
export function parseListingPage(html) {
  if (typeof html !== 'string') return [];
  /** @type {Map<string, {id: string, title: string, url: string, location: string, date: string}>} */
  const byId = new Map();

  for (const row of html.split(/<tr\b/i)) {
    const link = POSTING_LINK_RE.exec(row);
    if (!link) continue;
    const [, url, id] = link;

    let record = byId.get(id);
    if (!record) {
      // location/date fill in later rows; company is never named on the listing.
      record = { id, title: '', url, location: '', date: '' };
      byId.set(id, record);
    }

    const anchor = POSTING_ANCHOR_RE.exec(row);
    if (anchor && !record.title) {
      record.title = visibleText(anchor[1]);
      // The cell after the title holds the place, then the localized "Publié:"
      // label. Cutting at the label keeps the place free of date text without
      // depending on where the surrounding tags sit. The `&` alternative cuts at
      // the label even when the shared decoder leaves `Publi&eacute;:` as an
      // entity (its named table covers only amp/lt/gt/quot/apos/nbsp), so the
      // place never absorbs the accented label or the date that follows it.
      record.location = visibleText(row.slice(anchor.index + anchor[0].length))
        .split(/Publi[ée&]/i)[0]
        .replace(/^[\s|:-]+|[\s|:-]+$/g, '');
    }

    const date = HIDDEN_ISO_DATE_RE.exec(row);
    if (date && !record.date) record.date = date[1]; // already YYYY-MM-DD
  }

  return [...byId.values()].filter((job) => job.title && job.url);
}

/**
 * A listing page that parses to nothing is either a markup change or a block —
 * both are failures, and both must be reported. Returning [] would show up as a
 * board with no openings, indistinguishable from a healthy quiet board.
 *
 * The emptiness test is the posting-link SHAPE rather than a marker word: if the
 * page still contains posting links and the parser found none, the parser broke.
 * Exported for tests.
 * @param {string} html
 * @param {string} url
 */
export function assertParsedSomething(html, url) {
  if (!/\/jobseekers\/[^"]*?_e_\d+\.html/i.test(String(html ?? ''))) return;
  throw new Error(
    `senjob: ${url} still contains posting links but none could be parsed — the listing markup changed`,
  );
}

/** Resolve the page cap: positive integer `max_pages` on the company (clamped), else default. */
function resolveMaxPages(company) {
  const v = company?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * Fetch + normalize the Senjob listing (paginated via ?page=N, 1-based). Stops
 * when a page parses to nothing (end of board), when a page brings no fresh
 * posting (the board pins "sticky" rows to the top of every page), or at the
 * page cap. Page 1 parsing to nothing is a HARD failure — assertParsedSomething
 * turns a silent-zero markup break into a thrown error rather than an empty board.
 * @param {string} endpoint list URL (host-pinned to senjob.com)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchSenjob(endpoint = DEFAULT_LIST_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertSenjobUrl(endpoint);

  const maxPages = resolveMaxPages(company);
  const jobs = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages; page += 1) {
    if (page > 1) await delay(INTER_PAGE_DELAY_MS, signal);

    const url = assertSenjobUrl(buildListUrl(endpoint, page));
    const html = await fetchText(fetchImpl, url, {
      signal,
      redirect: 'error',
      headers: { 'User-Agent': BROWSER_LIKE_USER_AGENT },
    });

    const rows = parseListingPage(html);
    if (rows.length === 0) {
      // Page 1 parsing to nothing is a hard failure; a later empty page is just
      // the end of the board.
      if (page === 1) assertParsedSomething(html, url);
      break;
    }

    const before = seen.size;
    for (const row of rows) {
      if (seen.has(row.url)) continue;
      seen.add(row.url);
      jobs.push({
        id: `senjob-${row.id}`,
        title: row.title,
        // company stays empty on purpose: the listing rows never name the
        // employer. Inventing one from the slug would be a fabricated claim.
        company: '',
        url: row.url,
        salary: '',
        location: row.location,
        isRemote: false,
        workplaceType: '',
        relocates: false,
        date: row.date || '',
        snippet: '',
        source: 'senjob',
      });
    }
    // A page that adds nothing new is the end of the run (sticky repeats), not a
    // reason to keep going.
    if (seen.size === before) break;
  }

  return jobs;
}
