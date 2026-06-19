/**
 * IBM careers source — POSTs to IBM's Elasticsearch-style careers search API
 * (the same endpoint ibm.com/careers/search calls). One endpoint serves every
 * locale (lang: "zz"), so results are language-agnostic.
 *
 * Ported from parent career-ops v1.12.0 `providers/ibm.mjs` into the web-ui
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
import { fetchJson } from '../http-json.mjs';

export const API_URL = 'https://www-api.ibm.com/search/api/v2';
const PAGE_SIZE = 30;
const MAX_RECORDS = 600; // safety cap on pagination
const REMOTE_RE = /remote|home\s*office|anywhere/i;

export const meta = {
  value: 'ibm',
  label: 'IBM',
  region: 'en',
};

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
    if (typeof s.url !== 'string' || !/^https?:\/\//i.test(s.url.trim())) continue;
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
  const postFilter = buildPostFilter(company.ibm || {});
  const out = [];
  for (let from = 0; from < MAX_RECORDS; from += PAGE_SIZE) {
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
    const json = await fetchJson(fetchImpl, apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    out.push(...parseIbmResponse(json));
    // Stop on the first short page; IBM's `total` is unreliable.
    if (json.hits.hits.length < PAGE_SIZE) break;
  }
  return out;
}
