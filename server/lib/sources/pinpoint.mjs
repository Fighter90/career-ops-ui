// @ts-check
/**
 * Pinpoint source — per-tenant public postings feed.
 *   GET https://<slug>.pinpointhq.com/postings.json
 *
 * Pinpoint exposes a zero-auth JSON feed per tenant. The response shape is:
 *   { data: [{ title, url, path, location: { name, city, province, ... }, ... }] }
 *
 * SSRF defence: host is pinned to `<slug>.pinpointhq.com` via PINPOINT_HOST_RE
 * plus `redirect:'error'` (no server-side redirect chains). The per-job `url`
 * is display-only and never server-fetched by the scanner.
 *
 * Used by the pinpoint adapter (server/lib/portals/adapters/pinpoint.mjs).
 */
import { fetchJson } from '../http-json.mjs';
import { requireObject, requireArray } from './_shape.mjs';

/** @type {string} */
const UA = 'career-ops-ui/1 (job-scanner; +https://github.com/Fighter90/career-ops)';

export const PINPOINT_HOST_RE = /^[a-z0-9][a-z0-9-]*\.pinpointhq\.com$/i;

export const meta = {
  value: 'pinpoint',
  label: 'Pinpoint',
  region: 'en',
};

/**
 * Defence-in-depth host check on the endpoint built by the adapter.
 * @param {string} url
 */
export function assertPinpointUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`pinpoint: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`pinpoint: URL must use HTTPS: ${url}`);
  if (!PINPOINT_HOST_RE.test(parsed.hostname)) {
    throw new Error(`pinpoint: untrusted hostname "${parsed.hostname}" — must match <slug>.pinpointhq.com`);
  }
  return url;
}

function toIsoDate(value) {
  if (!value) return '';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString().slice(0, 10);
}

function tenantSlug(hostname) {
  // "acme.pinpointhq.com" → "Acme"
  const slug = hostname.replace(/\.pinpointhq\.com$/i, '').replace(/^.*\./, '');
  return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : '';
}

// Certain abandoned trial Pinpoint tenants answer 200 with canned demo postings
// ("Head of DEI - UK"/"- Belfast") instead of 404ing (parent #4190). Every one
// embeds the same malformed, doubled YouTube URL for Pinpoint's onboarding video
// — byte-identical across tenants and not something a real employer's
// description reproduces — so that artifact (not the title) is the signal.
const PINPOINT_DEMO_VIDEO_MARKER = 'youtube.com/embed/https://www.youtube.com/embed/pFxm6fszrpw';

function isPinpointDemoPosting(j) {
  const description = typeof j?.description === 'string' ? j.description : '';
  return description.includes(PINPOINT_DEMO_VIDEO_MARKER);
}

/**
 * Parse a Pinpoint /postings.json response. Exported for unit tests.
 *
 * Pinpoint returns:
 *   { data: [{ title, url, path, location: { name, city, province, ... }, ... }] }
 *
 * Rows missing a usable title or a valid `https:` URL are dropped, as are rows
 * carrying Pinpoint's seeded demo-video fingerprint (isPinpointDemoPosting), so a
 * demo-only tenant resolves as empty rather than as a live board.
 *
 * @param {any} json
 * @param {string} companyName  fallback; derived from tenant slug if empty
 * @param {string} [host]       tenant hostname e.g. "acme.pinpointhq.com"
 */
export function parsePinpointResponse(json, companyName, host = '') {
  // Phase-2: a 200 that stopped speaking { data: [...] } is a drifted envelope
  // or a challenge, not an empty board — THROW (the feed is a single request,
  // so this is always "page 1").
  const postings = requireArray(requireObject(json, 'Pinpoint postings').data, 'Pinpoint postings');
  const company = companyName || tenantSlug(host) || 'Pinpoint';
  const REMOTE_RE = /remote|anywhere|distributed|home\s*office/i;
  return postings
    .map((j) => {
      if (isPinpointDemoPosting(j)) return null;

      const title = typeof j?.title === 'string' ? j.title.trim() : '';
      if (!title) return null;

      // url: require a well-formed https: URL (display-only).
      let url = '';
      const rawUrl = typeof j?.url === 'string' ? j.url.trim() : '';
      if (rawUrl) {
        try {
          const parsed = new URL(rawUrl);
          if (parsed.protocol === 'https:') url = parsed.href;
        } catch {
          // malformed → dropped below
        }
      }
      if (!url) return null;

      // location: prefer the display name, else assemble from city/province.
      const loc = j?.location && typeof j.location === 'object' ? j.location : {};
      const name = typeof loc.name === 'string' ? loc.name.trim() : '';
      const city = typeof loc.city === 'string' ? loc.city.trim() : '';
      const province = typeof loc.province === 'string' ? loc.province.trim() : '';
      const location = name || [city, province].filter(Boolean).join(', ');

      const isRemote = REMOTE_RE.test(location) || REMOTE_RE.test(title);
      const rawDate = j?.created_at || j?.published_at || j?.publishedAt || '';

      return {
        id: `pinpoint-${j?.id ?? url}`,
        title,
        company,
        url,
        salary: '',
        location,
        isRemote,
        workplaceType: isRemote ? 'Remote' : 'Onsite',
        relocates: false,
        date: toIsoDate(rawDate),
        snippet: '',
        source: 'pinpoint',
      };
    })
    .filter(Boolean);
}

/**
 * Fetch + normalize a Pinpoint tenant's open positions.
 * @param {string} endpoint `https://<slug>.pinpointhq.com/postings.json` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchPinpoint(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertPinpointUrl(endpoint);
  const host = new URL(endpoint).hostname;
  const json = await fetchJson(fetchImpl, endpoint, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  return parsePinpointResponse(json, company.name || '', host);
}
