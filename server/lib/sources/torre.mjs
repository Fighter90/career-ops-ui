// @ts-check
/**
 * Torre source — the public opportunity search behind torre.ai
 *   POST https://search.torre.co/opportunities/_search
 *
 * Implements the web-ui source contract (rich job objects + `meta` for
 * auto-discovery). Public, zero-auth JSON. Torre is a pan-LatAm talent
 * marketplace (Colombia-born); its board carries LatAm-heavy remote roles that
 * never reach Greenhouse/Lever/Ashby. It is a board-wide aggregator, so it is
 * selected via an explicit `provider: torre` entry — never auto-detected from a
 * careers_url.
 *
 * Per-entry config is read from `opts.company` (all optional):
 *   search      — text handed to Torre's `skill/role` filter (e.g. "engineering
 *                 manager"). STRONGLY recommended; see the firehose note below.
 *   experience  — required companion to `search` (default "1-plus-year"); one of
 *                 EXPERIENCE_LEVELS below.
 *   remote_only — true → only remote postings (default: unset, no remote filter)
 *
 * There is no max_pages: the endpoint returns AT MOST 20 rows per query and
 * cannot be paged (quirk 2). Breadth comes from configuring several entries
 * with different `search` terms, not from deeper paging.
 *
 * ── Two API behaviours this source is built around ──────────────────
 *
 * 1. UNKNOWN FILTER KEYS ARE SILENTLY IGNORED. Posting `{"objective":{"text":
 *    "engineering manager"}}` returns the FULL unfiltered catalogue with a 200
 *    and no error. Only filters observed to actually move `total` are sent:
 *      {"skill/role":{"text": <search>}}   and   {"remote":{"term":true}}
 *    Correctness never depends on the server filtering: the single capped
 *    request (quirk 2) plus the en-scanner's own title_filter/location_filter
 *    do the real gating. The worst case of a filter being ignored is less
 *    relevant results, never an unbounded scan.
 *
 * 2. THE RESULT SET IS CAPPED AT 20 AND CANNOT BE PAGED. `size` above 20
 *    returns an EMPTY array rather than clamping, and every pagination form
 *    (?offset / ?page / ?from and a body `offset`) is silently ignored. This
 *    source therefore issues exactly ONE request per entry. Do not add a paging
 *    loop back: it cannot advance, and its results would be discarded as dups.
 *
 * 3. `skill/role` REQUIRES a companion `experience`. `{"skill/role":{"text":X}}`
 *    alone returns HTTP 500, and an unrecognised experience value is rejected —
 *    so it is a validated enum, not free text. Hence the EXPERIENCE_LEVELS
 *    allowlist and the always-paired emission below.
 *
 * Host-pinned to search.torre.co; fetch uses `redirect:'error'` (SSRF-safe).
 * Used by the torre adapter (server/lib/portals/adapters/torre.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const SEARCH_ENDPOINT = 'https://search.torre.co/opportunities/_search';
const TRUSTED_HOST = 'search.torre.co';
// Postings are displayed on torre.ai; /post/{id} is the canonical permalink.
const POSTING_BASE = 'https://torre.ai/post/';
// Hard ceiling: >20 returns an empty array, and no offset/page form advances.
const PAGE_SIZE = 20;
// Torre ids are short URL-safe tokens (e.g. "NwBp2Axr"). Anchored so an id from
// the payload can never inject a path segment or query into the permalink.
const ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
// Values the API accepts for the required `skill/role.experience` companion,
// confirmed live; anything else is rejected server-side. Every one returns the
// same result set, so the default is arbitrary among them.
const EXPERIENCE_LEVELS = new Set([
  'potential-to-develop',
  '1-plus-year',
  '2-plus-years',
  '3-plus-years',
  '5-plus-years',
]);
const DEFAULT_EXPERIENCE = '1-plus-year';

export const meta = {
  value: 'torre',
  label: 'Torre',
  // NOTE: the source registry's validateMeta only accepts 'en' | 'ru'. Torre is
  // an English-language international (LatAm-heavy) board that rides the EN ATS
  // sweep, exactly like getonbrd/tencent/himalayas — so it registers under 'en'.
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertTorreUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`torre: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`torre: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`torre: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/**
 * Build the search body from the portal entry. Only filters proven to affect
 * `total` are emitted — see the header note. Exported for tests.
 *
 * @param {any} entry
 * @returns {object}
 */
export function buildTorreQuery(entry) {
  /** @type {Record<string, unknown>} */
  const body = {};

  const search = typeof entry?.search === 'string' ? entry.search.trim() : '';
  if (search) {
    // `experience` is mandatory here — omitting it is a hard 500, so it is
    // always emitted alongside `text` rather than being conditional on config.
    const configured = typeof entry?.experience === 'string' ? entry.experience.trim() : '';
    if (configured && !EXPERIENCE_LEVELS.has(configured)) {
      throw new Error(
        `torre: invalid experience "${configured}" — must be one of: ${[...EXPERIENCE_LEVELS].join(', ')}`,
      );
    }
    body['skill/role'] = { text: search, experience: configured || DEFAULT_EXPERIENCE };
  }

  // Only the positive case is expressible: `{"remote":{"term":false}}` is not a
  // verified filter, so a falsy remote_only sends no key at all rather than a
  // filter that might be ignored while looking effective.
  if (entry?.remote_only === true) body.remote = { term: true };

  return body;
}

/**
 * Normalize a single Torre opportunity into the web-ui job shape (the same
 * shape getonbrd/tencent return). Exported for tests. Returns null for rows
 * without a title, without a valid id (the permalink/dedup key), or explicitly
 * closed.
 *
 * Field mapping:
 *   - title:    `objective`, trimmed (items without one are dropped).
 *   - url:      `https://torre.ai/post/{id}` — built from the id rather than
 *               taken from the payload, so there is no attacker-controlled URL.
 *               An id failing ID_RE drops the item. This is the dedup key.
 *   - company:  `organizations[0].name`, falling back to the entry name, then
 *               "Torre". Torre lists solo/anonymous posters with no org.
 *   - location: "Remote" when `remote` is true, else the joined `locations`
 *               array; a remote posting keeps its country list appended.
 *   - date:     `created` (ISO 8601) → normalized ISO string (omitted when
 *               absent/unparseable).
 *
 * @param {any} o
 * @param {string} [fallbackCompany]
 */
export function normalizeTorreOpportunity(o, fallbackCompany) {
  if (!o || typeof o !== 'object') return null;

  const title = typeof o.objective === 'string' ? o.objective.trim() : '';
  if (!title) return null;

  // Drop anything not explicitly open. An absent status is treated as open —
  // the field is present on every observed row, but a missing one must not
  // silently empty the feed if Torre stops sending it.
  if (typeof o.status === 'string' && o.status.trim() && o.status.trim() !== 'open') return null;

  const id = typeof o.id === 'string' ? o.id.trim() : '';
  if (!ID_RE.test(id)) return null;
  const url = `${POSTING_BASE}${id}`;

  let company = '';
  if (Array.isArray(o.organizations)) {
    const named = o.organizations.find(
      (org) => org && typeof org.name === 'string' && org.name.trim(),
    );
    if (named) company = named.name.trim();
  }
  if (!company) {
    company = (typeof fallbackCompany === 'string' && fallbackCompany.trim())
      ? fallbackCompany.trim()
      : 'Torre';
  }

  const countries = Array.isArray(o.locations)
    ? o.locations.filter((l) => typeof l === 'string' && l.trim()).map((l) => l.trim())
    : [];
  const isRemote = o.remote === true;
  let location = countries.join(', ');
  if (isRemote) location = location ? `Remote — ${location}` : 'Remote';

  let date = '';
  if (typeof o.created === 'string' && o.created.trim()) {
    const ms = Date.parse(o.created);
    if (Number.isFinite(ms)) date = new Date(ms).toISOString();
  }

  return {
    id: `torre-${url}`,
    title,
    company,
    url,
    salary: '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : '',
    relocates: false,
    date,
    snippet: '',
    source: 'torre',
  };
}

/**
 * Fetch + normalize the Torre opportunity search. Exactly ONE request: the
 * endpoint caps at 20 rows and ignores every pagination form (quirk 2), so a
 * loop could only refetch the same page. `max_pages` / `ctx.maxPages` need no
 * handling for the same reason.
 *
 * @param {string} endpoint search endpoint (host-pinned to search.torre.co)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchTorre(endpoint = SEARCH_ENDPOINT, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertTorreUrl(endpoint);

  const body = JSON.stringify(buildTorreQuery(company));
  const fallbackCompany = company && typeof company.name === 'string' ? company.name : undefined;

  const url = `${endpoint}?offset=0&size=${PAGE_SIZE}`;
  // redirect:'error' prevents SSRF via server-side redirects.
  const json = await fetchJson(fetchImpl, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal,
    redirect: 'error',
  });

  if (!json || !Array.isArray(json.results)) {
    throw new Error(
      `torre: unexpected API response — expected { results: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
    );
  }

  const out = [];
  const seen = new Set();
  for (const o of json.results) {
    const normalized = normalizeTorreOpportunity(o, fallbackCompany);
    if (!normalized || seen.has(normalized.url)) continue;
    seen.add(normalized.url);
    out.push(normalized);
  }
  return out;
}
