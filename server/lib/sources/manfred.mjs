// @ts-check
/**
 * getManfred source — board-wide public JSON feed of Spanish/EU tech jobs
 *   GET https://www.getmanfred.com/api/v2/public/offers?lang=EN
 *
 * Implements the web-ui source
 * contract (rich job objects + `meta` for auto-discovery). Public, zero-auth,
 * and returned in ONE call: the endpoint has no pagination parameters and
 * answers with the full catalogue.
 *
 * Two things measured against the live feed shape this source:
 *
 *   1. The feed is a CATALOGUE, NOT A LIVE BOARD. The vast majority of entries
 *      carry `status: "CLOSED"`; only a small slice are ACTIVE. Ingesting it
 *      unfiltered would push ~1.6k dead postings into the pipeline on the first
 *      scan, so the status filter is not an optimization here — it is the
 *      difference between a usable source and an unusable one.
 *   2. `lang` is REQUIRED: without it the API answers 400 with
 *      `"lang must be one of the following values: EN, ES"`. It is read from the
 *      portal entry (`opts.company.lang`) and always sent, defaulting to EN.
 *
 * The host is pinned to www.getmanfred.com and the fetch uses `redirect:'error'`
 * (SSRF-safe). The board-wide feed is a SINGLE call — there is no pagination —
 * so the v1.25.0 dead-board contract collapses to its simplest form: the sole
 * request IS "page 1", and because nothing has succeeded before it, a fetch
 * failure propagates (fetchJson throws on a non-2xx) rather than being swallowed
 * into an empty result. That lets portal-health record the failure instead of
 * mistaking a dead board for a board with no openings (parity with the
 * meituan/tencent `succeededOnce` guard — trivially "no success yet" here).
 *
 * Used by the manfred adapter (server/lib/portals/adapters/manfred.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const FEED_BASE = 'https://www.getmanfred.com/api/v2/public/offers';
const TRUSTED_HOST = 'www.getmanfred.com';
const OFFER_BASE = 'https://www.getmanfred.com/ofertas-empleo';
const VALID_LANGS = ['EN', 'ES'];
const DEFAULT_LANG = 'EN';

export const meta = {
  value: 'manfred',
  label: 'getManfred',
  region: 'en',
};

/**
 * Defence-in-depth host check on the endpoint built by the adapter. Throws on
 * failure.
 * @param {string} url
 * @returns {string} the same URL if valid
 */
export function assertManfredUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`manfred: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`manfred: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`manfred: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/**
 * Resolve the feed language: `lang` on the portal entry, uppercased, else EN.
 * The API rejects anything outside EN/ES, so an unknown value falls back rather
 * than being forwarded. Exported for tests.
 * @param {any} [entry]
 */
export function resolveLang(entry) {
  const raw = typeof entry?.lang === 'string' ? entry.lang.trim().toUpperCase() : '';
  return VALID_LANGS.includes(raw) ? raw : DEFAULT_LANG;
}

// The feed reports currency as the SYMBOL, not an ISO code, and the observed
// values include a narrow-no-break-space variant of the euro sign. The
// scanner's salary_filter compares currencies case-insensitively as plain
// strings, so a symbol would never match a user's `currency: EUR` — map to ISO,
// and drop the field entirely rather than guess when the symbol is unknown.
const CURRENCY_BY_SYMBOL = new Map([
  ['€', 'EUR'],
  ['£', 'GBP'],
  ['US$', 'USD'],
  ['$', 'USD'],
  ['MXN$', 'MXN'],
]);

/**
 * Map an observed currency symbol to an ISO code, tolerating Unicode-space
 * variants glued to the symbol in the live feed. Returns '' for an unknown
 * symbol (never guessed). Exported for tests.
 * @param {unknown} raw
 */
export function normalizeCurrency(raw) {
  if (typeof raw !== 'string') return '';
  // \s covers the narrow no-break space (U+202F) and no-break space (U+00A0)
  // seen glued to the symbol in the live feed.
  const cleaned = raw.replace(/\s+/g, '').toUpperCase();
  for (const [symbol, iso] of CURRENCY_BY_SYMBOL) {
    if (cleaned === symbol.toUpperCase()) return iso;
  }
  return /^[A-Z]{3}$/.test(cleaned) ? cleaned : '';
}

/**
 * Build the `{min, max, currency}` shape used to render the display salary.
 * Returns null when the offer carries no usable figure. A one-sided range is
 * mirrored into both bounds. Exported for tests.
 * @param {any} offer
 * @returns {{min: number, max: number, currency: string}|null}
 */
export function parseCompensation(offer) {
  const from = Number(offer?.salaryFrom);
  const to = Number(offer?.salaryTo);
  const min = Number.isFinite(from) && from > 0 ? from : null;
  const max = Number.isFinite(to) && to > 0 ? to : null;
  if (min === null && max === null) return null;
  return {
    min: min ?? /** @type {number} */ (max),
    max: max ?? /** @type {number} */ (min),
    currency: normalizeCurrency(offer?.currency),
  };
}

/**
 * Render a normalized salary object into the web-ui shape's STRING `salary`
 * field ('' when there is no comp data). The web-ui job shape carries salary as
 * a display string (used as `comp` downstream), not a structured object — same
 * convention as the agenticjobs source. Exported for tests.
 * @param {{min?: number, max?: number, currency?: string}|null} salary
 */
export function salaryToString(salary) {
  if (!salary) return '';
  const cur = salary.currency ? ` ${salary.currency}` : '';
  const hasMin = typeof salary.min === 'number';
  const hasMax = typeof salary.max === 'number';
  if (hasMin && hasMax) return `${salary.min}–${salary.max}${cur}`;
  if (hasMin) return `≥ ${salary.min}${cur}`;
  if (hasMax) return `≤ ${salary.max}${cur}`;
  return '';
}

/**
 * Human-readable location string for an offer.
 *
 * `locations` is a plain string array ("Madrid, Spain") and is empty on many
 * entries. For those, `remotePercentage` is the only place signal there is —
 * and remote and hybrid are kept DISTINGUISHABLE rather than collapsed into
 * "Remote", because the emitted string is what location_filter matches on:
 * collapsing them makes a `block: ["Hybrid"]` rule unmatchable.
 *
 * A placeless on-site offer (0%) keeps "", which passes the filter under the
 * scanner's "don't penalize missing data" convention. Exported for tests.
 * @param {any} offer
 * @returns {string}
 */
export function resolveLocation(offer) {
  const listed = Array.isArray(offer?.locations)
    ? offer.locations.filter((l) => typeof l === 'string' && l.trim()).map((l) => l.trim())
    : [];
  if (listed.length > 0) return listed.join(', ');

  const remote = Number(offer?.remotePercentage);
  if (!Number.isFinite(remote)) return '';
  if (remote >= 100) return 'Remote';
  if (remote > 0) return 'Hybrid';
  return '';
}

/**
 * Normalize a single offer into the web-ui rich job shape, or null when it is
 * not ingestible. Exported for tests.
 *
 * Field mapping:
 *   - title:    `position`, trimmed (offers without one are dropped).
 *   - url:      built from `id` and `slug` as `/ofertas-empleo/{id}/{slug}` —
 *               the canonical form published in the site's own
 *               sitemap-offers.xml. An offer missing either part is dropped
 *               rather than linked to a guessed URL, since url is the dedup key.
 *   - company:  `company.name`, falling back to the portal entry name.
 *   - location: see resolveLocation.
 *   - salary:   `salaryFrom`/`salaryTo`/`currency` → display string.
 *
 * NO date: the only timestamp in the payload is `updatedAt`, which is a
 * modification time, not a publication date. Mapping it to `date` would make an
 * edited old posting look freshly published to the recency filters, so the
 * field is left empty (no `postedAt` is emitted).
 *
 * @param {any} offer
 * @param {string} [fallbackCompany]
 */
export function normalizeManfredOffer(offer, fallbackCompany = 'getManfred') {
  if (!offer || typeof offer !== 'object') return null;
  if (offer.status !== 'ACTIVE') return null;

  const title = typeof offer.position === 'string' ? offer.position.trim() : '';
  if (!title) return null;

  const id = Number(offer.id);
  const slug = typeof offer.slug === 'string' ? offer.slug.trim() : '';
  if (!Number.isInteger(id) || id <= 0 || !slug) return null;
  const url = `${OFFER_BASE}/${id}/${encodeURIComponent(slug)}`;

  const company =
    typeof offer.company?.name === 'string' && offer.company.name.trim()
      ? offer.company.name.trim()
      : ((typeof fallbackCompany === 'string' && fallbackCompany.trim()) ? fallbackCompany.trim() : 'getManfred');

  const remote = Number(offer.remotePercentage);
  const isRemote = Number.isFinite(remote) && remote >= 100;
  const workplaceType = !Number.isFinite(remote)
    ? ''
    : remote >= 100 ? 'Remote' : remote > 0 ? 'Hybrid' : 'Onsite';

  return {
    id: `manfred-${url}`,
    title,
    company,
    url,
    salary: salaryToString(parseCompensation(offer)),
    location: resolveLocation(offer),
    isRemote,
    workplaceType,
    relocates: false,
    date: '', // updatedAt is a modification time, not a publication date
    snippet: '',
    source: 'manfred',
  };
}

/**
 * Append the required `lang` query parameter to the (already host-validated)
 * base endpoint, robust to a base that already carries query params.
 * @param {string} base
 * @param {string} lang
 */
function withLang(base, lang) {
  const u = new URL(base);
  u.searchParams.set('lang', lang);
  return u.toString();
}

/**
 * Fetch + normalize the getManfred board-wide feed. A SINGLE request (the
 * endpoint has no pagination), host-pinned, `redirect:'error'`, with CLOSED /
 * non-ACTIVE entries filtered out and the result deduped by url.
 *
 * Dead-board contract: the sole request failing throws (nothing has succeeded),
 * so a dead board reads as a failure to portal-health rather than an empty run.
 *
 * @param {string} feedBase base feed URL (adapter default: FEED_BASE)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchManfred(feedBase = FEED_BASE, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertManfredUrl(feedBase);
  const url = assertManfredUrl(withLang(feedBase, resolveLang(company)));

  const json = await fetchJson(fetchImpl, url, { signal, redirect: 'error' });
  if (!Array.isArray(json)) {
    throw new Error(
      `manfred: unexpected API response — expected a JSON array of offers, got ${json === null ? 'null' : typeof json}`,
    );
  }

  const fallbackCompany = (company && typeof company.name === 'string' && company.name.trim())
    ? company.name.trim()
    : 'getManfred';
  const out = [];
  const seen = new Set();
  for (const offer of json) {
    const normalized = normalizeManfredOffer(offer, fallbackCompany);
    if (normalized && !seen.has(normalized.url)) {
      seen.add(normalized.url);
      out.push(normalized);
    }
  }
  return out;
}
