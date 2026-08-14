// @ts-check
/**
 * TKMS (thyssenkrupp Marine Systems) source — the careers app at
 * jobs.tkmsgroup.com. Single-employer, but the backend is a shared job-board
 * platform keyed by a `subclient` param, so the source takes the subclient (and
 * locale) from an optional `tkms:` config block for reuse if another tenant on
 * the same platform ever needs it.
 *
 *   POST {origin}/api/filter/query
 *   Content-Type: application/json
 *   {"searchQuery":"","filter":{},"subclient":"tkms","locale":"en","page":0}
 *   → {"jobs":[{"data":{id,title,city,country,postingDate:"2026-07-02T22:00:00",
 *        locations:[{cityState,…}],…}}],"page":0,"nextPage":1,"totalHits":330}
 *
 * `page` is 0-based; `nextPage` is null on the last page. The public job page is
 * {origin}/{locale}/job/{slug}/{id} — the slug is cosmetic (a stub resolves the
 * same posting), so we slugify the title.
 *
 * Implements the web-ui source
 * contract (rich job objects + `meta`). Host-pinned to jobs.tkmsgroup.com via
 * TKMS_HOST_RE, https only (the POST uses `redirect:'error'`, so a plain-HTTP
 * origin would send cleartext and hard-fail on any HTTPS redirect — reject it
 * up front). MAX_PAGES/MAX_JOBS caps preserved.
 *
 * Used by the tkms adapter (server/lib/portals/adapters/tkms.mjs).
 */
import { fetchJson, delay } from '../http-json.mjs';

export const meta = {
  value: 'tkms',
  label: 'TKMS',
  region: 'en',
};

export const TKMS_HOST_RE = /^jobs\.tkmsgroup\.com$/i;
export const TKMS_DEFAULT_ORIGIN = 'https://jobs.tkmsgroup.com';

const MAX_PAGES = 60; // safety cap on request count (60*20 = 1200 postings)
const MAX_JOBS = 1000; // cap total postings pulled
const PAGE_DELAY_MS = 150; // polite pacing between page requests

/**
 * Resolve the query endpoint + subclient/locale config from a company entry.
 * https only. Returns null when the host isn't jobs.tkmsgroup.com.
 * @param {any} company
 */
export function resolveConfig(company) {
  const raw = String((company && (company.api || company.careers_url)) || '').trim();
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.host.toLowerCase();
  if (!TKMS_HOST_RE.test(host)) return null;
  const block = company.tkms && typeof company.tkms === 'object' ? company.tkms : {};
  return {
    origin: u.origin,
    queryApi: `${u.origin}/api/filter/query`,
    subclient: typeof block.subclient === 'string' ? block.subclient : 'tkms',
    locale: typeof block.locale === 'string' ? block.locale : 'en',
  };
}

// Slugify a title for the cosmetic job-page slug. TKMS uses `_`/`-` markers, but
// a stub slug also resolves, so exactness doesn't matter — we produce a clean,
// hyphenated string.
/** @param {string} title */
export function slugify(title) {
  return String(title)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'job';
}

// postingDate is a naive ISO local timestamp ("2026-07-02T22:00:00"); prefer
// the epoch-seconds `postingDate_timestamp` when present. Returns epoch ms.
/** @param {any} data @returns {number | undefined} */
export function parseTkmsDate(data) {
  const ts = data && data.postingDate_timestamp;
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts * 1000;
  const raw = data && data.postingDate;
  if (typeof raw === 'string' && raw.trim()) {
    const ms = Date.parse(raw.trim() + 'Z'); // treat naive stamp as UTC for determinism
    if (Number.isFinite(ms)) return ms;
  }
  return undefined;
}

// Location: prefer the `locations` array (cityState per site), else the flat
// city/country fields. Joined with " / ", deduped.
/** @param {any} data @returns {string} */
export function tkmsLocation(data) {
  const locs = Array.isArray(data && data.locations) ? data.locations : [];
  const out = [];
  for (const l of locs) {
    const s = String((l && (l.cityState || l.city)) || '').trim();
    if (s && !out.includes(s)) out.push(s);
  }
  if (out.length) return out.join(' / ');
  const flat = [data && data.city, data && data.country].map((p) => String(p || '').trim()).filter(Boolean);
  return [...new Set(flat)].join(', ');
}

// epoch ms → ISO date ('' when absent/invalid).
function toIsoDate(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/**
 * Map one query response to { total, nextPage, rows } (rich job shape). A record
 * without an id or title is skipped. Exported for unit tests.
 * @param {any} json @param {{ origin: string, locale: string, company?: string }} cfg
 */
export function parseQuery(json, cfg) {
  const total = typeof (json && json.totalHits) === 'number' ? json.totalHits : null;
  const nextPage = typeof (json && json.nextPage) === 'number' ? json.nextPage : null;
  const list = Array.isArray(json && json.jobs) ? json.jobs : [];
  const company = (cfg && typeof cfg.company === 'string' && cfg.company.trim()) ? cfg.company.trim() : 'TKMS';
  const rows = [];
  for (const item of list) {
    const d = item && item.data;
    if (!d) continue;
    const id = d.id != null ? String(d.id) : '';
    const title = String(d.title || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!id || !title) continue;
    rows.push({
      id: `tkms-${id}`,
      title,
      company,
      url: `${cfg.origin}/${encodeURIComponent(cfg.locale)}/job/${slugify(title)}/${encodeURIComponent(id)}`,
      salary: '',
      location: tkmsLocation(d),
      isRemote: false,
      workplaceType: '',
      relocates: false,
      date: toIsoDate(parseTkmsDate(d)),
      snippet: '',
      source: 'tkms',
    });
  }
  return { total, nextPage, rows };
}

/** Resolve the page cap: positive integer `max_pages`, else the default. */
function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES);
  return MAX_PAGES;
}

/**
 * Fetch + normalize the TKMS filter/query feed (paginated via `page` until
 * nextPage===null). POST body (subclient/locale/page) is driven by opts.company.
 * @param {string} endpoint the query API URL (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchTkms(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const cfg = resolveConfig({ ...company, api: company.api || endpoint, careers_url: company.careers_url || endpoint });
  if (!cfg) throw new Error(`tkms: cannot resolve jobs host for ${company.name || endpoint}`);
  const name = (company && typeof company.name === 'string' && company.name.trim()) ? company.name.trim() : 'TKMS';
  const maxPages = resolveMaxPages(company);
  const jobs = [];
  const seen = new Set();

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await delay(PAGE_DELAY_MS, signal);
    const json = await fetchJson(fetchImpl, cfg.queryApi, {
      method: 'POST',
      signal,
      redirect: 'error',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ searchQuery: '', filter: {}, subclient: cfg.subclient, locale: cfg.locale, page }),
    });
    const { nextPage, rows } = parseQuery(json, { origin: cfg.origin, locale: cfg.locale, company: name });
    if (rows.length === 0) break;

    let fresh = 0;
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      fresh++;
      jobs.push(row);
      if (jobs.length >= MAX_JOBS) break;
    }
    if (fresh === 0) break; // server looped / ignored page
    if (jobs.length >= MAX_JOBS) break;
    if (nextPage === null) break; // last page
  }
  return jobs;
}
