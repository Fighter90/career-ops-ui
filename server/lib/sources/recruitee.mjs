// @ts-check
/**
 * Recruitee source — hits the public per-tenant offers API.
 *   GET https://<slug>.recruitee.com/api/offers/
 *
 * Implements the web-ui source
 * contract. Per-tenant subdomains vary, so the SSRF defence is an anchored host
 * regex plus `redirect:'error'`. The per-offer URL is commonly on the tenant's
 * own custom domain, so it is NOT host-locked (display-only, never server-fetched).
 *
 * Used by the recruitee adapter (server/lib/portals/adapters/recruitee.mjs).
 */
import { fetchJson } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';

export const RECRUITEE_HOST_RE = /^[a-z0-9][a-z0-9-]*\.recruitee\.com$/;

export const meta = {
  value: 'recruitee',
  label: 'Recruitee',
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertRecruiteeUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`recruitee: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`recruitee: URL must use HTTPS: ${url}`);
  if (!RECRUITEE_HOST_RE.test(parsed.hostname)) {
    throw new Error(`recruitee: untrusted hostname "${parsed.hostname}" — must match <slug>.recruitee.com`);
  }
  return url;
}

// Recruitee stamps "(Sample)" on the seeded posting it serves for trial tenants
// that never launched real hiring (parent #4190 — observed byte-identical on two
// unrelated tenants). The platform's own marker, not a heuristic: the bare word
// "sample" without the parenthesised tag is NOT matched.
const RECRUITEE_SAMPLE_TITLE_RE = /\(sample\)/i;

function isRecruiteeSamplePosting(j) {
  const title = typeof j?.title === 'string' ? j.title : '';
  return RECRUITEE_SAMPLE_TITLE_RE.test(title);
}

/**
 * Whole-word, case-insensitive containment with Unicode-aware boundaries
 * (`\b` is ASCII-only and misfires next to "Zürich"/"Örebro"), so city "Paris"
 * is NOT considered present in "Parisian HQ".
 * @param {string} text
 * @param {string} word
 */
function containsWholeWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

/**
 * Location for one offer (parent #4414). The flat `location` field carries only
 * the PRIMARY place; `locations[]` lists every place as `{ name, city, country }`.
 * When it yields 2+ DISTINCT names (city/country appended when not already a
 * whole word of the name), they are joined with " · " — plus "Remote" when the
 * top-level `remote` flag is set and no name already says so. Otherwise falls
 * back to the flat field, else city/country(/Remote).
 * @param {any} j
 */
function assembleLocation(j) {
  const names = Array.isArray(j.locations)
    ? j.locations.map((l) => {
        const name = typeof l?.name === 'string' ? l.name.trim() : '';
        if (!name) return '';
        const parts = [name];
        const city = typeof l?.city === 'string' ? l.city.trim() : '';
        if (city && !containsWholeWord(name, city)) parts.push(city);
        const country = typeof l?.country === 'string' ? l.country.trim() : '';
        if (country && !containsWholeWord(name, country)) parts.push(country);
        return parts.join(', ');
      }).filter(Boolean)
    : [];
  const distinctNames = [...new Set(names)];
  if (distinctNames.length > 1) {
    const hasRemote = distinctNames.some((n) => n.toLowerCase().includes('remote'));
    return j.remote && !hasRemote ? [...distinctNames, 'Remote'].join(' · ') : distinctNames.join(' · ');
  }
  const city = j.city || '';
  const country = j.country || '';
  const remote = j.remote ? 'Remote' : '';
  return j.location || [city, country, remote].filter(Boolean).join(', ');
}

/**
 * Parse a Recruitee `/api/offers/` response. Exported for unit tests.
 * Shape: `{ offers: [{ title, careers_url?, url?, city?, country?, remote?, location?, locations? }] }`.
 * The per-offer url is the dedup key: `careers_url` then `url`, each validated
 * independently (one bad field never shadows a usable other one). Dropped rows:
 * malformed entries (null/primitive), Recruitee's own "(Sample)" demo postings,
 * no usable (trimmed, string) title, no well-formed https URL.
 *
 * @param {any} json
 * @param {string} companyName
 */
export function parseRecruiteeResponse(json, companyName) {
  const offers = json && Array.isArray(json.offers) ? json.offers : [];
  const out = [];
  for (const j of offers) {
    if (!j || typeof j !== 'object') continue;
    if (isRecruiteeSamplePosting(j)) continue;
    const title = typeof j.title === 'string' ? j.title.trim() : '';
    if (!title) continue;

    let url = '';
    for (const candidate of [j.careers_url, j.url]) {
      if (typeof candidate !== 'string' || !candidate) continue;
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol === 'https:') { url = parsed.href; break; }
      } catch { /* malformed → try the next candidate */ }
    }
    if (!url) continue;

    const location = assembleLocation(j);
    const isRemote = !!j.remote || /remote/i.test(location);
    // Recruitee's list payload embeds each offer's full HTML body for free
    // (same request), so it's stripped to plain text here for the
    // content_filter. Empty string when the offer carries no usable body.
    const description = htmlToText(j.description);

    out.push({
      id: `recruitee-${url}`,
      title,
      company: companyName,
      url,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : 'Onsite',
      relocates: false,
      date: '',
      snippet: '',
      description,
      source: 'recruitee',
    });
  }
  return out;
}

/**
 * Fetch + normalize a Recruitee tenant's offers.
 * @param {string} apiUrl `https://<slug>.recruitee.com/api/offers/` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchRecruitee(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertRecruiteeUrl(apiUrl);
  const json = await fetchJson(fetchImpl, apiUrl, {
    signal,
    headers: { accept: 'application/json' },
  });
  return parseRecruiteeResponse(json, company.name || '');
}
