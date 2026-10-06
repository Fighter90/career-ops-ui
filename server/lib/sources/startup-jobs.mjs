// @ts-check
/**
 * Startup Jobs source — the board-wide public RSS feed of the startup/scale-up
 * job aggregator startup.jobs.
 *   GET https://startup.jobs/feeds/jobs[?role=<slug>[&workplace=remote]]
 *
 * Ported from parent career-ops `providers/startup-jobs.mjs` at its post-merge
 * review fix (08fe5d06), reimplemented to the web-ui source contract (rich
 * 12-field job objects + `meta` for auto-discovery). No code lifted.
 *
 * The feed is public, no-auth RSS XML, parsed in-process with a tiny tag
 * extractor. The JSON API (api.startup.jobs) needs a bearer token and is NOT
 * used. SINGLE REQUEST: the feed is a fixed snapshot of only the ~50 most
 * recent matching postings, with no pagination, so there is no page cap to
 * apply and a fetch failure propagates (nothing succeeded before it). Cover a
 * search with several narrow entries (one per `role` slug, plus a
 * `workplace: remote` variant) instead of one broad one.
 *
 * Query params (both optional, from the entry's `startup_jobs:` block):
 *   - `role`: slug, the last segment of a `startup.jobs/roles/<slug>` page.
 *     An unknown slug answers HTTP 404, which propagates (a config typo fails
 *     loud instead of reading as an empty board).
 *   - `workplace`: confirmed live to accept exactly `remote`; anything else is a 404.
 * The JSON API's `country` param is a confirmed no-op on this RSS endpoint and
 * is deliberately NOT exposed.
 *
 * The feed has no structured company/location fields, so both are heuristic:
 *   - company: the title's trailing "... at {Company}", split on the LAST " at "
 *     (a company literally named "...at..." mis-splits, accepted). A title with
 *     no usable " at " segment has no identifiable employer and the row is
 *     DROPPED rather than attributed to the board. A leading German "bei " glued
 *     on by the source ("... at bei PROLOGA") is stripped so blacklist/dedup
 *     matching sees the plain company name.
 *   - location: the description's last non-empty line, anything after " · "
 *     (a trailing comp range) stripped.
 *
 * Defensive parsing (parent 08fe5d06): a malformed envelope (empty body, HTML
 * error page, non-string, bare `<item>`, or open/close `<item>` tag counts that
 * differ = truncation) THROWS instead of reading as zero jobs. CDATA sections
 * and XML comments are masked with same-length filler before any structural
 * matching, so a posting that mentions "<item>"/"</item>" in its text neither
 * trips the truncation check nor truncates its own item block.
 *
 * The host is pinned to startup.jobs, HTTPS only, `redirect:'error'`.
 *
 * Used by the startup-jobs adapter (server/lib/portals/adapters/startup-jobs.mjs).
 */
import { fetchText, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText } from '../html-to-text.mjs';

export const meta = {
  value: 'startup-jobs',
  label: 'Startup Jobs',
  region: 'en',
};

export const FEED_HOST = 'startup.jobs';
export const FEED_PATH = '/feeds/jobs';
const SNIPPET_CAP = 500;

/** Exact-host pin. Anchored on both ends: no subdomain, no suffix spoof. */
const TRUSTED_HOST_RE = /^startup\.jobs$/i;

/**
 * Defence-in-depth guard on the endpoint built by the adapter. Throws so an
 * off-host value can never reach the fetch slot.
 * @param {string} url
 * @returns {string} the same URL if valid
 */
export function assertStartupJobsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`startup-jobs: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`startup-jobs: URL must use HTTPS: ${url}`);
  if (!TRUSTED_HOST_RE.test(parsed.hostname)) {
    throw new Error(`startup-jobs: untrusted hostname "${parsed.hostname}" - must be ${FEED_HOST}`);
  }
  return url;
}

/**
 * Feed URL from an entry's optional `startup_jobs:` (or `startup-jobs:`) block.
 * Exported for tests and the adapter.
 * @param {any} entry
 * @returns {string}
 */
export function buildFeedUrl(entry) {
  const raw = entry && (entry.startup_jobs ?? entry['startup-jobs']);
  const cfg = raw && typeof raw === 'object' ? raw : {};
  const params = new URLSearchParams();
  if (typeof cfg.role === 'string' && cfg.role.trim()) params.set('role', cfg.role.trim());
  if (typeof cfg.workplace === 'string' && cfg.workplace.trim()) params.set('workplace', cfg.workplace.trim());
  const qs = params.toString();
  return `https://${FEED_HOST}${FEED_PATH}${qs ? `?${qs}` : ''}`;
}

/**
 * Split "{Role} at {Company}" on the LAST " at ". null when no usable employer.
 * Exported for tests.
 * @param {string} rawTitle
 * @returns {{title: string, company: string}|null}
 */
export function splitTitleCompany(rawTitle) {
  if (typeof rawTitle !== 'string') return null;
  const idx = rawTitle.lastIndexOf(' at ');
  if (idx === -1) return null;
  const title = rawTitle.slice(0, idx).trim();
  const company = rawTitle.slice(idx + 4).trim().replace(/^bei\s+/i, '');
  if (!title || !company) return null;
  return { title, company };
}

/**
 * Last non-empty description line, with a trailing " · {comp}" stripped.
 * Exported for tests.
 * @param {string} description
 * @returns {string}
 */
export function extractLocation(description) {
  if (!description) return '';
  const lines = description.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';
  const last = lines[lines.length - 1];
  const sep = last.indexOf(' · ');
  return (sep === -1 ? last : last.slice(0, sep)).trim();
}

/** @param {string} value */
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
 * Keep only absolute HTTPS links on startup.jobs; strips the feed's utm_*
 * query string down to the canonical posting path. '' otherwise.
 * Exported for tests.
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
  if (parsed.protocol !== 'https:' || !TRUSTED_HOST_RE.test(parsed.hostname)) return '';
  return `https://${parsed.hostname.toLowerCase()}${parsed.pathname}`;
}

const ENVELOPE_RE = /<rss\b[^>]*>[\s\S]*<channel\b[^>]*>[\s\S]*<\/channel>[\s\S]*<\/rss>/i;

/** Same-length filler for CDATA + comments, so positions stay aligned. */
function maskCdataAndComments(str) {
  return str.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g, (m) => '#'.repeat(m.length));
}

/**
 * Parse Startup Jobs' RSS feed into the web-ui rich job shape. Pure, no network.
 * Throws on a malformed envelope or a truncated feed (see header).
 * @param {unknown} xml raw RSS feed body
 * @returns {object[]}
 */
export function parseStartupJobsFeed(xml) {
  if (typeof xml !== 'string') {
    throw new Error(`startup-jobs: unexpected feed response — expected an <rss><channel> envelope, got: ${typeof xml}`);
  }
  const maskedXml = maskCdataAndComments(xml);
  if (!ENVELOPE_RE.test(maskedXml)) {
    throw new Error(`startup-jobs: unexpected feed response — expected an <rss><channel> envelope, got: ${xml.length}-char body`);
  }

  const channelBody = (maskedXml.match(/<channel\b[^>]*>([\s\S]*)<\/channel>/i) || ['', ''])[1];
  const openItems = (channelBody.match(/<item\b/gi) || []).length;
  const closedItems = (channelBody.match(/<\/item>/gi) || []).length;
  if (openItems !== closedItems) {
    throw new Error(`startup-jobs: malformed feed — ${openItems} <item> open tag(s) but ${closedItems} </item> close tag(s) (truncated response?)`);
  }

  // Boundaries from the masked text, content from the real text.
  const blocks = [];
  for (const m of maskedXml.matchAll(/<item\b[^>]*>[\s\S]*?<\/item>/gi)) {
    blocks.push(xml.slice(m.index, m.index + m[0].length));
  }

  const jobs = [];
  for (const item of blocks) {
    const url = cleanUrl(tagText(item, 'link'));
    if (!url) continue;
    const rawTitle = tagText(item, 'title');
    if (!rawTitle) continue;
    const split = splitTitleCompany(rawTitle);
    if (!split) continue;

    const rawDesc = tagText(item, 'description');
    const location = extractLocation(rawDesc);
    const isRemote = /\bremote\b/i.test(location);
    const description = htmlToText(rawDesc);

    /** @type {Record<string, any>} */
    const job = {
      id: `startup-jobs-${url}`,
      title: split.title,
      company: split.company,
      url,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: toIsoDate(tagText(item, 'pubDate')),
      snippet: description.slice(0, SNIPPET_CAP),
      source: 'startup-jobs',
    };
    if (description) job.description = description;
    jobs.push(job);
  }
  return jobs;
}

/**
 * Fetch + normalize the Startup Jobs feed. One host-pinned request with
 * `redirect:'error'`; failure propagates.
 * @param {string} feedUrl endpoint from the adapter's buildEndpoint
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchStartupJobs(feedUrl, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertStartupJobsUrl(feedUrl);
  const xml = await fetchText(/** @type {any} */ (fetchImpl), feedUrl, {
    signal,
    redirect: 'error',
    headers: {
      'User-Agent': BROWSER_LIKE_USER_AGENT,
      accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    },
  });
  return parseStartupJobsFeed(xml);
}
