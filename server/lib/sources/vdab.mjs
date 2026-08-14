/**
 * VDAB (Flanders' public employment service) source — hits the public
 * `vindeenjob` search API directly (the same endpoint vdab.be's own frontend
 * uses). One or more `vdab.keywords` are queried; the en-scanner applies
 * title_filter + location_filter + dedup afterwards, so this source
 * over-fetches (recall-first) — same philosophy as arbeitsagentur.mjs.
 *
 * Implements the web-ui source
 * contract (no code lifted). Config comes from the company entry's `vdab:`
 * block, read via `opts.company`:
 *
 *   tracked_companies:
 *     - name: VDAB — AI/ML Vlaanderen
 *       provider: vdab
 *       vdab:
 *         keywords: ["Machine Learning Engineer", "Data Scientist"]  # required
 *         days: 30            # recency window in days (onlineSindsCode, default 30)
 *         size: 100           # results per keyword page (1–100, default 100)
 *         fetchDetails: false # optional: fetch detail JSON for descriptions
 *         detailLimit: 25     # optional max detail calls when fetchDetails=true
 *       enabled: true
 *
 * VDAB's search API has no working location/geo field, so every keyword search
 * is nationwide; precision on location is left to the scanner's location_filter,
 * consistent with the recall-first design.
 *
 * Used by the vdab adapter (server/lib/portals/adapters/vdab.mjs).
 */
import { fetchJson, fetchText } from '../http-json.mjs';

// Host-pinned endpoints (SSRF guard: every request is asserted against
// TRUSTED_HOST over HTTPS before it goes out — see assertVdabUrl).
const TRUSTED_HOST = 'www.vdab.be';
export const API_URL = 'https://www.vdab.be/rest/vindeenjob/v4/vacatureLight/zoek';
const DETAIL_API = 'https://www.vdab.be/rest/vindeenjob/v4/vacatures/';
// Plural + no slug is the canonical detail URL form and resolves without a
// redirect (verified live upstream).
const DETAIL_BASE = 'https://www.vdab.be/vindeenjob/vacatures/';
const BUNDLE_PAGE = 'https://www.vdab.be/vindeenjob/vacatures';

// Public, build-time constant baked into VDAB's own frontend JS bundle (an
// Angular HTTP interceptor stamps it on every request) — not a per-visitor
// session token. Same trust tier as arbeitsagentur.mjs's public API_KEY.
const VEJ_KEY_MONITOR = 'b277002f-e1fa-4fc5-868a-fdab633c3851';

// Self-heal if VDAB rotates VEJ_KEY_MONITOR on a frontend redeploy: read the
// current key straight off VDAB's own live bundle instead of needing a code
// patch. Only invoked on a 403 — the fast path never pays this round trip.
const KEY_RE = /vej-key-monitor","([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i;
const BUNDLE_RE = /https:\/\/www\.vdab\.be\/webapps\/vindeenjob\/main-[\w-]+\.js/;

// Batch detail calls so a large detailLimit can't fire dozens of concurrent
// requests at once (mirrors arbeitsagentur.mjs's VERIFY_BATCH).
const DETAIL_BATCH = 5;
// Real-scan safety cap: fetchKeyword() otherwise only stops on a short page.
// At the max page size (100) this is ~5,000 postings per keyword — far beyond
// any real keyword's volume — so it only guards against a runaway loop.
const MAX_PAGES_PER_KEYWORD = 50;

// Remote detection for job-shape parity with arbeitsagentur (EN + Dutch terms).
const REMOTE_RE = /(remote|thuiswerk|telewerk|op afstand|home[-\s]?office|full[-\s]?remote|fully remote|100\s*%)/i;

export const meta = {
  value: 'vdab',
  label: 'VDAB',
  region: 'en',
};

/** Clamp a runtime integer into [min, max], falling back to `def` for NaN. */
function intInRange(val, def, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** ISO datetime → YYYY-MM-DD (empty string when unparseable). */
function toIsoDate(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10);
}

/**
 * Assert that `url` points to VDAB (www.vdab.be) over HTTPS. Throws on failure.
 * Closes the SSRF vector for the endpoint override + self-heal bundle fetches.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertVdabUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`vdab: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`vdab: URL must use HTTPS: ${url}`);
  }
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`vdab: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/**
 * Read + sanitize the entry's `vdab:` config block.
 * @param {{ vdab?: any }} entry
 */
export function parseVdabConfig(entry) {
  const cfg = (entry && entry.vdab) || {};
  const keywords = [...new Set(
    (Array.isArray(cfg.keywords) ? cfg.keywords : [])
      .filter((k) => typeof k === 'string' && k.trim())
      .map((k) => k.trim()),
  )];
  return {
    keywords,
    days: intInRange(cfg.days, 30, 1, 1000),   // recency window (onlineSindsCode)
    size: intInRange(cfg.size, 100, 1, 100),    // results per page
    fetchDetails: cfg.fetchDetails === true,
    detailLimit: intInRange(cfg.detailLimit, 25, 1, 100),
  };
}

/**
 * Extract the best plain-text description from VDAB's detail JSON.
 * @param {any} detail
 * @returns {string}
 */
export function extractDescription(detail) {
  const omschrijving = detail && detail.functie && detail.functie.omschrijving;
  return String(
    (omschrijving && (omschrijving.markdown || omschrijving.plainText)) || '',
  ).trim();
}

/**
 * Build the VDAB vacatureLight search request body for one keyword/page.
 * The facet-code arrays are kept empty (over-fetch, recall-first); the shape
 * is captured verbatim from VDAB's own frontend network trace.
 * @param {string} trefwoord
 * @param {{ days: number, size: number, pagina: number }} opts
 */
export function buildSearchBody(trefwoord, { days, size, pagina }) {
  return {
    criteria: {
      trefwoord,
      diplomaCodes: [],
      arbeidsduurCodes: [],
      arbeidsregimeCodes: [],
      contractTypeCodes: [],
      jobdomeinCodes: [],
      internationaalCodes: [],
      beroepCodes: [],
      ervaringCodes: [],
      rijbewijsCodes: [],
      attestCodes: [],
      taalCriteria: { taalSelecties: [] },
      onlineSindsCode: String(days),
      sorteerVeld: 'STANDAARD',
    },
    pagina,
    zoekmodus: 'C2',
    paginaGrootte: size,
  };
}

/**
 * Normalize one raw VDAB `resultaten[]` record into the rich Job shape (matching
 * arbeitsagentur.mjs's output) plus its numeric `vdabId` (kept for dedup,
 * stripped before the source returns). Returns null when the posting lacks a
 * usable id or title.
 * @param {any} job
 */
export function normalizeJob(job) {
  const rawId = job && job.id && job.id.id;
  const title = String((job && job.vacaturefunctie && job.vacaturefunctie.naam) || '').trim();
  if (!rawId || !title) return null;
  const location = String((job && job.tewerkstellingsLocatieRegioOfAdres) || '').trim();
  const isRemote = REMOTE_RE.test(title) || REMOTE_RE.test(location);
  return {
    id: `vdab-${encodeURIComponent(String(rawId))}`,
    title,
    company: String((job && job.vacatureBedrijfsnaam) || '').trim(),
    url: DETAIL_BASE + encodeURIComponent(String(rawId)),
    salary: '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : 'Onsite',
    relocates: false,
    date: toIsoDate(job && job.eerstePublicatieDatum),
    snippet: '',
    source: 'vdab',
    vdabId: String(rawId),
  };
}

/**
 * Read VDAB's current vej-key-monitor straight off its live frontend bundle.
 * Only invoked on a 403 (rotated key). Both fetches are host-guarded + no-follow.
 * @param {typeof fetch} fetchImpl
 * @param {AbortSignal} [signal]
 * @returns {Promise<string|null>}
 */
async function deriveKeyFromBundle(fetchImpl, signal) {
  const html = await fetchText(fetchImpl, assertVdabUrl(BUNDLE_PAGE), { redirect: 'error', signal });
  const bundleUrl = html.match(BUNDLE_RE)?.[0];
  if (!bundleUrl) return null;
  const js = await fetchText(fetchImpl, assertVdabUrl(bundleUrl), { redirect: 'error', signal });
  return js.match(KEY_RE)?.[1] || null;
}

/**
 * Fetch + normalize VDAB postings across the configured keywords.
 * @param {string} apiUrl base search endpoint (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object, maxPages?: number }} [opts]
 */
export async function fetchVdab(apiUrl = API_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const searchUrl = assertVdabUrl(apiUrl);
  const { keywords, days, size, fetchDetails, detailLimit } = parseVdabConfig(company);
  if (!keywords.length) {
    throw new Error(`vdab: entry "${company.name || '(unnamed)'}" has no vdab.keywords[]`);
  }

  // Scoped to this call: try the hardcoded key first (fast path); on a 403
  // (VDAB rotated it), re-derive once from the live bundle and keep using the
  // fresh key for every remaining request this run.
  let activeKey = VEJ_KEY_MONITOR;
  let rederiveAttempted = false;

  const keyedFetchJson = async (url, requestOpts) => {
    const merged = {
      ...requestOpts,
      headers: { ...(requestOpts.headers || {}), 'vej-key-monitor': activeKey },
      redirect: 'error',
      signal,
    };
    try {
      return await fetchJson(fetchImpl, url, merged);
    } catch (err) {
      if (err?.status !== 403 || rederiveAttempted) throw err;
      rederiveAttempted = true;
      const fresh = await deriveKeyFromBundle(fetchImpl, signal).catch(() => null);
      if (!fresh) throw err;
      activeKey = fresh;
      return fetchJson(fetchImpl, url, { ...merged, headers: { ...merged.headers, 'vej-key-monitor': activeKey } });
    }
  };

  const postSearch = (body) => keyedFetchJson(searchUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  // opts.maxPages caps pagination per keyword during a bounded health-check
  // probe (mirrors thehub's opts.maxPages); real scans paginate up to the
  // MAX_PAGES_PER_KEYWORD safety cap.
  const pageLimit = Number.isInteger(opts.maxPages) && opts.maxPages > 0
    ? Math.min(opts.maxPages, MAX_PAGES_PER_KEYWORD)
    : MAX_PAGES_PER_KEYWORD;

  const fetchKeyword = async (trefwoord) => {
    const out = [];
    for (let pagina = 0; pagina < pageLimit; pagina++) {
      const json = await postSearch(buildSearchBody(trefwoord, { days, size, pagina }));
      const page = Array.isArray(json && json.resultaten) ? json.resultaten : [];
      out.push(...page);
      if (page.length < size) break; // short page → done
    }
    return out;
  };

  const byId = new Map();
  const errors = [];
  let succeeded = 0; // keywords whose request completed (source answered)
  for (const kw of keywords) {
    let raw;
    try {
      raw = await fetchKeyword(kw);
      succeeded++;
    } catch (err) {
      // Recall-first: tolerate a single failed keyword and keep going.
      errors.push(`"${kw}": ${(err && err.message) || err}`);
      continue;
    }
    for (const r of raw) {
      const job = normalizeJob(r);
      if (job && !byId.has(job.vdabId)) byId.set(job.vdabId, job);
    }
  }

  // Optional detail enrichment — bounded, batched, and fail-open per detail.
  if (fetchDetails && byId.size) {
    const jobs = [...byId.values()].slice(0, detailLimit);
    for (let i = 0; i < jobs.length; i += DETAIL_BATCH) {
      const batch = jobs.slice(i, i + DETAIL_BATCH);
      await Promise.all(batch.map(async (job) => {
        try {
          const detail = await keyedFetchJson(
            assertVdabUrl(`${DETAIL_API}${encodeURIComponent(job.vdabId)}?preview=false`),
            { method: 'GET', headers: { accept: 'application/json' } },
          );
          const description = extractDescription(detail);
          if (description) job.snippet = description;
        } catch {
          // Detail fetch is enrichment only. Keep the listing result.
        }
      }));
    }
  }

  // Total outage = every keyword request failed. A keyword that answered with
  // zero results is not an outage, so key off the success count.
  if (succeeded === 0 && errors.length) {
    throw new Error(`vdab: all ${keywords.length} keyword request(s) failed — ${errors[0]}`);
  }

  return [...byId.values()].map(({ vdabId, ...job }) => job);
}
