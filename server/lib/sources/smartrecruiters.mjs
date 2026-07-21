/**
 * SmartRecruiters public postings API wrapper.
 *   GET https://api.smartrecruiters.com/v1/companies/<slug>/postings?limit=100&offset=N
 *
 * Returns { content: [...], totalFound, offset, limit }. v1.16.0 follows
 * the totalFound / offset pagination cursor across pages so large
 * boards (Procter & Gamble, Amazon-style with 1000+ open roles)
 * surface all postings, not just the first 100. Safety cap is 30
 * pages (3000 jobs) — the in-process scanner timeline would lose
 * value past that and the title_filter culls hard anyway.
 */
const UA = 'career-ops-web-ui/1.0';
const PAGE_SIZE = 100;
const MAX_PAGES = 30;        // 3000 jobs hard ceiling
const MAX_TOTAL_JOBS = MAX_PAGES * PAGE_SIZE;

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs for the rationale.
export const meta = {
  value: 'smartrecruiters',
  label: 'SmartRecruiters',
  region: 'en',
};

export async function fetchSmartRecruiters(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  // Strip any caller-supplied ?limit= / ?offset= so we own the cursor.
  const base = apiUrl.replace(/[?&](limit|offset)=[^&]*/g, '').replace(/\?$/, '');
  const sep = base.includes('?') ? '&' : '?';

  const all = [];
  let offset = 0;
  let page = 0;
  let totalFound = null;

  while (page < MAX_PAGES) {
    const url = `${base}${sep}limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetchImpl(url, {
      signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) {
      const err = new Error(`SmartRecruiters: HTTP ${res.status} (${url})`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    const batch = (data.content || []).map((j) => normalize(j));
    all.push(...batch);
    if (totalFound == null && typeof data.totalFound === 'number') totalFound = data.totalFound;
    // Stop conditions:
    //   - empty page (no more results)
    //   - reached totalFound (full set fetched)
    //   - hit hard safety cap
    if (batch.length === 0) break;
    if (totalFound != null && all.length >= totalFound) break;
    if (all.length >= MAX_TOTAL_JOBS) break;
    offset += PAGE_SIZE;
    page += 1;
  }
  return all;
}

/**
 * Build the public posting URL.
 *
 * `j.ref` is an `api.smartrecruiters.com/v1/companies/<slug>/postings/<id>` URL —
 * rewrite it to the public `jobs.smartrecruiters.com/<slug>/<id>-<title-slug>`.
 * The public site has no `/postings/` segment; carrying it over yields a 404,
 * which the liveness checker then reports as an expired posting (#2047).
 * SmartRecruiters resolves the page by id alone, so the trailing title slug is
 * cosmetic. If `ref` is missing or untrusted, synthesise the same shape from the
 * company slug + posting id; only then fall back to the raw applyUrl.
 */
function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function buildPublicUrl(j) {
  const slugified = slugify(j.name);
  if (typeof j.ref === 'string') {
    let parsedRef;
    try { parsedRef = new URL(j.ref); } catch { parsedRef = null; }
    if (parsedRef
        && parsedRef.protocol === 'https:'
        && parsedRef.hostname === 'api.smartrecruiters.com'
        && parsedRef.pathname.startsWith('/v1/companies/')) {
      // /v1/companies/<slug>/postings/<id> → <slug>, <id>
      const [refSlug, postings, refId] = parsedRef.pathname
        .slice('/v1/companies/'.length)
        .split('/')
        .filter(Boolean);
      if (refSlug && postings === 'postings' && refId) {
        return `https://jobs.smartrecruiters.com/${refSlug}/${refId}${slugified ? `-${slugified}` : ''}`;
      }
    }
  }
  if (j.id) {
    const companySlug = slugify(j.company?.name);
    if (companySlug) {
      return `https://jobs.smartrecruiters.com/${companySlug}/${j.id}${slugified ? `-${slugified}` : ''}`;
    }
  }
  return j.applyUrl || '';
}

function normalize(j) {
  const locParts = [j.location?.city, j.location?.region, j.location?.country].filter(Boolean);
  const loc = locParts.join(', ');
  const isRemote = !!j.location?.remote || /remote|anywhere/i.test(loc) || /\bremote\b/i.test(j.name || '');
  const hybrid = /hybrid/i.test(loc);
  return {
    id: `sr-${j.id}`,
    title: j.name || '',
    company: j.company?.name || '',
    url: buildPublicUrl(j),
    salary: '',
    location: loc,
    isRemote,
    workplaceType: isRemote ? 'Remote' : (hybrid ? 'Hybrid' : 'Onsite'),
    relocates: /\b(visa|relocation|sponsorship)\b/i.test((j.name || '') + ' ' + (j.industry?.label || '')),
    date: j.releasedDate || j.createdOn || '',
    snippet: '',
    source: 'smartrecruiters',
  };
}
