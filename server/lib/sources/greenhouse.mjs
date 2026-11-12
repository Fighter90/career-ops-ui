/**
 * Greenhouse public boards-api wrapper.
 *   GET https://boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true
 *
 * Each job has location.name (often "Hybrid - SF, NYC") + offices[]. With
 * `content=true` each posting also carries its full body, which we decode to
 * plain text as `description` — the scanner's content_filter reads
 * `j.description ?? j.snippet` (en-scanner.mjs), so without it every Greenhouse
 * board passed that filter blind.
 */
import { htmlToText } from '../html-to-text.mjs';
import { fetchJson, fetchJsonWithRetry, labeledHttpError, delay } from '../http-json.mjs';
import { requireArray, requireContainer } from './_shape.mjs';

const UA = 'career-ops-web-ui/1.0';

// Ported from parent career-ops providers/greenhouse.mjs — the boards-api host
// allowlist. The scanner always hands this source an adapter-built URL, so the
// assert is defence-in-depth: a future adapter regression (or a hand-edited
// portals.yml `api:`) can never point the scan — and its User-Agent — at an
// arbitrary host. EXACT hostnames, parsed: a substring or suffix match would
// accept boards-api.greenhouse.io.evil.test.
const ALLOWED_GREENHOUSE_HOSTS = new Set([
  'boards-api.greenhouse.io',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'job-boards.eu.greenhouse.io',
]);

// ── CAR-264 (parent #6673) — the oversized-board plan ───────────────────────
// A board too big to read with every body inline (content=true) is read as the
// plain list instead: the response cap is a board-size limit in disguise,
// because the inline body grows with board size × description length (parent
// measurement, Anduril 2026-11-07: 2,600 jobs; 45.7 MB with content=true,
// 2.7 MB without, ~10 KB per posting detail). Greenhouse documents both
// shapes: "GET /v1/boards/{board_token}/jobs" lists jobs, `?content=true` adds
// each job's full description, and "GET /v1/boards/{board_token}/jobs/{id}"
// returns one job with its content
// (https://developers.greenhouse.io/job-board.html#list-jobs,
// #retrieve-a-job). With the entry's opt-in
// (`greenhouse: { fetchDetails: true, detailLimit: 25 }`), bodies are then
// fetched one posting at a time for just the postings this scan keeps
// (titleWanted), up to detailLimit, and never during a health probe (maxPages).
// MAX_BODY_BYTES is the parent transport's DEFAULT_MAX_BODY_BYTES — web-ui's
// ceiling is opt-in per call, so greenhouse asks for it explicitly.
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const DETAIL_DELAY_MS = 200; // ADDING_A_PROVIDER.md: 150-250 ms between sequential requests

/** parent _config-utils.mjs::intInRange — non-finite → def, else clamped trunc. */
function intInRange(val, def, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Entry opt-in: `greenhouse: { fetchDetails: true, detailLimit: N }`. */
function parseDetailConfig(company) {
  const cfg = company?.greenhouse || {};
  return {
    fetchDetails: cfg.fetchDetails === true,
    detailLimit: intInRange(cfg.detailLimit, 25, 1, 100),
  };
}

/** https + exact Greenhouse host, or throws. Exported for tests. @param {string} url */
export function assertGreenhouseUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`greenhouse: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`greenhouse: URL must use HTTPS: ${url}`);
  if (!ALLOWED_GREENHOUSE_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `greenhouse: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_GREENHOUSE_HOSTS].join(', ')}`,
    );
  }
  return url;
}

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs for the rationale.
export const meta = {
  value: 'greenhouse',
  label: 'Greenhouse',
  region: 'en',
};

// ── Office enrichment ───────────────────────────────────────────────
// Some Greenhouse boards put the *work model* ("Hybrid", "In-Office",
// "Distributed") in location.name and keep the actual city only in the
// separate /offices endpoint — which the /jobs list does not embed. For those
// boards the scanner's location_filter never sees a city, so every role is
// evaluated against "Hybrid" and silently dropped. The city is recoverable
// from /v1/boards/{slug}/offices (offices → departments → jobs), one extra
// request paid only for boards that actually exhibit the pattern.
// OFFICES_* get their own ceiling. /offices repeats the board's job list once
// per office in the nested tree, so it outgrows the shared 10 MB defaults
// long before /jobs does: Stripe's was 29.2 MB on 2026-11-09 for a 769-job
// board, and every run aborted, leaving each Stripe role as a bare "Hybrid"
// the location filter cannot place. 64 MB / 60 s leaves 2x headroom on the
// largest board seen while still bounding a hostile endpoint (the parent
// transport's timeoutMs ceiling; web-ui expresses the deadline as a combined
// abort signal on the request).
export const OFFICES_MAX_BYTES = 64 * 1024 * 1024;
export const OFFICES_TIMEOUT_MS = 60_000;

const WORK_MODEL = /^(?:hybrid|in[-\s]?office|on[-\s]?site|distributed|remote|flexible)$/i;

/**
 * True when a location string is only a work model with no geography at all
 * ("Hybrid", "Distributed; Hybrid"). Anything with a place in it
 * ("Hybrid - London") is already filterable and left alone.
 */
export function isWorkModelOnly(name) {
  if (typeof name !== 'string') return false;
  const parts = name.split(';').map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => WORK_MODEL.test(p));
}

/** boards/{slug}/jobs → boards/{slug}/offices, or null for any other shape. */
export function officesUrlFor(apiUrl) {
  const m = String(apiUrl).match(/^(https:\/\/[^/]+\/v1\/boards\/[^/]+)\/jobs(?:$|[?#])/);
  return m ? `${m[1]}/offices` : null;
}

/** Build jobId → Set(office names) by walking offices → departments → jobs. */
export function buildOfficeMap(json) {
  const map = new Map();
  const walk = (offices) => {
    if (!Array.isArray(offices)) return;
    for (const office of offices) {
      if (!office || typeof office !== 'object') continue;
      const name = typeof office.name === 'string' ? office.name.trim() : '';
      if (name) {
        for (const dept of Array.isArray(office.departments) ? office.departments : []) {
          for (const job of Array.isArray(dept?.jobs) ? dept.jobs : []) {
            if (!job || job.id == null) continue;
            if (!map.has(job.id)) map.set(job.id, new Set());
            map.get(job.id).add(name);
          }
        }
      }
      walk(office.children);
    }
  };
  walk(json?.offices);
  return map;
}

// ── Posting body → plain text ────────────────────────────────────────
// With content=true the list response embeds each posting's body as
// DOUBLE-encoded HTML. That pipeline (and its rationale) now lives in
// html-to-text.mjs, shared with the sources given descriptions in the same
// batch; this wrapper keeps greenhouse's tested export name.
/** Entity-decoded markup → stripped plain text. Exported for tests. */
export function contentToText(content) {
  return htmlToText(content);
}

/** Append `content=true` to a boards-api /jobs URL, preserving any existing query. */
export function withContent(apiUrl) {
  try {
    const u = new URL(apiUrl);
    u.searchParams.set('content', 'true');
    return u.href;
  } catch {
    return apiUrl;
  }
}

/** A job whose absolute_url is not https has no safe dedup/apply key — dropped. */
function hasHttpsJobUrl(j) {
  if (!j || typeof j.absolute_url !== 'string') return false;
  try {
    return new URL(j.absolute_url).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function fetchGreenhouse(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal } = opts; // REVIEW-B3
  assertGreenhouseUrl(apiUrl);
  // CAR-264 — every list/detail request reads through the body cap, so an
  // oversized board is REFUSED instead of buffered whole.
  const listOpts = {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    maxBytes: MAX_BODY_BYTES,
  };
  // Only an oversized body changes the plan; every other failure is the
  // board's, and stays loud. The size refusal carries no `.status`, so it is
  // checked on the RAW error — labeledHttpError re-labels into a new Error
  // and would drop `.code`.
  let data;
  let bodiesInline = true;
  try {
    data = await fetchJson(fetchImpl, withContent(apiUrl), listOpts);
  } catch (e) {
    if (e?.code !== 'response_too_large') {
      throw labeledHttpError(e, 'Greenhouse');
    }
    // A board with thousands of postings (SpaceX, Anduril) exceeds the body cap
    // once every posting body is embedded. Fall back to titles, URLs and dates:
    // the same list without content=true.
    const bare = new URL(apiUrl);
    bare.searchParams.delete('content');
    data = await fetchJson(fetchImpl, bare.href, listOpts)
      .catch((e2) => { throw labeledHttpError(e2, 'Greenhouse'); });
    bodiesInline = false;
  }
  // Phase-2: a 200 without the jobs container is a broken/changed board, not
  // an empty one — say so instead of reading it as [] and "succeeding".
  requireContainer(data, 'Greenhouse board', 'jobs');
  const jobs = requireArray(data.jobs, 'Greenhouse jobs').filter(hasHttpsJobUrl);

  if (!bodiesInline) {
    const { fetchDetails, detailLimit } = parseDetailConfig(opts.company);
    const probing = Number.isInteger(opts.maxPages) && opts.maxPages > 0;
    const titleWanted = typeof opts.titleWanted === 'function' ? opts.titleWanted : null;
    const boardSlug = new URL(apiUrl).pathname.match(/^\/v1\/boards\/([^/]+)\/jobs\/?$/)?.[1] || '';
    if (!fetchDetails || probing || !titleWanted || !boardSlug) {
      // No opt-in, a probe, or no title filter to narrow the reads to: the
      // board stays readable, but description-based filters (content_filter,
      // visa, country eligibility) cannot judge these postings. Say so.
      if (!probing) {
        console.warn(`[greenhouse] ${opts.company?.name || 'board'}: board too large for content=true; read without descriptions, so description-based filters (content_filter, visa, country eligibility) cannot judge these postings.${fetchDetails ? '' : ' Set greenhouse.fetchDetails: true on this entry to fetch bodies for title-matched postings.'}`);
      }
    } else {
      const wanted = jobs.filter((j) => j.id != null && titleWanted(j.title || ''));
      const candidates = wanted.slice(0, detailLimit);
      const sleepFn = opts.sleep || delay;
      let attempted = 0;
      let filled = 0;
      for (const j of candidates) {
        // Paced on attempts, not successes, so a run of failures is no burst.
        if (attempted > 0) await sleepFn(DETAIL_DELAY_MS, signal);
        attempted += 1;
        try {
          // Built on the list URL's own path, so a board slug that arrived
          // percent-encoded stays encoded once rather than twice.
          const detailRef = new URL(apiUrl);
          detailRef.search = '';
          detailRef.pathname = `${detailRef.pathname.replace(/\/+$/, '')}/${encodeURIComponent(String(j.id))}`;
          const detailUrl = assertGreenhouseUrl(detailRef.href);
          // Same guarded transport as the list requests (retries transient
          // failures only; a 404 is deterministic and rethrown immediately).
          const detail = await fetchJsonWithRetry(fetchImpl, detailUrl, { ...listOpts, sleep: sleepFn });
          if (detail && typeof detail.content === 'string') { j.content = detail.content; filled += 1; }
        } catch {
          // One posting's body is enrichment: after the retries, keep the
          // posting without it rather than lose it, and never the board.
        }
      }
      console.error(`ℹ️  greenhouse: ${opts.company?.name || 'board'} board too large to read with bodies inline; read the plain list (${jobs.length} jobs) and fetched bodies for ${filled} of ${wanted.length} title-matched${wanted.length > detailLimit ? ` (capped at detailLimit ${detailLimit})` : ''}`);
    }
  }

  // Only pay for /offices when this board actually hides its cities there.
  let officeMap = null;
  if (jobs.some((j) => isWorkModelOnly(j.location?.name) && !(j.offices || []).length)) {
    const officesUrl = officesUrlFor(apiUrl);
    // officesUrlFor only rewrites the trailing /jobs → /offices on the SAME
    // host, so the enrichment request stays pinned to the boards-api host.
    if (officesUrl) {
      try {
        // Same guarded transport as the /jobs request above — the enrichment
        // request stays pinned to the boards-api host and never follows a 3xx.
        // But it carries its OWN ceiling, not the shared one: the nested tree
        // outgrows MAX_BODY_BYTES long before /jobs does (see OFFICES_MAX_BYTES
        // above), and the 60 s deadline rides the request as a combined abort
        // signal (web-ui's transport takes its timeout from the caller).
        // Capped like them, a refusal is fail-soft (enrichment off).
        const timeout = AbortSignal.timeout(OFFICES_TIMEOUT_MS);
        const officesJson = await fetchJson(fetchImpl, officesUrl, {
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
          headers: { 'User-Agent': UA, Accept: 'application/json' },
          maxBytes: OFFICES_MAX_BYTES,
        });
        officeMap = buildOfficeMap(officesJson);
      } catch {
        // Best-effort: a scan must never fail because the secondary lookup did.
        officeMap = null;
      }
    }
  }

  return jobs.map((j) => normalize(j, officeMap));
}

function normalize(j, officeMap = null) {
  let loc = j.location?.name || '';
  // Sorted, because both uses below reach the posting's `location` field and
  // Greenhouse does not promise this array's order between responses. A board
  // that re-orders its offices would otherwise rewrite `location`, and a
  // posting nothing changed about reads as new. (Parent career-ops #3839 fixed
  // the same class on its office-tree Set; the `offices[0]` fallback is
  // web-ui's own second instance of it.)
  const offices = (j.offices || []).map((o) => o.name).filter(Boolean).sort();
  // When the job's location is a bare work model and /jobs
  // embedded no offices, recover the city from the /offices map and fold it
  // into the location string (a `[loc, ...offices]` join)
  // so the returned `location` field — and downstream filtering — sees it.
  if (officeMap && isWorkModelOnly(loc) && !offices.length) {
    const fromMap = officeMap.get(j.id);
    // Sorted for the same reason: the set is built by walking the office
    // tree, so its iteration order is Greenhouse's, not ours.
    if (fromMap && fromMap.size > 0) loc = [loc, ...[...fromMap].sort()].join(' · ');
  }
  const allLocs = [loc, ...offices].filter(Boolean).join(' · ');
  const isRemote = /remote|anywhere|fully\s*distributed/i.test(allLocs) ||
                   /\bremote\b/i.test(j.title);
  const isHybrid = /hybrid/i.test(allLocs);
  const relocates = /\b(visa|relocation|relocates?|sponsorship)\b/i.test(allLocs + ' ' + (j.title || ''));
  return {
    id: `gh-${j.id}`,
    title: j.title || '',
    company: j.company_name || '',
    url: j.absolute_url || '',
    salary: '', // greenhouse rarely exposes salary in board-api
    location: loc || (offices[0] || ''),
    isRemote,
    workplaceType: isRemote ? 'Remote' : (isHybrid ? 'Hybrid' : 'Onsite'),
    relocates,
    date: j.first_published || j.updated_at || '',
    snippet: '',
    description: contentToText(j.content),
    source: 'greenhouse',
  };
}
