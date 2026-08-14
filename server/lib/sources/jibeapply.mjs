// @ts-check
/**
 * JibeApply source — the /api/jobs JSON endpoint on the tenant's hostname.
 * Auto-detects from a careers_url of the form `https://<slug>.jibeapply.com`;
 * iCIMS acquired Jibe in 2019 and some tenants run the same JSON schema on a
 * branded custom domain — those are wired with an explicit `api:` on the
 * portals.yml entry.
 *
 * Implements the web-ui
 * source contract (rich job objects + `meta`). Pagination is sequential (a
 * single tenant's API has no reason to receive a parallel burst, and a mid-run
 * failure keeps the pages already gathered) with a safety cap —
 * DEFAULT_MAX_PAGES=50, hard cap 500 via `max_pages` on the entry — applied
 * regardless of the upstream-reported totalCount, so a misbehaving API can't
 * drive thousands of requests. `redirect:'error'` (SSRF-safe).
 *
 * Used by the jibeapply adapter (server/lib/portals/adapters/jibeapply.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const meta = {
  value: 'jibeapply',
  label: 'JibeApply (iCIMS)',
  region: 'en',
};

const DEFAULT_MAX_PAGES = 50;
const MAX_PAGES_CAP = 500;
const DEFAULT_PAGE_SIZE = 10; // filter.displayLimit on every observed tenant

function resolveMaxPages(company) {
  const v = company && company.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

/** careers_url on *.jibeapply.com → its /api/… form, or null. */
export function toApiUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  if (!/^[a-z0-9-]+\.jibeapply\.com$/i.test(u.hostname)) return null;
  if (!u.pathname.startsWith('/api/')) {
    u.pathname = '/api' + (u.pathname.startsWith('/') ? u.pathname : '/' + u.pathname);
  }
  return u.href;
}

// An explicit entry.api may live on any HTTPS host (branded iCIMS tenants).
function validateExplicitApi(apiUrl) {
  let u;
  try { u = new URL(apiUrl); } catch { return null; }
  return u.protocol === 'https:' ? u.href : null;
}

/**
 * Map a /api/jobs response into the rich job shape. Exported for unit tests.
 * Job URLs are made absolute against the entry's careers_url (or api) origin.
 */
export function parseJibeapplyResponse(json, company = {}) {
  let origin = '';
  try { origin = new URL(company.careers_url || '').origin; } catch { /* ignore */ }
  if (!origin) {
    try { origin = new URL(company.api || '').origin; } catch { /* ignore */ }
  }
  const items = Array.isArray(json && json.jobs) ? json.jobs : [];
  const jobs = [];
  for (const item of items) {
    if (item == null) continue;
    const d = item.data ?? item;
    const title = String(d.title || '').trim();
    const slug = d.slug || d.req_id;
    if (!title || !slug) continue;
    jobs.push({
      id: `jibeapply-${slug}`,
      title,
      company: String(d.hiring_organization || company.name || '').trim(),
      url: `${origin}/jobs/${encodeURIComponent(slug)}`,
      salary: '',
      location: d.full_location || [d.city, d.country].filter(Boolean).join(', '),
      isRemote: false,
      workplaceType: '',
      relocates: false,
      date: '',
      snippet: '',
      source: 'jibeapply',
    });
  }
  return jobs;
}

/**
 * Fetch + parse a tenant's postings with a sequential paged walk.
 * `endpoint` is the /api/jobs URL from the adapter's buildEndpoint.
 */
export async function fetchJibeapply(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const apiUrl = validateExplicitApi(endpoint);
  if (!apiUrl) throw new Error(`jibeapply: invalid API URL for ${company.name || endpoint}`);

  const first = await fetchJson(fetchImpl, apiUrl, { signal, redirect: 'error' });
  const total = (first && first.totalCount) || 0;
  // Actual returned length beats the reported `count` — some tenants set
  // `count` to the TOTAL rather than the per-page size.
  const pageSize = (first && Array.isArray(first.jobs) && first.jobs.length) || (first && first.count) || DEFAULT_PAGE_SIZE;
  const allJobs = [...((first && first.jobs) || [])];

  if (total > pageSize && pageSize > 0) {
    const maxPages = resolveMaxPages(company);
    const pages = Math.min(Math.ceil(total / pageSize), maxPages);
    for (let page = 2; page <= pages; page++) {
      const u2 = new URL(apiUrl);
      u2.searchParams.set('page', String(page));
      let json;
      try {
        json = await fetchJson(fetchImpl, u2.toString(), { signal, redirect: 'error' });
      } catch (err) {
        console.warn(`jibeapply: ${company.name || 'tenant'} page ${page} fetch failed — ${err.message} (keeping ${allJobs.length} jobs fetched so far)`);
        break;
      }
      allJobs.push(...((json && json.jobs) || []));
    }
    if (Math.ceil(total / pageSize) > maxPages) {
      // The cap is a safety net; surface a real overflow so missing postings
      // don't go unnoticed.
      console.warn(`jibeapply: ${company.name || 'tenant'} exceeds max_pages (fetched ${allJobs.length} of ${total}) — raise max_pages on the portal entry (current: ${maxPages})`);
    }
  }
  return parseJibeapplyResponse({ jobs: allJobs }, company);
}
