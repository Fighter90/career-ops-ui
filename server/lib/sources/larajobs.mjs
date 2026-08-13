// @ts-check
/**
 * LaraJobs source — board-wide Laravel/PHP jobs RSS feed.
 *   GET https://larajobs.com/feed
 *
 * Ported from parent career-ops `providers/larajobs.mjs` into the web-ui
 * source contract (rich job objects + `meta` for auto-discovery).
 *
 * The feed is public, no-auth XML, parsed in-process with the same tiny tag
 * extractor as nodesk.mjs / weworkremotely.mjs — no XML dependency. Each
 * <item> carries the standard RSS fields plus a `job:` namespace with
 * `<job:company>` and `<job:location>`, so company and location come straight
 * from the feed (no title-splitting heuristics needed); company falls back to
 * `<dc:creator>` then the tracked entry's name. Host-pinned to larajobs.com;
 * the fetch uses `redirect:'error'` (SSRF-safe).
 *
 * Used by the larajobs adapter (server/lib/portals/adapters/larajobs.mjs).
 */
import { fetchText } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
const decodeXmlEntities = decodeEntities;

export const FEED_URL = 'https://larajobs.com/feed';
const TRUSTED_HOST = 'larajobs.com';
// Exact host match — used by the adapter's override pinning too.
export const LARAJOBS_HOST_RE = /^larajobs\.com$/i;

export const meta = {
  value: 'larajobs',
  label: 'LaraJobs',
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertLarajobsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`larajobs: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`larajobs: URL must use HTTPS: ${url}`);
  if (!LARAJOBS_HOST_RE.test(parsed.hostname)) {
    throw new Error(`larajobs: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

function toIsoDate(value) {
  if (!value) return '';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString().slice(0, 10);
}


// Decode XML entities: numeric (&#38; / &#x27;) first, named five last (&amp;
// last so "&amp;lt;" → "&lt;" not "<").

function extractText(inner) {
  const cdata = inner.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) return cdata[1].trim();
  return decodeXmlEntities(inner).trim();
}

// Extract the text of the first <tag>…</tag> in a block. Returns '' when
// absent. Tag names may carry a namespace colon (e.g. job:company).
function tagText(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? extractText(m[1]) : '';
}

// Keep only absolute HTTPS links hosted on the trusted board domain.
function cleanUrl(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value.trim());
    const host = parsed.hostname.toLowerCase();
    const trusted = host === TRUSTED_HOST || host.endsWith(`.${TRUSTED_HOST}`);
    return parsed.protocol === 'https:' && trusted ? parsed.href : '';
  } catch {
    return '';
  }
}

/**
 * Parse LaraJobs' public RSS jobs feed into the web-ui rich job shape.
 * Exported for unit tests.
 *
 * Shape: `<rss><channel><item>…</item>…</channel></rss>`. Each item exposes
 * `<title>`, `<link>` (larajobs.com/job/<id>), `<pubDate>`, and a `job:`
 * namespace with `<job:company>` and `<job:location>`. Company falls back to
 * `<dc:creator>` then the entry name; location may be empty. Items without a
 * usable https larajobs.com URL (or with no title) are dropped.
 *
 * @param {string} xml raw RSS feed body
 * @param {string} [defaultCompany] fallback company when the feed omits one
 */
export function parseLarajobsFeed(xml, defaultCompany = 'LaraJobs') {
  if (typeof xml !== 'string') return [];
  const fallback = (typeof defaultCompany === 'string' && defaultCompany.trim()) ? defaultCompany.trim() : 'LaraJobs';
  const jobs = [];
  const blocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  for (const item of blocks) {
    const url = cleanUrl(tagText(item, 'link'));
    if (!url) continue;
    const title = tagText(item, 'title');
    if (!title) continue;
    const location = tagText(item, 'job:location');
    // Mixed board (not remote-only) — flag remote only when the feed says so.
    const isRemote = /remote/i.test(location);
    jobs.push({
      id: `larajobs-${url}`,
      title,
      company: tagText(item, 'job:company') || tagText(item, 'dc:creator') || fallback,
      url,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: toIsoDate(tagText(item, 'pubDate')),
      snippet: '',
      source: 'larajobs',
    });
  }
  return jobs;
}

/**
 * Fetch + normalize the LaraJobs feed.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchLarajobs(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertLarajobsUrl(feedUrl);
  const xml = await fetchText(fetchImpl, feedUrl, {
    signal,
    redirect: 'error',
    headers: { accept: 'application/rss+xml, application/xml, text/xml' },
  });
  const fallback = (company && typeof company.name === 'string' && company.name.trim()) ? company.name.trim() : 'LaraJobs';
  return parseLarajobsFeed(xml, fallback);
}
