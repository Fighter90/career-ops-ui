// @ts-check
/**
 * ITviec source — Vietnam's largest IT job board (https://itviec.com), the
 * project's first Vietnamese source. A tracked_companies entry selects it with
 * `provider: itviec`. Optional per-entry tuning mirrors the jobstreet/glints
 * convention: `searchKeywords` narrows the listing and `searchLocation` pins a
 * city (Ho Chi Minh / Hanoi / Da Nang).
 *
 * This source parses HTML, which the scanner otherwise avoids. The reason is
 * worth stating: measured on 2026-08-23, itviec.com serves its listing pages
 * fully server-rendered over plain HTTPS — no interstitial, no auth, no JS
 * needed to see the cards. robots.txt (fetched 2026-08-23) disallows only
 * `/subscriptions/new`, a candidate-facing subscription page this source never
 * requests. The TopCV/VietnamWorks family of Vietnamese boards is Cloudflare-
 * or Vue-rendered and needs a browser; ITviec does not, which is what makes it
 * the right zero-auth entry point for the Vietnamese market.
 *
 * PARSING CONTRACT. Markup-based extraction rots, so the anchors here are the
 * things a redesign is least likely to change:
 *
 *   1. the per-card Stimulus data attribute
 *      `data-search--job-selection-job-slug-value='{slug}'`, which both splits
 *      the page into card windows and carries the posting slug;
 *   2. the posting URL shape `https://itviec.com/it-jobs/{slug}`;
 *   3. the title anchor inside the `<h3 data-search--job-selection-target='jobTitle'>`.
 *
 * No positional markup or layout class is matched. And when a page that clearly
 * IS a listing page yields nothing, this THROWS instead of returning [] — a
 * broken parser must look like a broken board, not like a market with no jobs.
 * That silent-zero failure is the whole risk of scraping and the reason for
 * `assertParsedSomething` below.
 *
 * Implements the web-ui source contract (rich job objects + `meta` for
 * auto-discovery). Host-pinned to itviec.com; every fetch uses
 * `redirect:'error'` (SSRF-safe). Used by the itviec adapter
 * (server/lib/portals/adapters/itviec.mjs).
 *
 * Ported from the parent career-ops providers/itviec.mjs.
 */
import { fetchText, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

export const LIST_URL = 'https://itviec.com/it-jobs';
const TRUSTED_HOST = 'itviec.com';

/** Pages are 20 postings; 10 covers the freshest slice of the board. */
const DEFAULT_MAX_PAGES = 10;

/** Hard ceiling on a configured `max_pages`, so one entry cannot sweep forever. */
const MAX_PAGES_CAP = 50;

/**
 * Pacing between pages of the SAME board. Unlike senjob.com, throttling here
 * was OBSERVED while probing: three back-to-back full sweeps returned HTTP 429
 * on the second run's later pages, so this is measured politeness, not a guess.
 */
const INTER_PAGE_DELAY_MS = 750;

export const meta = {
  value: 'itviec',
  label: 'ITviec',
  region: 'en',
};

/** A card window opens at its slug attribute; everything up to the next one belongs to it. */
const CARD_SPLIT_RE = /data-search--job-selection-job-slug-value=['"]([^'"]+)['"]/gi;

/** The title anchor sits inside the card's h3, itself tagged with the same Stimulus target. */
const TITLE_ANCHOR_RE =
  /<h3[^>]*data-search--job-selection-target=['"]jobTitle['"][^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i;

/** Company name: the first /companies/ link inside the card window (absolute or relative). */
const COMPANY_LINK_RE = /href=["'](?:https?:\/\/itviec\.com)?\/companies\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi;

/** Location: the div with a title attribute right after the map-pin icon. */
const LOCATION_RE = /#map-pin"?><\/use><\/svg>\s*<div[^>]*title=["']([^"']*)["']/i;

/** Relative publication label: English "Posted … ago" or Vietnamese "Đăng … trước". */
const POSTED_LABEL_RE =
  /(?:Posted|Đăng)\s*:?\s*(?:<\/\w+>\s*)?([^.<]{0,40}?(?:ago|trước)|today|hôm nay)/i;

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertItviecUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`itviec: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`itviec: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`itviec: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/**
 * Collapse a markup fragment to its visible text. Comments are stripped
 * before tags (a card's title anchor carries an inline comment in some
 * markup variants); entities are decoded once through the shared decoder.
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

const CITY_SLUGS = /** @type {const} */ ({
  hcm: 'ho-chi-minh-hcm',
  'ho chi minh': 'ho-chi-minh-hcm',
  'hồ chí minh': 'ho-chi-minh-hcm',
  hanoi: 'ha-noi',
  'ha noi': 'ha-noi',
  'hà nội': 'ha-noi',
  danang: 'da-nang',
  'da nang': 'da-nang',
  'đà nẵng': 'da-nang',
});

/**
 * Resolve an entry location string to an ITviec city path segment.
 * @param {string} location
 * @returns {string | null}
 */
export function cityPath(location) {
  const key = String(location ?? '').trim().toLowerCase();
  if (!key) return null;
  // Own-property check: a user string like "constructor" or "toString" must
  // resolve to null, not to an inherited Object.prototype member whose source
  // text would then be interpolated into the request URL.
  if (Object.hasOwn(CITY_SLUGS, key)) return CITY_SLUGS[key];
  for (const [candidate, slug] of Object.entries(CITY_SLUGS)) {
    if (key.includes(candidate)) return slug;
  }
  return null;
}

/**
 * Build the listing URL for a page. The board-wide default is /it-jobs; a
 * configured keyword and/or city narrow it via path segments, matching the
 * URLs the board itself generates from its search form.
 * @param {{ searchKeywords?: string, searchLocation?: string }} [entry]
 * @param {number} page
 */
export function buildListUrl(entry, page) {
  let path = LIST_URL;
  const keywords = String(entry?.searchKeywords ?? '').trim().replace(/\s+/g, '-').toLowerCase();
  if (keywords) path += `/${encodeURIComponent(keywords).replace(/%2F/gi, '')}`;
  const city = cityPath(entry?.searchLocation);
  if (city) path += `/${city}`;
  return page <= 1 ? path : `${path}?page=${page}`;
}

/**
 * Parse a relative "posted" label ("today", "1 day ago", "2 weeks ago") into
 * epoch ms. Unparseable labels return undefined — the contract documents
 * postedAt as omittable, and inventing a date would be a fabricated claim.
 * @param {string} text
 * @param {number} nowMs
 * @returns {number | undefined}
 */
export function parsePostedAt(text, nowMs = Date.now()) {
  const t = String(text ?? '').toLowerCase();
  if (/today|hôm nay/.test(t)) return nowMs;
  const m = /(\d+)\s*(hour|giờ)/.exec(t);
  if (m) return nowMs - Number(m[1]) * 3_600_000;
  const d = /(\d+)\s*(day|ngày)/.exec(t);
  if (d) return nowMs - Number(d[1]) * 86_400_000;
  const w = /(\d+)\s*(week|tuần)/.exec(t);
  if (w) return nowMs - Number(w[1]) * 7 * 86_400_000;
  const mo = /(\d+)\s*(month|tháng)/.exec(t);
  if (mo) return nowMs - Number(mo[1]) * 30 * 86_400_000;
  return undefined;
}

/**
 * Parse one listing page into postings.
 *
 * Cards are split on the slug attribute, then each window contributes at most
 * one record keyed by that slug — the first row to carry a title sets it, and
 * sibling fragments fill company/location/date without depending on where the
 * surrounding tags sit.
 *
 * @param {string} html Raw listing page.
 * @returns {{slug: string, title: string, url: string, company: string, location: string, postedAt?: number}[]}
 */
export function parseListingPage(html) {
  const source = String(html ?? '');
  CARD_SPLIT_RE.lastIndex = 0;

  /** @type {Map<string, {slug: string, title: string, url: string, company: string, location: string, postedAt?: number}>} */
  const bySlug = new Map();

  // Collect the windows first so each card's scope ends where the next begins.
  /** @type {{slug: string, start: number, end: number}[]} */
  const windows = [];
  let m;
  while ((m = CARD_SPLIT_RE.exec(source)) !== null) {
    if (windows.length > 0) windows[windows.length - 1].end = m.index;
    windows.push({ slug: m[1], start: m.index, end: source.length });
  }

  for (const win of windows) {
    if (bySlug.has(win.slug)) continue;
    const card = source.slice(win.start, win.end);

    const titleMatch = TITLE_ANCHOR_RE.exec(card);
    const title = titleMatch ? visibleText(titleMatch[1]) : '';

    // The card's first /companies/ link wraps only the logo picture; its body
    // is empty. The employer NAME lives in the first such link WITH text.
    let company = '';
    COMPANY_LINK_RE.lastIndex = 0;
    let cm;
    while ((cm = COMPANY_LINK_RE.exec(card)) !== null) {
      const name = visibleText(cm[1]);
      if (name) { company = name; break; }
    }

    const locMatch = LOCATION_RE.exec(card);
    const location = locMatch ? decodeEntities(locMatch[1]).trim() : '';

    const postedMatch = POSTED_LABEL_RE.exec(card);
    const postedAt = postedMatch ? parsePostedAt(postedMatch[0], Date.now()) : undefined;

    bySlug.set(win.slug, {
      slug: win.slug,
      title,
      url: `${LIST_URL}/${win.slug}`,
      company,
      location,
      ...(postedAt !== undefined ? { postedAt } : {}),
    });
  }

  return [...bySlug.values()].filter((job) => job.title && job.url);
}

/**
 * A listing page that parses to nothing is either a markup change or a block —
 * both are failures, and both must be reported. Returning [] would show up as a
 * board with no openings, which is indistinguishable from a healthy quiet board
 * and is the failure mode that makes scrapers untrustworthy.
 *
 * The emptiness test is the card-marker SHAPE rather than a marker word: if the
 * page still carries card slug attributes and the parser found none, the parser
 * is what broke.
 * @param {string} html
 * @param {string} url
 */
export function assertParsedSomething(html, url) {
  // The numeric suffix check is deliberately loose (\d+, not \d{4}): this is a
  // heuristic that answers "is this still a listing page", so it must err
  // toward throwing rather than toward silence.
  if (!/href=["'](?:https?:\/\/itviec\.com)?\/it-jobs\/[a-z0-9-]+-\d+/i.test(String(html ?? ''))) return;
  throw new Error(
    `itviec: ${url} still contains job cards but none could be parsed — the listing markup changed`,
  );
}

/** Resolve the page cap: positive integer `max_pages` on the company (clamped), else default. */
function resolveMaxPages(company) {
  const v = company?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/**
 * Fetch + normalize the ITviec listing (paginated via ?page=N, 1-based; the
 * URL for every page — including page 1 — is rebuilt from `opts.company` so a
 * configured `searchKeywords`/`searchLocation` narrows every page the same
 * way). Stops when a page parses to nothing (end of board), when a page
 * brings no fresh posting, or at the page cap. Page 1 parsing to nothing is a
 * HARD failure — `assertParsedSomething` turns a silent-zero markup break into
 * a thrown error rather than an empty board.
 *
 * @param {string} endpoint page-1 list URL (host-pinned to itviec.com; only
 *   validated here, since every page is rebuilt from `opts.company`)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchItviec(endpoint = LIST_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertItviecUrl(endpoint);

  const maxPages = resolveMaxPages(company);
  /** @type {any[]} */
  const jobs = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages; page += 1) {
    if (page > 1) await delay(INTER_PAGE_DELAY_MS, signal);

    const url = assertItviecUrl(buildListUrl(company, page));
    const html = await fetchText(fetchImpl, url, {
      signal,
      redirect: 'error',
      headers: { 'User-Agent': BROWSER_LIKE_USER_AGENT },
    });

    const rows = parseListingPage(html);
    if (rows.length === 0) {
      // Page 1 parsing to nothing is a hard failure; a later page running dry
      // is just the end of the board.
      if (page === 1) assertParsedSomething(html, url);
      break;
    }

    const before = seen.size;
    for (const row of rows) {
      if (seen.has(row.url)) continue;
      seen.add(row.url);
      jobs.push({
        id: `itviec-${row.slug}`,
        title: row.title,
        company: row.company,
        url: row.url,
        salary: '',
        location: row.location,
        isRemote: false,
        workplaceType: '',
        relocates: false,
        date: row.postedAt !== undefined ? new Date(row.postedAt).toISOString() : '',
        snippet: '',
        source: 'itviec',
      });
    }
    // A page that adds nothing new is the end of the run, not a reason to
    // keep going.
    if (seen.size === before) break;
  }

  return jobs;
}
