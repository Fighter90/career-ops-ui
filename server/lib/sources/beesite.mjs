// @ts-check
/**
 * beesite (milch & zucker GJB) source — the search backend behind branded
 * portals like jobs.mercedes-benz.com. The SPA calls a public, no-auth JSON
 * endpoint on the tenant's *.app.beesite.de host:
 *
 *   GET {origin}/search?data={URL-encoded JSON}
 *   → {"SearchResult":{"SearchResultCountAll":TOTAL,"SearchResultItems":[
 *        {"MatchedObjectId":"200325","MatchedObjectDescriptor":{
 *          "PositionTitle":…,"PositionURI":"https://jobs.mercedes-benz.com/…",
 *          "PositionLocation":[{"CityName":"Bremen"}],
 *          "PublicationStartDate":"2026-07-04"}}]}}
 *
 * Ported from parent career-ops `providers/beesite.mjs` into the web-ui source
 * contract (rich job objects + `meta`). PositionURI is the BRANDED job page,
 * so listings link straight to the public posting. FirstItem is 1-based;
 * requesting past the end returns an empty list; newest-first sort keeps a
 * bounded walk on the most recent postings. Safety caps preserved from the
 * parent: MAX_PAGES=40 (page size 100), MAX_JOBS=1000. Host-pinned to
 * *.beesite.de + `redirect:'error'` (SSRF-safe).
 *
 * Per-tenant: the endpoint origin comes from the company entry's `api:` /
 * careers_url. Optional `beesite:` block on the entry pins languageCode and
 * tenant-internal SearchCriteria facet codes.
 *
 * Used by the beesite adapter (server/lib/portals/adapters/beesite.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const meta = {
  value: 'beesite',
  label: 'beesite (GJB)',
  region: 'en',
};

const PAGE_SIZE = 100;
const MAX_PAGES = 40;
const MAX_JOBS = 1000;
const PAGE_DELAY_MS = 150;

const DESCRIPTOR = [
  'PositionID',
  'PositionTitle',
  'PositionURI',
  'PositionLocation.CityName',
  'PublicationStartDate',
];

/** Resolve the tenant's /search endpoint + config, or null when not beesite. */
export function resolveConfig(company) {
  const raw = String(company.api || company.careers_url || '').trim();
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.host.toLowerCase();
  if (host !== 'beesite.de' && !host.endsWith('.beesite.de')) return null;
  const cfgBlock = company.beesite && typeof company.beesite === 'object' ? company.beesite : {};
  return {
    searchApi: `${u.origin}/search`,
    languageCode: typeof cfgBlock.languageCode === 'string' ? cfgBlock.languageCode : 'EN',
    searchCriteria: Array.isArray(cfgBlock.searchCriteria) ? cfgBlock.searchCriteria : [],
  };
}

/** Build the ?data= payload URL for one page (FirstItem is 1-based). */
export function buildSearchUrl(cfg, firstItem) {
  const data = {
    LanguageCode: cfg.languageCode,
    SearchParameters: {
      FirstItem: firstItem,
      CountItem: PAGE_SIZE,
      Sort: [{ Criterion: 'PublicationStartDate', Direction: 'DESC' }],
      MatchedObjectDescriptor: DESCRIPTOR,
    },
    SearchCriteria: cfg.searchCriteria,
  };
  return `${cfg.searchApi}?data=${encodeURIComponent(JSON.stringify(data))}`;
}

// "2026-07-04" → ISO date string for the rich job shape ('' when unparseable).
function toIsoDate(raw) {
  const m = typeof raw === 'string' ? raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!m) return '';
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Map one search response into { total, jobs } (rich job shape). Exported for
 * unit tests.
 */
export function parseSearchResult(json, companyName) {
  const sr = json && json.SearchResult;
  const total = typeof (sr && sr.SearchResultCountAll) === 'number' ? sr.SearchResultCountAll : null;
  const items = Array.isArray(sr && sr.SearchResultItems) ? sr.SearchResultItems : [];
  const jobs = [];
  for (const item of items) {
    const d = item && item.MatchedObjectDescriptor;
    if (!d) continue;
    const id = item.MatchedObjectId != null ? String(item.MatchedObjectId) : String(d.PositionID || '');
    const title = String(d.PositionTitle || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const url = String(d.PositionURI || '').trim();
    if (!id || !title || !/^https:\/\//i.test(url)) continue;
    const locs = Array.isArray(d.PositionLocation) ? d.PositionLocation : [];
    const cities = [];
    for (const l of locs) {
      const c = String((l && l.CityName) || '').trim();
      if (c && !cities.includes(c)) cities.push(c);
    }
    jobs.push({
      id: `beesite-${id}`,
      title,
      company: companyName,
      url,
      salary: '',
      location: cities.join(' / '),
      isRemote: false,
      workplaceType: '',
      relocates: false,
      date: toIsoDate(d.PublicationStartDate),
      snippet: '',
      source: 'beesite',
    });
  }
  return { total, jobs };
}

function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES);
  return MAX_PAGES;
}

/**
 * Fetch + parse a tenant's postings with the parent's bounded newest-first
 * walk. `endpoint` is the tenant /search API from the adapter's buildEndpoint;
 * pagination stops on an empty page, a no-fresh-rows page, MAX_JOBS, or total.
 */
export async function fetchBeesite(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const cfg = resolveConfig({ ...company, api: company.api || endpoint, careers_url: company.careers_url || endpoint });
  if (!cfg) throw new Error(`beesite: cannot resolve search host for ${company.name || endpoint}`);
  const name = (company && typeof company.name === 'string' && company.name.trim()) ? company.name.trim() : 'beesite';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const maxPages = resolveMaxPages(company);
  const jobs = [];
  const seen = new Set();
  let total = null;

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await wait(PAGE_DELAY_MS);
    const json = await fetchJson(fetchImpl, buildSearchUrl(cfg, page * PAGE_SIZE + 1), {
      signal,
      redirect: 'error',
      headers: { accept: 'application/json' },
    });
    const { total: pageTotal, jobs: rows } = parseSearchResult(json, name);
    if (total === null) total = pageTotal;
    if (rows.length === 0) break; // past the last page

    let fresh = 0;
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      fresh++;
      jobs.push(row);
      if (jobs.length >= MAX_JOBS) break;
    }
    if (fresh === 0) break; // server ignored FirstItem (or we've looped)
    if (jobs.length >= MAX_JOBS) break;
    if (total !== null && (page + 1) * PAGE_SIZE >= total) break;
  }
  return jobs;
}
