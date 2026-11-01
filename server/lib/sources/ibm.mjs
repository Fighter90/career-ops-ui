/**
 * IBM careers source — POSTs to IBM's Elasticsearch-style careers search API
 * (the same endpoint ibm.com/careers/search calls). One endpoint serves every
 * locale (lang: "zz"), so results are language-agnostic.
 *
 * Implements the web-ui
 * source contract. Config comes from the company entry's `ibm:` block, read
 * via `opts.company` (the en-scanner passes the resolved company through):
 *
 *   tracked_companies:
 *     - name: IBM Germany — SWE & Data
 *       provider: ibm
 *       ibm:
 *         country: Germany                                   # field_keyword_05
 *         categories: ["Software Engineering", "Data & Analytics"]  # field_keyword_08
 *       enabled: true
 *
 * Used by the ibm adapter (server/lib/portals/adapters/ibm.mjs).
 */
import { fetchJsonWithRetry } from '../http-json.mjs';

export const API_URL = 'https://www-api.ibm.com/search/api/v2';
const PAGE_SIZE = 30;
// IBM's `total` is unreliable (often capped at the page size), so the walk is
// bounded by these, never by the response. 20 pages is the 600-record cap this
// provider always had; an entry can raise it with `max_pages`. (#6273)
const DEFAULT_MAX_PAGES = 20;
const MAX_PAGES_CAP = 300;
export const PAGE_DELAY_MS = 200;
const REMOTE_RE = /remote|home\s*office|anywhere/i;

/** Resolve the page cap: a positive integer `max_pages` on the entry, capped. */
export function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

export const meta = {
  value: 'ibm',
  label: 'IBM',
  region: 'en',
};

/**
 * Pin the endpoint to an IBM-owned host over HTTPS. The default endpoint is
 * www-api.ibm.com; an `api:` override may select another IBM property (a
 * regional mirror), but any other hostname is refused BEFORE any network I/O
 * — the override previously accepted `https://evil.com/...` verbatim.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertIbmApiUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`ibm: invalid API URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`ibm: API URL must use HTTPS: ${url}`);
  const host = parsed.hostname.toLowerCase();
  if (host !== 'ibm.com' && !host.endsWith('.ibm.com')) {
    throw new Error(`ibm: untrusted hostname "${parsed.hostname}" — must be an ibm.com host`);
  }
  return url;
}

/** tiny stable hash (djb2) → base36. */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/**
 * Build the Elasticsearch post_filter from the entry's `ibm:` config.
 * Sanitizes operator config: only non-empty trimmed strings survive, so a
 * stray/mistyped value can't inject empty or non-string filter terms.
 * @param {{ country?: string, categories?: string[] }} cfg
 */
export function buildPostFilter(cfg = {}) {
  const must = [];
  const categories = Array.isArray(cfg.categories)
    ? cfg.categories.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim())
    : [];
  if (categories.length) {
    must.push({ bool: { should: categories.map((c) => ({ term: { field_keyword_08: c } })) } });
  }
  const country = typeof cfg.country === 'string' ? cfg.country.trim() : '';
  if (country) must.push({ term: { field_keyword_05: country } });
  return { bool: { must } };
}

/**
 * Normalize one page of the IBM careers API response into rich job objects.
 * Throws if the response lacks the expected `hits.hits[]` shape so a silent
 * endpoint change surfaces as a hard error instead of empty results.
 * @param {any} json
 */
export function parseIbmResponse(json) {
  const hits = json && json.hits && Array.isArray(json.hits.hits) ? json.hits.hits : null;
  if (!hits) {
    throw new Error(`ibm: unexpected API response — expected hits.hits[], got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`);
  }
  const out = [];
  for (const h of hits) {
    const s = (h && h._source) || {};
    if (typeof s.title !== 'string' || s.title.trim() === '') continue;
    // Job URLs are fetched later by the pipeline: only https: survives, so an
    // insecure or scheme-abusing `url` (`http:`, `javascript:`) drops the row
    // instead of flowing into the scanner.
    if (typeof s.url !== 'string' || !/^https:\/\//i.test(s.url.trim())) continue;
    const loc = typeof s.field_keyword_19 === 'string' ? s.field_keyword_19.trim() : '';
    const mode = typeof s.field_keyword_17 === 'string' ? s.field_keyword_17.trim() : '';
    const isRemote = REMOTE_RE.test(mode) || REMOTE_RE.test(loc);
    const url = s.url.trim();
    out.push({
      id: `ibm-${djb2(url)}`,
      title: s.title.trim(),
      company: 'IBM',
      url,
      salary: '',
      location: [loc, mode].filter(Boolean).join(' · '),
      isRemote,
      workplaceType: isRemote ? 'Remote' : (mode || 'Onsite'),
      relocates: false,
      date: '',
      snippet: '',
      source: 'ibm',
    });
  }
  return out;
}

/**
 * Fetch + normalize IBM careers postings.
 * @param {string} apiUrl base endpoint (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchIbm(apiUrl = API_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertIbmApiUrl(apiUrl);
  const postFilter = buildPostFilter(company.ibm || {});
  const maxPages = resolveMaxPages(company);
  // Test seam; the default honors the abort signal while pacing between pages.
  const sleep = opts.sleep || ((ms) => new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason ?? new Error('aborted')); }, { once: true });
  }));
  const out = [];
  // Why the walk stopped: 'complete' (a short page), 'cap' (max_pages ran out
  // on a full page) or 'fetch-error' (a later page failed after retries).
  let stopReason = 'complete';
  let page = 0;
  let lastPageFull = false;
  for (; page < maxPages; page++) {
    if (page > 0) await sleep(PAGE_DELAY_MS);
    const from = page * PAGE_SIZE;
    const body = {
      appId: 'careers',
      scopes: ['careers2'],
      query: { bool: { must: [] } },
      post_filter: postFilter,
      size: PAGE_SIZE,
      from,
      sort: [{ _score: 'desc' }, { pageviews: 'desc' }],
      lang: 'zz',
      localeSelector: {},
      sm: { query: '', lang: 'zz' },
      _source: ['_id', 'title', 'url', 'description', 'language',
        'field_keyword_05', 'field_keyword_08', 'field_keyword_17',
        'field_keyword_18', 'field_keyword_19'],
    };
    let json;
    try {
      // redirect:'error' prevents SSRF via server-side redirects
      json = await fetchJsonWithRetry(fetchImpl, apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
        redirect: 'error',
        signal,
      });
    } catch (err) {
      // A failed first page is a broken board, not an empty one — throw so the
      // scan surfaces it. Past page one in a real scan, keep what was collected
      // and say so.
      if (page === 0) throw err;
      console.error(`⚠️  ibm: ${company.name || 'IBM'} truncated at page ${page + 1} of ${maxPages} (${out.length} jobs): ${err.message}`);
      stopReason = 'fetch-error';
      break;
    }
    out.push(...parseIbmResponse(json));
    // Stop on the first short page; IBM's `total` is not trusted.
    lastPageFull = json.hits.hits.length >= PAGE_SIZE;
    if (!lastPageFull) break;
  }
  // Only a full page at the entry's own cap is a truncation. A short last page
  // ended the board on its own.
  if (stopReason === 'complete' && lastPageFull && page === maxPages) stopReason = 'cap';
  if (stopReason === 'cap') {
    console.error(`⚠️  ibm: ${company.name || 'IBM'} truncated at max_pages=${maxPages} (${out.length} jobs) — raise max_pages on this entry for more`);
  }
  return out;
}
