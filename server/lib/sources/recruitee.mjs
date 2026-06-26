// @ts-check
/**
 * Recruitee source — hits the public per-tenant offers API.
 *   GET https://<slug>.recruitee.com/api/offers/
 *
 * Ported from parent career-ops `providers/recruitee.mjs` into the web-ui source
 * contract. Per-tenant subdomains vary, so the SSRF defence is an anchored host
 * regex plus `redirect:'error'`. The per-offer URL is commonly on the tenant's
 * own custom domain, so it is NOT host-locked (display-only, never server-fetched).
 *
 * Used by the recruitee adapter (server/lib/portals/adapters/recruitee.mjs).
 */
import { fetchJson } from '../http-json.mjs';

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

/**
 * Parse a Recruitee `/api/offers/` response. Exported for unit tests.
 * Shape: `{ offers: [{ title, careers_url?, url?, city?, country?, remote?, location? }] }`.
 * The per-offer url (careers_url|url) is the dedup key; rows without a well-formed
 * https URL are dropped.
 *
 * @param {any} json
 * @param {string} companyName
 */
export function parseRecruiteeResponse(json, companyName) {
  const offers = json && Array.isArray(json.offers) ? json.offers : [];
  return offers
    .map((j) => {
      const city = j.city || '';
      const country = j.country || '';
      const remote = j.remote ? 'Remote' : '';
      const location = j.location || [city, country, remote].filter(Boolean).join(', ');

      let url = '';
      const rawUrl = j.careers_url || j.url || '';
      if (typeof rawUrl === 'string' && rawUrl) {
        try {
          const parsed = new URL(rawUrl);
          if (parsed.protocol === 'https:') url = parsed.href;
        } catch { /* malformed → drop */ }
      }
      const isRemote = !!j.remote || /remote/i.test(location);

      return {
        id: `recruitee-${url}`,
        title: j.title || '',
        company: companyName,
        url,
        salary: '',
        location,
        isRemote,
        workplaceType: isRemote ? 'Remote' : 'Onsite',
        relocates: false,
        date: '',
        snippet: '',
        source: 'recruitee',
      };
    })
    .filter((job) => job.title && job.url);
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
