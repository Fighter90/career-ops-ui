// @ts-check
/**
 * Breezy HR source — hits the public per-tenant board feed.
 *   GET https://<tenant>.breezy.hr/json
 *
 * Ported from parent career-ops v1.13.0 `providers/breezy.mjs` into the web-ui
 * source contract. Per-tenant subdomains vary, so the SSRF defence is an
 * anchored host regex (same approach as bamboohr/personio) plus `redirect:'error'`.
 * Only the public board feed is used; the authenticated REST API is never touched.
 *
 * Used by the breezy adapter (server/lib/portals/adapters/breezy.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const BREEZY_HOST_RE = /^[a-z0-9][a-z0-9-]*\.breezy\.hr$/;

export const meta = {
  value: 'breezy',
  label: 'Breezy HR',
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertBreezyUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`breezy: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`breezy: URL must use HTTPS: ${url}`);
  if (!BREEZY_HOST_RE.test(parsed.hostname)) {
    throw new Error(`breezy: untrusted hostname "${parsed.hostname}" — must match <tenant>.breezy.hr`);
  }
  return url;
}

/**
 * Parse a Breezy `<tenant>.breezy.hr/json` response. Exported for unit tests.
 *
 * Breezy returns a top-level array: `[{ name, url, published_date?,
 *   location: { name?, city?, state?, country?: { name }, is_remote? } }]`. The
 * per-offer `url` is the dedup key — display-only, never server-fetched, so it is
 * not host-locked, only required to be a well-formed https URL (else dropped).
 *
 * @param {any} json
 * @param {string} companyName
 */
export function parseBreezyResponse(json, companyName) {
  const rows = Array.isArray(json) ? json : [];
  const out = [];
  for (const j of rows) {
    if (!j || !j.name) continue;

    let url = '';
    const rawUrl = typeof j.url === 'string' ? j.url : '';
    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol === 'https:') url = parsed.href;
      } catch { /* malformed → drop */ }
    }
    if (!url) continue;

    const loc = j.location || {};
    const remote = loc.is_remote ? 'Remote' : '';
    const assembled = [loc.city, loc.state, loc.country?.name].filter(Boolean).join(', ');
    const base = (typeof loc.name === 'string' && loc.name.trim()) ? loc.name.trim() : assembled;
    const location = remote && !/remote/i.test(base)
      ? [base, remote].filter(Boolean).join(', ')
      : base;
    const isRemote = !!loc.is_remote || /remote/i.test(location);

    const job = {
      id: `breezy-${url}`,
      title: String(j.name),
      company: companyName,
      url,
      salary: '',
      location,
      isRemote,
      workplaceType: isRemote ? 'Remote' : 'Onsite',
      relocates: false,
      date: '',
      snippet: '',
      source: 'breezy',
    };
    const ts = Date.parse(j.published_date);
    if (!Number.isNaN(ts)) job.date = new Date(ts).toISOString();

    out.push(job);
  }
  return out;
}

/**
 * Fetch + normalize a Breezy tenant board.
 * @param {string} apiUrl `https://<tenant>.breezy.hr/json` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchBreezy(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertBreezyUrl(apiUrl);
  const json = await fetchJson(fetchImpl, apiUrl, {
    signal,
    headers: { accept: 'application/json' },
  });
  return parseBreezyResponse(json, company.name || '');
}
