/**
 * Generic RSS feed source (v1.62.0).
 *
 * Parses RSS 2.0 feeds via regex — no XML library required.
 * Supports CDATA sections, basic HTML-entity decoding, and the
 * dc:creator / category extension elements.
 *
 * Used by the rss adapter (server/lib/portals/adapters/rss.mjs).
 */

const UA = 'career-ops-web-ui/1.0';

// ── tiny stable hash (djb2) ──────────────────────────────────────────
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  // >>> 0 converts to unsigned 32-bit, then toString(36) for compactness
  return (h >>> 0).toString(36);
}

// ── HTML entity + CDATA helpers ──────────────────────────────────────
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Codepoint → string, guarding against invalid/astral overflow values. */
function safeFromCodePoint(cp) {
  try {
    return Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
  } catch {
    return '';
  }
}

function decodeEntities(str) {
  return str
    .replace(/&([a-z]+);/gi, (_, e) => ENTITIES[e.toLowerCase()] ?? _)
    .replace(/&#(\d+);/g, (_, n) => safeFromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeFromCodePoint(parseInt(h, 16)));
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
 * Extract the first <link> that is NOT inside a CDATA or another tag.
 * RSS <link> elements often sit between adjacent tags without attributes:
 *   <link>https://…</link>
 * or are self-closed Atom-style; we handle both.
 */
function extractLink(itemXml) {
  // Try plain <link>…</link> first
  const plain = itemXml.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (plain) return plain[1].trim();
  // Try <link … href="…" …/> (Atom mixed into RSS)
  const atom = itemXml.match(/<link[^>]+href="([^"]+)"/i);
  if (atom) return atom[1].trim();
  return '';
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
 * Fetch an RSS feed and return a normalized job array.
 *
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 * @returns {Promise<import('../../../types.mjs').Job[]>}
 */
export async function fetchRss(feedUrl, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;

  const res = await fetchImpl(feedUrl, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
  });

  if (!res.ok) {
    const err = new Error(`RSS: HTTP ${res.status} (${feedUrl})`);
    err.status = res.status;
    throw err;
  }

  const xml = await res.text();

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
 */
export function parseRss(xml, feedHostname = '') {
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
