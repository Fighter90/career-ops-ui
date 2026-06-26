// @ts-check
/**
 * SolidJobs source — hits the public offers API.
 *   GET https://solid.jobs/public-api/offers/<division>
 *
 * Ported from parent career-ops `providers/solidjobs.mjs` into the web-ui source
 * contract. Single fixed origin, so the SSRF defence pins hostname to solid.jobs
 * AND requires the /public-api/offers/ path prefix, plus `redirect:'error'`.
 * Divisions: it, engineering, marketing, sales, hr, logistics, finances, other.
 *
 * Used by the solidjobs adapter (server/lib/portals/adapters/solidjobs.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const SOLIDJOBS_HOST = 'solid.jobs';
const REMOTE_RE = /remote|anywhere|home\s*office/i;

export const meta = {
  value: 'solidjobs',
  label: 'SolidJobs',
  region: 'en',
};

/** True when `raw` is a usable SolidJobs public-api offers URL. */
export function isSolidJobsUrl(raw) {
  if (typeof raw !== 'string' || !raw) return false;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:'
    && parsed.hostname === SOLIDJOBS_HOST
    && parsed.pathname.startsWith('/public-api/offers/');
}

/** Defence-in-depth check on the endpoint built by the adapter. */
export function assertSolidJobsUrl(url) {
  if (!isSolidJobsUrl(url)) {
    throw new Error(`solidjobs: untrusted or malformed offers URL (must be https://solid.jobs/public-api/offers/<division>): ${url}`);
  }
  return url;
}

/**
 * Parse a SolidJobs `/public-api/offers/<division>` response. Exported for tests.
 * Shape: `{ jobs: [{ title, url, company?, locations?: string|string[] }] }`.
 * Throws on an unexpected shape so a silent endpoint change surfaces as an error.
 *
 * @param {any} json
 * @param {string} companyName fallback company name
 */
export function parseSolidJobsResponse(json, companyName) {
  if (!json || !Array.isArray(json.jobs)) {
    throw new Error(`solidjobs: unexpected API response — expected { jobs: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`);
  }
  return json.jobs
    .filter((j) => j && typeof j === 'object' && typeof j.url === 'string' && j.url.trim() !== '')
    .map((j) => {
      const url = j.url.trim();
      const location = Array.isArray(j.locations)
        ? j.locations.join(', ')
        : (typeof j.locations === 'string' ? j.locations : '');
      const isRemote = REMOTE_RE.test(location) || REMOTE_RE.test(j.title || '');
      return {
        id: `solidjobs-${url}`,
        title: j.title || '',
        company: j.company || companyName || '',
        url,
        salary: '',
        location,
        isRemote,
        workplaceType: isRemote ? 'Remote' : 'Onsite',
        relocates: false,
        date: '',
        snippet: '',
        source: 'solidjobs',
      };
    });
}

/**
 * Fetch + normalize a SolidJobs division feed.
 * @param {string} apiUrl `https://solid.jobs/public-api/offers/<division>` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchSolidJobs(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertSolidJobsUrl(apiUrl);
  const json = await fetchJson(fetchImpl, apiUrl, {
    signal,
    headers: { accept: 'application/json' },
  });
  return parseSolidJobsResponse(json, company.name || '');
}
