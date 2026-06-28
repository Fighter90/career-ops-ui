// @ts-check
/**
 * We Work Remotely source — board-wide remote-jobs RSS feed.
 *   GET https://weworkremotely.com/remote-jobs.rss
 *
 * Ported from parent career-ops v1.14.0 `providers/weworkremotely.mjs` into the
 * web-ui source contract (rich job objects + `meta` for auto-discovery).
 *
 * The feed is public, no-auth XML, parsed in-process with a tiny tag extractor
 * (same approach as personio.mjs) — no XML dependency. The host is pinned to
 * weworkremotely.com and the fetch uses `redirect:'error'` (SSRF-safe). Every
 * posting is remote, so `isRemote` is always true; the en-scanner's
 * title_filter / location_filter gate the rows afterwards.
 *
 * Used by the weworkremotely adapter (server/lib/portals/adapters/weworkremotely.mjs).
 */
import { fetchText } from '../http-json.mjs';

export const FEED_URL = 'https://weworkremotely.com/remote-jobs.rss';
const TRUSTED_HOST = 'weworkremotely.com';

export const meta = {
  value: 'weworkremotely',
  label: 'We Work Remotely',
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertWwrUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`weworkremotely: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`weworkremotely: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`weworkremotely: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

function toIsoDate(value) {
  if (!value) return '';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString().slice(0, 10);
}

function fromCodePoint(cp) {
  try { return String.fromCodePoint(cp); } catch { return ''; }
}

// Decode XML entities: numeric (&#38; / &#x27;) first, named five last (&amp;
// last so "&amp;lt;" → "&lt;" not "<").
function decodeXmlEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
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

// WWR titles are usually "Company: Role"; split when present.
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

/**
 * Parse the WeWorkRemotely RSS feed into the web-ui rich job shape. Exported
 * for unit tests. The `<link>` is the dedup key; items without a usable
 * https weworkremotely.com URL are dropped.
 *
 * @param {string} xml raw RSS body
 * @param {string} [defaultCompany] fallback company for unsplittable titles
 */
export function parseWwrFeed(xml, defaultCompany = 'We Work Remotely') {
  if (typeof xml !== 'string') return [];
  const fallback = (typeof defaultCompany === 'string' && defaultCompany.trim()) ? defaultCompany.trim() : 'We Work Remotely';
  const jobs = [];
  const blocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  for (const item of blocks) {
    const url = cleanUrl(tagText(item, 'link'));
    if (!url) continue;
    const rawTitle = tagText(item, 'title');
    if (!rawTitle) continue;
    const { company, title } = splitTitle(rawTitle, fallback);
    const location = tagText(item, 'region') || tagText(item, 'category') || 'Remote';
    jobs.push({
      id: `weworkremotely-${url}`,
      title,
      company,
      url,
      salary: '',
      location,
      isRemote: true,
      workplaceType: 'Remote',
      relocates: false,
      date: toIsoDate(tagText(item, 'pubDate')),
      snippet: '',
      source: 'weworkremotely',
    });
  }
  return jobs;
}

/**
 * Fetch + normalize the WeWorkRemotely feed.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchWeWorkRemotely(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertWwrUrl(feedUrl);
  const xml = await fetchText(fetchImpl, feedUrl, { signal, redirect: 'error', headers: { accept: 'application/rss+xml, application/xml, text/xml' } });
  const fallback = (company && typeof company.name === 'string' && company.name.trim()) ? company.name.trim() : 'We Work Remotely';
  return parseWwrFeed(xml, fallback);
}
