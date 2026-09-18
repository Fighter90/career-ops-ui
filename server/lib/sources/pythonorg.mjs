// @ts-check
/**
 * Python.org Jobs source — the board-wide public RSS feed of the official
 * Python Software Foundation job board.
 *   GET https://www.python.org/jobs/feed/rss/
 *
 * Ported from parent career-ops `providers/pythonorg.mjs` at its hardened HEAD
 * (a7d9185c add → 7283db62 employer attribution + strict careers_url →
 * 317e4808 shared htmlToText for location → 6032f86d https + path boundary in
 * detect → 0622e41e sanitize description → 1102a14a single-line-feed location),
 * reimplemented to the web-ui source contract (rich 12-field job objects +
 * `meta` for auto-discovery). No code lifted.
 *
 * The feed is public, no-auth RSS 2.0 XML, parsed in-process with a tiny tag
 * extractor (same approach as weworkremotely.mjs / larajobs.mjs) — no XML
 * dependency. Each `<item>` exposes:
 *   - `<title>`       — "{Role}, {Company}" (the ONLY employer signal there is)
 *   - `<link>`/`<guid>` — the canonical posting URL on python.org
 *   - `<description>` — the location line, then the HTML body
 *   - `<pubDate>`     — RFC-822 publication date
 *
 * SINGLE REQUEST: the feed is not paginated, so there is no page cap to apply
 * and the dead-board contract collapses to its simplest form — the sole request
 * IS "page 1", and because nothing has succeeded before it a fetch failure
 * propagates (fetchText throws on a non-2xx) rather than being swallowed into
 * an empty result. Per-item parsing is fail-soft: a malformed/unattributed item
 * is dropped, never allowed to abort the rest of the feed.
 *
 * The host is pinned to python.org (anchored, subdomain-safe) and the fetch
 * uses `redirect:'error'` (SSRF-safe).
 *
 * Used by the pythonorg adapter (server/lib/portals/adapters/pythonorg.mjs).
 */
import { fetchText } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText } from '../html-to-text.mjs';

export const FEED_URL = 'https://www.python.org/jobs/feed/rss/';

/**
 * ANCHORED host allowlist: `python.org` itself or any subdomain of it.
 *
 * The anchors are the guard, not decoration. An unanchored `/python\.org/`
 * would admit BOTH spoof directions: `evilpython.org` (prefix — `(^|\.)`
 * requires the match to start the hostname or follow a dot) and
 * `python.org.evil.com` (suffix — `$` requires it to END the hostname).
 */
const TRUSTED_HOST_RE = /(^|\.)python\.org$/i;

/** Hosts whose `/jobs` page identifies the board itself (adapter detection). */
const BOARD_HOSTS = new Set(['python.org', 'www.python.org']);

/** `/jobs`, `/jobs/`, `/jobs/8133/` — but NOT `/jobs-archive`. */
const JOBS_PATH_RE = /^\/jobs(?:\/|$)/;

/** Keep scan payloads sane — python.org bodies carry a full-text JD. */
const SNIPPET_CAP = 500;

export const meta = {
  value: 'pythonorg',
  label: 'Python.org Jobs',
  region: 'en',
};

/**
 * Defence-in-depth host check on the endpoint built by the adapter. Throws on
 * failure so an off-host value can never reach the fetch slot.
 * @param {string} url
 * @returns {string} the same URL if valid
 */
export function assertPythonOrgUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`pythonorg: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`pythonorg: URL must use HTTPS: ${url}`);
  if (!TRUSTED_HOST_RE.test(parsed.hostname)) {
    throw new Error(`pythonorg: untrusted hostname "${parsed.hostname}" — must be python.org`);
  }
  return url;
}

/**
 * Whether a portal entry's `careers_url` points at the Python.org job board.
 *
 * Strict by construction (parent 7283db62 + 6032f86d): the URL is PARSED, not
 * regex-matched against the raw string, so `https://evil.com/?r=https://python.org/jobs`
 * cannot pass by carrying the board's address in a query parameter. HTTPS is
 * required, the host must be the board itself (not an arbitrary subdomain), and
 * the path is matched with a boundary so `/jobs-archive` is not `/jobs`.
 *
 * Exported for tests and for the adapter's `matches()`.
 * @param {unknown} careersUrl
 * @returns {boolean}
 */
export function matchesPythonOrgCareersUrl(careersUrl) {
  if (typeof careersUrl !== 'string' || !careersUrl) return false;
  let parsed;
  try {
    parsed = new URL(careersUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return BOARD_HOSTS.has(parsed.hostname.toLowerCase()) && JOBS_PATH_RE.test(parsed.pathname);
}

/**
 * RFC-822 `pubDate` → `YYYY-MM-DD`, or '' when absent/unparseable.
 *
 * `Number.isNaN` rather than a falsy check on the parse result: `|| ''` would
 * also discard a valid epoch 0.
 * @param {string} value
 * @returns {string}
 */
function toIsoDate(value) {
  if (!value) return '';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString().slice(0, 10);
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

/**
 * Keep only absolute HTTPS links hosted on python.org; '' otherwise.
 *
 * The same anchored allowlist as {@link assertPythonOrgUrl} — a feed item's
 * `<link>` is host-controlled content, so an off-host `<link>` must not become
 * a job URL. Exported so a future de-anchoring is caught by its own test.
 * @param {unknown} value
 * @returns {string}
 */
export function cleanUrl(value) {
  if (typeof value !== 'string' || !value) return '';
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return '';
  }
  return parsed.protocol === 'https:' && TRUSTED_HOST_RE.test(parsed.hostname) ? parsed.href : '';
}

/**
 * Split the RSS `<title>` into role and employer.
 *
 * Python.org writes "{Role}, {Company}" and the feed carries NO separate
 * employer field, so this split is the only attribution available. Per the
 * parent's Source Indexing Policy (7283db62) a listing that cannot be
 * employer-attributed is DROPPED rather than filed under the portal entry's own
 * name — which is why this source takes no `defaultCompany` fallback.
 *
 * Known parent quirk, ported deliberately: the split is on the LAST comma, so
 * "Senior Engineer, Acme, Inc." yields company "Inc.". Splitting on the first
 * comma would be wrong far more often ("Engineer, Data" style roles), and the
 * feed offers nothing to disambiguate with.
 *
 * Exported for tests.
 * @param {string} rawTitle
 * @returns {{title: string, company: string}|null} null when unattributable
 */
export function splitTitle(rawTitle) {
  if (typeof rawTitle !== 'string') return null;
  const text = rawTitle.trim();
  const lastComma = text.lastIndexOf(',');
  if (lastComma <= 0) return null;
  const title = text.slice(0, lastComma).trim();
  const company = text.slice(lastComma + 1).trim();
  if (!title || !company) return null;
  return { title, company };
}

/**
 * Location line from an item's already-entity-decoded `<description>`.
 *
 * Python.org prepends the location BEFORE the HTML body, separated either by a
 * newline or by nothing at all — on a single-line item the body starts right
 * after the location text (parent 1102a14a). Splitting on the newline alone
 * therefore swallowed the whole body into the location on those items, so the
 * split also breaks at an opening tag, in both its decoded (`<p>`) and still-
 * encoded (`&lt;p&gt;`, a double-encoded feed) spellings.
 *
 * A description that STARTS with markup has no location line at all — returning
 * the stripped body text there would put a paragraph of prose in `location`,
 * which is what the location filter matches on.
 *
 * Exported for tests.
 * @param {string} rawDesc entity-decoded description text
 * @returns {string}
 */
export function parseLocation(rawDesc) {
  if (typeof rawDesc !== 'string' || !rawDesc) return '';
  const firstChunk = rawDesc.split(/\r?\n|(?=<[a-z/!])|(?=&lt;[a-z/!])/i)[0];
  if (/^\s*(?:<|&lt;)/i.test(firstChunk)) return '';
  return htmlToText(firstChunk);
}

/**
 * Parse the Python.org jobs RSS feed into the web-ui rich job shape.
 *
 * Exported for unit tests — pure, no network. The `<link>` (falling back to
 * `<guid>`) is the dedup key; an item is dropped when it has no usable https
 * python.org URL, no title, or no identifiable employer.
 *
 * Field notes:
 *   - snippet: the HTML body run through the shared `htmlToText` (parent
 *     0622e41e) and capped. Raw markup here would flow into scan history, the
 *     tracker and every generated document.
 *   - isRemote: derived from the location line only — python.org is a MIXED
 *     board and the feed exposes no telecommute flag, so `workplaceType` stays
 *     '' (unknown) rather than claiming "Onsite".
 *
 * @param {unknown} xml raw RSS feed body
 * @returns {object[]}
 */
export function parsePythonOrgFeed(xml) {
  if (typeof xml !== 'string') return [];
  const jobs = [];
  const blocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];

  for (const item of blocks) {
    const url = cleanUrl(tagText(item, 'link') || tagText(item, 'guid'));
    if (!url) continue;

    const rawTitle = tagText(item, 'title');
    if (!rawTitle) continue;

    const split = splitTitle(rawTitle);
    if (!split) continue;

    const rawDesc = tagText(item, 'description');
    const location = parseLocation(rawDesc);
    const isRemote = /remote/i.test(location);
    const snippet = htmlToText(rawDesc).slice(0, SNIPPET_CAP);

    jobs.push({
      id: `pythonorg-${url}`,
      title: split.title,
      company: split.company,
      url,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: toIsoDate(tagText(item, 'pubDate') || tagText(item, 'dc:date')),
      snippet,
      source: 'pythonorg',
    });
  }

  return jobs;
}

/**
 * Fetch + normalize the Python.org jobs feed. One host-pinned request with
 * `redirect:'error'`; the response is parsed by {@link parsePythonOrgFeed}.
 *
 * @param {string} feedUrl feed URL (adapter default: FEED_URL)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchPythonOrg(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertPythonOrgUrl(feedUrl);
  const xml = await fetchText(fetchImpl, feedUrl, {
    signal,
    redirect: 'error',
    headers: { accept: 'application/rss+xml, application/xml, text/xml' },
  });
  return parsePythonOrgFeed(xml);
}
