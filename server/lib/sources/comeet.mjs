// @ts-check
/**
 * Comeet (Spark Hire Recruit) source — hits the public, no-auth careers API.
 *   GET https://www.comeet.co/careers-api/2.0/company/<uid>/positions?token=<token>
 *
 * Ported from parent career-ops v1.13.0 `providers/comeet.mjs` into the web-ui
 * source contract. Neither the company-uid nor the per-tenant token is derivable
 * from a branded careers URL, so the full API URL must be supplied via `api:`.
 * The API host is a single fixed origin, so the SSRF defence pins hostname to
 * www.comeet.co AND requires the /careers-api/ path prefix, plus `redirect:'error'`.
 *
 * Used by the comeet adapter (server/lib/portals/adapters/comeet.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const COMEET_API_HOST = 'www.comeet.co';
const REMOTE_RE = /remote|anywhere|home\s*office/i;

export const meta = {
  value: 'comeet',
  label: 'Comeet',
  region: 'en',
};

/** True when `raw` is a usable Comeet careers-api URL. */
export function isComeetApiUrl(raw) {
  if (typeof raw !== 'string' || !raw) return false;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:'
    && parsed.hostname === COMEET_API_HOST
    && parsed.pathname.startsWith('/careers-api/');
}

// Redact the per-tenant ?token= so a thrown validation error never carries the
// secret. Best-effort: regex strip when the value won't parse as a URL.
export function redactToken(url) {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('token')) parsed.searchParams.set('token', 'REDACTED');
    return parsed.href;
  } catch {
    return typeof url === 'string' ? url.replace(/([?&]token=)[^&#]*/gi, '$1REDACTED') : url;
  }
}

/** Defence-in-depth check on the endpoint built by the adapter. */
export function assertComeetUrl(url) {
  if (!isComeetApiUrl(url)) {
    throw new Error(`comeet: untrusted or malformed careers-api URL: ${redactToken(url)}`);
  }
  return url;
}

// NaN-safe Date.parse — `|| undefined` would also coerce a valid epoch 0.
function toIso(value) {
  if (!value) return '';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString();
}

/**
 * Parse a Comeet careers-api positions response. Exported for unit tests.
 *
 * Comeet returns a top-level ARRAY of position objects:
 *   [{ name, location: { name, is_remote }, url_active_page,
 *      url_comeet_hosted_page, time_updated }]
 * Prefer `url_active_page`, fall back to `url_comeet_hosted_page`; both are
 * display-only (never server-fetched) so not host-locked, only required to be a
 * well-formed https URL. url is the dedup key — rows without one are dropped.
 *
 * @param {any} json
 * @param {string} companyName
 */
export function parseComeetResponse(json, companyName) {
  const positions = Array.isArray(json) ? json : [];
  return positions
    .map((row) => {
      const j = (row && typeof row === 'object') ? row : {};
      let url = '';
      const rawUrl = j.url_active_page || j.url_comeet_hosted_page || '';
      if (typeof rawUrl === 'string' && rawUrl) {
        try {
          const parsed = new URL(rawUrl);
          if (parsed.protocol === 'https:') url = parsed.href;
        } catch { /* malformed → leave url '' */ }
      }
      const loc = j.location || {};
      const remote = loc.is_remote ? 'Remote' : '';
      const base = (typeof loc.name === 'string' && loc.name.trim()) ? loc.name.trim() : '';
      const location = remote && !/remote/i.test(base)
        ? [base, remote].filter(Boolean).join(', ')
        : base;
      const isRemote = !!loc.is_remote || REMOTE_RE.test(location);
      return {
        id: `comeet-${url}`,
        title: (typeof j.name === 'string' ? j.name.trim() : ''),
        company: companyName,
        url,
        salary: '',
        location,
        isRemote,
        workplaceType: isRemote ? 'Remote' : 'Onsite',
        relocates: false,
        date: toIso(j.time_updated),
        snippet: '',
        source: 'comeet',
      };
    })
    .filter((job) => job.title && job.url);
}

/**
 * Fetch + normalize a Comeet careers-api positions feed.
 * @param {string} apiUrl full careers-api positions URL (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchComeet(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertComeetUrl(apiUrl);
  const json = await fetchJson(fetchImpl, apiUrl, {
    signal,
    headers: { accept: 'application/json' },
  });
  return parseComeetResponse(json, company.name || '');
}
