/**
 * Ashby public posting-api wrapper.
 *   GET https://api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true
 */
import { DESCRIPTION_CAP } from '../html-to-text.mjs';
import { fetchJson, fetchText, labeledHttpError } from '../http-json.mjs';
import { requireContainer, requireArray } from './_shape.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';

const UA = 'career-ops-web-ui/1.0';
const API_HOST = 'api.ashbyhq.com';
const EMBED_HOST = 'jobs.ashbyhq.com';

// Parent #6674 — the posting API answers with one document per board and has
// no paging or listing-only mode: its only query parameter is
// `includeCompensation`. Every posting carries its description inline (HTML
// and plain), so the body grows with the board: OpenAI was 13.7 MB on
// 2026-11-07, over the shared 10 MB cap in _http.mjs, and the scan lost the
// whole board. The cap exists to stop one endless response from pinning
// memory, not to bound a documented board-wide document, so this endpoint
// gets its own ceiling sized for that shape. A board past even this is read
// from the embed page instead (the same postings without bodies, ~0.4 MB for
// OpenAI), so a big board degrades, never disappears.
export const ASHBY_MAX_BYTES = 64 * 1024 * 1024;

// v1.69.0 (P-14) — self-describing adapter metadata. The registry
// auto-discovers every `*.mjs` in this folder and collects each
// module's `meta` export, so adding a new source is a pure file
// drop — no edit to registry.mjs required.
export const meta = {
  value: 'ashby',
  label: 'Ashby',
  region: 'en',
};

/**
 * Defence-in-depth endpoint check: HTTPS on exactly api.ashbyhq.com. The
 * adapter builds the URL from a slug, so this only ever rejects a caller that
 * hand-built a bad one — but it must reject it BEFORE any request is made
 * (phase-2: the source, not just the adapter, owns the pin).
 * @param {string} url
 * @returns {string}
 */
export function assertAshbyUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`ashby: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`ashby: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== API_HOST) {
    throw new Error(`ashby: untrusted hostname "${parsed.hostname}" — must be ${API_HOST}`);
  }
  return url;
}

/** The https job/apply URL for a posting, or '' when unusable (never a
 *  javascript:/data:/http: link — the URL is the dedup key). */
function resolveJobUrl(j) {
  const raw = (typeof j.jobUrl === 'string' && j.jobUrl.trim())
    || (typeof j.applyUrl === 'string' && j.applyUrl.trim())
    || '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    return parsed.href;
  } catch {
    return '';
  }
}

export async function fetchAshby(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal } = opts; // REVIEW-B3
  assertAshbyUrl(apiUrl);
  // redirect:'error' — never follow a 3xx off api.ashbyhq.com (SSRF; parent #4080).
  // #6674 — the board-wide posting-api document reads under its OWN ceiling
  // (ASHBY_MAX_BYTES), not the shared default.
  let data;
  try {
    data = await fetchJson(fetchImpl, apiUrl, {
      signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      maxBytes: ASHBY_MAX_BYTES,
    });
  } catch (e) {
    // Only an oversized body changes the plan; every other failure is the
    // board's, and stays loud. The size refusal carries no `.status`, so it is
    // checked on the RAW error — labeledHttpError re-labels into a new Error
    // and would drop `.code`.
    if (e?.code !== 'response_too_large') {
      throw labeledHttpError(e, 'Ashby');
    }
    const mb = Math.round((e.maxBytes || ASHBY_MAX_BYTES) / 1048576);
    console.error(`ℹ️  ashby: ${opts.company?.name || 'board'} posting API body over ${mb} MB — read the embed listing instead (no descriptions or dates)`);
    // The fallback must read the SAME board the posting API was asked for.
    // That board is named in the validated apiUrl (from `api:` or derived
    // from careers_url), which may differ from careers_url when `api:` pins
    // the board, so its slug is taken from here (parent #6674).
    return await fetchFromEmbed(apiUrl, opts);
  }
  // Phase-2: a 200 without the documented {jobs:[...]} envelope is a shape
  // change (challenge page, API retirement) — throw instead of the old
  // `(data.jobs || [])` that read it as a healthy-but-empty board. Rows whose
  // jobUrl/applyUrl is not a usable https URL are dropped (the URL is the
  // dedup key — a javascript:/data:/relative href is never a job link).
  requireContainer(data, 'Ashby posting-api', 'jobs');
  return requireArray(data.jobs, 'Ashby jobs')
    .map((j) => normalize(j))
    .filter((j) => j.url);
}

// ── Embed fallback (parent #6674, #4298) ────────────────────────────────────

/** The embed page Ashby's own documented embed script loads. Exported for tests. */
export function buildEmbedUrl(slug) {
  return `https://${EMBED_HOST}/${encodeURIComponent(slug)}?embed=js`;
}

// The embed page hydrates from a single assignment of a JSON object.
const APP_DATA_START_RE = /window\.__appData\s*=\s*\{/;

/**
 * The JSON object assigned to window.__appData, as source text. A brace scan
 * that skips string contents, because a lazy regex up to the first `};` cut
 * the object at any title, team name or theme CSS containing that sequence.
 *
 * @param {string} html
 * @returns {string|null|undefined} the object text; null when the assignment
 *   is absent; undefined when it starts but never closes.
 */
function appDataSource(html) {
  const m = APP_DATA_START_RE.exec(html);
  if (!m) return null;
  const start = m.index + m[0].length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === '{') {
      depth++;
    } else if (c === '}' && --depth === 0) {
      return html.slice(start, i + 1);
    }
  }
  return undefined;
}

/**
 * Pull the job board out of the embed page.
 *
 * Three outcomes, deliberately distinct — a company that disabled its posting
 * API and a slug that does not exist BOTH answer 404 on the API, and only this
 * page tells them apart:
 *   - a jobBoard object        -> the board exists and is readable
 *   - jobBoard: null           -> no such board (a nonexistent slug renders
 *                                 `"organization":null,"jobBoard":null`)
 *   - no parseable __appData   -> Ashby changed the page
 *
 * @param {string} html
 * @returns {{ jobPostings: any[] } | null} null when jobBoard is absent/null.
 * @throws when __appData itself cannot be found or parsed.
 */
export function parseEmbedAppData(html) {
  const source = appDataSource(html || '');
  if (source === null) throw new Error('ashby: embed page carried no window.__appData — Ashby changed the embed markup');
  let data;
  try {
    if (source === undefined) throw new Error('unterminated');
    data = JSON.parse(source);
  } catch {
    throw new Error('ashby: embed page __appData did not parse as JSON — Ashby changed the embed markup');
  }
  const board = data?.jobBoard;
  if (!board || typeof board !== 'object') return null;
  if (!Array.isArray(board.jobPostings)) {
    throw new Error('ashby: embed jobBoard carried no jobPostings array — Ashby changed the embed payload');
  }
  return { jobPostings: board.jobPostings };
}

/** Defence-in-depth on the embed URL: https + exactly jobs.ashbyhq.com. Its
 *  own one-host set, deliberately NOT the API host set: that would also let
 *  a portals.yml `api:` entry point at the embed page. */
function assertEmbedUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`ashby: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`ashby: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== EMBED_HOST) {
    throw new Error(`ashby: untrusted hostname "${parsed.hostname}" — must be ${EMBED_HOST}`);
  }
  return url;
}

/** "ABSENT BEATS WRONG" id coercion (parent _ids.mjs): accept a string or a
 *  number, trim, treat empty as absent. */
function coerceId(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const s = String(raw).trim();
  return s === '' ? undefined : s;
}

/**
 * Read a board from the embed page instead of the posting API (parent
 * #6674): a body past ASHBY_MAX_BYTES is read from the same board's embed
 * listing — the same postings, without bodies. The board slug comes from the
 * validated posting-api URL itself, so an `api:`-pinned board (whose
 * careers_url may be a corporate page or a DIFFERENT Ashby board) still
 * reads its own listing.
 *
 * @param {string} apiUrl the posting-api URL the oversized read was asked for
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} opts
 */
async function fetchFromEmbed(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  const apiSlug = new URL(apiUrl).pathname.match(/^\/posting-api\/job-board\/([^/]+)\/?$/)?.[1];
  if (!apiSlug) throw new Error(`ashby: cannot derive the board slug from ${apiUrl}`);
  const url = assertEmbedUrl(buildEmbedUrl(decodeURIComponent(apiSlug)));
  const html = await fetchText(fetchImpl, url, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  }).catch((e) => { throw labeledHttpError(e, 'Ashby'); });
  const board = parseEmbedAppData(html);
  if (!board) {
    // The page rendered, and it says there is no such board. That is the same
    // condition the posting API reports as 404, and it has to stay loud: a
    // mistyped or migrated slug returning [] would read as "no open roles"
    // on every scan from here on.
    const err = new Error(`ashby: no job board at ${url} — the slug does not exist (jobBoard: null)`);
    /** @type {any} */ (err).status = 404;
    throw err;
  }
  // The slug comes from the posting-api URL, and buildEmbedUrl above already
  // encoded it.
  const encodedSlug = encodeURIComponent(decodeURIComponent(apiSlug));
  return board.jobPostings.map((p) => {
    // A row the payload mangled is dropped on its own, never the board: a null
    // entry, or one with no usable id. The id is the URL's last segment, so
    // without it `String(undefined)` minted ".../undefined" — a dead link that
    // passed the title/url filter (parent #4298). The URL is built from the
    // coerced value.
    if (!p || typeof p !== 'object') return null;
    const id = coerceId(p.id);
    if (id === undefined) return null;
    // Same location rendering as the posting API path, so a board reads the
    // same whichever source served it — in particular the "Remote" marker:
    // the location_filter sees only this string, so a remote posting whose
    // locationName is a city would otherwise fail `allow: ["Remote"]`. The
    // embed payload names places `locationName` where the API says
    // `location`; nothing else differs.
    const location = formatLocation({
      location: p.locationName,
      secondaryLocations: Array.isArray(p.secondaryLocations)
        ? p.secondaryLocations.map((l) => ({ location: l?.locationName }))
        : [],
      workplaceType: p.workplaceType,
      isRemote: p.isRemote,
    });
    const wt = typeof p.workplaceType === 'string' ? p.workplaceType.trim().toLowerCase() : '';
    const isRemote = wt ? wt === 'remote' : p.isRemote === true;
    // The embed payload carries neither descriptionPlain nor publishedAt —
    // the posting API's two extras — and compensation only as a display
    // string, which is not parsed (a bare "$" names no currency). An absent
    // date means "unknown", never "stale", so nothing is invented here.
    // The id comes from the embed payload, so it is host-controlled: a lone
    // surrogate in it would make encodeURIComponent throw and take the whole
    // board down mid-map. Drop that one posting instead (_safe-url.mjs).
    const encodedId = safeEncodeURIComponent(id);
    return {
      id: `ashby-${id}`,
      title: p.title || '',
      company: '',
      url: encodedId === null ? '' : `https://${EMBED_HOST}/${encodedSlug}/${encodedId}`,
      salary: '',
      location,
      isRemote,
      workplaceType: p.workplaceType || (isRemote ? 'Remote' : 'Onsite'),
      relocates: false,
      date: '',
      snippet: '',
      description: '',
      source: 'ashby',
    };
  }).filter((j) => j && j.title && j.url);
}

// v1.75.0 — build the full location from primary +
// secondaryLocations. Ashby puts extra hiring regions in `secondaryLocations[]`
// (each with a region label and a postalAddress). Using only `j.location` drops
// them, so an EU-eligible role whose PRIMARY label is e.g. "Canada" reads as
// Canada-only and is wrongly removed by the location_filter. Fold in each
// secondary's region label, locality, and country (deduped, joined with " · ")
// so the filter can match e.g. "Europe", "Berlin", "Germany".
function containsWholeWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

function formatLocation(j) {
  const parts = [];
  if (typeof j.location === 'string' && j.location.trim()) parts.push(j.location.trim());
  // Parent parity (v1.239.0): fold the PRIMARY address block too. `location` is
  // often a subdivision ("England") while location_filter matches on the country
  // ("United Kingdom") that only addressCountry carries; the country is skipped
  // when `location` already names it ("London, United Kingdom").
  const primaryPa = j.address && j.address.postalAddress;
  if (primaryPa) {
    for (const k of ['addressLocality', 'addressCountry']) {
      const v = typeof primaryPa[k] === 'string' ? primaryPa[k].trim() : '';
      if (!v) continue;
      if (k === 'addressCountry' && parts.some((p) => containsWholeWord(p, v))) continue;
      parts.push(v);
    }
  }
  if (Array.isArray(j.secondaryLocations)) {
    for (const s of j.secondaryLocations) {
      if (!s || typeof s !== 'object') continue;
      const label = s.location || s.name;
      if (typeof label === 'string' && label.trim()) parts.push(label.trim());
      const pa = s.address && s.address.postalAddress;
      if (pa) {
        for (const k of ['addressLocality', 'addressCountry']) {
          if (typeof pa[k] === 'string' && pa[k].trim()) parts.push(pa[k].trim());
        }
      }
    }
  }
  // Remote work model lives in `workplaceType` ("Remote"|"Hybrid"|"Onsite") and
  // `isRemote`, SEPARATE from `location` — which keeps naming the office/HQ city
  // even for a fully remote role. Folding only the location strings renders a
  // remote posting as e.g. "San Francisco", so a location_filter blocking that
  // city drops a role the candidate could actually take. Append "Remote" so the
  // work model is visible to the scanner's string matching without discarding
  // the city (both `allow: ["Remote"]` and city filters keep working).
  // `workplaceType` wins when present: a board can carry `isRemote: true` with
  // `workplaceType: "Hybrid"` for an office-anchored role, and trusting isRemote
  // alone would mislabel those "Remote"; isRemote is the fallback when
  // workplaceType is absent.
  const wt = typeof j.workplaceType === 'string' ? j.workplaceType.trim().toLowerCase() : '';
  const remote = wt ? wt === 'remote' : j.isRemote === true;
  if (remote && !parts.some((p) => /remote/i.test(p))) parts.push('Remote');
  return [...new Set(parts)].join(' · ');
}

function normalize(j) {
  // workplaceType wins over the isRemote boolean (see formatLocation) so the
  // exported flag matches the location string.
  const wtLower = typeof j.workplaceType === 'string' ? j.workplaceType.trim().toLowerCase() : '';
  const isRemote = wtLower ? wtLower === 'remote' : j.isRemote === true;
  const wt = j.workplaceType || (isRemote ? 'Remote' : 'Onsite');

  // Compensation summary
  let salary = '';
  const tier = j.compensation?.compensationTierSummary;
  if (tier) salary = tier;
  else if (j.compensation?.summaryComponents?.length) {
    salary = j.compensation.summaryComponents
      .map((s) => s.compensationType + ' ' + (s.summary || ''))
      .join(', ');
  }

  return {
    id: `ashby-${j.id}`,
    title: j.title || '',
    company: '',
    url: resolveJobUrl(j),
    salary,
    location: formatLocation(j),
    isRemote,
    workplaceType: wt,
    relocates: false,
    date: j.publishedAt || '',
    snippet: '',
    // Ashby's posting-api list ships `descriptionPlain` for free (same payload,
    // no per-job request), so the content_filter can match on the JD body. It's
    // already plain text (no HTML to strip — running it through htmlToText would
    // eat legitimate `<…>` like "C++ templates <T>"), but it IS uncapped and
    // runs 4× longer than greenhouse's, so apply the SAME DESCRIPTION_CAP the
    // shared pipeline uses — one filter behaves the same across boards, and
    // scan-results stays sane.
    description: (typeof j.descriptionPlain === 'string' ? j.descriptionPlain : '').slice(0, DESCRIPTION_CAP),
    source: 'ashby',
  };
}
