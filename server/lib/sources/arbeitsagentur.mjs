/**
 * Arbeitsagentur (Bundesagentur für Arbeit) source — hits the public Jobsuche
 * REST API (the same endpoint arbeitsagentur.de uses). Over-fetches one or more
 * keywords (recall-first); the en-scanner applies title_filter + location_filter
 * + dedup afterwards.
 *
 * Ported from parent career-ops `providers/arbeitsagentur.mjs` into the web-ui
 * source contract. Config comes from the company entry's `arbeitsagentur:`
 * block, read via `opts.company`:
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
 *                                 #   'filter' — server-side homeoffice=nv_true + pagination to
 *                                 #              narrow the set, then the same title check as
 *                                 #              'title' (v6 no longer serves per-hit
 *                                 #              homeofficetyp to this public key — #2494)
 *                                 #   'title'  — regex on the job title only
 *                                 #   'off'    — skip the remote pass entirely
 *         remoteMaxPages: 10      # 'filter' mode: max pages to paginate (default 1)
 *       enabled: true
 *
 * v6 migration (#2494): the v4 search + detail endpoints both 404 as of
 * 2026-08-04 (v5 too). v6 keeps every query parameter this source sends
 * (was/wo/umkreis/veroeffentlichtseit/angebotsart/homeoffice/page/size) but
 * renames the response fields — the list is `ergebnisliste`, and a posting
 * carries `referenznummer` / `stellenangebotsTitel` / `firma` /
 * `stellenlokationen[]` (see normalizeJob + buildLocation).
 *
 * Used by the arbeitsagentur adapter
 * (server/lib/portals/adapters/arbeitsagentur.mjs).
 */
import { fetchJson } from '../http-json.mjs';

export const API_URL = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs';
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
 * Assemble a human-readable location from v6's `stellenlokationen` array. Only a
 * non-DE country is appended so the downstream location_filter can act on it.
 *
 * v4 exposed a single `arbeitsort` object whose `region` was a display name, so
 * it was joined onto the city. v6 nests the address one level deeper
 * (`stellenlokationen[].adresse`) and its `region` is an uppercase federal-state
 * enum (`BADEN_WUERTTEMBERG`), which would only add noise to the string the
 * commute filter has to match — so the city stands alone. A posting may list
 * several locations; the downstream shape is a single string, so the first is
 * used, as v4's single `arbeitsort` field effectively was.
 */
export function buildLocation(lokationen) {
  if (!Array.isArray(lokationen)) return '';
  const adresse = lokationen[0] && lokationen[0].adresse;
  if (!adresse || typeof adresse !== 'object') return '';
  const loc = String(adresse.ort || '').trim();
  const land = adresse.land;
  if (land && !/deutschland|germany/i.test(land)) return loc ? `${loc}, ${land}` : String(land);
  return loc;
}

/**
 * Normalize one raw posting into a rich Job plus its `refnr` (kept for dedup,
 * stripped before the source returns). Returns null when the posting lacks a
 * usable reference number or title.
 *
 * v6 renamed every field this reads (#2494): `refnr` → `referenznummer`,
 * `titel` → `stellenangebotsTitel`, `arbeitgeber` → `firma`, `arbeitsort` →
 * `stellenlokationen[]`. The public job-detail page still resolves by reference
 * number, so the outgoing URL is unchanged.
 */
export function normalizeJob(job) {
  const refnr = job && job.referenznummer;
  const title = String((job && job.stellenangebotsTitel) || '').trim();
  if (!refnr || !title) return null;
  const isRemote = REMOTE_RE.test(title);
  return {
    id: `arbeitsagentur-${encodeURIComponent(String(refnr))}`,
    title,
    company: String((job && job.firma) || '').trim(),
    url: DETAIL_BASE + encodeURIComponent(String(refnr)),
    salary: '',
    location: buildLocation(job && job.stellenlokationen),
    isRemote,
    workplaceType: isRemote ? 'Remote' : 'Onsite',
    relocates: false,
    date: typeof job?.aktuelleVeroeffentlichungsdatum === 'string' ? job.aktuelleVeroeffentlichungsdatum : '',
    snippet: '',
    source: 'arbeitsagentur',
    refnr: String(refnr),
  };
}

// What `remoteMatch: 'filter'` lost in the v6 move, and why it still exists.
//
// v4 proved a role was fully remote by reading `homeofficetyp: VOLLSTAENDIG`
// from the detail endpoint, because the `homeoffice=nv_true` query alone also
// returns `NACH_VEREINBARUNG` ("nach Absprache") — an office-anchored hybrid.
// That proof is gone: v6's detail endpoint answers 403 to this public client
// key, and the only home-office field on a v6 search hit is the boolean
// `homeofficemoeglich`, which is exactly what nv_true already filtered on. A
// boolean that cannot separate fully-remote from hybrid is not evidence.
//
// So 'filter' keeps the half that still works — the server-side query narrows
// the candidate set far better than a nationwide sweep — and falls back to the
// posting's own title for the proof, the same standard 'title' mode uses. A
// candidate whose title makes no remote claim keeps its real city (and its
// title-derived flags), the fail-closed behaviour an unverifiable lookup had in
// v4: the `Deutschlandweit (Homeoffice)` marker exempts a job from the commute
// location_filter, so tagging on nv_true alone would smuggle every hybrid past it.

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
    // fetchJson defaults to redirect:'error', closing the SSRF redirect vector.
    const json = await fetchJson(fetchImpl, `${apiUrl}?${params.toString()}`, {
      headers: { 'X-API-Key': API_KEY, accept: 'application/json' },
      signal,
    });
    return Array.isArray(json && json.ergebnisliste) ? json.ergebnisliste : [];
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
    //   'filter' — server-side homeoffice=nv_true + pagination narrows the set; the
    //              title still has to claim remote before tagging (see the note on
    //              what v6 took away, above)
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
          wide = (await fetchKeyword(kw)).filter((j) => REMOTE_RE.test(String((j && j.stellenangebotsTitel) || '')));
        }
      } catch (err) {
        errors.push(`"${kw}" (remote pass): ${(err && err.message) || err}`);
      }
    }
    // Pass A (commutable) keeps its city as-is.
    for (const raw of primary) {
      const job = normalizeJob(raw);
      if (job && !byRef.has(job.refnr)) byRef.set(job.refnr, job);
    }
    // Pass B roles get a `Deutschlandweit (Homeoffice)` marker (plus forced remote
    // flags), which makes a commute-based location_filter rescue them via
    // always_allow instead of dropping them on a far office city. A wrong marker
    // therefore smuggles an office-anchored hybrid past the distance check, so it
    // may only be applied on evidence:
    //   'title'  — the posting's own title claims remote; take it at face value.
    //   'filter' — `homeoffice=nv_true` narrowed the set but only means "home office
    //              possible", so the title is what proves it. Hits that make no such
    //              claim keep their real city and title-derived flags.
    // Dedup by refnr first: paginating a live index can return the same posting on
    // two pages.
    const wideJobs = [...new Map(
      wide
        .map(normalizeJob)
        .filter(Boolean)
        .filter((job) => !byRef.has(job.refnr))
        .map((job) => [job.refnr, job]),
    ).values()];
    for (const job of wideJobs) {
      if (remoteMatch !== 'filter' || REMOTE_RE.test(job.title)) {
        job.location = job.location
          ? `${job.location} · Deutschlandweit (Homeoffice)`
          : 'Deutschlandweit (Homeoffice)';
        job.isRemote = true;
        job.workplaceType = 'Remote';
      }
      if (!byRef.has(job.refnr)) byRef.set(job.refnr, job);
    }
  }

  if (succeeded === 0 && errors.length) {
    throw new Error(`arbeitsagentur: all ${keywords.length} keyword request(s) failed — ${errors[0]}`);
  }

  return [...byRef.values()].map(({ refnr, ...job }) => job);
}
