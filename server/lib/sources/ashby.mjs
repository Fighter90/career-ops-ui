/**
 * Ashby public posting-api wrapper.
 *   GET https://api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true
 */
import { DESCRIPTION_CAP } from '../html-to-text.mjs';
import { requireContainer, requireArray } from './_shape.mjs';

const UA = 'career-ops-web-ui/1.0';
const API_HOST = 'api.ashbyhq.com';

// v1.69.0 (P-14) — self-describing adapter metadata. The registry
// auto-discovers every `*.mjs` in this folder and collects each
// module's `meta` export, so adding a new source is a pure file
// drop — no edit to registry.mjs required.
export const meta = {
  value: 'ashby',
  label: 'Ashby',
  region: 'en',
};

/**
 * Defence-in-depth endpoint check: HTTPS on exactly api.ashbyhq.com. The
 * adapter builds the URL from a slug, so this only ever rejects a caller that
 * hand-built a bad one — but it must reject it BEFORE any request is made
 * (phase-2: the source, not just the adapter, owns the pin).
 * @param {string} url
 * @returns {string}
 */
export function assertAshbyUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`ashby: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`ashby: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== API_HOST) {
    throw new Error(`ashby: untrusted hostname "${parsed.hostname}" — must be ${API_HOST}`);
  }
  return url;
}

/** The https job/apply URL for a posting, or '' when unusable (never a
 *  javascript:/data:/http: link — the URL is the dedup key). */
function resolveJobUrl(j) {
  const raw = (typeof j.jobUrl === 'string' && j.jobUrl.trim())
    || (typeof j.applyUrl === 'string' && j.applyUrl.trim())
    || '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    return parsed.href;
  } catch {
    return '';
  }
}

export async function fetchAshby(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal } = opts; // REVIEW-B3
  assertAshbyUrl(apiUrl);
  // redirect:'error' — never follow a 3xx off api.ashbyhq.com (SSRF; parent #4080).
  const res = await fetchImpl(apiUrl, { signal, redirect: 'error', headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error(`Ashby: HTTP ${res.status} (${apiUrl})`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  // Phase-2: a 200 without the documented {jobs:[...]} envelope is a shape
  // change (challenge page, API retirement) — throw instead of the old
  // `(data.jobs || [])` that read it as a healthy-but-empty board. Rows whose
  // jobUrl/applyUrl is not a usable https URL are dropped (the URL is the
  // dedup key — a javascript:/data:/relative href is never a job link).
  requireContainer(data, 'Ashby posting-api', 'jobs');
  return requireArray(data.jobs, 'Ashby jobs')
    .map((j) => normalize(j))
    .filter((j) => j.url);
}

// v1.75.0 — build the full location from primary +
// secondaryLocations. Ashby puts extra hiring regions in `secondaryLocations[]`
// (each with a region label and a postalAddress). Using only `j.location` drops
// them, so an EU-eligible role whose PRIMARY label is e.g. "Canada" reads as
// Canada-only and is wrongly removed by the location_filter. Fold in each
// secondary's region label, locality, and country (deduped, joined with " · ")
// so the filter can match e.g. "Europe", "Berlin", "Germany".
function containsWholeWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

function formatLocation(j) {
  const parts = [];
  if (typeof j.location === 'string' && j.location.trim()) parts.push(j.location.trim());
  // Parent parity (v1.239.0): fold the PRIMARY address block too. `location` is
  // often a subdivision ("England") while location_filter matches on the country
  // ("United Kingdom") that only addressCountry carries; the country is skipped
  // when `location` already names it ("London, United Kingdom").
  const primaryPa = j.address && j.address.postalAddress;
  if (primaryPa) {
    for (const k of ['addressLocality', 'addressCountry']) {
      const v = typeof primaryPa[k] === 'string' ? primaryPa[k].trim() : '';
      if (!v) continue;
      if (k === 'addressCountry' && parts.some((p) => containsWholeWord(p, v))) continue;
      parts.push(v);
    }
  }
  if (Array.isArray(j.secondaryLocations)) {
    for (const s of j.secondaryLocations) {
      if (!s || typeof s !== 'object') continue;
      const label = s.location || s.name;
      if (typeof label === 'string' && label.trim()) parts.push(label.trim());
      const pa = s.address && s.address.postalAddress;
      if (pa) {
        for (const k of ['addressLocality', 'addressCountry']) {
          if (typeof pa[k] === 'string' && pa[k].trim()) parts.push(pa[k].trim());
        }
      }
    }
  }
  // Remote work model lives in `workplaceType` ("Remote"|"Hybrid"|"Onsite") and
  // `isRemote`, SEPARATE from `location` — which keeps naming the office/HQ city
  // even for a fully remote role. Folding only the location strings renders a
  // remote posting as e.g. "San Francisco", so a location_filter blocking that
  // city drops a role the candidate could actually take. Append "Remote" so the
  // work model is visible to the scanner's string matching without discarding
  // the city (both `allow: ["Remote"]` and city filters keep working).
  // `workplaceType` wins when present: a board can carry `isRemote: true` with
  // `workplaceType: "Hybrid"` for an office-anchored role, and trusting isRemote
  // alone would mislabel those "Remote"; isRemote is the fallback when
  // workplaceType is absent.
  const wt = typeof j.workplaceType === 'string' ? j.workplaceType.trim().toLowerCase() : '';
  const remote = wt ? wt === 'remote' : j.isRemote === true;
  if (remote && !parts.some((p) => /remote/i.test(p))) parts.push('Remote');
  return [...new Set(parts)].join(' · ');
}

function normalize(j) {
  // workplaceType wins over the isRemote boolean (see formatLocation) so the
  // exported flag matches the location string.
  const wtLower = typeof j.workplaceType === 'string' ? j.workplaceType.trim().toLowerCase() : '';
  const isRemote = wtLower ? wtLower === 'remote' : j.isRemote === true;
  const wt = j.workplaceType || (isRemote ? 'Remote' : 'Onsite');

  // Compensation summary
  let salary = '';
  const tier = j.compensation?.compensationTierSummary;
  if (tier) salary = tier;
  else if (j.compensation?.summaryComponents?.length) {
    salary = j.compensation.summaryComponents
      .map((s) => s.compensationType + ' ' + (s.summary || ''))
      .join(', ');
  }

  return {
    id: `ashby-${j.id}`,
    title: j.title || '',
    company: '',
    url: resolveJobUrl(j),
    salary,
    location: formatLocation(j),
    isRemote,
    workplaceType: wt,
    relocates: false,
    date: j.publishedAt || '',
    snippet: '',
    // Ashby's posting-api list ships `descriptionPlain` for free (same payload,
    // no per-job request), so the content_filter can match on the JD body. It's
    // already plain text (no HTML to strip — running it through htmlToText would
    // eat legitimate `<…>` like "C++ templates <T>"), but it IS uncapped and
    // runs 4× longer than greenhouse's, so apply the SAME DESCRIPTION_CAP the
    // shared pipeline uses — one filter behaves the same across boards, and
    // scan-results stays sane.
    description: (typeof j.descriptionPlain === 'string' ? j.descriptionPlain : '').slice(0, DESCRIPTION_CAP),
    source: 'ashby',
  };
}
