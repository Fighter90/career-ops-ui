// @ts-check
/**
 * Phenom People source — the "CareerConnect" career sites many large
 * enterprises run (careers.allianz.com and countless others). The search SPA
 * talks to a public, no-auth JSON widget endpoint on the BRANDED host:
 *
 *   POST {origin}/widgets
 *   {"lang":"en_global","country":"global","ddoKey":"refineSearch",
 *    "pageName":"search-results","siteType":"external","jobs":true,
 *    "from":0,"size":100,"keywords":"","selected_fields":{…facet filters…},…}
 *   → {"refineSearch":{"status":200,"totalHits":N,
 *        "data":{"jobs":[{"jobId":"98098","title":…,"city":…,"state":…,
 *          "country":…,"location":…,"postedDate":"…ISO…"}]}}}
 *
 * Ported from parent career-ops `providers/phenom.mjs` into the web-ui source
 * contract (rich job objects + `meta`). `from` is a 0-based offset; `size` up
 * to 100/page. The public job page is {origin}/{urlPrefix}/job/{jobId}/{slug}
 * — the slug is cosmetic (Phenom keys on jobId), so we slugify the title. The
 * response's applyUrl points at the downstream ATS, NOT the public listing, so
 * it is never used as the job URL.
 *
 * A portals entry configures the tenant via a `phenom:` block:
 *   phenom: { lang, country, urlPrefix, selectedFields: { country: [...] } }
 *
 * SSRF defence: HTTPS only + `redirect:'error'`. Branded hosts carry no
 * "phenom" token, so PHENOM_HOST_RE (auto-detect) only claims literal
 * *.phenompeople.com URLs — branded tenants are wired with an explicit
 * `provider: phenom`, and the endpoint is then pinned to the tenant host the
 * adapter derived from the entry (same model as successfactors). Safety caps
 * preserved from the parent: PAGE_SIZE=100, MAX_PAGES=40, MAX_JOBS=1000.
 *
 * Used by the phenom adapter (server/lib/portals/adapters/phenom.mjs).
 */
import { fetchJson, delay } from '../http-json.mjs';

// Hosts detect() may auto-claim. Branded tenants (careers.allianz.com, …) are
// NOT auto-claimed — they carry an explicit `provider: phenom` in portals.yml.
export const PHENOM_HOST_RE = /(?:^|\.)phenompeople\.com$/i;

export const meta = {
  value: 'phenom',
  label: 'Phenom',
  region: 'en',
};

const PAGE_SIZE = 100; // max the widget serves per page (parent-verified)
const MAX_PAGES = 40; // safety cap on request count (40*100 = 4000 postings)
const MAX_JOBS = 1000; // cap total postings pulled per site
const PAGE_DELAY_MS = 150; // polite pacing between page requests

const REMOTE_RE = /remote|anywhere|distributed|home\s*office/i;

/**
 * Resolve the tenant's /widgets endpoint + config, or null when unusable.
 * @param {any} company portals.yml entry (api:/careers_url + optional phenom block)
 */
export function resolveConfig(company) {
  const raw = String(company.api || company.careers_url || '').trim();
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null; // https only (web-ui hardening; parent also allowed http)
  const block = company.phenom && typeof company.phenom === 'object' ? company.phenom : {};
  const urlPrefix = String(block.urlPrefix || 'global/en').replace(/^\/+|\/+$/g, '');
  return {
    origin: u.origin,
    widgetsApi: `${u.origin}/widgets`,
    lang: typeof block.lang === 'string' ? block.lang : 'en_global',
    country: typeof block.country === 'string' ? block.country : 'global',
    urlPrefix,
    selectedFields: block.selectedFields && typeof block.selectedFields === 'object' ? block.selectedFields : {},
  };
}

/**
 * Defence-in-depth guard on the endpoint built by the adapter. Branded Phenom
 * tenants run on their own domains, so this can only enforce HTTPS + a real
 * host (the adapter pins the specific tenant host from the entry's URL).
 * @param {string} url
 */
export function assertPhenomUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`phenom: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`phenom: URL must use HTTPS: ${url}`);
  if (!parsed.hostname) throw new Error(`phenom: URL has no hostname: ${url}`);
  return url;
}

// Slugify a title the way Phenom builds the cosmetic job-page slug: keep
// alphanumerics, collapse every other run to a single hyphen, trim hyphens.
/** @param {string} title */
export function slugify(title) {
  return String(title)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks (ü→u, é→e)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'job';
}

// Phenom postedDate is an ISO-8601 instant ("2026-05-07T18:25:30.000+0000")
// → ISO "YYYY-MM-DD" for the rich job shape ('' when unparseable).
/** @param {unknown} raw @returns {string} */
export function parsePhenomDate(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const ms = Date.parse(raw.trim());
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : '';
}

// The widget returns a flat "City, State, Country" via several fields; prefer
// the explicit `location`, else assemble from city/state/country. Strips
// markup and collapses whitespace.
/** @param {any} job @returns {string} */
export function jobLocation(job) {
  const direct = String(job?.location || job?.cityStateCountry || job?.cityState || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (direct) return direct;
  const parts = [job?.city, job?.state, job?.country].map((p) => String(p || '').trim()).filter(Boolean);
  return [...new Set(parts)].join(', ');
}

/**
 * Map one refineSearch response to { total, jobs } (rich job shape). A record
 * without a jobId or a title is skipped (no stable dedup key / no meaningful
 * listing). Exported for unit tests.
 * @param {any} json
 * @param {{origin:string, urlPrefix:string}} cfg
 * @param {string} [companyName]
 */
export function parseRefineSearch(json, cfg, companyName = '') {
  const rs = json?.refineSearch;
  const total = typeof rs?.totalHits === 'number' ? rs.totalHits : null;
  const list = Array.isArray(rs?.data?.jobs) ? rs.data.jobs : [];
  const jobs = [];
  for (const job of list) {
    if (!job || typeof job !== 'object') continue;
    const id = job.jobId != null ? String(job.jobId) : '';
    const title = String(job.title || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!id || !title) continue;
    const location = jobLocation(job);
    const isRemote = REMOTE_RE.test(title) || REMOTE_RE.test(location);
    jobs.push({
      id: `phenom-${id}`,
      title,
      company: companyName,
      url: `${cfg.origin}/${cfg.urlPrefix}/job/${encodeURIComponent(id)}/${slugify(title)}`,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: parsePhenomDate(job.postedDate || job.dateCreated),
      snippet: '',
      source: 'phenom',
    });
  }
  return { total, jobs };
}

/** Resolve the page cap: positive integer `max_pages`, else default. */
function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES);
  return MAX_PAGES;
}

/**
 * Fetch + normalize a Phenom tenant's postings with the parent's bounded paged
 * walk (from/size offsets until totalHits, dedup across pages). A transient
 * mid-scan failure keeps the jobs collected so far — it never discards
 * earlier pages.
 * @param {string} endpoint tenant /widgets endpoint (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchPhenom(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertPhenomUrl(endpoint);
  const cfg = resolveConfig(company) || resolveConfig({ api: endpoint, phenom: company.phenom });
  if (!cfg) throw new Error(`phenom: cannot resolve origin for ${company.name || endpoint}`);
  const name = (company && typeof company.name === 'string' && company.name.trim()) ? company.name.trim() : 'Phenom';

  const maxPages = resolveMaxPages(company);
  const jobs = [];
  const seen = new Set();
  let total = null;

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await delay(PAGE_DELAY_MS, signal);
    let json;
    try {
      json = await fetchJson(fetchImpl, cfg.widgetsApi, {
        method: 'POST',
        signal,
        redirect: 'error',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          lang: cfg.lang,
          deviceType: 'desktop',
          country: cfg.country,
          pageName: 'search-results',
          ddoKey: 'refineSearch',
          sortBy: '',
          subsearch: '',
          from: page * PAGE_SIZE,
          jobs: true,
          counts: true,
          all_fields: ['category', 'country', 'city'],
          size: PAGE_SIZE,
          clearAll: false,
          jdsource: 'facets',
          isSliderEnable: false,
          pageId: 'page10',
          siteType: 'external',
          keywords: '',
          global: cfg.country === 'global',
          selected_fields: cfg.selectedFields,
          locationData: {},
        }),
      });
    } catch {
      break; // keep jobs collected so far — a transient mid-scan failure shouldn't discard earlier pages
    }
    const { total: pageTotal, jobs: rows } = parseRefineSearch(json, cfg, name);
    if (total === null) total = pageTotal;
    if (rows.length === 0) break;

    let fresh = 0;
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      fresh++;
      jobs.push(row);
      if (jobs.length >= MAX_JOBS) break;
    }
    if (fresh === 0) break; // server ignored `from` (or we've looped)
    if (jobs.length >= MAX_JOBS) break;
    if (total !== null && (page + 1) * PAGE_SIZE >= total) break;
  }
  return jobs;
}
