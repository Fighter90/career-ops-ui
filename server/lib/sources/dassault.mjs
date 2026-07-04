// @ts-check
/**
 * Dassault Systèmes source — the public Exalead "card search" API that powers
 * www.3ds.com/careers/jobs.
 *
 *   GET https://www.3ds.com/apisearch/card_search_api
 *       ?lang=en
 *       &r=f/card_content_type/career                          # only career cards
 *       &r=f/card_content_categories_facet/cards language/en   # only the English copy
 *       &start={offset}                                        # 0-based, 10 hits/page
 *
 * Ported from parent career-ops `providers/dassault.mjs` into the web-ui source
 * contract (rich job objects + `meta` for auto-discovery). Single-company,
 * zero-token; the endpoint is global to 3ds.com so it is provider-selected
 * (`provider: dassault`) like ibm / amazon — there is no per-tenant config.
 *
 * The response is Exalead XML (Content-Type: application/javascript), not JSON.
 * We don't need a real XML parser — each posting is one <Hit>…</Hit> block whose
 * fields are <Meta name="…"><MetaString name="value">…</MetaString> pairs.
 *
 * BOTH refinements matter: `f/card_content_type/career` narrows the global
 * career-content index (~43k mixed third-party hits) to Dassault's own postings,
 * and `cards language/en` collapses the ~12-language duplication to the English
 * set. As a safety net we still keep only hits whose public URL is on *.3ds.com.
 *
 * Host-pinned to www.3ds.com; every fetch uses `redirect:'error'` (SSRF-safe).
 * Used by the dassault adapter (server/lib/portals/adapters/dassault.mjs).
 */
import { fetchText } from '../http-json.mjs';

export const ORIGIN = 'https://www.3ds.com';
export const FEED_BASE = `${ORIGIN}/apisearch/card_search_api`;
const TRUSTED_HOST = 'www.3ds.com';
const REFINES = ['f/card_content_type/career', 'f/card_content_categories_facet/cards language/en'];
const PAGE_SIZE = 10; // Exalead returns 10 hits/page
const MAX_PAGES = 60; // safety cap on request count (~600 postings; the en set is ~445)
const MAX_JOBS = 1000; // cap total postings pulled

export const meta = {
  value: 'dassault',
  label: 'Dassault Systèmes',
  region: 'en',
};

/**
 * Defence-in-depth host check on the endpoint built by the adapter.
 * @param {string} url
 */
export function assertDassaultUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`dassault: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`dassault: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`dassault: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/** @param {number} start */
export function buildUrl(start = 0, feedBase = FEED_BASE) {
  const base = new URL(feedBase);
  base.searchParams.set('lang', 'en'); // keeps facet labels (Country/City/…) in English
  for (const r of REFINES) base.searchParams.append('r', r);
  base.searchParams.set('start', String(start));
  return base.href;
}

// Minimal HTML entity decoder — titles/URLs/locations carry named (&amp;, &apos;)
// and numeric (&#252; / &#xfc;) entities.
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** @param {string} s */
function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

// Pull every <Meta name="X"><MetaString name="value">V</MetaString> pair from one
// <Hit> block into a Map. First value per name wins.
/** @param {string} hitXml @returns {Map<string,string>} */
function metaMap(hitXml) {
  const map = new Map();
  const re = /<Meta name="([^"]+)"[^>]*>\s*<MetaString[^>]*name="value"[^>]*>([\s\S]*?)<\/MetaString>/g;
  let m;
  while ((m = re.exec(hitXml)) !== null) {
    if (!map.has(m[1])) map.set(m[1], m[2]);
  }
  return map;
}

// content_categories is a flat "Label/Value Label/Value …" string. Values can hold
// spaces and commas, so we anchor on the known label tokens and slice each value up
// to the next label. Labels come back localized in some responses, so we accept the
// common en/es/fr variants.
const LOC_LABELS = [
  'Category', 'Type', 'Country', 'City', 'Products', 'Year', // en
  'Categoría', 'Categoria', 'Tipo', 'País', 'Pais', 'Ciudad', 'Productos', 'Año', 'Ano', 'Área', 'Area', // es
  'Catégorie', 'Pays', 'Ville', 'Produits', 'Année', 'Annee', // fr
];
const CITY_LABELS = new Set(['City', 'Ciudad', 'Ville']);
const COUNTRY_LABELS = new Set(['Country', 'País', 'Pais', 'Pays']);
const LABEL_RE = new RegExp('(^|\\s)(' + LOC_LABELS.join('|') + ')\\/', 'g');

/** @param {string} categories @returns {{city: string, country: string}} */
function parseCategories(categories) {
  const marks = [];
  let m;
  LABEL_RE.lastIndex = 0;
  while ((m = LABEL_RE.exec(categories)) !== null) {
    marks.push({ label: m[2], keyStart: m.index + m[1].length, valStart: m.index + m[0].length });
  }
  let city = '';
  let country = '';
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].keyStart : categories.length;
    const value = decodeEntities(categories.slice(marks[i].valStart, end)).trim();
    if (!city && CITY_LABELS.has(marks[i].label)) city = value;
    else if (!country && COUNTRY_LABELS.has(marks[i].label)) country = value;
  }
  return { city, country };
}

// "2026/07/03 18:22:13" → ISO date "2026-07-03" (parsed as UTC so it's deterministic
// across machine timezones; consumers only use this for coarse recency ranking).
/** @param {string} ts @returns {string} */
function toIsoDate(ts) {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})/.exec(String(ts || '').trim());
  if (!m) return '';
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Parse one Exalead card-search XML page into normalized web-ui jobs.
 * Deduped by card_id within the page; the fetch loop dedups again across pages.
 * Keeps only real Dassault-hosted postings (public URL on *.3ds.com).
 * Exported for tests.
 * @param {string} xml @param {string} [fallbackCompany]
 */
export function parseHits(xml, fallbackCompany = 'Dassault Systèmes') {
  const hits = typeof xml === 'string' ? xml.match(/<Hit\b[\s\S]*?<\/Hit>/g) : null;
  if (!hits) return [];

  const byId = new Map();
  for (const hit of hits) {
    const meta = metaMap(hit);
    const title = decodeEntities((meta.get('content_title') || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    const url = decodeEntities((meta.get('content_cta_1_url') || '').trim());
    if (!title || !url) continue;

    // Safety net: only accept postings hosted on 3ds.com. The refined query
    // already guarantees this, but a broadened index must never leak through.
    let host;
    try {
      host = new URL(url).host.toLowerCase();
    } catch {
      continue;
    }
    if (host !== '3ds.com' && !host.endsWith('.3ds.com')) continue;

    const { city, country } = parseCategories(meta.get('content_categories') || '');
    const company = (typeof fallbackCompany === 'string' && fallbackCompany.trim())
      ? fallbackCompany.trim() : 'Dassault Systèmes';
    const id = (meta.get('card_id') || '').trim() || url; // natural dedup key
    if (byId.has(id)) continue;

    byId.set(id, {
      id: `dassault-${url}`,
      title,
      company,
      url,
      salary: '',
      location: city || country,
      isRemote: false,
      workplaceType: '',
      relocates: false,
      date: toIsoDate(meta.get('content_start_datetime') || meta.get('card_update_timestamp') || ''),
      snippet: '',
      source: 'dassault',
      _id: id,
    });
  }
  return [...byId.values()];
}

/**
 * Fetch + normalize the Dassault Exalead card-search feed (paginated via `start`).
 * @param {string} feedBase base search URL (host-pinned to www.3ds.com)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchDassault(feedBase = FEED_BASE, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertDassaultUrl(feedBase);
  const fallbackCompany = (company && typeof company.name === 'string' && company.name.trim())
    ? company.name : 'Dassault Systèmes';

  const out = [];
  const seen = new Set();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const xml = await fetchText(fetchImpl, buildUrl(page * PAGE_SIZE, feedBase), {
      signal,
      redirect: 'error',
      headers: { accept: 'application/xml, text/xml, */*' },
    });
    const parsed = parseHits(xml, fallbackCompany);
    if (parsed.length === 0) break; // past the last page

    let fresh = 0;
    for (const job of parsed) {
      if (seen.has(job._id)) continue;
      seen.add(job._id);
      fresh += 1;
      const { _id, ...clean } = job; // drop the internal dedup key
      out.push(clean);
    }
    if (fresh === 0) break; // server ignored the offset / looped
    if (out.length >= MAX_JOBS) break;
  }
  return out;
}
