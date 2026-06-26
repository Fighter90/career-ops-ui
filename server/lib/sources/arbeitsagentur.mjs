/**
 * Arbeitsagentur (Bundesagentur für Arbeit) source — hits the public Jobsuche
 * REST API (the same endpoint arbeitsagentur.de uses). Over-fetches one or more
 * keywords (recall-first); the en-scanner applies title_filter + location_filter
 * + dedup afterwards.
 *
 * Ported from parent career-ops v1.12.0 `providers/arbeitsagentur.mjs` into the
 * web-ui source contract. Config comes from the company entry's
 * `arbeitsagentur:` block, read via `opts.company`:
 *
 *   tracked_companies:
 *     - name: Arbeitsagentur — ML/KI Deutschland
 *       provider: arbeitsagentur
 *       arbeitsagentur:
 *         keywords: ["Machine Learning Engineer", "Data Scientist"]  # required
 *         wo: Berlin              # optional anchor city; omit for nationwide
 *         umkreis: 50             # km radius around `wo` (default 50)
 *         days: 30                # recency window in days (default 30)
 *         size: 100               # results per keyword (1–100, default 100)
 *         remoteNationwide: true  # also run a nationwide pass keeping remote-eligible hits
 *         remoteMatch: filter     # how that pass detects remote (default 'title'):
 *                                 #   'filter' — server-side homeoffice=nv_true + pagination (every hit remote, cheap)
 *                                 #   'title'  — regex on the job title only
 *                                 #   'off'    — skip the remote pass entirely
 *         remoteMaxPages: 10      # 'filter' mode: max pages to paginate (default 1)
 *       enabled: true
 *
 * Used by the arbeitsagentur adapter
 * (server/lib/portals/adapters/arbeitsagentur.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const API_URL = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs';
const API_KEY = 'jobboerse-jobsuche'; // public client key the arbeitsagentur.de UI uses
const DETAIL_BASE = 'https://www.arbeitsagentur.de/jobsuche/jobdetail/';
const REMOTE_RE = /(remote|homeoffice|home[-\s]?office|ortsunabh|deutschlandweit|bundesweit|100\s*%|full[-\s]?remote|fully remote)/i;

export const meta = {
  value: 'arbeitsagentur',
  label: 'Arbeitsagentur',
  region: 'en',
};

/** Clamp a runtime integer into [min, max], falling back to `def` for NaN. */
function intInRange(val, def, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * Read + sanitize the entry's `arbeitsagentur:` config block.
 * @param {{ arbeitsagentur?: any }} entry
 */
export function parseArbeitsagenturConfig(entry) {
  const cfg = (entry && entry.arbeitsagentur) || {};
  const keywords = Array.isArray(cfg.keywords)
    ? cfg.keywords.filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim())
    : [];
  return {
    keywords,
    wo: typeof cfg.wo === 'string' ? cfg.wo.trim() : '',
    umkreis: intInRange(cfg.umkreis, 50, 0, 1000),
    days: intInRange(cfg.days, 30, 1, 1000),
    size: intInRange(cfg.size, 100, 1, 100),
    remoteNationwide: cfg.remoteNationwide === true,
    // v1.76.0 — config-driven remote detection (parent career-ops v1.13.0 #1189).
    remoteMatch: ['title', 'filter', 'off'].includes(cfg.remoteMatch) ? cfg.remoteMatch : 'title',
    remoteMaxPages: intInRange(cfg.remoteMaxPages, 1, 1, 20),
  };
}

/**
 * Assemble a human-readable location from the API's `arbeitsort` object. Only a
 * non-DE country is appended so the downstream location_filter can act on it.
 */
export function buildLocation(arbeitsort) {
  if (!arbeitsort || typeof arbeitsort !== 'object') return '';
  const loc = [arbeitsort.ort, arbeitsort.region].filter(Boolean).join(', ');
  const land = arbeitsort.land;
  if (land && !/deutschland|germany/i.test(land)) return loc ? `${loc}, ${land}` : land;
  return loc;
}

/**
 * Normalize one raw posting into a rich Job plus its `refnr` (kept for dedup,
 * stripped before the source returns). Returns null when the posting lacks a
 * usable refnr or title.
 */
export function normalizeJob(job) {
  const refnr = job && job.refnr;
  const title = String((job && job.titel) || '').trim();
  if (!refnr || !title) return null;
  const isRemote = REMOTE_RE.test(title);
  return {
    id: `arbeitsagentur-${encodeURIComponent(String(refnr))}`,
    title,
    company: String((job && job.arbeitgeber) || '').trim(),
    url: DETAIL_BASE + encodeURIComponent(String(refnr)),
    salary: '',
    location: buildLocation(job && job.arbeitsort),
    isRemote,
    workplaceType: isRemote ? 'Remote' : 'Onsite',
    relocates: false,
    date: typeof job?.aktuelleVeroeffentlichungsdatum === 'string' ? job.aktuelleVeroeffentlichungsdatum : '',
    snippet: '',
    source: 'arbeitsagentur',
    refnr: String(refnr),
  };
}

/**
 * Fetch + normalize Arbeitsagentur postings across the configured keywords.
 * @param {string} apiUrl base endpoint (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchArbeitsagentur(apiUrl = API_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const { keywords, wo, umkreis, days, size, remoteNationwide, remoteMatch, remoteMaxPages } = parseArbeitsagenturConfig(company);
  if (!keywords.length) {
    throw new Error(`arbeitsagentur: entry "${company.name || '(unnamed)'}" has no arbeitsagentur.keywords[]`);
  }

  const fetchKeyword = async (was, extra = {}) => {
    const params = new URLSearchParams({
      was,
      size: String(size),
      page: '1',
      angebotsart: '1', // 1 = ARBEIT (employment)
      veroeffentlichtseit: String(days),
      ...extra,
    });
    const json = await fetchJson(fetchImpl, `${apiUrl}?${params.toString()}`, {
      headers: { 'X-API-Key': API_KEY, accept: 'application/json' },
      signal,
    });
    return Array.isArray(json && json.stellenangebote) ? json.stellenangebote : [];
  };

  const byRef = new Map();
  const errors = [];
  let succeeded = 0;
  for (const kw of keywords) {
    let primary;
    try {
      primary = wo
        ? await fetchKeyword(kw, { wo, umkreis: String(umkreis) })
        : await fetchKeyword(kw);
      succeeded++;
    } catch (err) {
      errors.push(`"${kw}": ${(err && err.message) || err}`);
      continue;
    }
    // Pass B (optional): a nationwide pass for remote roles hosted at a far HQ
    // (which the radius pass misses). Detection is config-driven via remoteMatch:
    //   'filter' — server-side homeoffice=nv_true + pagination (every hit remote)
    //   'title'  — keep only nationwide hits whose title matches the remote regex
    //   'off'    — skip. Its failure must NOT discard the primary results.
    let wide = [];
    if (wo && remoteNationwide && remoteMatch !== 'off') {
      try {
        if (remoteMatch === 'filter') {
          for (let page = 1; page <= remoteMaxPages; page++) {
            const res = await fetchKeyword(kw, { homeoffice: 'nv_true', page: String(page) });
            wide.push(...res);
            if (res.length < size) break; // short page → done
          }
        } else { // 'title'
          wide = (await fetchKeyword(kw)).filter((j) => REMOTE_RE.test(String((j && j.titel) || '')));
        }
      } catch (err) {
        errors.push(`"${kw}" (remote pass): ${(err && err.message) || err}`);
      }
    }
    // Pass A (commutable) keeps its city. Pass B roles are remote, so append a
    // `Deutschlandweit (Homeoffice)` marker and force the remote flags — remote
    // ignores distance, and the marker lets a commute-based location_filter pass
    // them via always_allow instead of dropping them on the far office city.
    for (const raw of primary) {
      const job = normalizeJob(raw);
      if (job && !byRef.has(job.refnr)) byRef.set(job.refnr, job);
    }
    for (const raw of wide) {
      const job = normalizeJob(raw);
      if (!job) continue;
      job.location = job.location
        ? `${job.location} · Deutschlandweit (Homeoffice)`
        : 'Deutschlandweit (Homeoffice)';
      job.isRemote = true;
      job.workplaceType = 'Remote';
      if (!byRef.has(job.refnr)) byRef.set(job.refnr, job);
    }
  }

  if (succeeded === 0 && errors.length) {
    throw new Error(`arbeitsagentur: all ${keywords.length} keyword request(s) failed — ${errors[0]}`);
  }

  return [...byRef.values()].map(({ refnr, ...job }) => job);
}
