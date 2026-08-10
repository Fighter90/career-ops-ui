/**
 * Hacker News "Ask HN: Who is hiring?" source — no auth required.
 *
 * Two-step fetch via Algolia HN API:
 *   1. GET SEARCH_URL → find the latest monthly hiring thread objectID, filtered
 *      to stories posted by the "whoishiring" account (tags=story,author_whoishiring)
 *      rather than a free-text query (parent #3aa5e15). A free-text
 *      "Ask HN Who is hiring" query against search_by_date can, once enough time
 *      passes since the monthly thread posted, rank an unrelated recent story
 *      above it in the top date-sorted hits — every one fails the title regex
 *      and the provider throws "thread not found" while the real thread sits a
 *      few pages back. The account tag returns only its own threads, so
 *      date-ordering always surfaces the latest real one first.
 *   2. GET ITEMS_BASE + id → thread's top-level `children` are job posts (free-form text).
 *
 * Posts are free-form; we guarantee only:
 *   - title  : first non-empty line of the comment (HTML stripped, entities decoded)
 *   - url    : first https?:// link found anywhere in the comment text
 *
 * Children with no extractable URL are dropped. Deleted/dead children are also dropped.
 *
 * Used by the hackernews adapter (server/lib/portals/adapters/hackernews.mjs).
 */
const UA = 'career-ops-web-ui/1.0';

export const SEARCH_URL =
  'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=5';

export const ITEMS_BASE = 'https://hn.algolia.com/api/v1/items/';

export const HN_ALGOLIA_HOST = 'hn.algolia.com';

export const meta = {
  value: 'hackernews',
  label: 'Hacker News (Who is hiring)',
  region: 'en',
};

/** tiny stable hash (djb2) → base36, for URL-derived IDs. */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/**
 * Assert the URL uses HTTPS and points to hn.algolia.com.
 * Throws on any other host or non-HTTPS scheme.
 * @param {string} url
 * @returns {string} the url, unmodified, if valid
 */
export function assertHnUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`hackernews: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`hackernews: URL must use HTTPS: ${url}`);
  }
  if (parsed.hostname !== HN_ALGOLIA_HOST) {
    throw new Error(`hackernews: untrusted hostname "${parsed.hostname}" — expected ${HN_ALGOLIA_HOST}`);
  }
  return url;
}

/** Named HTML entities we decode in comment bodies. */
const ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
};
const ENTITY_RE = /&amp;|&lt;|&gt;|&quot;|&#x27;|&#39;|&nbsp;/g;

/**
 * Find the objectID of the latest "Ask HN: Who is hiring?" story from Algolia search hits.
 * Picks the first hit whose title matches /who is hiring/i (Algolia returns newest first).
 * Returns null if no matching hit is found.
 *
 * @param {unknown} searchJson  Parsed Algolia search_by_date response.
 * @returns {string|null}
 */
export function findHiringThreadId(searchJson) {
  if (!searchJson || typeof searchJson !== 'object') return null;
  const hits = /** @type {any} */ (searchJson).hits;
  if (!Array.isArray(hits) || hits.length === 0) return null;
  const RE = /who\s+is\s+hiring/i;
  for (const hit of hits) {
    if (hit && typeof hit.objectID === 'string' && typeof hit.title === 'string') {
      if (RE.test(hit.title)) return hit.objectID;
    }
  }
  return null;
}

/**
 * Parse a single HN comment child into { title, url } or null.
 *
 * - Strips HTML tags (anchors: href value replaces the tag so URL extraction works).
 * - Decodes named HTML entities.
 * - title = first non-empty line, truncated to 200 chars, URL-stripped.
 * - url   = first https?:// link found anywhere in the text.
 * - Returns null when there is no extractable URL or no non-empty line.
 *
 * @param {{ text?: string, deleted?: boolean, dead?: boolean }} child
 * @returns {{ title: string, url: string, rawText: string } | null}
 */
export function extractPost(child) {
  if (!child || child.deleted || child.dead) return null;
  const raw = typeof child.text === 'string' ? child.text : '';
  if (!raw.trim()) return null;

  // Anchors: replace with href so the URL survives tag stripping.
  const plain = raw
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>.*?<\/a>/gi, (_, href) => href)
    .replace(/<\/?(?:p|br|div|li|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(ENTITY_RE, (m) => ENTITY_MAP[m])
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // First non-empty line → title (strip any embedded URL, collapse spaces, cap at 200).
  const lines = plain.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const rawTitle = lines[0]
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 200);
  if (!rawTitle) return null;

  // First https?:// link anywhere in the plain text.
  const urlMatch = plain.match(/https?:\/\/[^\s<>"')]+/);
  if (!urlMatch) return null;
  const url = urlMatch[0].replace(/[.,;!?)]+$/, '');

  return { title: rawTitle, url, rawText: plain };
}

/**
 * Fetch and normalize jobs from HN "Who is hiring?" thread.
 *
 * @param {string} _url  Nominal URL (ignored — SEARCH_URL is always used).
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 * @returns {Promise<Array<object>>}
 */
export async function fetchHackerNews(_url, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;

  // Step 1 — find the latest monthly hiring thread.
  assertHnUrl(SEARCH_URL);
  const searchRes = await fetchImpl(SEARCH_URL, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!searchRes.ok) {
    throw new Error(`hackernews: search HTTP ${searchRes.status}`);
  }
  const searchJson = await searchRes.json();
  const threadId = findHiringThreadId(searchJson);
  if (!threadId) return [];

  // Step 2 — fetch the thread item.
  const itemUrl = `${ITEMS_BASE}${threadId}`;
  assertHnUrl(itemUrl);
  const itemRes = await fetchImpl(itemUrl, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!itemRes.ok) {
    throw new Error(`hackernews: items HTTP ${itemRes.status} for thread ${threadId}`);
  }
  const item = await itemRes.json();
  const children = Array.isArray(item?.children) ? item.children : [];

  const jobs = [];
  for (const child of children) {
    const post = extractPost(child);
    if (!post) continue;
    jobs.push(normalize(post));
  }
  return jobs;
}

/**
 * Detect "remote" in a title/text (case-insensitive).
 * @param {string} text
 */
function isRemotePost(text) {
  return /\bremote\b/i.test(text);
}

function normalize({ title, url, rawText }) {
  const remote = isRemotePost(title) || isRemotePost(rawText);
  // First ~160 chars of raw text as snippet (single-line).
  const snippet = rawText.replace(/\s+/g, ' ').trim().slice(0, 160);
  return {
    id: `hackernews-${djb2(url)}`,
    title,
    company: '',
    url,
    salary: '',
    location: '',
    isRemote: remote,
    workplaceType: remote ? 'Remote' : 'Onsite',
    relocates: false,
    date: '',
    snippet,
    source: 'hackernews',
  };
}
