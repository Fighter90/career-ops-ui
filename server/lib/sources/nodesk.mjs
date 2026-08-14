// @ts-check
/**
 * NoDesk source — board-wide remote-jobs RSS feed.
 *   GET https://nodesk.co/remote-jobs/index.xml
 *
 * Implements the web-ui
 * source contract (rich job objects + `meta` for auto-discovery).
 *
 * The feed is public, no-auth XML, parsed in-process with a tiny tag extractor
 * (same approach as weworkremotely.mjs / personio.mjs) — no XML dependency. The
 * host is pinned to nodesk.co and the fetch uses `redirect:'error'` (SSRF-safe).
 * NoDesk is a remote-only board, so `isRemote` is always true; the en-scanner's
 * title_filter / location_filter gate the rows afterwards.
 *
 * NoDesk encodes the company in the RSS title as `Role at Company`; there is no
 * dedicated location tag, so location stays empty unless the feed evolves.
 *
 * Used by the nodesk adapter (server/lib/portals/adapters/nodesk.mjs).
 */
import { fetchText } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
const decodeXmlEntities = decodeEntities;

export const FEED_URL = 'https://nodesk.co/remote-jobs/index.xml';
const TRUSTED_HOST = 'nodesk.co';

export const meta = {
  value: 'nodesk',
  label: 'NoDesk',
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertNodeskUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`nodesk: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`nodesk: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`nodesk: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

function toIsoDate(value) {
  if (!value) return '';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString().slice(0, 10);
}

function extractText(inner) {
  const cdata = inner.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) return cdata[1].trim();
  return decodeXmlEntities(inner).trim();
}

function tagText(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? extractText(m[1]) : '';
}

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

// NoDesk encodes the company in the title as "Role at Company"; split on the
// LAST " at " so a role like "Engineer at Acme" → { title: 'Engineer', company: 'Acme' }.
function splitTitle(rawTitle, defaultCompany) {
  const text = rawTitle.trim();
  const lower = text.toLowerCase();
  const idx = lower.lastIndexOf(' at ');
  if (idx > 0) {
    const title = text.slice(0, idx).trim();
    const company = text.slice(idx + 4).trim();
    if (title && company) return { title, company };
  }
  return { title: text, company: defaultCompany };
}

/**
 * Parse NoDesk's public RSS jobs feed into the web-ui rich job shape. Exported
 * for unit tests. The `<link>` is the dedup key; items without a usable https
 * nodesk.co URL (or with no title) are dropped.
 *
 * @param {string} xml raw RSS body
 * @param {string} [defaultCompany] fallback company for unsplittable titles
 */
export function parseNodeskFeed(xml, defaultCompany = 'NoDesk') {
  if (typeof xml !== 'string') return [];
  const fallback = (typeof defaultCompany === 'string' && defaultCompany.trim()) ? defaultCompany.trim() : 'NoDesk';
  const jobs = [];
  const blocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  for (const item of blocks) {
    const url = cleanUrl(tagText(item, 'link'));
    if (!url) continue;
    const rawTitle = tagText(item, 'title');
    if (!rawTitle) continue;
    const { title, company } = splitTitle(rawTitle, fallback);
    jobs.push({
      id: `nodesk-${url}`,
      title,
      company,
      url,
      salary: '',
      location: '',
      isRemote: true,
      workplaceType: 'Remote',
      relocates: false,
      date: toIsoDate(tagText(item, 'pubDate')),
      snippet: '',
      source: 'nodesk',
    });
  }
  return jobs;
}

/**
 * Fetch + normalize the NoDesk feed.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchNodesk(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertNodeskUrl(feedUrl);
  const xml = await fetchText(fetchImpl, feedUrl, { signal, redirect: 'error', headers: { accept: 'application/rss+xml, application/xml, text/xml' } });
  const fallback = (company && typeof company.name === 'string' && company.name.trim()) ? company.name.trim() : 'NoDesk';
  return parseNodeskFeed(xml, fallback);
}
