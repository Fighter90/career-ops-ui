/**
 * Amazon / AWS adapter (registry contract). Parent career-ops parity.
 *
 * The amazon.jobs board is one global endpoint, so a tracked_companies entry
 * narrows it with an `amazon:` config block (loc_query / base_query / category …)
 * whose keys pass straight through as query params. It matches on an explicit
 * `provider: amazon` OR a careers_url/api whose host is amazon.jobs (mirroring the
 * parent's `detect`). The endpoint is host-pinned to www.amazon.jobs; the
 * source-level assertAmazonUrl is the hard SSRF guard.
 *
 *   tracked_companies:
 *     - name: Amazon / AWS
 *       provider: amazon
 *       amazon:
 *         loc_query: Germany
 *         base_query: machine learning
 */
import { fetchAmazon, FEED_BASE, ORIGIN } from '../../sources/amazon.mjs';

// Host match — `amazon.jobs` or any `*.amazon.jobs` subdomain.
function isAmazonHost(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const host = new URL(value).host.toLowerCase();
    return host === 'amazon.jobs' || host.endsWith('.amazon.jobs');
  } catch {
    return false;
  }
}

// Append the entry's `amazon:` config block as query params. Array values are
// amazon.jobs facet filters and MUST use the `key[]=` bracket form (a bare
// `key=DEU` is silently ignored and the board stays global).
function applyAmazonConfig(urlObj, cfg) {
  if (!cfg || typeof cfg !== 'object') return;
  for (const [k, v] of Object.entries(cfg)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      const name = k.endsWith('[]') ? k : `${k}[]`;
      for (const item of v) urlObj.searchParams.append(name, String(item));
    } else {
      urlObj.searchParams.set(k, String(v));
    }
  }
}

export const amazonAdapter = {
  id: 'amazon',
  label: 'Amazon',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'amazon') return true;
    return isAmazonHost(company.api) || isAmazonHost(company.careers_url);
  },
  buildEndpoint(company) {
    const url = new URL(FEED_BASE);
    applyAmazonConfig(url, company && company.amazon);
    // Defence-in-depth: never let a stray config value repoint the host.
    if (`${url.protocol}//${url.host}` !== ORIGIN) return FEED_BASE;
    return url.href;
  },
  fetch: fetchAmazon,
};
