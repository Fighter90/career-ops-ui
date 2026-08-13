// @ts-check
/**
 * HigherEdJobs source — board-wide RSS category feed.
 *   GET https://www.higheredjobs.com/rss/categoryFeed.cfm?catID={catID}
 *
 * Ported from parent career-ops `providers/higheredjobs.mjs` into the web-ui
 * source contract (rich job objects + `meta` for auto-discovery).
 *
 * The feed is public, no-auth XML, parsed in-process with the same tiny tag
 * extractor as weworkremotely.mjs — no XML dependency. Posting URLs are
 * exact-host-pinned to www.higheredjobs.com (no subdomain wildcard — the board
 * serves postings only from that host) and the fetch uses `redirect:'error'`
 * (SSRF-safe). `<description>` is "Institution Name (City, ST)" — company and
 * location are split from it.
 *
 * Used by the higheredjobs adapter (server/lib/portals/adapters/higheredjobs.mjs).
 */
import { fetchText } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
const decodeXmlEntities = decodeEntities;

const DEFAULT_CAT_ID = 68; // Higher Education category
const TRUSTED_HOST = 'www.higheredjobs.com';

export const meta = {
  value: 'higheredjobs',
  label: 'HigherEdJobs',
  region: 'en',
};

/** Build the category feed URL; a non-finite catId falls back to the default. */
export function feedUrlFor(catId) {
  const catID = typeof catId === 'number' && Number.isFinite(catId) ? catId : DEFAULT_CAT_ID;
  return `https://www.higheredjobs.com/rss/categoryFeed.cfm?catID=${catID}`;
}

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertHejUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`higheredjobs: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`higheredjobs: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`higheredjobs: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
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
    // Exact-match host — higheredjobs serves posting URLs only from www.
    return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === TRUSTED_HOST ? parsed.href : '';
  } catch {
    return '';
  }
}

// <description> is "Institution Name (City, ST)" — split on the LAST " (".
function splitDescription(rawDescription, defaultCompany) {
  const text = rawDescription.trim();
  const open = text.lastIndexOf(' (');
  if (open > 0) {
    const close = text.lastIndexOf(')');
    const company = text.slice(0, open).trim();
    const location = close > open ? text.slice(open + 2, close).trim() : text.slice(open + 2).trim();
    if (company) return { company, location };
  }
  return { company: text || defaultCompany, location: '' };
}

/**
 * Parse the HigherEdJobs RSS category feed into the web-ui rich job shape.
 * Exported for unit tests. The RSS <link> is the dedup key; items without a
 * usable https www.higheredjobs.com URL are dropped.
 *
 * @param {string} xml raw RSS body
 * @param {string} [defaultCompany] fallback company for empty descriptions
 */
export function parseHigherEdJobsFeed(xml, defaultCompany = 'HigherEdJobs') {
  if (typeof xml !== 'string') return [];
  const fallback = (typeof defaultCompany === 'string' && defaultCompany.trim()) ? defaultCompany.trim() : 'HigherEdJobs';
  const jobs = [];
  const blocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  for (const item of blocks) {
    const url = cleanUrl(tagText(item, 'link'));
    if (!url) continue;
    const title = tagText(item, 'title');
    if (!title) continue;
    const { company, location } = splitDescription(tagText(item, 'description'), fallback);
    jobs.push({
      id: `higheredjobs-${url}`,
      title,
      company,
      url,
      salary: '',
      location,
      isRemote: false,
      workplaceType: '',
      relocates: false,
      date: toIsoDate(tagText(item, 'pubDate')),
      snippet: '',
      source: 'higheredjobs',
    });
  }
  return jobs;
}

/**
 * Fetch + parse the feed. `feedUrl` comes from the adapter's buildEndpoint
 * (fixed public feed, catID-parameterized); host-pinned before the request.
 */
export async function fetchHigherEdJobs(feedUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertHejUrl(feedUrl);
  const xml = await fetchText(fetchImpl, feedUrl, { signal, redirect: 'error', headers: { accept: 'application/rss+xml, application/xml, text/xml' } });
  const fallback = (company && typeof company.name === 'string' && company.name.trim()) ? company.name.trim() : 'HigherEdJobs';
  return parseHigherEdJobsFeed(xml, fallback);
}
