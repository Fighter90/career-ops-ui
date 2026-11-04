// @ts-check
/**
 * GermanTechJobs source — the board-wide public RSS feed at
 * https://germantechjobs.de/rss (German IT jobs; a salary range and a tech
 * stack are mandatory on every posting). The feed is public, no-auth and XML,
 * parsed in-process with the tiny tag extractor the RSS siblings share — no
 * XML dependency. ONE request covers the whole board (4.3 MB / ~626 items
 * when the parent sampled it, 2026-10-30), so there is no pagination and no
 * per-posting fetch. The legacy JSON API at /api/jobs is deprecated upstream
 * ("ENDPOINT Deprecated - contact hello@swissdevjobs.ch"), so RSS is the
 * stable public surface.
 *
 * Ported from the parent's providers/germantechjobs.mjs (upstream #6346). The
 * board is one of the swissdevjobs.ch / devitjobs family (same stack, same
 * feed shape); this source reads the GermanTechJobs board only.
 *
 * Two properties of the feed shape the parser:
 *
 *  - `<title>` carries the employer: "{Role} @ {Company} [{salary range}]".
 *    The company is the last " @ " segment and the trailing salary bracket is
 *    stripped from the role — its inner text is KEPT as the row's salary
 *    display string (the bracket is mandatory on every posting, so this is
 *    feed-carried data, never invented). The string is never annualized here:
 *    German-formatted thousands ("48.000") are exactly what the client's
 *    shared salary tokenizer reads correctly (CAR-228 — the #/scan salary
 *    facet parses it to 48000–70000; see tests/sources-germantechjobs.test.mjs).
 *    A title with no " @ " has no identifiable employer — the row is DROPPED
 *    rather than attributed to the board or the portal entry name, which
 *    would let the scanner's company+role dedup merge two different
 *    employers' same-titled postings into one opening.
 *  - There is no location tag, and `<description>` does not carry one either
 *    (sampled: 20 of 626 items mention a location line, the rest pack
 *    salary/requirements/tech only). The PARSE layer therefore emits location
 *    '' on every row — the feed's truth. The normalized ROW carries the
 *    board-level country default (BOARD_LOCATION, 'Germany'): the board's own
 *    identity (germantechjobs.de, a mandatory € salary on every posting,
 *    German-formatted figures) is a country claim, not a city, and the board
 *    default follows the apple/google DEFAULT_LOCATION precedent. It feeds
 *    the #/scan country facet (Countries.detectCountry('Germany') → de) and
 *    the server location_filter (block: Germany now correctly drops the
 *    board; strict allow-lists now see the real country instead of a
 *    always-passing empty). A CITY is never invented — recovering one would
 *    cost one detail-page request per posting
 *    (`window.__detailedJob` carries cityCategory/actualCity), which is not a
 *    free list-payload field, so it is not done.
 *
 * Defensive parsing: CDATA sections and XML comments are masked with
 * same-length filler before any structural matching (a posting that mentions
 * XML/RSS tooling can neither split its own item block nor trip the
 * open/close item tally); an envelope that is absent, not RSS, or truncated
 * mid-item THROWS with a named error instead of reading as an empty board; an
 * empty channel is the genuine empty-board case and stays [].
 *
 * Wire in via a `job_boards:` entry (or `tracked_companies:`) with
 * `provider: germantechjobs` — the board serves one board-wide feed with no
 * per-entry URL, so the adapter claims an entry only when it names the
 * provider. An optional `feed_url:` override (pinned to the board host)
 * covers a mirror.
 *
 * Used by the germantechjobs adapter (server/lib/portals/adapters/germantechjobs.mjs).
 */
import { fetchTextWithRetry, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText } from '../html-to-text.mjs';

export const meta = {
  value: 'germantechjobs',
  label: 'GermanTechJobs',
  region: 'en',
};

export const FEED_URL = 'https://germantechjobs.de/rss';
export const TRUSTED_HOST = 'germantechjobs.de';

/**
 * Board-level country default on every normalized row. The feed carries no
 * per-item location (see the header), so the row fills the country the BOARD
 * is — never a city. apple/google set the same DEFAULT_LOCATION precedent.
 */
export const BOARD_LOCATION = 'Germany';

/**
 * Defence-in-depth endpoint check: HTTPS on the board host (subdomain form
 * allowed — `x.germantechjobs.de` carries a dot boundary, so a look-alike
 * like `eviltermantechjobs.de` never matches). Runs on the endpoint the
 * adapter resolved, before any request.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertGermantechjobsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`germantechjobs: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`germantechjobs: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST && !parsed.hostname.endsWith(`.${TRUSTED_HOST}`)) {
    throw new Error(`germantechjobs: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/**
 * Titles look like:
 *   "Data Architect (all Genders) @ BORA Gruppe Deutschland [48.000 - 70.000 €]"
 *   "CIAM Platform Engineer (w/m/d) @ SEW-EURODRIVE GmbH & Co KG [50.000 - 80.000 €]"
 * The company is after the LAST " @ ", the role before it, and a trailing
 * salary bracket "[... €]" is stripped from the role — its inner text is
 * returned as `salary` (the display string the #/scan salary facet parses;
 * never annualized here). Only a bracket carrying € is a salary bracket — a
 * location bracket like "[Düsseldorf]" is not. When no " @ " is present there
 * is no identifiable employer: company is '' and the caller drops the row
 * rather than attributing it to the board or the entry name. Exported for
 * tests.
 * @param {string} rawTitle
 * @returns {{title: string, company: string, salary: string}} company is '' when unattributable
 */
export function splitTitle(rawTitle) {
  let text = String(rawTitle ?? '').trim();
  let salary = '';
  const bracket = text.match(/\s*\[([^\]]*€[^\]]*)\]\s*$/);
  if (bracket) {
    salary = bracket[1].replace(/\s+/g, ' ').trim();
    text = text.slice(0, bracket.index).trim();
  }

  const at = text.lastIndexOf(' @ ');
  if (at > 0) {
    const title = text.slice(0, at).trim();
    const company = text.slice(at + 3).trim();
    if (title && company) return { title, company, salary };
  }
  return { title: text, company: '', salary };
}

/**
 * Canonical posting URL — the feed appends its own attribution to every link
 * (`?utm_source=our_rss_feed&utm_medium=…`), so the query is dropped and the
 * stable /jobs/<slug> path is kept. Only https: links on this board are
 * accepted; anything else is unusable (''), which drops the row. Exported
 * for tests.
 * @param {unknown} value
 * @returns {string}
 */
export function cleanUrl(value) {
  if (!value) return '';
  let parsed;
  try {
    parsed = new URL(String(value).trim());
  } catch {
    return '';
  }
  const host = parsed.hostname.toLowerCase();
  const trusted = host === TRUSTED_HOST || host.endsWith(`.${TRUSTED_HOST}`);
  if (parsed.protocol !== 'https:' || !trusted) return '';
  return `https://${parsed.hostname}${parsed.pathname}`;
}

/** NaN-safe epoch parse — `|| undefined` would also coerce a valid epoch 0. */
function toEpochMs(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const ms = Date.parse(value.trim());
  return Number.isFinite(ms) ? ms : undefined;
}

/** Resolve a tag's inner text: unwrap a CDATA section, else decode entities. */
function extractText(inner) {
  const cdata = inner.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) return cdata[1].trim();
  return decodeEntities(inner).trim();
}

/** Text of the first `<tag>…</tag>` in a block; '' when absent. */
function tagText(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? extractText(m[1]) : '';
}

// CDATA sections (a job <description>'s raw, unescaped text) and XML comments
// can both carry the literal substrings "<item>" / "</item>" / "</channel>" /
// "</rss>" without being real structure — a posting that mentions XML/RSS
// tooling, or a feed-generator comment. Matching item boundaries directly
// against the raw XML would mistake that text for real structure and silently
// truncate that item. Replace both with same-length filler first: positions
// stay aligned with the original string, so a matched item block's
// start/length can be used to slice the REAL xml (preserving the actual CDATA
// content), while the filler itself never matches a tag.
function maskCdataAndComments(str) {
  return str.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g, (m) => '#'.repeat(m.length));
}

const ENVELOPE_RE = /<rss\b[^>]*>[\s\S]*<channel\b[^>]*>[\s\S]*<\/channel>[\s\S]*<\/rss>/i;

/**
 * Parse GermanTechJobs' public RSS feed. Exported for unit tests.
 *
 * Shape: `<rss><channel><item>…</item>…</channel></rss>`, each item carrying
 * `<title>`, `<link>`, `<guid>`, `<pubDate>`, `<description>` (HTML CDATA)
 * and `<content:encoded>`. No location tag.
 *
 * - [] — the envelope is valid and no item produced a usable row (incl. the
 *   genuine empty board: a valid envelope around an empty channel).
 * - throws — a non-string body, an HTML error page, or a feed truncated
 *   mid-item (open/close `<item>` counts that differ), each with a named
 *   error so a broken fetch never reads as "zero jobs".
 *
 * @param {unknown} xml raw RSS feed body
 * @returns {Array<{title: string, url: string, company: string, location: string, salary?: string, description?: string, postedAt?: number}>}
 */
export function parseGermantechjobsFeed(xml) {
  if (typeof xml !== 'string') {
    throw new Error(`germantechjobs: unexpected feed response — expected an <rss><channel> envelope, got: ${typeof xml}`);
  }

  const maskedXml = maskCdataAndComments(xml);

  if (!ENVELOPE_RE.test(maskedXml)) {
    throw new Error(`germantechjobs: unexpected feed response — expected an <rss><channel> envelope, got: ${xml.length}-char body`);
  }

  // A valid outer envelope can still wrap a body truncated mid-item — e.g. a
  // response cut off after an opening <item> but before its closing tag, with
  // a stray </channel></rss> tail from buffering/retry behavior. The non-greedy
  // item regex below would simply not match that dangling <item>, so an
  // otherwise-truncated feed would read as "zero items" — a genuinely empty
  // board — instead of the broken fetch it actually is. Count open vs close
  // tags within the (masked) channel body first: a mismatch is unambiguous
  // truncation evidence and throws, rather than silently dropping the
  // incomplete item and returning whatever did parse.
  const maskedChannelBody = (maskedXml.match(/<channel\b[^>]*>([\s\S]*)<\/channel>/i) || [, ''])[1];
  const openItems = (maskedChannelBody.match(/<item\b/gi) || []).length;
  const closedItems = (maskedChannelBody.match(/<\/item>/gi) || []).length;
  if (openItems !== closedItems) {
    throw new Error(`germantechjobs: malformed feed — ${openItems} <item> open tag(s) but ${closedItems} </item> close tag(s) (truncated response?)`);
  }

  // Item boundaries are matched against the masked xml (so CDATA text cannot
  // end a block early), but each block is sliced from the REAL xml at that
  // same position/length, preserving the actual CDATA content for field
  // parsing.
  const jobs = [];
  for (const m of maskedXml.matchAll(/<item\b[^>]*>[\s\S]*?<\/item>/gi)) {
    const item = xml.slice(m.index, m.index + m[0].length);

    const url = cleanUrl(tagText(item, 'link') || tagText(item, 'guid'));
    if (!url) continue;

    const rawTitle = tagText(item, 'title');
    if (!rawTitle) continue;

    // No identifiable employer after " @ " means the row cannot be attributed
    // to anyone: drop it rather than filing it under the board or the portal
    // entry name, which would let the scanner's company+role dedup merge two
    // different employers' same-titled postings into one opening.
    const { title, company, salary } = splitTitle(rawTitle);
    if (!company) continue;

    // Description ships in the list payload, so it is free — the scanner's
    // content_filter and visa_filter read it. `description` is the posting
    // body; `content:encoded` repeats it with more markup on some rows.
    const rawDesc = tagText(item, 'description') || tagText(item, 'content:encoded') || '';
    const description = rawDesc ? htmlToText(rawDesc) : '';

    const job = {
      title,
      company,
      // The feed carries no location for any item (see the header comment), so
      // this is '' on every PARSE row — the feed's truth. The board-level
      // country default is applied at the normalized-row layer (normalize).
      location: '',
      url,
    };
    if (salary) job.salary = salary;
    if (description) job.description = description;
    const postedAt = toEpochMs(tagText(item, 'pubDate'));
    if (postedAt !== undefined) job.postedAt = postedAt;
    jobs.push(job);
  }

  return jobs;
}

/** Scanner job-row shape for one parsed posting. */
function normalize(row) {
  return {
    id: `germantechjobs-${row.url}`,
    title: row.title,
    company: row.company,
    url: row.url,
    // The salary display string captured from the title's € bracket (CAR-228):
    // kept verbatim, never annualized here — German-formatted thousands
    // ("48.000") are what the client's shared salary tokenizer reads
    // correctly, so the #/scan salary facet filters on real figures.
    salary: row.salary || '',
    // The board-level country default feeds the country facet; the feed
    // carries no per-item location, so a CITY is never invented (see
    // BOARD_LOCATION).
    location: row.location || BOARD_LOCATION,
    isRemote: /remote|удал[её]н/i.test(row.title),
    workplaceType: '',
    relocates: false,
    date: typeof row.postedAt === 'number' ? new Date(row.postedAt).toISOString().slice(0, 10) : '',
    snippet: row.description || '',
    source: 'germantechjobs',
  };
}

/**
 * Fetch + parse the board-wide feed (single request). The endpoint is
 * re-validated against the pinned host before any request
 * (assertGermantechjobsUrl); `redirect: 'error'` prevents SSRF via
 * server-side redirects. A scan aborted before the first request fails loud,
 * not as an empty board.
 *
 * @param {string} endpoint - the feed URL from the adapter's buildEndpoint
 *   (FEED_URL, or an allowlisted `feed_url`/`api` override).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           retries?: number }} [opts]
 * @returns {Promise<Array<object>>} normalized job rows
 */
export async function fetchGermantechjobs(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, retries } = opts;
  // Host allowlist before any request (SSRF guard): the adapter resolved this
  // endpoint from the entry; re-validate it here. An empty endpoint falls
  // back to the canonical feed (the adapter always resolves one, so this is
  // defence in depth only).
  const feedUrl = endpoint && String(endpoint).trim()
    ? assertGermantechjobsUrl(String(endpoint).trim())
    : assertGermantechjobsUrl(FEED_URL);
  signal?.throwIfAborted();
  const xml = await fetchTextWithRetry(fetchImpl, feedUrl, {
    signal,
    redirect: 'error',
    retries,
    headers: {
      'User-Agent': BROWSER_LIKE_USER_AGENT,
      accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    },
  });
  return parseGermantechjobsFeed(xml).map(normalize);
}
