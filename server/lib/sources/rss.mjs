/**
 * Generic RSS feed source (v1.62.0).
 *
 * Parses RSS 2.0 feeds via regex — no XML library required.
 * Supports CDATA sections, basic HTML-entity decoding, and the
 * dc:creator / category extension elements.
 *
 * Used by the rss adapter (server/lib/portals/adapters/rss.mjs).
 */
import { decodeEntities } from '../html-entities.mjs';
import { fetchText, labeledHttpError } from '../http-json.mjs';
import { isPrivateOrLoopbackHost } from '../security.mjs';

const UA = 'career-ops-web-ui/1.0';

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs for the rationale.
export const meta = {
  value: 'rss',
  label: 'RSS',
  region: 'en',
};

// ── tiny stable hash (djb2) ──────────────────────────────────────────
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  // >>> 0 converts to unsigned 32-bit, then toString(36) for compactness
  return (h >>> 0).toString(36);
}

/** Strip CDATA wrapper if present, then decode entities. */
function unwrap(raw) {
  if (!raw) return '';
  const cdataMatch = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)]]>\s*$/);
  const text = cdataMatch ? cdataMatch[1] : raw;
  return decodeEntities(text);
}

/** Strip HTML tags and collapse whitespace. */
function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── field extractors ─────────────────────────────────────────────────

function extractField(itemXml, tag) {
  // Support namespace prefix (e.g. dc:creator) and plain tags.
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = itemXml.match(re);
  return m ? unwrap(m[1]) : '';
}

/**
 * Extract the job URL from an item's <link>. Handles the three shapes feeds
 * actually ship — a plain <link>text</link>, a CDATA-wrapped one, and an
 * Atom-style <link href="…"> — then decodes entities and pins the scheme to
 * https (a job URL that is not https is dropped to '', never emitted).
 */
function extractLink(itemXml) {
  const tag = itemXml.match(/<link\b([^>]*)>([\s\S]*?)<\/link>/i);
  const candidates = [];
  if (tag) {
    candidates.push(unwrap(tag[2]).trim());
    const href = (tag[1].match(/\shref="([^"]+)"/i) || [])[1];
    if (href) candidates.push(unwrap(href).trim());
  } else {
    // Atom-style self-closing link (no </link> to match).
    const selfClosed = itemXml.match(/<link\b[^>]*\shref="([^"]+)"/i);
    if (selfClosed) candidates.push(unwrap(selfClosed[1]).trim());
  }
  return candidates.find((c) => /^https:\/\//i.test(c)) || '';
}

// ── remote-work / relocation signals ────────────────────────────────
const RE_REMOTE    = /remote|anywhere|удал[её]нн/i;
const RE_RELOCATE  = /visa|relocation|sponsorship/i;

// ── company name extraction from title ──────────────────────────────
/** Try common title patterns to pull a company name. */
function companyFromTitle(title) {
  // "Company — Role" or "Company - Role"
  const dashM = title.match(/^(.+?)\s+[—–-]+\s+.+/);
  if (dashM) return dashM[1].trim();
  // "Role at Company"
  const atM = title.match(/\bat\s+(.+)$/i);
  if (atM) return atM[1].trim();
  return '';
}

// ── main export ──────────────────────────────────────────────────────

/**
 * SSRF guard on the ONE source whose URL is fully user/config-controlled:
 * the feed URL comes straight from `portals.yml`, so an entry pointing at
 * `169.254.169.254` or `127.0.0.1` would be fetched as-is and its body parsed
 * back into the UI. FULL-R2 review revision: the SCHEME is not the threat —
 * plain-http feeds are legitimate and the config is operator-owned — so both
 * http: and https: pass. What is refused, BEFORE any request leaves, is a
 * private/loopback/link-local host (string-level here, resolve-time again in
 * the guarded transport below). Exported for tests.
 * @param {string} url
 * @returns {string}
 */
export function assertRssFeedUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`rss: invalid feed URL: ${url}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`rss: feed URL must use HTTP(S): ${url}`);
  }
  if (!parsed.hostname) throw new Error(`rss: feed URL has no hostname: ${url}`);
  // Bracketed IPv6 literals arrive with the brackets on (.hostname) —
  // isPrivateOrLoopbackHost strips them and classifies ::1, ::ffff:127.0.0.1,
  // fd00::/8 unique-local and fe80::/10 link-local as private.
  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    throw new Error(`rss: refusing private/loopback feed host: ${parsed.hostname}`);
  }
  return url;
}

/**
 * Fetch an RSS feed and return a normalized job array.
 *
 * Fetched through the shared guarded transport (`fetchText`), so the
 * DNS-rebinding guard resolves the feed host on the real network path and
 * refuses a record pointing at a private/loopback/cloud-metadata address —
 * the string-level {@link assertRssFeedUrl} check above is the first gate,
 * the resolve-time one is the second.
 *
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 * @returns {Promise<import('../../../types.mjs').Job[]>}
 */
export async function fetchRss(feedUrl, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertRssFeedUrl(feedUrl);

  const xml = await fetchText(fetchImpl, feedUrl, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
  }).catch((e) => {
    throw labeledHttpError(e, 'RSS');
  });

  // Extract the feed hostname as a last-resort company name
  let feedHostname = '';
  try {
    feedHostname = new URL(feedUrl).hostname.replace(/^www\./, '');
  } catch {
    feedHostname = feedUrl;
  }

  return parseRss(xml, feedHostname);
}

/**
 * Parse an RSS XML string into job objects.
 * Exported for testing without a live HTTP call.
 *
 * Shape contract (Phase 2): the body must carry the documented container —
 * an <rss> or <channel> root. A 200 that is not an RSS document (a
 * challenge page, an HTML error template) THROWS instead of parsing as an
 * empty board; a real feed with zero items still parses to [].
 */
export function parseRss(xml, feedHostname = '') {
  if (typeof xml !== 'string' || !/<(?:rss|channel)[\s>]/i.test(xml)) {
    throw new TypeError('RSS: response is not an RSS feed (no <rss>/<channel> document found)');
  }
  const jobs = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const itemXml = m[1];

    const title    = stripTags(extractField(itemXml, 'title'));
    const link     = extractLink(itemXml);
    const pubDate  = extractField(itemXml, 'pubDate') || extractField(itemXml, 'dc:date');
    const rawDesc  = extractField(itemXml, 'description') || extractField(itemXml, 'content:encoded');
    const guid     = extractField(itemXml, 'guid') || link;
    const creator  = extractField(itemXml, 'dc:creator');
    const category = extractField(itemXml, 'category');

    const snippet = stripTags(rawDesc).slice(0, 500);

    // Derive company: dc:creator → title pattern → feed hostname
    let company = creator
      || companyFromTitle(title)
      || feedHostname;
    company = stripTags(company);

    const location = category || '';

    // Remote / workplace type
    const haystack = `${title} ${snippet} ${location}`;
    const isRemote = RE_REMOTE.test(haystack);
    const workplaceType = isRemote ? 'Remote' : 'Onsite';

    // Relocation / visa sponsorship
    const relocates = RE_RELOCATE.test(haystack);

    // Stable id
    const id = `rss-${djb2(guid || link)}`;

    jobs.push({
      id,
      title:         title || '',
      company,
      url:           link  || '',
      salary:        '',
      location:      '', // RSS <category> is a topic tag, not a location — leave empty so location_filter passes
      isRemote,
      workplaceType,
      relocates,
      date:          pubDate || '',
      snippet,
      source:        'rss',
    });
  }
  return jobs;
}
