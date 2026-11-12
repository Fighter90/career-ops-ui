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
import { delay, fetchJson, fetchJsonWithRetry, labeledHttpError } from '../http-json.mjs';
import { markTruncated } from '../board-truncation.mjs';

const UA = 'career-ops-web-ui/1.0';
const PAGE_SIZE = 100;
const MAX_PAGES = 30;        // default cap (3000 postings @ 100/page) when the entry sets no max_pages
// Upper bound an entry may opt in to with `max_pages` (10,000 postings at the
// parent's ceiling). Bosch alone listed 5,104 on 2026-11-10 (parent #6799),
// past the default; the bound stays finite so a typo can't walk a board
// forever. A raised max_pages can mean ~100 list requests to one public API
// host, so the walk spaces its pages (SR_INTER_PAGE_DELAY_MS) and retries a
// transient failure (429, 5xx, a dropped connection) a bounded number of
// times. A page that still fails ends the board with that error, never as a
// page-cap truncation.
export const SR_HARD_MAX_PAGES = 100;
const SR_INTER_PAGE_DELAY_MS = 250;
const SR_RETRIES = 3;

/**
 * Page cap for an entry: a positive integer `max_pages` up to
 * SR_HARD_MAX_PAGES, else the default. Exported for unit tests.
 * @param {{max_pages?: unknown}} company
 */
export function resolveMaxPages(company) {
  const v = company?.max_pages;
  return Number.isInteger(v) && /** @type {number} */ (v) > 0
    ? Math.min(/** @type {number} */ (v), SR_HARD_MAX_PAGES)
    : MAX_PAGES;
}

/**
 * The posting's ATS-native identity (parent #6936): the configured company
 * slug and the posting `id` from the payload, never parsed out of a URL.
 * Exported for unit tests. Returns undefined unless both halves are clean
 * nonempty strings (no surrounding whitespace, no control characters), the
 * shape the parent's listing-fingerprint dedup accepts, so an unusable id
 * falls back to URL dedup. web-ui's scanner dedups by URL key for now; the
 * field rides the rows so the provider half of the contract is already here.
 *
 * @param {string | null | undefined} slug
 * @param {unknown} id
 * @returns {{ats_provider: 'smartrecruiters', board_slug: string, posting_id: string} | undefined}
 */
export function smartRecruitersListingIdentity(slug, id) {
  const clean = (v) => typeof v === 'string' && v !== '' && v === v.trim() && !/[\u0000-\u001f\u007f]/u.test(v);
  if (!clean(slug) || !clean(id)) return undefined;
  return { ats_provider: 'smartrecruiters', board_slug: /** @type {string} */ (slug), posting_id: /** @type {string} */ (id) };
}

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
  const { fetchImpl = fetch, signal, sleep = delay } = opts;
  // Strip any caller-supplied ?limit= / ?offset= so we own the cursor.
  const base = apiUrl.replace(/[?&](limit|offset)=[^&]*/g, '').replace(/\?$/, '');
  assertSmartRecruitersUrl(base);
  const sep = base.includes('?') ? '&' : '?';

  // Parent #6799 — the entry may raise the page cap (max_pages, up to
  // SR_HARD_MAX_PAGES); the default stays MAX_PAGES.
  const pageCap = resolveMaxPages(opts.company);

  const all = [];
  let offset = 0;
  let page = 0;
  let totalFound = null;
  // True when a short/empty page or the reported total ended the walk before
  // the cap. The cap ending the walk with postings still unread — or with no
  // sign the board ended when the API reports no total — is a truncation the
  // scanner must not present as a complete read.
  let ended = false;

  // The configured company slug: the tenant path segment the adapter spliced
  // into this endpoint (`/v1/companies/<slug>`). Fallback job links
  // are synthesised from it (not from j.company.name, which is a display
  // label) — see buildPublicUrl / #4770. Empty when the caller hands us a URL
  // without that path shape, which just keeps the legacy display-name fallback.
  const configuredSlug = (new URL(base).pathname.match(/\/v1\/companies\/([^/]+)/) || [])[1] || '';

  while (page < pageCap) {
    // A raised max_pages means many list requests to one public API host:
    // space the pages out (parent #6799). Injectable so tests skip the wait.
    if (page > 0) await sleep(SR_INTER_PAGE_DELAY_MS, signal);
    const url = `${base}${sep}limit=${PAGE_SIZE}&offset=${offset}`;
    let content;
    let envelopeTotal;
    try {
      // Transient failures (429, 5xx, dropped connection) retry a bounded
      // number of times inside the wrapper (parent SR_RETRY_POLICY); a
      // permanent 4xx rethrows immediately. The error carries `.attempts`.
      const raw = await fetchJsonWithRetry(fetchImpl, url, {
        signal,
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        retries: SR_RETRIES,
        sleep,
      }).catch((e) => { throw labeledHttpError(e, 'SmartRecruiters'); });
      // Shape contract (Phase 2): a 200 without the documented
      // { content: [...] } envelope THROWS — it must never read as an
      // empty board (that is how an envelope change ships for months as
      // "0 postings"). Guarded AFTER the retry, exactly like the parent,
      // so a shape change is not mistaken for a transient failure.
      const data = requireObject(raw, 'SmartRecruiters postings');
      content = requireArray(data.content, 'SmartRecruiters postings content');
      if (typeof data.totalFound === 'number' && Number.isSafeInteger(data.totalFound) && data.totalFound >= 0) envelopeTotal = data.totalFound;
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
    //   - hit the page cap (pageCap — the default, or the entry's opt-in raise)
    if (batch.length === 0) { ended = true; break; }
    if (totalFound != null && all.length >= totalFound) { ended = true; break; }
    offset += PAGE_SIZE;
    page += 1;
  }

  // The cap ended the walk with postings still unread, or with no sign the
  // board ended when the API reports no total. Said out loud AND tagged in
  // the canonical `truncated` shape the scanner reads, so a silently short
  // board never reads as a complete one (parent #6799).
  const truncated = !ended && (totalFound === null || pageCap * PAGE_SIZE < totalFound);
  if (truncated) {
    const counts = totalFound === null ? `${all.length} jobs fetched, total unknown` : `${all.length} of ${totalFound} jobs`;
    const advice = pageCap < SR_HARD_MAX_PAGES
      ? `raise max_pages on this entry for more (up to ${SR_HARD_MAX_PAGES})`
      : `max_pages is already at the ${SR_HARD_MAX_PAGES}-page ceiling`;
    console.error(`⚠️  smartrecruiters: ${opts.company?.name || 'board'} truncated at max_pages=${pageCap} (${counts}) — ${advice}`);
  }

  if (truncated) {
    // Canonical shape read by board-truncation.mjs, so the scan logs the
    // board as `partial` instead of complete.
    markTruncated(all, 'page-cap', { fetched: all.length, ...(totalFound === null ? {} : { total: totalFound }) });
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
  // Parent #6936 — the id exactly as the payload typed it is the posting half
  // of the ATS-native identity, next to the configured board slug. A numeric
  // payload id is stringified for the URL and the row id below, but identity
  // ids are never coerced, so it gets none.
  const listingIdentity = smartRecruitersListingIdentity(companySlug, typeof j.id === 'string' ? j.id : undefined);
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
    ...(listingIdentity ? { listingIdentity } : {}),
  };
}
