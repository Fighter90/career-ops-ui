/**
 * Lever adapter (v1.13.0 registry contract).
 *
 * Detects Lever boards from `careers_url` like `jobs.lever.co/<slug>` or the
 * EU tenancy `jobs.eu.lever.co/<slug>` (Lever EU) and
 * the explicit `api:` field. The API host mirrors the board host —
 * api.lever.co for the US tenancy, api.eu.lever.co for the EU one. Delegates
 * the fetch to server/lib/sources/lever.mjs (preserved verbatim).
 *
 * Both fields are validated on the PARSED URL against exact allowlisted
 * hostnames — never `includes('lever.co')`, which `https://clever.com/`
 * satisfies — so an off-host value can never ride into the fetch slot.
 */
import { fetchLever } from '../../sources/lever.mjs';

// The API hosts exactly mirror the board hosts (US + EU tenancy).
const API_HOST_RE   = /^api\.(?:eu\.)?lever\.co$/;
const BOARD_HOST_RE = /^jobs\.(?:eu\.)?lever\.co$/;

// A board token is spliced into the API path, so anything but a plain
// identifier (incl. `.` / `..`, which would normalise the path) is refused.
const SLUG_RE = /^\w[\w.-]*$/;

/** Parse a careers URL; tolerates the scheme-less `jobs.lever.co/<slug>`. */
function parseCareersUrl(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try { return new URL(trimmed); } catch { /* maybe scheme-less */ }
  if (/^[\w.-]+\//.test(trimmed)) {
    try { return new URL(`https://${trimmed}`); } catch { /* fall through */ }
  }
  return null;
}

/** True when `api` is a real Lever API URL (https + allowlisted host). */
function isLeverApi(api) {
  if (typeof api !== 'string' || !api) return false;
  try {
    const u = new URL(api.trim());
    return u.protocol === 'https:' && API_HOST_RE.test(u.hostname.toLowerCase());
  } catch { return false; }
}

/** Board slug for a Lever careers_url, or null (host must be jobs[.eu].lever.co). */
function slugFromCareersUrl(careersUrl) {
  const u = parseCareersUrl(careersUrl);
  if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:')) return null;
  if (u.username || u.password) return null;
  if (!BOARD_HOST_RE.test(u.hostname.toLowerCase())) return null;
  const slug = u.pathname.split('/').filter(Boolean)[0] || '';
  return SLUG_RE.test(slug) ? slug : null;
}

export const leverAdapter = {
  id: 'lever',
  label: 'Lever',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    return isLeverApi(company.api) || slugFromCareersUrl(company.careers_url) !== null;
  },
  buildEndpoint(company) {
    if (!company || typeof company !== 'object') return null;
    if (isLeverApi(company.api)) return company.api;
    const u = parseCareersUrl(company.careers_url);
    if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:')) return null;
    const host = u.hostname.toLowerCase();
    if (!BOARD_HOST_RE.test(host)) return null;
    const slug = u.pathname.split('/').filter(Boolean)[0] || '';
    if (!SLUG_RE.test(slug)) return null;
    // jobs.lever.co → api.lever.co, jobs.eu.lever.co → api.eu.lever.co.
    return `https://${host.replace(/^jobs\./, 'api.')}/v0/postings/${slug}`;
  },
  fetch: fetchLever,
};
