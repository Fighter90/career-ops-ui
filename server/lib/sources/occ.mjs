// @ts-check
/**
 * OCC Mundial source — occ.com.mx, the dominant general job board in Mexico.
 * Provider-selected (like CareerViet / Built In): a tracked_companies entry
 * picks it with `provider: occ`, never via careers_url auto-detection — it is a
 * board-wide aggregator on one host, not a per-employer tenant.
 *
 * Ported from the parent career-ops `providers/occ.mjs` and rewritten to the
 * web-ui source contract (12-field job objects + `meta` for auto-discovery).
 * Host-pinned to www.occ.com.mx over HTTPS; every fetch uses
 * `redirect:'error'`, and `fetchText` adds the DNS-rebinding guard on the real
 * network path. Used by the occ adapter (server/lib/portals/adapters/occ.mjs).
 *
 * Why it exists: many Mexican employers never appear on Greenhouse, Lever,
 * Ashby, Workday or SuccessFactors — they post to OCC. There is no public JSON
 * API (/api/* returns 403); the search pages are server-rendered HTML, parsed
 * with small tag regexes rather than an HTML-parser dependency.
 *
 * URL SHAPES (verified live by the parent 2026-09-03):
 *
 *   https://www.occ.com.mx/empleos/de-{keyword-slug}/
 *   https://www.occ.com.mx/empleos/de-{keyword-slug}/en-{state-slug}/
 *
 * Pagination is a SLUG suffix on the keyword segment
 * (`de-{keyword}-pagina-{N}`), not a query parameter: `?page=2`, `?pagina=2`,
 * `?start=20` and `/2/` all silently return page 1. OCC also answers an
 * out-of-range page with page 1, so "no new ids on this page" is the real
 * end-of-results signal and the loop stops there.
 *
 * CARD SHAPE (one per posting):
 *
 *   <div class="card-job-offer ..." data-id='21319670' id="jobcard-21319670">
 *     <h2 ...>TITLE</h2>
 *     <div class="h-[21px] flex items-center gap-1"><span ...>COMPANY</span>
 *     <div class="no-alter-loc-text ..."><span...></span><p ...>CITY, STATE</p></div>
 *
 * OUTAGE vs EMPTY BOARD. The Cloudflare challenge in front of OCC is
 * geo-scoped: reachable from Mexico, 403 (`cf-mitigated: challenge`) from
 * foreign egresses. A challenge — whether a 403 or an unreadable HTTP 200 —
 * parses to zero cards, so a zero-card page 1 only counts as "no matches" when
 * it carries OCC's own empty-result copy ({@link isEmptyResultPage}). When
 * every query/state pair fails that way the fetch THROWS rather than returning
 * [], which would read downstream as a healthy board with no jobs. One dead
 * keyword next to a live one stays fail-soft.
 *
 * robots.txt (quoted by the parent 2026-09-04) does not disallow the /empleos/
 * search paths; this source requests only those.
 *
 *   tracked_companies:
 *     - name: OCC Mundial
 *       provider: occ
 *       occ:
 *         queries: ["automatizacion", "robotica"]  # REQUIRED — no default
 *         states: ["nuevo-leon", "jalisco"]        # optional; omit for nationwide
 *         max_pages: 3                             # optional, default 3, hard cap 10
 *       enabled: true
 *
 * `queries` is required: OCC has no browsable "all jobs" listing, so a built-in
 * default would be one user's search profile silently applied to everyone
 * else's scan (same contract as wttj / builtin). Flat `queries` / `states` /
 * `max_pages` keys on the entry (the parent's shape) are honoured too; the
 * nested `occ:` block wins.
 */
import {
  fetchText,
  delay,
  computeRetryDelayMs,
  REDIRECT_REFUSAL_CAUSE_MESSAGE,
  BROWSER_LIKE_USER_AGENT,
} from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

export const meta = {
  value: 'occ',
  label: 'OCC Mundial',
  region: 'en',
};

export const TRUSTED_HOST = 'www.occ.com.mx';
export const ORIGIN = `https://${TRUSTED_HOST}`;
/** The adapter's endpoint. Search URLs are built per query/state from ORIGIN. */
export const BASE_URL = `${ORIGIN}/empleos/`;

const DEFAULT_MAX_PAGES = 3;
export const MAX_PAGES_CAP = 10;

/** Pacing between requests, matching the parser sources (jobbankca, careerviet). */
export const INTER_REQUEST_DELAY_MS = 750;

// Matches the parent's fetchTextWithRetry budget: 1 attempt + 2 retries on a
// transient failure (429, 5xx, or a network error without a status).
const RETRIES = 2;
const RETRY_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 4000;

const HEADERS_HTML = {
  'User-Agent': BROWSER_LIKE_USER_AGENT,
  accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.8',
};

/**
 * SSRF guard: HTTPS only, exact host match (never a substring or suffix test),
 * no credentials, no custom port.
 * @param {string} url
 * @returns {string} the same URL when valid
 */
export function assertOccUrl(url) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    throw new Error(`occ: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`occ: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`occ: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  if (parsed.username || parsed.password || parsed.port) {
    throw new Error(`occ: URL must not carry credentials or a custom port: ${url}`);
  }
  return url;
}

/**
 * Strip tags, decode entities, collapse whitespace.
 * @param {string} html
 */
function text(html) {
  return decodeEntities(String(html ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Fold a user-supplied query/state into the shape OCC's path expects. Accents
 * are folded because OCC's own slugs are unaccented ("automatizacion", not
 * "automatización"). The output is `[a-z0-9-]` only, so hostile input ("../",
 * a full URL) can never reach the path as anything but a plain slug.
 * @param {unknown} s
 */
export function slugify(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Build one search URL. Page 1 has no suffix; later pages take `-pagina-N`
 * on the KEYWORD segment (see the URL-shape note above).
 * @param {string} query
 * @param {string|null} [state]
 * @param {number} [page]
 */
export function buildSearchUrl(query, state, page = 1) {
  const q = slugify(query);
  const kw = page > 1 ? `de-${q}-pagina-${page}` : `de-${q}`;
  const st = state ? slugify(state) : '';
  return `${ORIGIN}/empleos/${kw}/${st ? `en-${st}/` : ''}`;
}

/**
 * OCC's own "this search matched nothing" copy.
 *
 * A zero-card parse is ambiguous: a legitimately empty search, a Cloudflare
 * challenge served with HTTP 200 and a markup change all produce `[]`. Only
 * this copy means "no matches". Entities are decoded (`&nbsp;`) and accents
 * folded so a copy tweak on "búsqueda" cannot break the match.
 * @param {string} html
 * @returns {boolean}
 */
export function isEmptyResultPage(html) {
  const plain = text(html).normalize('NFD').replace(/[̀-ͯ]/g, '');
  return /no hay empleos que coincidan/i.test(plain);
}

/**
 * Parse the job cards out of one rendered search page.
 *
 * Splits on the card class rather than regex-matching a whole card: the markup
 * nests divs several levels deep and a greedy match would swallow the next
 * card. Cards without a numeric data-id or a non-empty title are dropped.
 * The posting URL is rebuilt from the numeric id on the pinned origin, never
 * taken from an href in the markup.
 *
 * @param {string} html
 * @returns {Array<{id: string, title: string, url: string, company: string, location: string}>}
 */
export function parseCards(html) {
  const out = [];
  const chunks = String(html ?? '').split('class="card-job-offer');
  for (const chunk of chunks.slice(1)) {
    const idM = chunk.match(/data-id='(\d+)'/);
    if (!idM) continue;
    const id = idM[1];

    const titleM = chunk.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const title = titleM ? text(titleM[1]) : '';
    if (!title) continue;

    // Company sits in the first span inside the h-[21px] row.
    const compM = chunk.match(/h-\[21px\][^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/);
    const company = compM ? text(compM[1]) : '';

    // Location is the <p> inside .no-alter-loc-text.
    const locM = chunk.match(/no-alter-loc-text[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/);
    const location = locM ? text(locM[1]) : '';

    out.push({
      id,
      title,
      url: `${ORIGIN}/empleo/oferta/${id}/`,
      // "Empresa confidencial" is OCC's own placeholder, not a company name.
      // Normalize it to the locale-invariant "?" marker (parent #1596) so the
      // Spanish string never reaches the tracker or a report.
      company: /^empresa confidencial$/i.test(company) ? '?' : company,
      location,
    });
  }
  return out;
}

/**
 * Read the scan config. The nested `occ: {...}` block is canonical; the
 * parent's flat `queries` / `states` / `max_pages` keys are honoured so an
 * entry copied from the CLI's portals.yml keeps working. Nested wins over flat.
 *
 * Throws when no non-empty query is configured (see the header note).
 *
 * @param {any} company
 * @returns {{ queries: string[], states: Array<string|null>, maxPages: number }}
 */
export function readOccConfig(company) {
  const nested = company && typeof company.occ === 'object' && company.occ ? company.occ : {};
  const pick = (key) => (nested[key] !== undefined ? nested[key] : company?.[key]);

  const rawQueries = pick('queries');
  const queries = Array.isArray(rawQueries)
    ? rawQueries.map((q) => String(q).trim()).filter(Boolean)
    : [];
  if (!queries.length) {
    throw new Error(
      `occ: entry "${company?.name || 'OCC'}" requires a non-empty queries: [...] list `
      + '(e.g. occ: { queries: ["automatizacion", "robotica"] }) — OCC is a keyword-search '
      + 'board and has no default listing to scan.',
    );
  }

  const rawStates = pick('states');
  const states = Array.isArray(rawStates) && rawStates.length ? rawStates.map(String) : [null];

  const rawMax = pick('max_pages');
  const maxPages = Math.min(
    Number.isInteger(rawMax) && rawMax > 0 ? rawMax : DEFAULT_MAX_PAGES,
    MAX_PAGES_CAP,
  );
  return { queries, states, maxPages };
}

/**
 * `fetchText` with the parent's retry budget. Only transient failures are
 * retried: HTTP 429, HTTP 5xx, and network errors that carry no status. A
 * permanent 4xx, and a refused redirect (undici's `unexpected redirect`), are
 * rethrown at once. `retries: 0` makes exactly one attempt (the probe path).
 * @param {Function} fetchImpl
 * @param {string} url
 * @param {{ signal?: AbortSignal, sleep: (ms: number, signal?: AbortSignal) => Promise<void>,
 *           retryDelayMs: number, retries: number }} o
 */
async function fetchTextWithRetry(fetchImpl, url, { signal, sleep, retryDelayMs, retries }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchText(/** @type {any} */ (fetchImpl), url, { signal, headers: HEADERS_HTML, redirect: 'error' });
    } catch (err) {
      lastErr = err;
      const status = err && typeof err.status === 'number' ? err.status : undefined;
      const redirectRefusal = status === undefined
        && err instanceof TypeError
        && err?.cause?.message === REDIRECT_REFUSAL_CAUSE_MESSAGE;
      const transient = !redirectRefusal && (status === undefined || status === 429 || status >= 500);
      if (!transient || attempt === retries || signal?.aborted) throw err;
      await sleep(computeRetryDelayMs({
        attempt, baseDelayMs: retryDelayMs, maxDelayMs: RETRY_MAX_DELAY_MS, retryAfter: err?.retryAfter,
      }), signal);
    }
  }
  throw lastErr;
}

/**
 * Fetch + normalize OCC Mundial search results: one paginated search per
 * query × state, deduplicated by posting id across all of them.
 *
 * When `maxPages` is a positive integer (a bounded health probe) it caps the
 * entry's own page budget, requests are not retried, and a request error
 * propagates unwrapped so the caller's error-identity checks still work.
 * Otherwise a failed first page is recorded and skipped (recall-first), and a
 * total outage — every pair failing — throws.
 *
 * @param {string} [endpoint] board URL from the adapter (host-pinned; search URLs are built here)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: any, maxPages?: number,
 *           sleep?: (ms: number, signal?: AbortSignal) => Promise<void>, retryDelayMs?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchOcc(endpoint = BASE_URL, opts = {}) {
  const {
    fetchImpl = fetch,
    signal,
    company = {},
    maxPages: probePages,
    sleep = delay,
    retryDelayMs = RETRY_DELAY_MS,
  } = opts;
  assertOccUrl(endpoint);
  const { queries, states, maxPages: entryMaxPages } = readOccConfig(company);

  const probing = Number.isInteger(probePages) && /** @type {number} */ (probePages) > 0;
  const maxPages = probing ? Math.min(entryMaxPages, /** @type {number} */ (probePages)) : entryMaxPages;
  const io = { signal, sleep, retryDelayMs, retries: probing ? 0 : RETRIES };

  const seen = new Set();
  const jobs = [];
  const errors = [];
  let succeeded = 0; // query/state pairs whose first page the board answered
  let requests = 0;

  for (const query of queries) {
    for (const state of states) {
      const pair = `"${query}"${state ? `/${state}` : ''}`;
      let answered = false;
      for (let page = 1; page <= maxPages; page += 1) {
        if (signal?.aborted) break;
        if (requests > 0) await sleep(INTER_REQUEST_DELAY_MS, signal);
        requests += 1;

        const url = assertOccUrl(buildSearchUrl(query, state, page));
        let html;
        try {
          html = await fetchTextWithRetry(fetchImpl, url, io);
          answered = true;
        } catch (err) {
          // While probing, propagate unwrapped — flattening it here would turn
          // a probe's stop signal into an empty board.
          if (probing) throw err;
          // Recall-first: one bad keyword/state/page must not kill the board,
          // but record it for the outage guard below.
          if (page === 1) errors.push(`${pair}: ${(err && err.message) || err}`);
          break;
        }

        const cards = parseCards(html);
        if (!cards.length) {
          // A first page that parses to nothing is only "no matches" when the
          // board says so. A challenge interstitial, an error page or a markup
          // change must not count as answered, or it would slip past the
          // outage guard on a 200 the way it used to slip past on a 403.
          if (page === 1 && !isEmptyResultPage(html)) {
            answered = false;
            errors.push(`${pair}: page 1 parsed to zero cards and is not OCC's empty-result page (challenge or markup change) — ${url}`);
          }
          break;
        }

        // OCC re-serves page 1 for an out-of-range page, so a page with no new
        // ids is the end of the run.
        let fresh = 0;
        for (const c of cards) {
          if (seen.has(c.id)) continue;
          seen.add(c.id);
          fresh += 1;
          jobs.push({
            id: `occ-${c.id}`,
            title: c.title,
            // Never substitute the board's own name for a missing employer
            // (parent source-policy rule 1): an unparsed row gets the same "?"
            // marker parseCards emits for "Empresa confidencial". An empty
            // string here would let the scanner fall back to the entry name.
            company: c.company || '?',
            url: c.url,
            salary: '',
            location: c.location,
            isRemote: false,
            workplaceType: '',
            relocates: false,
            date: '',
            snippet: '',
            source: 'occ',
          });
        }
        if (fresh === 0) break;
      }
      if (answered) succeeded += 1;
    }
  }

  // Total outage: every pair's first page failed or was unreadable. Returning
  // [] here would read downstream as a live board with no matching jobs.
  if (succeeded === 0 && errors.length) {
    throw new Error(`occ: all ${errors.length} search request(s) failed — ${errors[0]}`);
  }
  return jobs;
}
