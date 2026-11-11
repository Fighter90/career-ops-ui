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
import { markTruncated } from '../board-truncation.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';
import { requireArray, requireContainer } from './_shape.mjs';

export const meta = {
  value: 'jibeapply',
  label: 'JibeApply (iCIMS)',
  region: 'en',
};

const DEFAULT_MAX_PAGES = 50;
const MAX_PAGES_CAP = 500;
const DEFAULT_PAGE_SIZE = 10; // filter.displayLimit on every observed tenant

// CAR-264 (parent #6692) — opt-in per entry: `page_size: N` sends `limit=N` so
// each request returns up to N postings (parent measurement on a real tenant:
// limit=100 returns 100 and `page` then counts in those units). Fewer, larger
// requests reach more of a big board for the same politeness. Default is
// unchanged: no `limit` is sent unless the entry sets it.
const MAX_PAGE_SIZE = 100;

/** Resolve an explicit page size: a positive integer `page_size`, capped; null = not set. */
function resolvePageSize(company) {
  const v = company?.page_size;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGE_SIZE);
  return null;
}

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
 * A 200 whose `jobs` container is missing or not an array THROWS — a broken
 * board must not read as an empty one.
 */
export function parseJibeapplyResponse(json, company = {}) {
  let origin = '';
  try { origin = new URL(company.careers_url || '').origin; } catch { /* ignore */ }
  if (!origin) {
    try { origin = new URL(company.api || '').origin; } catch { /* ignore */ }
  }
  const items = requireArray(json && json.jobs, 'JibeApply jobs');
  const jobs = [];
  for (const item of items) {
    if (item == null) continue;
    const d = item.data ?? item;
    const title = String(d.title || '').trim();
    const slug = d.slug || d.req_id;
    if (!title || !slug) continue;
    // A lone surrogate in slug throws URIError out of encodeURIComponent and
    // aborts this loop, losing every job on the page. Drop just this one.
    const encodedSlug = safeEncodeURIComponent(slug);
    if (encodedSlug === null) continue;
    jobs.push({
      id: `jibeapply-${slug}`,
      title,
      company: String(d.hiring_organization || company.name || '').trim(),
      url: `${origin}/jobs/${encodedSlug}`,
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
  const { fetchImpl = fetch, signal, company = {}, maxPages } = opts;
  const apiUrl = validateExplicitApi(endpoint);
  if (!apiUrl) throw new Error(`jibeapply: invalid API URL for ${company.name || endpoint}`);

  // CAR-264 (parent #6692) — the opt-in page size rides EVERY request: later
  // pages are built from firstUrl, so `page` counts in the same units.
  const requestedSize = resolvePageSize(company);
  let firstUrl = apiUrl;
  if (requestedSize) {
    const u1 = new URL(apiUrl);
    u1.searchParams.set('limit', String(requestedSize));
    firstUrl = u1.toString();
  }

  // Page 1: a 200 without the jobs container is a broken board, not an empty
  // one — throw instead of reading `[]` as a healthy quiet tenant.
  const first = requireContainer(await fetchJson(fetchImpl, firstUrl, { signal, redirect: 'error' }), 'JibeApply', 'jobs');
  const firstJobs = requireArray(first.jobs, 'JibeApply jobs');
  const total = first.totalCount || 0;
  // Actual returned length beats the reported `count` — some tenants set
  // `count` to the TOTAL rather than the per-page size.
  const pageSize = firstJobs.length || first.count || DEFAULT_PAGE_SIZE;
  const allJobs = [...firstJobs];
  // Set when the board is cut short (page cap or a failed page), so a caller
  // can tell a partial board from a complete one without reading stderr.
  // CAR-264 — surfaced in the canonical board-truncation shape.
  let truncated = false;
  let pageFailed = false;

  if (total > pageSize && pageSize > 0) {
    // A health probe (opts.maxPages) caps the walk too.
    const probeMax = Number(maxPages) > 0 ? Number(maxPages) : Infinity;
    const effectiveMaxPages = Math.min(resolveMaxPages(company), probeMax);
    const pages = Math.min(Math.ceil(total / pageSize), effectiveMaxPages);
    for (let page = 2; page <= pages; page++) {
      const u2 = new URL(firstUrl);
      u2.searchParams.set('page', String(page));
      try {
        const json = await fetchJson(fetchImpl, u2.toString(), { signal, redirect: 'error' });
        // Shape-validate INSIDE the try: a later page answering {jobs:{}} used
        // to TypeError on the spread outside the catch and discard the walk.
        allJobs.push(...requireArray(requireContainer(json, 'JibeApply', 'jobs').jobs, 'JibeApply jobs'));
      } catch (err) {
        // A health probe (maxPages set) must see the failure, not first-page jobs as success.
        if (maxPages != null) throw err;
        pageFailed = true;
        console.warn(`jibeapply: ${company.name || 'tenant'} page ${page} fetch failed — ${err.message} (keeping ${allJobs.length} jobs fetched so far)`);
        truncated = true;
        break;
      }
    }
    // The cap is a safety net; surface a real overflow so missing postings
    // don't go unnoticed. Not when a page failed: the scan stopped on the
    // fetch error, already reported above. Not during a probe either — the
    // probe budget is a probe budget, not a truncation.
    if (!pageFailed && probeMax === Infinity && Math.ceil(total / pageSize) > effectiveMaxPages) {
      truncated = true;
      const atCap = effectiveMaxPages >= MAX_PAGES_CAP;
      if (atCap) {
        // Raising max_pages cannot help here: the provider ceiling is the limit.
        const hint = pageSize < MAX_PAGE_SIZE
          ? ` — set page_size (up to ${MAX_PAGE_SIZE}) on this portal entry to read more postings per request`
          : ` — narrow the board with a filter in the entry's api URL (e.g. a location query)`;
        console.warn(
          `jibeapply: ${company.name || 'tenant'} is still cut short at the provider ceiling of ${MAX_PAGES_CAP} pages ` +
          `(fetched ${allJobs.length} of ${total}); max_pages is already at its cap, so raising it changes nothing${hint}`,
        );
      } else {
        console.warn(`jibeapply: ${company.name || 'tenant'} exceeds max_pages (fetched ${allJobs.length} of ${total}) — raise max_pages on the portal entry (current: ${effectiveMaxPages})`);
      }
    }
  }
  const result = parseJibeapplyResponse({ jobs: allJobs }, company);
  if (truncated) {
    markTruncated(result, pageFailed ? 'fetch-error' : 'page-cap', { fetched: allJobs.length, total });
  }
  return result;
}
