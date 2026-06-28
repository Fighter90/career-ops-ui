// @ts-check
/**
 * Teamtailor source — per-tenant career site, public RSS feed.
 *   GET https://<slug>.teamtailor.com/jobs.rss
 *
 * v1.80.0 — new source (idea from bracketouverte/job-crawler; reimplemented to
 * the web-ui source contract, no code lifted). Teamtailor exposes a no-auth RSS
 * feed per tenant with namespaced `<teamtailor:location>` / `<teamtailor:department>`
 * tags. The feed host is pinned to `<slug>.teamtailor.com` and the fetch uses
 * `redirect:'error'` (SSRF-safe). The per-job `<link>` is on the tenant (or its
 * custom) domain, so it is NOT host-locked — display-only, never server-fetched.
 *
 * Used by the teamtailor adapter (server/lib/portals/adapters/teamtailor.mjs).
 */
import { fetchText } from '../http-json.mjs';

export const TEAMTAILOR_HOST_RE = /^[a-z0-9][a-z0-9-]*\.teamtailor\.com$/;
const REMOTE_RE = /remote|anywhere|distributed|home\s*office/i;

export const meta = {
  value: 'teamtailor',
  label: 'Teamtailor',
  region: 'en',
};

/** Defence-in-depth host check on the feed URL built by the adapter. */
export function assertTeamtailorUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`teamtailor: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`teamtailor: URL must use HTTPS: ${url}`);
  if (!TEAMTAILOR_HOST_RE.test(parsed.hostname)) {
    throw new Error(`teamtailor: untrusted hostname "${parsed.hostname}" — must match <slug>.teamtailor.com`);
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

// Extract the first <tag>…</tag> (tag may contain a namespace colon, e.g.
// "teamtailor:location"). Returns '' when absent.
function tagText(block, tag) {
  const esc = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = block.match(new RegExp(`<${esc}\\b[^>]*>([\\s\\S]*?)</${esc}>`, 'i'));
  return m ? extractText(m[1]) : '';
}

function cleanUrl(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

/**
 * Parse a Teamtailor `/jobs.rss` feed into the web-ui rich job shape. Exported
 * for unit tests. The `<link>` is the dedup key; items without a usable https
 * URL or a title are dropped.
 *
 * @param {string} xml raw RSS body
 * @param {string} companyName fallback company name
 */
export function parseTeamtailorFeed(xml, companyName = '') {
  if (typeof xml !== 'string') return [];
  const jobs = [];
  const blocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  for (const item of blocks) {
    const url = cleanUrl(tagText(item, 'link'));
    if (!url) continue;
    const title = tagText(item, 'title');
    if (!title) continue;
    const loc = tagText(item, 'teamtailor:location');
    const dept = tagText(item, 'teamtailor:department') || tagText(item, 'category');
    const location = loc || (REMOTE_RE.test(title) ? 'Remote' : '');
    const isRemote = REMOTE_RE.test(location) || REMOTE_RE.test(title);
    jobs.push({
      id: `teamtailor-${url}`,
      title,
      company: companyName || '',
      url,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : 'Onsite',
      relocates: false,
      date: toIsoDate(tagText(item, 'pubDate')),
      snippet: dept || '',
      source: 'teamtailor',
    });
  }
  return jobs;
}

/**
 * Fetch + normalize a Teamtailor tenant's RSS feed.
 * @param {string} feedUrl `https://<slug>.teamtailor.com/jobs.rss` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchTeamtailor(feedUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertTeamtailorUrl(feedUrl);
  const xml = await fetchText(fetchImpl, feedUrl, {
    signal,
    redirect: 'error',
    headers: { accept: 'application/rss+xml, application/xml, text/xml' },
  });
  return parseTeamtailorFeed(xml, company.name || '');
}
