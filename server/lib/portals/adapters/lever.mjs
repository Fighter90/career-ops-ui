/**
 * Lever adapter (v1.13.0 registry contract).
 *
 * Detects Lever boards from `careers_url` like `jobs.lever.co/<slug>` or the
 * EU tenancy `jobs.eu.lever.co/<slug>` (Lever EU) and
 * the explicit `api:` field. The API host mirrors the board host —
 * api.lever.co for the US tenancy, api.eu.lever.co for the EU one. Delegates
 * the fetch to server/lib/sources/lever.mjs (preserved verbatim).
 */
import { fetchLever } from '../../sources/lever.mjs';

const URL_PATTERN = /jobs\.((?:eu\.)?lever\.co)\/([^/?#]+)/;

export const leverAdapter = {
  id: 'lever',
  label: 'Lever',
  matches(company) {
    if (company.api && company.api.includes('lever.co')) return true;
    return URL_PATTERN.test(company.careers_url || '');
  },
  buildEndpoint(company) {
    if (company.api && company.api.includes('lever.co')) return company.api;
    const m = (company.careers_url || '').match(URL_PATTERN);
    if (!m) return null;
    return `https://api.${m[1]}/v0/postings/${m[2]}`;
  },
  fetch: fetchLever,
};
