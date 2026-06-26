// @ts-check
/**
 * BambooHR source — hits the public per-tenant careers list API.
 *   GET https://<tenant>.bamboohr.com/careers/list
 *
 * Ported from parent career-ops v1.13.0 `providers/bamboohr.mjs` into the web-ui
 * source contract. Per-tenant subdomains are the variable part, so the SSRF
 * defence is an anchored host regex (same approach as breezy/personio) plus
 * `redirect:'error'` — a server-side redirect can't bounce the fetch off-domain.
 *
 * The list endpoint returns lightweight metadata (title, url, location) at zero
 * token cost; the full JD lives behind a second per-job request the scanner
 * deliberately skips, so `date`/`snippet` are omitted.
 *
 * Used by the bamboohr adapter (server/lib/portals/adapters/bamboohr.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const BAMBOOHR_HOST_RE = /^[a-z0-9][a-z0-9-]*\.bamboohr\.com$/;
const REMOTE_RE = /remote|anywhere|home\s*office/i;

export const meta = {
  value: 'bamboohr',
  label: 'BambooHR',
  region: 'en',
};

/**
 * Defence-in-depth host check on the endpoint built by the adapter. The endpoint
 * is constructed from an already-validated host, so this only ever rejects a
 * caller that hand-built a bad URL.
 * @param {string} url
 */
export function assertBambooHRUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`bamboohr: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`bamboohr: URL must use HTTPS: ${url}`);
  if (!BAMBOOHR_HOST_RE.test(parsed.hostname)) {
    throw new Error(`bamboohr: untrusted hostname "${parsed.hostname}" — must match <tenant>.bamboohr.com`);
  }
  return url;
}

/**
 * Parse a BambooHR `/careers/list` response. Exported for unit tests.
 *
 * BambooHR returns `{ result: [{ id, jobOpeningName,
 *   location: { city?, state? }, isRemote? }] }`. Rows without a non-empty `id`
 * are dropped (id is the URL/dedup key; a blank id collapses distinct postings).
 *
 * @param {any} json
 * @param {string} companyName
 * @param {string} origin  e.g. "https://acme.bamboohr.com"
 */
export function parseBambooHRResponse(json, companyName, origin) {
  const rows = json && Array.isArray(json.result) ? json.result : [];
  return rows
    .filter((j) => j && j.jobOpeningName && String(j.id ?? '').trim().length > 0)
    .map((j) => {
      const loc = j.location || {};
      const remote = j.isRemote ? 'Remote' : '';
      const location = [loc.city, loc.state, remote].filter(Boolean).join(', ');
      const id = String(j.id).trim();
      const isRemote = !!j.isRemote || REMOTE_RE.test(location);
      return {
        id: `bamboohr-${id}`,
        title: String(j.jobOpeningName),
        company: companyName,
        url: `${origin}/careers/${encodeURIComponent(id)}`,
        salary: '',
        location,
        isRemote,
        workplaceType: isRemote ? 'Remote' : 'Onsite',
        relocates: false,
        date: '',
        snippet: '',
        source: 'bamboohr',
      };
    });
}

/**
 * Fetch + normalize a BambooHR tenant's open positions.
 * @param {string} apiUrl `https://<tenant>.bamboohr.com/careers/list` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchBambooHR(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertBambooHRUrl(apiUrl);
  const origin = new URL(apiUrl).origin;
  const json = await fetchJson(fetchImpl, apiUrl, {
    signal,
    headers: { accept: 'application/json' },
  });
  return parseBambooHRResponse(json, company.name || '', origin);
}
