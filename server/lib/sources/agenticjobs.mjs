// @ts-check
/**
 * Agentic Jobs source — board-wide, single-page server-rendered HTML listing.
 *   GET https://agentic-engineering-jobs.com/
 *
 * Ported from parent career-ops `providers/agentic-jobs.mjs` into the web-ui
 * source contract (rich job objects + `meta` for auto-discovery).
 *
 * The site has no public API, but every job card is plain HTML wrapped in a
 * `data-impression-slug` container, so the full list is parseable from one page
 * fetch (zero tokens, no browser). The host is pinned to
 * agentic-engineering-jobs.com and the fetch uses `redirect:'error'` (SSRF-safe).
 *
 * Card text lines after tag-stripping follow a stable order:
 *   [Featured?] → title → company → location → tech tags… → 🇺🇸 flag → [date]
 * The country flag emoji is decoded to a country name and appended to the
 * location so the en-scanner's location_filter can gate non-US postings that
 * only say "Remote".
 *
 * Used by the agenticjobs adapter (server/lib/portals/adapters/agenticjobs.mjs).
 */
import { fetchText } from '../http-json.mjs';

const SITE_ORIGIN = 'https://agentic-engineering-jobs.com';
const TRUSTED_HOST = 'agentic-engineering-jobs.com';

/** Canonical single-page listing URL (adapter default endpoint). */
export const FEED_URL = `${SITE_ORIGIN}/`;

/** Upper bound on cards returned from one page — bounds memory defensively. */
export const MAX_RESULTS = 200;

export const meta = {
  value: 'agenticjobs',
  label: 'Agentic Jobs',
  region: 'en',
};

/**
 * Assert that `url` targets agentic-engineering-jobs.com over HTTPS. Throws on
 * failure. Defence-in-depth host check on the endpoint built by the adapter.
 * @param {string} url
 * @returns {string} the same URL if valid
 */
export function assertAgenticUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`agenticjobs: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`agenticjobs: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`agenticjobs: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

// Minimal HTML entity decoder (inlined from parent career-ops
// providers/_html-entities.mjs). Named entities + numeric (&#252; / &#xfc;),
// with a codepoint-range guard so a malformed/adversarial entity can't throw a
// RangeError and crash the whole parse.
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** @param {string} s */
function decodeEntities(s) {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      const valid =
        Number.isFinite(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
      return valid ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/**
 * Convert a two-letter regional-indicator flag emoji (e.g. 🇩🇪) into an English
 * country name ("Germany"). Returns '' when the input isn't a flag or the
 * region code can't be resolved. Exported for tests.
 * @param {string} s
 */
export function flagToCountry(s) {
  const cps = [...s];
  if (cps.length !== 2) return '';
  const codes = cps.map((c) => {
    const cp = c.codePointAt(0) ?? 0;
    return cp >= 0x1f1e6 && cp <= 0x1f1ff ? String.fromCharCode(cp - 0x1f1e6 + 65) : '';
  });
  if (codes.some((c) => !c)) return '';
  try {
    const name = regionNames.of(codes.join(''));
    return name && name !== codes.join('') ? name : '';
  } catch {
    return '';
  }
}

/**
 * Parse one job card's HTML segment into text lines (tags stripped, entities
 * decoded, blanks removed). Exported for tests.
 * @param {string} segment
 */
export function cardLines(segment) {
  const noMedia = segment
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<img[^>]*>/gi, ' ');
  return noMedia
    .split(/<[^>]+>/)
    .map((t) => decodeEntities(t).trim())
    .filter(Boolean);
}

/**
 * Normalize one card's text lines into the web-ui rich job shape. Returns null
 * for a missing/path-unsafe slug or fewer than title+company. Exported for
 * tests.
 * @param {string} slug
 * @param {string[]} lines
 */
export function normalizeAgenticCard(slug, lines) {
  // The slug feeds straight into a URL path — reject anything path-unsafe.
  if (!slug || !/^[a-z0-9_-]+$/i.test(slug)) return null;
  // Drop the leftover `slug">` artifact of the split plus any Featured badge.
  const fields = lines.filter((l) => !l.includes('">') && l !== 'Featured');
  if (fields.length < 2) return null;
  const [title, company, maybeLocation] = fields;
  if (!title || !company) return null;

  // A card without a location line slides the flag-emoji (or date) line into
  // this slot — neither is ever a real location.
  let location =
    maybeLocation && !/^\d{4}-\d{2}-\d{2}$/.test(maybeLocation) && !flagToCountry(maybeLocation)
      ? maybeLocation
      : '';
  const flag = fields.map(flagToCountry).find(Boolean);
  if (flag) location = location ? `${location}, ${flag}` : flag;

  const url = `${SITE_ORIGIN}/jobs/${slug}`;
  const dateLine = fields.find((l) => /^\d{4}-\d{2}-\d{2}$/.test(l));
  const date = dateLine || '';
  const isRemote = /\bremote\b/i.test(location);

  return {
    id: `agenticjobs-${url}`,
    title,
    company,
    url,
    salary: '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : '',
    relocates: false,
    date,
    snippet: '',
    source: 'agenticjobs',
  };
}

/**
 * Parse the full listing page into deduped web-ui jobs (dedup key: url).
 * Exported for tests.
 * @param {string} html raw HTML body
 * @param {number} [maxResults] cap on returned cards
 */
export function parseAgenticListing(html, maxResults = MAX_RESULTS) {
  if (typeof html !== 'string') return [];
  const out = [];
  const seen = new Set();
  const segments = html.split(/<div[^>]*\bdata-impression-slug="/).slice(1);
  for (const seg of segments) {
    if (out.length >= maxResults) break;
    const slug = seg.slice(0, seg.indexOf('"'));
    // Cards can nest other markup; stop this card at the next card boundary.
    const nextCard = seg.indexOf('data-impression-slug', slug.length + 2);
    const body = nextCard > 0 ? seg.slice(0, nextCard) : seg;
    const job = normalizeAgenticCard(slug, cardLines(body));
    if (job && !seen.has(job.url)) {
      seen.add(job.url);
      out.push(job);
    }
  }
  return out;
}

/**
 * Fetch + normalize the Agentic Jobs listing. Single page fetch; hard failure
 * on zero cards (markup-change canary).
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchAgenticJobs(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertAgenticUrl(feedUrl);
  // redirect:'error' prevents SSRF via server-side redirects.
  const html = await fetchText(fetchImpl, feedUrl, {
    signal,
    redirect: 'error',
    headers: { accept: 'text/html,application/xhtml+xml' },
  });
  const jobs = parseAgenticListing(html);
  if (jobs.length === 0) {
    throw new Error(
      'agenticjobs: parsed 0 job cards — the site markup likely changed (expected data-impression-slug containers)',
    );
  }
  return jobs;
}
