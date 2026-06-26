/**
 * Comeet adapter (registry contract). Parent career-ops v1.13.0 parity.
 *
 * Matches when `api:` (or `careers_url`) is a full Comeet careers-api URL, or on
 * an explicit `provider: comeet`. The HTTP fetch + normalization lives in
 * server/lib/sources/comeet.mjs.
 */
import { fetchComeet, isComeetApiUrl } from '../../sources/comeet.mjs';

function resolveApiUrl(company) {
  if (isComeetApiUrl(company.api)) return company.api;
  if (isComeetApiUrl(company.careers_url)) return company.careers_url;
  return null;
}

export const comeetAdapter = {
  id: 'comeet',
  label: 'Comeet',
  matches(company) {
    if (company.provider === 'comeet') return resolveApiUrl(company) !== null;
    return resolveApiUrl(company) !== null;
  },
  buildEndpoint(company) {
    return resolveApiUrl(company);
  },
  fetch: fetchComeet,
};
