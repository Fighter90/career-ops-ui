// @ts-check
/**
 * Cryptocurrency Jobs source — curated Web3/crypto job board, board-wide RSS.
 *   GET https://cryptocurrencyjobs.co/index.xml
 *
 * Implements the
 * web-ui source contract (rich job objects + `meta` for auto-discovery).
 *
 * The feed is public, no-auth RSS 2.0, parsed in-process with a tiny tag
 * extractor (same dependency-free approach as nodesk.mjs / weworkremotely.mjs /
 * larajobs.mjs — no XML library). The feed URL is a hardcoded constant (never
 * user-supplied), so there is no SSRF surface; the fetch still uses
 * `redirect:'error'` and the host is pinned to cryptocurrencyjobs.co for
 * defence-in-depth, mirroring the other board-wide RSS sources.
 *
 * Every listing is 100% remote, so `isRemote` is always true and
 * `workplaceType` is 'Remote'; `location` stays empty (the remote signal lives
 * in isRemote/workplaceType, matching the nodesk remote-only board convention)
 * so the en-scanner's location_filter passes. The company is encoded in the RSS
 * title as `Role at Company`; we split on the LAST " at ".
 *
 * Used by the cryptocurrencyjobs adapter
 * (server/lib/portals/adapters/cryptocurrencyjobs.mjs).
 */
import { fetchText } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
const decodeXmlEntities = decodeEntities;

export const FEED_URL = 'https://cryptocurrencyjobs.co/index.xml';
const TRUSTED_HOST = 'cryptocurrencyjobs.co';
// Exact host match — used by the adapter's override pinning too.
export const CRYPTOCURRENCYJOBS_HOST_RE = /^cryptocurrencyjobs\.co$/i;

export const meta = {
  value: 'cryptocurrencyjobs',
  label: 'Cryptocurrency Jobs',
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertCryptocurrencyJobsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`cryptocurrencyjobs: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`cryptocurrencyjobs: URL must use HTTPS: ${url}`);
  if (!CRYPTOCURRENCYJOBS_HOST_RE.test(parsed.hostname)) {
    throw new Error(`cryptocurrencyjobs: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

function toIsoDate(value) {
  if (!value) return '';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString().slice(0, 10);
}

// This feed's generator double-encodes entities at the source (verified live:
// the raw XML carries e.g. `Social Media &amp;amp; Growth Lead`), so a single
// canonical pass leaves a stray `&amp;` in some titles. Exactly TWO passes —
// NOT a decode-until-stable loop, which is the js/double-escaping bug class to
// avoid — normalizes this feed's shape and stays deterministic.
const decodeFeedText = (s) => decodeXmlEntities(decodeXmlEntities(s));

/**
 * Extract the raw text of the first <tag>…</tag> in a block, handling both
 * CDATA (<tag><![CDATA[…]]></tag>) and plain text. Returns the value UNDECODED
 * so the caller can apply the exactly-two-pass `decodeFeedText` uniformly.
 */
function extractTag(block, tag) {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))<\\/${tag}>`,
    'i',
  );
  const m = block.match(re);
  if (!m) return '';
  return (m[1] !== undefined ? m[1] : m[2] || '').trim();
}

/** Strip HTML tags and collapse whitespace (snippet is a plain-text preview). */
function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Keep only absolute HTTPS links on the exact trusted board host. Uses the same
// exact-match guard as assertCryptocurrencyJobsUrl + the adapter override, so
// the parser is never more permissive than the SSRF guard (no subdomains).
function cleanUrl(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' && CRYPTOCURRENCYJOBS_HOST_RE.test(parsed.hostname) ? parsed.href : '';
  } catch {
    return '';
  }
}

/**
 * Split "Role at Company" on the LAST " at " occurrence. Falls back to an empty
 * company when the pattern isn't found (no default company). Exported for unit
 * tests.
 *
 * @param {string} raw
 * @returns {{ title: string; company: string }}
 */
export function splitTitle(raw) {
  const text = String(raw ?? '').trim();
  const sep = ' at ';
  const idx = text.lastIndexOf(sep);
  if (idx <= 0) return { title: text, company: '' };
  return {
    title: text.slice(0, idx).trim(),
    company: text.slice(idx + sep.length).trim(),
  };
}

/**
 * Parse a Cryptocurrency Jobs RSS document into the web-ui rich job shape.
 * Exported for unit tests; `fetchCryptocurrencyJobs()` wraps it around an HTTP
 * fetch. Items without a usable https cryptocurrencyjobs.co URL (link, falling
 * back to guid) or without a title are dropped. Empty/malformed input yields []
 * (fail-soft — a scan must never abort on one bad feed).
 *
 * @param {string} xml raw RSS body
 * @param {number} [maxResults] optional cap on the number of jobs returned
 * @returns {import('../../../types.mjs').Job[]}
 */
export function parseCryptocurrencyJobsRss(xml, maxResults) {
  if (typeof xml !== 'string' || !xml) return [];
  const cap = Number.isFinite(maxResults) && maxResults > 0 ? Math.floor(maxResults) : Infinity;
  const jobs = [];
  const blocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  for (const item of blocks) {
    if (jobs.length >= cap) break;
    try {
      const rawTitle = decodeFeedText(extractTag(item, 'title'));
      // link is the dedup key; it falls back to <guid> when <link> is
      // absent, both host-pinned to cryptocurrencyjobs.co for SSRF safety.
      const url = cleanUrl(extractTag(item, 'link')) || cleanUrl(extractTag(item, 'guid'));
      if (!rawTitle || !url) continue;

      const { title, company } = splitTitle(rawTitle);
      if (!title) continue;

      // The feed carries the job description for free in the same payload; feed
      // it to `snippet` (tag-stripped, capped at 500) so content_filter can run.
      const rawDesc = extractTag(item, 'description');
      const snippet = rawDesc ? stripTags(decodeFeedText(rawDesc)).slice(0, 500) : '';

      jobs.push({
        id: `cryptocurrencyjobs-${url}`,
        title,
        company,
        url,
        salary: '',
        location: '',
        isRemote: true,
        workplaceType: 'Remote',
        relocates: false,
        date: toIsoDate(extractTag(item, 'pubDate')),
        snippet,
        source: 'cryptocurrencyjobs',
      });
    } catch {
      // Malformed item — skip, don't abort the whole feed.
    }
  }
  return jobs;
}

/**
 * Fetch + normalize the Cryptocurrency Jobs feed. A single fetch, so a failed
 * fetch must THROW, not be swallowed into []: a dead board is UNREACHABLE, not
 * empty. Swallowing it makes a dead board read as "live but empty", so
 * portal-health never escalates and coverage decays silently (same contract as
 * meituan/tencent). The transport error propagates to the caller (the
 * en-scanner catches per-source throws and records a failure).
 *
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, maxResults?: number, company?: object }} [opts]
 */
export async function fetchCryptocurrencyJobs(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal, maxResults } = opts;
  assertCryptocurrencyJobsUrl(feedUrl);
  const xml = await fetchText(fetchImpl, feedUrl, {
    signal,
    redirect: 'error',
    headers: { accept: 'application/rss+xml, application/xml, text/xml' },
  });
  return parseCryptocurrencyJobsRss(xml, maxResults);
}
