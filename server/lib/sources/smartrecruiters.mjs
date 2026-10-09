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
import { requireArray, requireObject } from './_shape.mjs';
const UA = 'career-ops-web-ui/1.0';
const PAGE_SIZE = 100;
const MAX_PAGES = 30;        // 3000 jobs hard ceiling
const MAX_TOTAL_JOBS = MAX_PAGES * PAGE_SIZE;

// The only host this source may talk to (SSRF guard, same idiom as tencent).
export const SMARTRECRUITERS_API_HOST = 'api.smartrecruiters.com';

/**
 * Defence-in-depth guard on the endpoint built by the adapter: HTTPS only,
 * host pinned exactly to api.smartrecruiters.com. A lookalike
 * (`api.smartrecruiters.com.evil.test`) must not pass.
 * @param {string} url
 */
export function assertSmartRecruitersUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`smartrecruiters: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`smartrecruiters: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== SMARTRECRUITERS_API_HOST) {
    throw new Error(`smartrecruiters: untrusted hostname "${parsed.hostname}" — must be ${SMARTRECRUITERS_API_HOST}`);
  }
  return url;
}

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
  assertSmartRecruitersUrl(base);
  const sep = base.includes('?') ? '&' : '?';

  const all = [];
  let offset = 0;
  let page = 0;
  let totalFound = null;

  // The configured company slug: the tenant path segment the adapter spliced
  // into this endpoint (`/v1/companies/<slug>/postings`). Fallback job links
  // are synthesised from it (not from j.company.name, which is a display
  // label) — see buildPublicUrl / #4770. Empty when the caller hands us a URL
  // without that path shape, which just keeps the legacy display-name fallback.
  const configuredSlug = (new URL(base).pathname.match(/\/v1\/companies\/([^/]+)/) || [])[1] || '';

  while (page < MAX_PAGES) {
    const url = `${base}${sep}limit=${PAGE_SIZE}&offset=${offset}`;
    let content;
    let envelopeTotal;
    try {
      const res = await fetchImpl(url, {
        signal,
        redirect: 'error',
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });
      if (!res.ok) {
        const err = new Error(`SmartRecruiters: HTTP ${res.status} (${url})`);
        err.status = res.status;
        throw err;
      }
      // Shape contract (Phase 2): a 200 without the documented
      // { content: [...] } envelope THROWS — it must never read as an
      // empty board (that is how an envelope change ships for months as
      // "0 postings").
      const data = requireObject(await res.json(), 'SmartRecruiters postings');
      content = requireArray(data.content, 'SmartRecruiters postings content');
      if (typeof data.totalFound === 'number') envelopeTotal = data.totalFound;
    } catch (err) {
      // Dead-board contract (successfactors/rippling idiom): a page-1
      // failure — transport, HTTP, or wrong shape — THROWS so scan /
      // portal-health record a real failure. A later-page failure keeps
      // the partials already collected; a transient page-N blip must not
      // discard them.
      if (page === 0) throw err;
      console.error(`  ⚠ smartrecruiters: truncated at offset ${offset} (${all.length} jobs): ${err.message}`);
      break;
    }
    const batch = content.map((j) => normalize(j, configuredSlug));
    all.push(...batch);
    if (totalFound == null && envelopeTotal != null) totalFound = envelopeTotal;
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
 * cosmetic. If `ref` is missing or untrusted, synthesise the same shape from
 * the configured company slug + posting id. The display name (j.company.name)
 * is only a fallback for callers that do not supply a company slug — it is a
 * label, not the tenant path segment, so slugifying it yields links the public
 * site 404s (#4770). Last resort is the raw applyUrl.
 */
function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function buildPublicUrl(j, companySlug) {
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
    const fallbackSlug = companySlug || slugify(j.company?.name);
    if (fallbackSlug) {
      return `https://jobs.smartrecruiters.com/${fallbackSlug}/${j.id}${slugified ? `-${slugified}` : ''}`;
    }
  }
  return j.applyUrl || '';
}

function normalize(j, companySlug) {
  const locParts = [j.location?.city, j.location?.region, j.location?.country].filter(Boolean);
  const loc = locParts.join(', ');
  const isRemote = !!j.location?.remote || /remote|anywhere/i.test(loc) || /\bremote\b/i.test(j.name || '');
  const hybrid = /hybrid/i.test(loc);
  return {
    id: `sr-${j.id}`,
    title: j.name || '',
    company: j.company?.name || '',
    url: buildPublicUrl(j, companySlug),
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
