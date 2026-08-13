// @ts-check
/**
 * Jobspresso source — board-wide remote-jobs RSS/XML feed.
 *   GET https://jobspresso.co/?feed=job_feed
 *
 * Ported into the web-ui source contract (rich job objects + `meta` for
 * auto-discovery). The feed is public, no-auth XML, parsed in-process with a
 * tiny tag extractor — no XML dependency. The host is pinned to jobspresso.co
 * and the fetch uses `redirect:'error'` (SSRF-safe). Every posting is remote,
 * so `isRemote` is always true; the en-scanner's title_filter / location_filter
 * gate the rows afterwards.
 *
 * Used by the jobspresso adapter (server/lib/portals/adapters/jobspresso.mjs).
 */
import { fetchText } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
const decodeXmlEntities = decodeEntities;

export const FEED_URL = 'https://jobspresso.co/?feed=job_feed';
const TRUSTED_HOST = 'jobspresso.co';

const UA = 'career-ops-ui/1 (job-search-tool; +https://github.com/Fighter90/career-ops)';

export const meta = {
  value: 'jobspresso',
  label: 'Jobspresso',
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertJobspressoUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`jobspresso: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`jobspresso: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`jobspresso: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
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

/** tiny stable hash (djb2) → base36, for postings with no native id. */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
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

// Jobspresso titles sometimes use "Company: Role"; split when present.
function splitTitle(rawTitle, defaultCompany) {
  const text = rawTitle.trim();
  const colon = text.indexOf(':');
  if (colon > 0) {
    const company = text.slice(0, colon).trim();
    const title = text.slice(colon + 1).trim();
    if (company && title) return { company, title };
  }
  return { company: defaultCompany, title: text };
}

function extractLocation(item) {
  // Try WP Job Manager's job_listing_location first, then generic category
  return tagText(item, 'job_listing_location') || tagText(item, 'category') || 'Remote';
}

/**
 * Parse the Jobspresso RSS feed into the web-ui rich job shape. Exported for
 * unit tests. The `<link>` is the dedup key; items without a usable https
 * jobspresso.co URL are dropped.
 *
 * @param {string} xml raw RSS body
 * @param {string} [fallbackCompany] fallback company for unsplittable titles
 */
export function parseJobspressoFeed(xml, fallbackCompany = 'Jobspresso') {
  if (typeof xml !== 'string') return [];
  const company = (typeof fallbackCompany === 'string' && fallbackCompany.trim())
    ? fallbackCompany.trim()
    : 'Jobspresso';
  const jobs = [];
  const blocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  for (const item of blocks) {
    const url = cleanUrl(tagText(item, 'link'));
    if (!url) continue;
    const rawTitle = tagText(item, 'title');
    if (!rawTitle) continue;
    const { company: co, title } = splitTitle(rawTitle, company);
    const location = extractLocation(item);
    jobs.push({
      id: `jobspresso-${djb2(url)}`,
      title,
      company: co,
      url,
      salary: '',
      location,
      isRemote: true,
      workplaceType: 'Remote',
      relocates: false,
      date: toIsoDate(tagText(item, 'pubDate')),
      snippet: '',
      source: 'jobspresso',
    });
  }
  return jobs;
}

/**
 * Fetch + normalize the Jobspresso RSS feed.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchJobspresso(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertJobspressoUrl(feedUrl);
  const xml = await fetchText(fetchImpl, feedUrl, {
    signal,
    redirect: 'error',
    headers: {
      'User-Agent': UA,
      Accept: 'application/rss+xml, application/xml, text/xml',
    },
  });
  const fallback = (company && typeof company.name === 'string' && company.name.trim())
    ? company.name.trim()
    : 'Jobspresso';
  return parseJobspressoFeed(xml, fallback);
}
