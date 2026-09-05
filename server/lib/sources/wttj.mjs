/**
 * Welcome to the Jungle source — queries WTTJ's public Algolia search index
 * (the same one welcometothejungle.com's jobs UI calls).
 *
 * Implements the web-ui source
 * contract. Two-host flow, both HTTPS-only + host-pinned:
 *   1. GET https://www.welcometothejungle.com/api/env → a `window.env = {…}`
 *      payload carrying the public Algolia application id + client search key.
 *      The credentials rotate, so they are fetched fresh every run rather than
 *      hardcoded. The client key is referer-locked to the WTTJ site.
 *   2. POST https://{appId}-dsn.algolia.net/1/indexes/wttj_jobs_production_en/query
 *      once per configured search term, sending the app id / api key / referer.
 *
 * The board is global and enormous, so — like Glints — an explicit `wttj:`
 * config block with search queries is REQUIRED (read from `opts.company`);
 * without one fetchWttj throws rather than scanning an arbitrary slice:
 *
 *   tracked_companies:
 *     - name: Welcome to the Jungle
 *       provider: wttj
 *       wttj:
 *         queries: ["finops", "data platform engineer", "snowflake"]
 *         max_hits: 100        # optional, per query, capped at 200
 *       enabled: true
 *
 * Used by the wttj adapter (server/lib/portals/adapters/wttj.mjs).
 */
import { fetchJson, fetchText } from '../http-json.mjs';

const ENV_HOST = 'www.welcometothejungle.com';
const SITE_ORIGIN = 'https://www.welcometothejungle.com';
const INDEX = 'wttj_jobs_production_en';
const DEFAULT_MAX_HITS = 100;
const MAX_HITS_CAP = 200;
// A server-side `filters` expression shrinks the result SET rather than
// re-ranking it, so a much higher cap is actually exhaustible. Without one, a
// keyword alone cannot narrow a global board — Algolia's relevance ranking, not
// our own title/location filters, decides which hits come back, and everything
// past the cap is invisible no matter how well it matches (our filters run
// afterwards, on what already arrived). Ported from parent career-ops #3757.
const FILTERED_MAX_HITS_CAP = 1000;
const FILTERS_MAX_LEN = 1000;
const ATTRS =
  'name,slug,organization,offices,remote,published_at_timestamp,salary_yearly_minimum,salary_maximum,salary_period,salary_currency';

export const ENV_URL = 'https://www.welcometothejungle.com/api/env';

export const meta = {
  value: 'wttj',
  label: 'Welcome to the Jungle',
  region: 'en',
};

/**
 * Pin a URL to an expected HTTPS host — the SSRF guard shared by the env
 * bootstrap and the derived Algolia endpoint.
 * @param {string} url
 * @param {string} host expected hostname
 * @param {string} label context for the error message
 * @returns {string} the same URL if valid
 */
export function assertHost(url, host, label) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`wttj: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`wttj: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== host.toLowerCase()) {
    throw new Error(`wttj: untrusted ${label} hostname "${parsed.hostname}" — must be ${host}`);
  }
  return url;
}

/**
 * Parse the `window.env = {…}` payload served by /api/env and extract the
 * Algolia application id + client search key. Exported for tests.
 * @param {string} text
 * @returns {{ appId: string, apiKey: string }}
 */
export function parseEnvPayload(text) {
  const start = typeof text === 'string' ? text.indexOf('{') : -1;
  const end = typeof text === 'string' ? text.lastIndexOf('}') : -1;
  if (start === -1 || end <= start) throw new Error('wttj: /api/env payload has no JSON object');
  let env;
  try {
    env = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('wttj: /api/env payload is not valid JSON');
  }
  const appId =
    typeof env.PUBLIC_ALGOLIA_APPLICATION_ID === 'string' ? env.PUBLIC_ALGOLIA_APPLICATION_ID.trim() : '';
  const apiKey =
    typeof env.PUBLIC_ALGOLIA_API_KEY_CLIENT === 'string' ? env.PUBLIC_ALGOLIA_API_KEY_CLIENT.trim() : '';
  // App ids are short alphanumerics; validating keeps the derived Algolia
  // hostname from being attacker-shaped if the env payload ever changes.
  if (!/^[A-Z0-9]{6,16}$/i.test(appId)) throw new Error(`wttj: unexpected Algolia app id "${appId}"`);
  // The key is only ever sent as a request header (never used to build a host),
  // so don't over-constrain its format — WTTJ may rotate to a longer or
  // non-hex (e.g. secured/base64) client key. Length bounds only.
  if (!apiKey || apiKey.length < 16 || apiKey.length > 500) {
    throw new Error('wttj: unexpected Algolia api key shape');
  }
  return { appId, apiKey };
}

/**
 * Format a salary string from a hit's yearly fields: trust salary_maximum only
 * when salary_period is 'yearly',
 * otherwise keep just the annualized minimum. Returns '' when no salary is set.
 * @param {any} h
 * @returns {string}
 */
function formatSalary(h) {
  const min = Number.isFinite(h.salary_yearly_minimum) && h.salary_yearly_minimum > 0 ? h.salary_yearly_minimum : 0;
  const max =
    h.salary_period === 'yearly' && Number.isFinite(h.salary_maximum) && h.salary_maximum > 0
      ? h.salary_maximum
      : 0;
  if (!min && !max) return '';
  const lo = min || max;
  const hi = max || min;
  const currency = typeof h.salary_currency === 'string' ? h.salary_currency.trim().toUpperCase() : '';
  const range = lo === hi ? String(lo) : `${lo}–${hi}`;
  return currency ? `${range} ${currency}` : range;
}

/**
 * Normalize a single Algolia hit into the 12-field web-ui job shape. Returns
 * null when required fields (name, slug, organization.slug) are missing or the
 * slugs are not path-safe (they feed straight into a URL path). Exported for
 * tests.
 * @param {any} h
 * @returns {object|null}
 */
export function normalizeWttjHit(h) {
  if (!h || typeof h !== 'object') return null;
  const title = typeof h.name === 'string' ? h.name.trim() : '';
  const slug = typeof h.slug === 'string' ? h.slug.trim() : '';
  const orgSlug = typeof h.organization?.slug === 'string' ? h.organization.slug.trim() : '';
  if (!title || !slug || !orgSlug) return null;
  if (!/^[a-z0-9_-]+$/i.test(slug) || !/^[a-z0-9_-]+$/i.test(orgSlug)) return null;

  const url = `${SITE_ORIGIN}/en/companies/${orgSlug}/jobs/${slug}`;
  const company =
    typeof h.organization?.name === 'string' && h.organization.name.trim()
      ? h.organization.name.trim()
      : 'Welcome to the Jungle';

  const remote = typeof h.remote === 'string' ? h.remote.toLowerCase() : '';
  const isRemote = remote === 'fulltime';
  const workplaceType = isRemote ? 'Remote' : remote === 'partial' ? 'Hybrid' : 'Onsite';

  const office = Array.isArray(h.offices) && h.offices.length > 0 ? h.offices[0] : null;
  const parts = [];
  if (office && typeof office.city === 'string' && office.city.trim()) parts.push(office.city.trim());
  if (office && typeof office.country === 'string' && office.country.trim()) parts.push(office.country.trim());
  if (isRemote) parts.push('Remote');
  const location = parts.join(', ');

  const ts = h.published_at_timestamp;
  const date = Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString().slice(0, 10) : '';

  return {
    id: `wttj-${orgSlug}-${slug}`,
    title,
    company,
    url,
    salary: formatSalary(h),
    location,
    isRemote,
    workplaceType,
    relocates: false,
    date,
    snippet: '',
    source: 'wttj',
  };
}

/**
 * Resolve the narrowing config from the company entry's `wttj:` block.
 *
 * The board is global and enormous, so it MUST be narrowed — by an Algolia
 * `filters` expression (preferred: it shrinks the result set server-side), by
 * explicit `queries`, or by both. Neither one present is an error rather than a
 * silent scan of an arbitrary slice.
 *
 * Useful faceted attributes on this index: offices.country_code, offices.state,
 * offices.city, contract_type, remote, experience_level_minimum,
 * salary_yearly_minimum, organization.name, and WTTJ's own taxonomy
 * new_profession.sub_category_reference.
 *
 * @param {any} company
 * @returns {{ queries: string[], filters: string, maxHits: number }}
 */
export function resolveWttjConfig(company) {
  const cfg = company?.wttj && typeof company.wttj === 'object' ? company.wttj : {};
  const queries = Array.isArray(cfg.queries)
    ? cfg.queries.filter((q) => typeof q === 'string' && q.trim()).map((q) => q.trim())
    : [];
  const filters = typeof cfg.filters === 'string' && cfg.filters.trim() ? cfg.filters.trim() : '';
  if (filters.length > FILTERS_MAX_LEN) {
    throw new Error(`wttj: \`filters\` is too long (${filters.length} > ${FILTERS_MAX_LEN} chars)`);
  }
  if (queries.length === 0 && !filters) {
    throw new Error(
      'wttj: the WTTJ board is global — narrow it with `wttj: { filters: "…" }` and/or `wttj: { queries: ["…"] }`',
    );
  }
  // A filter already narrows the board server-side, so the empty query ("match
  // everything that passes the filter") is the useful default. With no filter
  // there is nothing narrowing the board, so a query list stays mandatory.
  const effectiveQueries = queries.length > 0 ? queries : [''];
  const cap = filters ? FILTERED_MAX_HITS_CAP : MAX_HITS_CAP;
  const maxHits =
    Number.isInteger(cfg.max_hits) && cfg.max_hits > 0 ? Math.min(cfg.max_hits, cap) : DEFAULT_MAX_HITS;
  return { queries: effectiveQueries, filters, maxHits };
}

/**
 * Fetch + normalize Welcome to the Jungle postings.
 *   1. Bootstrap fresh Algolia credentials from /api/env.
 *   2. Run one Algolia query per configured search term; dedup across queries.
 *
 * @param {string} envUrl env-bootstrap endpoint (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchWttj(envUrl = ENV_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const { queries, filters, maxHits } = resolveWttjConfig(company);

  // 1. Fresh Algolia credentials from the site's public env endpoint.
  assertHost(envUrl, ENV_HOST, 'env');
  const envText = await fetchText(fetchImpl, envUrl, { redirect: 'error', signal });
  const { appId, apiKey } = parseEnvPayload(envText);
  const algoliaHost = `${appId}-dsn.algolia.net`;

  // 2. One Algolia query per configured search term; dedup across queries.
  const byUrl = new Map();
  for (const query of queries) {
    const url = assertHost(`https://${algoliaHost}/1/indexes/${INDEX}/query`, algoliaHost, 'algolia');
    const params = new URLSearchParams({
      query,
      hitsPerPage: String(maxHits),
      attributesToRetrieve: ATTRS,
    });
    if (filters) params.set('filters', filters);
    const json = await fetchJson(fetchImpl, url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'x-algolia-application-id': appId,
        'x-algolia-api-key': apiKey,
        // The client search key is referer-locked to the WTTJ site.
        referer: `${SITE_ORIGIN}/`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ params: params.toString() }),
      signal,
    });
    if (!json || !Array.isArray(json.hits)) {
      throw new Error(
        `wttj: unexpected Algolia response for query "${query}" — expected { hits: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
      );
    }
    for (const h of json.hits) {
      const job = normalizeWttjHit(h);
      if (job && !byUrl.has(job.url)) byUrl.set(job.url, job);
    }
  }
  return [...byUrl.values()];
}
