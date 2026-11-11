/**
 * EN portal scanner — Greenhouse / Ashby / Lever.
 *
 * Drop-in replacement for the original scan.mjs but:
 *   - In-process (no subprocess)
 *   - Yields rich job objects with location / isRemote / relocates / salary
 *   - Filters by title using portals.yml.title_filter (positive + negative)
 *   - Auto-detects API from careers_url even when api: field is missing
 *   - Persists last-scan results to data/last-scan.json (UI reads this)
 *
 * Reads the same portals.yml as scan.mjs.
 */
import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import yaml from 'js-yaml';
import { PATHS } from './paths.mjs';
import { addPipelineUrl } from './parsers.mjs';
import { sanitizeTsvField, normalizeScanUrl } from './scan-sanitize.mjs';
import { normalizeUrl } from './url-key.mjs';
// CAR-223 (#4789/#5285) — the pure language-dedup helpers (parent scan.mjs):
// language forms, the seen-version machinery, and the preferred_languages pick.
import {
  languageFormsForDedup,
  languageFormsFromUrl,
  isUnseenLanguageVersion,
  recordUrlVariant,
  resolvePreferredLanguages,
  preferredLanguageRanker,
  preferredLanguagePick,
} from './language-preferences.mjs';
import { buildLocationFilter, buildContentFilter, buildTitleFilter, cleanStringList } from './location-filter.mjs';
// CAR-180 — stated years of experience (upstream #6154): parseYearsRequirement
// reads job.description, buildYearsMinFilter is the years_min threshold.
import { parseYearsRequirement, buildYearsMinFilter } from './jd-years.mjs';
import { buildTrustValidator } from './trust-validator.mjs';
import { buildTierFilter } from './classify-tier.mjs';
import { loadQuarantine, isQuarantined, quarantineAdd, pruneQuarantine, saveQuarantine, isPermanentFailure, RETRY_AFTER_DAYS } from './scan-quarantine.mjs';
import { boardTruncation, describeTruncation } from './board-truncation.mjs';
import { isTransientFetchError } from './fetch-error-kind.mjs';
import { closesAtIso } from './posting-close.mjs';
import { withFileLock, atomicWrite } from './file-lock.mjs';
import { makeTimeoutFetch } from './fetch-timeout.mjs';
// #6582 — a portals.yml entry can raise its request timeout with `timeout_ms`.
import { applyEntryTimeout } from './entry-timeout.mjs';
import { withBoardResponseCache, boardCacheStats, resolveBoardCacheTtlMs, formatBoardCacheWindow } from './board-response-cache.mjs';
import { portalTopLevelTypos } from './portals-keys.mjs';
import { loadReApplyWindows, buildCooldownFilter } from './cooldown.mjs';
import { fetchGreenhouse } from './sources/greenhouse.mjs';
import { fetchAshby } from './sources/ashby.mjs';
import { fetchLever } from './sources/lever.mjs';
// v1.13.0 — adapter registry. detectApi() + FETCHERS below preserve the
// pre-registry API for backwards compatibility (any external caller of
// detectApi keeps working), but the registry is now the canonical truth.
// The next ATS we add goes only into ALL_ADAPTERS — no scanner change.
import { resolveAdapter, ALL_ADAPTERS } from './portals/registry.mjs';

// CAR-178 — default fan-out, ported from the parent's scan-ats-full host
// pool (upstream 5ef0676a "cap single-host ATS sweeps at their own
// concurrency" and the keyed hostname limiter that followed it). The pool
// keeps up to CONCURRENCY companies in flight, but the per-host limiter in
// runEnScan caps any ONE ATS host at PER_HOST_CONCURRENCY: Greenhouse, Lever
// and Ashby each serve their ENTIRE directory from a single hostname
// (boards-api.greenhouse.io, api.lever.co, api.ashbyhq.com), so an uncapped
// pool would hold 32 sustained connections to one API and earn an HTTP
// throttle — and a throttled board silently loses live postings rather than
// failing loudly.
//
// #6573 (parent) — BOTH limits are configurable: CAREER_OPS_SCAN_CONCURRENCY
// caps the whole company scan, CAREER_OPS_SCAN_HOST_CONCURRENCY caps one
// hostname inside it. A board response can be tens of megabytes and a
// request's timer also covers reading the body, so more requests in flight
// can make a healthy board miss its timeout on a slower connection — lower
// the values if a scan reports many "aborted" network errors for boards that
// open normally on their own. web-ui KEEPS its host-pool defaults (32 global
// / 10 per host) and adds the configurability on top. The env values are
// read per RUN (see resolveConcurrency): the server loads the data root's
// .env after this module is imported, so a module-load read would miss it.
/** @type {number} web-ui's host-pool default (#579): the whole-scan company cap. */
export const DEFAULT_SCAN_CONCURRENCY = 32;
/** @type {number} web-ui's host-pool default (#579): the per-hostname cap. */
export const DEFAULT_HOST_CONCURRENCY = 10;

/**
 * A concurrency limit from an env value. Anything but a positive integer
 * falls back to the default: a typo should not stop a scan, and pMap never
 * starts a task under a limit of 0.
 * @param {unknown} raw - Raw env value.
 * @param {number} [fallback] - Value used when `raw` is unusable.
 * @returns {number}
 */
export function resolveConcurrency(raw, fallback = DEFAULT_SCAN_CONCURRENCY) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// v1.76.0 — the scan result display is NO LONGER CAPPED. Every matched
// (post-filter) result is stored in data/last-scan.json and the #/scan table
// pages through the full set (200/page, client-side). History: a hard 500/region
// silently truncated large sweeps (e.g. RU 1352 → 500); v1.69.1 raised it to an
// env-overridable 2000 — but users with large company lists still lost the tail.
// The cap is now gone: nothing is dropped, you just turn pages. Adding to
// pipeline/history always used the uncapped `fresh` set and is unaffected.

/**
 * Detect which ATS adapter handles a company entry. v1.13.0 delegates
 * to the new registry (`server/lib/portals/registry.mjs`). The return
 * shape `{ type, url }` is preserved so any external code that imports
 * `detectApi` keeps working.
 */
/**
 * Expand the `telegram_channels:` config block into scanner entries.
 *
 *   telegram_channels:
 *     enabled: true          # optional master switch (default on)
 *     max_posts: 100         # optional cap applied to every channel
 *     channels:
 *       - rabotaphp                          # bare handle
 *       - "@salary_pm"                       # or @handle, or a full t.me link
 *       - { name: "Go работа", channel: rabota_golang }   # or named
 *       - { channel: hr_itwork, enabled: false }          # or switched off
 *
 * Returns [] for a missing or disabled block, so an absent section costs
 * nothing and `enabled: false` silences every channel at once without editing
 * fifteen lines.
 * @param {unknown} block
 * @returns {Array<object>}
 */
export function expandTelegramChannels(block) {
  if (!block || typeof block !== 'object') return [];
  if (block.enabled === false) return [];
  const list = Array.isArray(block.channels) ? block.channels : [];
  const defaultCap = Number(block.max_posts) || undefined;
  const out = [];
  for (const item of list) {
    const isObj = item && typeof item === 'object';
    const channel = isObj ? item.channel : item;
    if (!channel) continue;
    const entry = {
      // The handle doubles as the display name when none is given: it is what
      // the user typed and what they will recognise in the results table.
      name: (isObj && item.name) || String(channel),
      provider: 'telegram',
      channel,
      enabled: isObj && item.enabled !== undefined ? item.enabled : true,
    };
    const cap = (isObj && Number(item.max_posts)) || defaultCap;
    if (cap) entry.max_posts = cap;
    out.push(entry);
  }
  return out;
}

export function detectApi(company, onError) {
  const m = resolveAdapter(company, onError);
  if (!m) return null;
  return { type: m.adapter.id, url: m.endpoint };
}

/**
 * CAR-180 — the stated minimum years of experience for one fetched job, or
 * undefined when its JD text states no gating figure (no description,
 * preferred-only, skill-specific, none, or an "equivalent combination"
 * reading). Reads the same field the content filter matches —
 * `description ?? snippet` — so sources that ship no body are never judged.
 * An unstated or uncertain bar must never filter.
 * @param {{ description?: unknown, snippet?: unknown } | undefined} j
 * @returns {number|undefined}
 */
function statedYearsMin(j) {
  const text = j ? (j.description ?? j.snippet) : undefined;
  if (typeof text !== 'string' || !text.trim()) return undefined;
  const r = parseYearsRequirement(text);
  return r.status === 'stated' ? r.min : undefined;
}

// v1.13.0 — fetchers sourced from the registry. Any new adapter added to
// ALL_ADAPTERS automatically becomes callable here. Looked up per scan (not
// snapshotted at import) so the fetcher always belongs to the adapter that
// detectApi just resolved.
const fetcherFor = (id) => ALL_ADAPTERS.find((a) => a.id === id)?.fetch;

function loadPortals() {
  if (!existsSync(PATHS.portals)) return {};
  const parsed = yaml.load(readFileSync(PATHS.portals, 'utf8')) || {};
  // Parent #6107 — a key one or two edits from a real setting
  // (`tracked_companys`) was silently ignored: the company list read as
  // missing and the scan reported success with zero companies. A near-miss is
  // a typo: name the file, the key, and the suggestion, and refuse to scan
  // (the route surfaces the message as the scan's SSE error). Far-from-any-
  // setting keys — private notes — keep passing.
  const typos = portalTopLevelTypos(parsed);
  if (typos.length > 0) {
    const lines = typos.map((t) =>
      `unknown top-level key "${t.key}" — did you mean "${t.suggestion}"? The misspelled key is ignored, so this scan would report success without applying it.`);
    throw new Error(`Error: ${PATHS.portals}: ${lines.join('\n')}`);
  }
  return parsed;
}

// Parent-format scan-history rows (`url  first_seen  portal  title  company
// status …`) whose status only RECORDS that a posting was cut by the location
// or age filter. They are observations, not "seen": the parent never lets them
// pin a URL, so a posting that later passes (a widened allow list, a re-dated
// listing) must still come through here too.
const OBSERVATIONAL_HISTORY_STATUSES = new Set(['skipped_location', 'skipped_age', 'skipped_experience']);

// CAR-263 (upstream #5905) — the `scan_history.recheck_after_days` window.
// Statuses the TTL is allowed to release. `added` is the row a live posting
// leaves behind; `skipped_expired` is the row a dead one leaves, and it belongs
// here because a posting can be re-listed — pinning the retirement for good
// would put the recheck the user configured out of reach for exactly the URLs
// most likely to come back. `skipped_dup` says a scanner met a seen URL again,
// so it can pin no longer than whatever made the URL seen (collectSeenUrls
// resolves it against the URL's other rows). Everything else keeps its
// permanent pin: the distinction is whether the status describes a POSTING,
// which can change, or the URL itself — an invalid URL does not become valid
// and a blocked host does not become reachable because a window elapsed.
// web-ui's cooldown never writes scan-history rows (it reads the tracker), so
// the parent's `cooldown:` status branch has no counterpart here.
const PERMANENT_SCAN_HISTORY_STATUSES = new Set(['skipped_invalid_url', 'skipped_blocked_host']);
const RECHECKABLE_SCAN_HISTORY_STATUSES = new Set(['added', 'skipped_expired', 'skipped_dup']);

/**
 * The `scan_history` recheck policy portals.yml sets, in the shape
 * collectSeenUrls and loadSeenUrls take. Passed by every scanner that builds a
 * seen set, so a policy left out reads as "dedup forever" only where no config
 * was read at all.
 * @param {object|null} [config] - Parsed portals.yml.
 * @returns {{recheckAfterDays: number|null}}
 */
export function scanHistoryPolicy(config = {}) {
  const raw = config?.scan_history?.recheck_after_days;
  const parsed = Number.parseInt(raw, 10);
  return {
    recheckAfterDays: Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
  };
}

/**
 * Whole-calendar days between two ISO dates, else null. A date that rolls over
 * (`2026-02-30`) and a date outside the calendar (`2026-13-01`) both read as no
 * date: `new Date()` returns an Invalid Date for the latter and toISOString()
 * throws on one, so a single such scan-history row used to abort the whole
 * seen-set build — and with it the scan.
 */
function daysBetweenIsoDates(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  if (startDate.toISOString().slice(0, 10) !== start || endDate.toISOString().slice(0, 10) !== end) return null;
  return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
}

/**
 * Whether a scan-history row still pins its URL. `today` defaults to the UTC
 * calendar day — the day appendToHistory / appendSkippedHistory stamp rows
 * with (`toISOString().slice(0, 10)`), so a west-of-Greenwich evening run does
 * not read the window one day high against its own writer.
 * @param {{firstSeen: string, status?: string}} row
 * @param {{recheckAfterDays?: number|null, today?: string}} [policy]
 * @returns {boolean} true = the row pins (the URL counts as seen)
 */
export function shouldDedupScanHistoryRow({ firstSeen, status = 'added' }, { recheckAfterDays = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  if (PERMANENT_SCAN_HISTORY_STATUSES.has(status)) return true;
  if (OBSERVATIONAL_HISTORY_STATUSES.has(status)) return false;
  if (!RECHECKABLE_SCAN_HISTORY_STATUSES.has(status)) return true;
  if (recheckAfterDays == null) return true;
  const ageDays = daysBetweenIsoDates(firstSeen, today);
  if (ageDays == null) return true;
  return ageDays < recheckAfterDays;
}

// Heading depth decides which pipeline rows are finished work. `## Processed`
// (`## Procesadas`) and a checked box are finished. A deeper heading is a
// subdivision, and a shallower heading ends the section — collectSeenUrls and
// the pipeline write share this, so a row one of them releases is a row the
// other can write.
function processedSectionAfter(line, inProcessed) {
  const heading = line.match(/^(#+)\s+(.*)$/);
  if (!heading || heading[1].length > 2) return inProcessed;
  return heading[1].length === 2
    && /^(processed|procesadas)\b/i.test(heading[2].trim());
}

/**
 * Read the opt-in `scan_history.dedup_include_language` switch (CAR-223,
 * upstream #4789, parent resolveDedupIncludeLanguage).
 *
 * An employer can publish one posting in more than one language at one URL,
 * with the URL differing only in a language param. url-key.mjs strips that
 * param from the canonical key, so the versions share one key — correct for a
 * candidate who reads every language (they are duplicates), wrong for one who
 * applies in some languages only: with the switch on, a language version of a
 * seen posting that no seen row was in is kept. Strict boolean `true` only,
 * like the parent's resolveDedupIncludeLocation.
 * @param {object} [config] - Parsed portals.yml.
 * @returns {boolean}
 */
export function resolveDedupIncludeLanguage(config = {}) {
  return config.scan_history?.dedup_include_language === true;
}

/**
 * The title cell of a pipeline.md checklist row (`- [ ] url | company | title
 * | …`) — the cell a seen-version resolution compares against. Fenced
 * `url | comp` rows carry compensation, not a title, and record none.
 * @param {string} line
 * @returns {string}
 */
function pipelineRowTitle(line) {
  const m = /^\s*-\s*\[[ x]\]\s*/i.exec(line);
  if (!m) return '';
  const cells = line.trim().slice(m[0].length).split(/\s+\|\s+/).map((s) => s.trim());
  return cells[2] || '';
}

/**
 * Title and language CELL of one scan-history.tsv row. Two row shapes share
 * the file: the parent format (`url | first_seen | portal | title | company |
 * status | … | language | listing_key` — the language column was appended
 * later, so older rows stop short) and web-ui's own (`date | source | id |
 * company | title | url`). The URL's position tells them apart.
 * @param {string} line
 * @returns {{ title: string, language: string }}
 */
function scanHistoryRowContext(line) {
  const cells = line.split('\t');
  if (/^https?:\/\//i.test(cells[0] || '')) {
    return { title: cells[3] || '', language: cells[13] || '' };
  }
  return { title: cells[4] || '', language: '' };
}

/**
 * Every URL already known — scan-history.tsv, pipeline.md, applications.md —
 * normalised with url-key so tracking-parameter variants collapse, plus
 * (CAR-223, #4789) the language versions each seen URL stands for: a row's
 * language is its recorded cell when it has one, else the language its URL
 * asks for, and its title rides along for rows that recorded neither. The
 * variants feed the seen filter behind `scan_history.dedup_include_language`;
 * the seen set itself is built exactly as before (same lines, same tokens).
 * Shared by the EN and RU scanners.
 * @returns {{ seen: Set<string>, variants: Map<string, Array<{languages: string[], title: string}>> }}
 */
export function collectSeenUrls(policy = {}) {
  const seen = new Set();
  // Which language versions each seen URL key stands for — read by the
  // dedup filter behind scan_history.dedup_include_language.
  const variants = new Map();
  // CAR-263 (upstream #5905) — history rows the recheck window has released.
  // Held rather than dropped silently: a pipeline.md entry below can re-pin a
  // released URL while it is still actionable (a fence / `- [ ]` row is the
  // pending inbox — re-scanning it would append a SECOND queue copy), so the
  // pipeline pass must know which URLs the TTL freed.
  const recheckCandidates = new Set();
  // `skipped_dup` rows wait for all of the URL's history rows: under a window a
  // repeat takes its verdict from whatever made the URL seen, which can sit
  // anywhere in the file.
  const dupRows = [];

  // scan-history.tsv — a per-ROW walk: the recheck window reads a row's status
  // and first_seen, which only a shape-aware parse can find. Two shapes share
  // the file: web-ui's own (`date | source | id | company | title | url [ |
  // closes_at]`, every row an `added` equivalent) and the parent format
  // (`url | first_seen | portal | title | company | status …`).
  let historyText = '';
  try { historyText = readFileSync(PATHS.scanHistory, 'utf8'); } catch {}
  for (const line of historyText.split('\n')) {
    const cells = line.split('\t');
    const parentFormat = /^https?:\/\//i.test(cells[0] || '');
    if (!parentFormat && cells.length < 6) continue;
    const url = (parentFormat ? cells[0] : cells[5] || '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const status = parentFormat ? (String(cells[5] || '').trim() || 'added') : 'added';
    const firstSeen = (parentFormat ? cells[1] : cells[0] || '').trim();
    // Observational rows record a config rejection, not a seen posting — the
    // URL was never queued, so it neither pins nor counts as a recheck
    // candidate (counting it would overstate what the TTL released).
    if (parentFormat && OBSERVATIONAL_HISTORY_STATUSES.has(status)) continue;
    // Under a window a repeat sighting waits for the URL's other rows (next
    // loop). With no window it pins like any other row.
    if (status === 'skipped_dup' && policy.recheckAfterDays != null) {
      dupRows.push({ url, firstSeen, line });
      continue;
    }
    const token = normalizeUrl(url) || url;
    if (shouldDedupScanHistoryRow({ firstSeen, status }, policy)) {
      seen.add(token);
      const ctx = scanHistoryRowContext(line);
      const recorded = languageFormsForDedup(ctx.language);
      recordUrlVariant(variants, token, recorded.length ? recorded : languageFormsFromUrl(url), ctx.title);
    } else {
      recheckCandidates.add(token);
    }
  }

  // A `skipped_dup` row is dated the day of the repeat — a scanner writes one
  // every run that lists the URL — so reading that date would restart the
  // clock each scan. The URL's own rows decide instead, whatever the repeat's
  // age: one still pinned keeps it seen, and once they are all released the
  // repeat goes with them. Only a row with no original here falls back on its
  // own `first_seen`; an aged orphan stops pinning, and it never becomes a
  // recheck candidate, so it cannot un-pin the pipeline entry it repeats.
  for (const { url, firstSeen, line } of dupRows) {
    const token = normalizeUrl(url) || url;
    if (!seen.has(token) && recheckCandidates.has(token)) continue;
    if (seen.has(token) || shouldDedupScanHistoryRow({ firstSeen, status: 'skipped_dup' }, policy)) {
      seen.add(token);
      const ctx = scanHistoryRowContext(line);
      const recorded = languageFormsForDedup(ctx.language);
      recordUrlVariant(variants, token, recorded.length ? recorded : languageFormsFromUrl(url), ctx.title);
    }
  }

  // pipeline.md + applications.md — per-line URL extraction. The pipeline pass
  // carried no age policy, which is what made recheck_after_days a no-op: on
  // an install that has been scanning for a while every URL the TTL releases
  // above is listed here too, so it was re-pinned immediately. What may be
  // released is decided by whether the row is still ACTIONABLE. A fence line
  // or an unchecked `- [ ]` row is work the user can still pull from — it
  // re-pins. A checked `- [x]` row, or any row under `## Processed`
  // (`## Procesadas`), is finished: no queue entry can be duplicated, so the
  // scan-history TTL governs alone. Release also requires the URL to be a
  // recheck candidate, so a pipeline-only URL is never un-pinned.
  for (const p of [PATHS.pipeline, PATHS.applications]) {
    let text = '';
    try { text = readFileSync(p, 'utf8'); } catch { continue; }
    let inProcessed = false;
    for (const line of text.split('\n')) {
      inProcessed = processedSectionAfter(line, inProcessed);
      for (const m of line.matchAll(/https?:\/\/\S+/g)) {
        const token = normalizeUrl(m[0]) || m[0];
        if (p === PATHS.pipeline && recheckCandidates.has(token)
          && (inProcessed || /^-\s*\[[xX]\]/.test(line.trim()))) continue;
        seen.add(token);
        let languages;
        let title = '';
        if (p === PATHS.pipeline) {
          languages = languageFormsFromUrl(m[0]);
          title = pipelineRowTitle(line);
        } else {
          languages = languageFormsFromUrl(m[0]);
        }
        recordUrlVariant(variants, token, languages, title);
      }
    }
  }
  return { seen, variants };
}

/**
 * Every URL already known — scan-history.tsv, pipeline.md, applications.md —
 * normalised with url-key so tracking-parameter variants collapse. Shared by
 * the EN and RU scanners.
 * @returns {Set<string>}
 */
export function loadSeenUrls(policy = {}) {
  return collectSeenUrls(policy).seen;
}

async function pMap(items, mapper, concurrency) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await mapper(items[idx], idx); }
      catch (e) { out[idx] = { __error: e }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}

/**
 * CAR-178 — per-key semaphore: at most `limit` concurrent `fn` calls per
 * key while any number of keys run in parallel (the parent scan-ats-full
 * keyed limiter, verbatim). A released slot hands off directly to the next
 * waiter for its key; a key's state is deleted once it goes idle, so the
 * map cannot grow with the number of hosts ever seen.
 * @param {number} limit
 * @returns {<T>(key: string, fn: () => Promise<T>) => Promise<T>}
 */
export function createKeyedLimiter(limit) {
  const states = new Map();
  return async function withKeySlot(key, fn) {
    let state = states.get(key);
    if (!state) {
      state = { active: 0, queue: [] };
      states.set(key, state);
    }
    if (state.active >= limit) {
      await new Promise((resolve) => state.queue.push(resolve));
    } else {
      state.active++;
    }
    try {
      return await fn();
    } finally {
      const next = state.queue.shift();
      if (next) next();
      else {
        state.active--;
        if (state.active === 0) states.delete(key);
      }
    }
  };
}

/**
 * CAR-178 — the ATS host a company's fetch will actually hit: the hostname
 * of the adapter-built endpoint. Entries whose endpoint is not a URL
 * (config-driven sources resolve their URL inside the fetcher) share one
 * conservative bucket per adapter type.
 * @param {{ _api: { url: unknown, type: string }, name?: string }} c
 * @returns {string}
 */
function hostKeyFor(c) {
  try { return new URL(c._api.url).hostname.toLowerCase(); }
  catch { return String(c._api.type || c.name || 'unknown'); }
}

/**
 * Run an EN scan.
 *
 * Options:
 *   writeFiles  (default true)  — write to pipeline.md + scan-history.tsv + last-scan.json
 *   companyName               — if set, scan only that company
 *   onLog(stream, line)
 *   fetchImpl                 — for tests
 */
export async function runEnScan(opts = {}) {
  // REVIEW-B3 — `signal` lets the SSE handler abort in-flight fetches
  // when the client disconnects.
  // fetchImpl defaults to a timeout-wrapped fetch so one stalled board
  // can't hang the whole ATS sweep (v1.63.0).
  const { writeFiles = true, companyName, onLog = () => {}, onProgress = () => {}, fetchImpl = makeTimeoutFetch(), signal } = opts;
  // v1.80.0 — optional per-source cap (idea from job-crawler's
  // --max-jobs-per-source). 0 / absent = unlimited (the default). Caps how many
  // jobs each company/board contributes, so one huge board can't dominate.
  const maxPerSource = Math.max(0, Number(opts.maxPerSource) || 0);
  const portals = loadPortals();
  const tf = portals.title_filter || {};
  // v1.76.0 — word-boundary acronym matching + malformed-config guard (parent
  // career-ops v1.13.0 #1102/#1187). A job passes when a positive matches (or
  // there are none) AND no negative matches.
  const titleOk = buildTitleFilter(tf);
  // v1.12.0 — surface seniority_boost from portals.yml. Canonical
  // career-ops.org schema documents this as keywords that "rank matching
  // positions higher without filtering" (third list alongside positive /
  // negative). The scanner persists a `_boosted` flag on every job whose
  // title contains a boost keyword (case-insensitive); SPA renders a
  // "⬆ boosted" badge on those rows so the user can see WHY they're
  // ranked higher.
  // Blank / non-string entries dropped: "" is a substring of every title.
  const boosts = cleanStringList(tf.seniority_boost).map((s) => s.toLowerCase());
  // v1.76.0 — optional trust validation. Off unless
  // `trust_filter:` is present and not disabled. Annotates each job with
  // _trustScore/_trustLevel/_trustFlags so the #/scan table can badge low-trust
  // postings — it NEVER drops a job.
  const trust = buildTrustValidator(portals.trust_filter);
  const trustOn = !!(portals.trust_filter && portals.trust_filter.enabled !== false);
  // CAR-223 (#4789) — opt-in `scan_history.dedup_include_language`: behind it
  // the URL dedup keeps a language version of a seen posting that no seen row
  // was in. Off (the default) the behavior is unchanged — a language variant
  // of a seen posting dedups away.
  const dedupIncludeLanguage = resolveDedupIncludeLanguage(portals);
  // CAR-223 (#5285) — top-level `preferred_languages`: the languages the
  // candidate wants a posting in, best first. Ordering only — it decides
  // WHICH version of a posting the dedup keeps, never filters one out.
  const preferredLanguages = resolvePreferredLanguages(portals);
  const preferredLanguageRank = preferredLanguages.length
    ? preferredLanguageRanker(preferredLanguages)
    : null;
  // CAR-263 (upstream #5905) — the same portals.yml gives one verdict: the
  // seen set honours `scan_history.recheck_after_days`, so a posting the
  // window released comes back to the scan instead of deduping forever.
  const { seen, variants: seenVariants } = collectSeenUrls(scanHistoryPolicy(portals));
  // CAR-223 (#4789) — filled during the fetch walk below: each fetched
  // posting's language versions, in provider order, before any filter. Empty
  // (and unfilled) unless dedup_include_language is on.
  const siblingsByUrl = new Map();

  let companies = portals.tracked_companies || portals.companies || [];
  // v1.228.0 — `telegram_channels:` is its own top-level block. A channel is
  // not a company, and listing fifteen of them under `tracked_companies` buried
  // the actual employers. Expanding them here keeps ONE scan path: the entries
  // become ordinary adapter-selected companies the moment they are read, so
  // quarantine, filters, dedup and the per-source cap all apply unchanged.
  if (!Array.isArray(companies)) companies = [];
  companies = companies.concat(expandTelegramChannels(portals.telegram_channels));
  companies = companies.filter((c) => c && typeof c === 'object' && c.enabled !== false);
  if (companyName) {
    companies = companies.filter((c) => String(c.name ?? '').toLowerCase().includes(companyName.toLowerCase()));
  }

  const errors = [];
  const log = (s, line) => onLog(s, line);
  // R-12 (CAR-91) — entries whose detection or fetch failed this run. Their
  // previous snapshot rows must survive the full-replace save below.
  const failedCompanies = new Set();
  // Detection runs per company, inside its own catch: an adapter that throws on
  // one misconfigured entry is that entry's error, not the end of the scan.
  const withApiAll = [];
  let detectFailures = 0;
  for (const c of companies) {
    let failed = false;
    const recordError = (msg) => {
      failed = true;
      failedCompanies.add(c.name);
      errors.push(`${c.name}: ${msg}`);
      log('stderr', `  ✗ ${String(c.name ?? '').padEnd(28)} ${msg}`);
    };
    let api = null;
    try {
      api = detectApi(c, (adapter, e) => recordError(`${adapter.id}: ${e?.message || e}`));
    } catch (e) {
      recordError(e?.message || String(e));
    }
    if (api) withApiAll.push({ ...c, _api: api });
    else if (failed) detectFailures += 1;
  }
  const skipped = companies.length - withApiAll.length;

  // v1.80.0 — source quarantine. Skip sources that returned a permanent 404/410
  // on a prior run (self-healing: retried after RETRY_AFTER_DAYS). Can be turned
  // off with `scan_quarantine: false` in portals.yml.
  const quarantineOn = portals.scan_quarantine !== false;
  const quarantine = quarantineOn ? loadQuarantine() : { entries: {} };
  const now = Date.now();
  // Name AND endpoint: a fixed careers_url resolves to a new url and is retried.
  const withApi = quarantineOn ? withApiAll.filter((c) => !isQuarantined(quarantine, c.name, now, c._api.url)) : withApiAll;
  const quarantinedNames = withApiAll.filter((c) => !withApi.includes(c)).map((c) => c.name);
  const quarantinedCount = quarantinedNames.length;
  let quarantineChanged = false;

  log('stdout', '━'.repeat(60));
  log('stdout', `EN Portal Scan — ${new Date().toISOString().slice(0, 10)}`);
  log('stdout', '━'.repeat(60));
  log('stdout', `Enabled companies:    ${companies.length}`);
  log('stdout', `With API:             ${withApi.length}`);
  log('stdout', `Without API (skipped):${skipped}`);
  if (quarantinedCount) {
    log('stdout', `Quarantined (skipped):${quarantinedCount} (dead 404/410 — auto-retried after ${RETRY_AFTER_DAYS} days)`);
    log('stdout', `  ${quarantinedNames.join(', ')}`);
  }
  log('stdout', `Already seen:         ${seen.size} URLs`);
  log('stdout', '');

  let progressDone = 0;            // v1.63.2 — determinate % progress
  let fetchFailures = 0;           // sources whose fetch threw (snapshot guard)
  // CAR-256 (parent parity, #6636) — boards read only PARTLY (page cap, 429,
  // fetch error), one entry per source: {company, reason, fetched?, total?,
  // source}. Any provider tag the board-truncation mirror recognizes lands
  // here; truncatedSources keeps carrying the bare names for the snapshot
  // shape. A partial read is reported, never silently presented as the whole
  // board.
  const partialSources = [];
  // CAR-256 (parent parity, #6675) — boards whose fetch failed on a TRANSIENT
  // error (network reset / timeout / HTTP 5xx). They are retried ONCE after
  // the main concurrent sweep, one at a time (see retryTransientFailures in
  // fetchAllBoards below): the provider's own retries run inside the same
  // burst that caused the failure, so re-running the failed boards after the
  // sweep removes the contention instead of repeating into it.
  const transientFailures = [];
  // CAR-178 — one keyed limiter per run: the pool may hold scanConcurrency
  // companies in flight, but a single ATS host never takes more than the
  // resolved per-host limit concurrent fetches. Detection, quarantine, dedup
  // and the indexed pMap collection are untouched — results are still
  // gathered by input index, so the saved snapshot is identical to a
  // sequential run's whatever the completion order.
  const withHostSlot = createKeyedLimiter(
    // #6573 — per-run env read: CAREER_OPS_SCAN_HOST_CONCURRENCY (default 10).
    resolveConcurrency(process.env.CAREER_OPS_SCAN_HOST_CONCURRENCY, DEFAULT_HOST_CONCURRENCY),
  );
  // L262-R3 — `yearsMin` exists for the years_min filter (and the #/scan
  // badge fed from it); parseYearsRequirement walks the whole description
  // (~ms per JD), so the stamp is computed during the fetch ONLY when the
  // filter is actually configured. Mirrors buildYearsMinFilter's validity
  // rule; tests/jd-years-filter.test.mjs locks the configured path.
  const yearsMinConfigured = typeof portals.years_min === 'number'
    && Number.isFinite(portals.years_min) && portals.years_min >= 0;
  // CAR-226 (parent #6105) — a second board read inside the freshness window
  // (default 15 minutes) reuses the saved response, and a stale GET is
  // rechecked with If-None-Match. CAREER_OPS_HTTP_CACHE=0 always downloads;
  // CAREER_OPS_HTTP_CACHE_TTL_MS overrides the window. The store is IN MEMORY
  // and scoped to THIS run (web-ui has no on-disk cache contract — the parent
  // persists under data/cache/http/ for cross-process reuse; noted deviation).
  const cacheEnabled = process.env.CAREER_OPS_HTTP_CACHE !== '0';
  const cacheTtlMs = resolveBoardCacheTtlMs(process.env.CAREER_OPS_HTTP_CACHE_TTL_MS);
  const fetchedPerCo = await withBoardResponseCache({ ttlMs: cacheTtlMs, disabled: !cacheEnabled }, async () => {
    // #6573 — per-run env read: CAREER_OPS_SCAN_CONCURRENCY (default 32).
    const scanConcurrency = resolveConcurrency(process.env.CAREER_OPS_SCAN_CONCURRENCY, DEFAULT_SCAN_CONCURRENCY);
    // CAR-256 (parent parity, #6675) — the gap between the sweep and the
    // retry pass. Per-run env read so tests can shrink it.
    const transientRetryGapMs = Math.max(0, Number.parseInt(process.env.CAREER_OPS_TRANSIENT_RETRY_GAP_MS ?? '', 10) || 3000);
    const fetchCompany = async (c, { countProgress = true, idx = -1 } = {}) => {
    if (signal?.aborted) return [];
    const fetcher = fetcherFor(c._api.type);
    const label = String(c.name ?? '').padEnd(28);
    try {
      // v1.75.0 — thread the resolved company entry through so config-driven
      // sources (ibm / arbeitsagentur / glints / jobstreet) can read their
      // `<provider>:` block. URL-detected ATS fetchers ignore the extra opt.
      // CAR-178 — the per-host slot wraps ONLY the fetch; filters, error
      // handling and progress below run outside it.
      // #6582 — the entry's own `timeout_ms` (when set) raises the request
      // budget for THIS entry's fetches only; every other entry keeps the
      // run default.
      const coFetch = applyEntryTimeout(fetchImpl, c);
      const items = await withHostSlot(hostKeyFor(c), () => fetcher(c._api.url, {
        fetchImpl: coFetch, signal, company: c,
        // CAR-264 (parent #6673) — the parent scan ctx's title hook. A source
        // with an expensive per-posting enrichment (greenhouse's oversized-
        // board detail fetches; sitemap's detail pages) narrows it to the
        // postings this scan keeps. Sources that ignore the opt are unaffected.
        // The same predicate is applied again post-fetch below — reading a
        // title twice is free next to the request it saves.
        titleWanted: titleOk,
        // CAR-223 — a provider that serves extra language versions of a
        // posting at extra cost fetches them only when the scan will keep
        // them; one that returns versions selectively also returns the
        // preferred ones (parent scan ctx, #4789/#5285).
        dedupIncludeLanguage,
        ...(preferredLanguageRank ? { preferredLanguageRank } : {}),
      }));
      // CAR-223 (#4789) — the versions this fetch returned, from the UNSORTED
      // items: the provider's own order — each posting's default language
      // first — is what the language-aware seen dedup resolves a seen row
      // against. Recorded before any filter, so a seen row is matched against
      // every version, also those a filter rejects (a German title can fail a
      // title filter that its English version passes).
      if (dedupIncludeLanguage) {
        for (const j of items) {
          const languages = languageFormsForDedup(j?.language);
          if (!languages.length) continue;
          recordUrlVariant(siblingsByUrl, normalizeUrl(j.url) || j.url, languages, j.title);
        }
      }
      // CAR-223 (#5285) — preferred languages first, best first; stable, so
      // the rest keep the provider's order. What the dedup keeps is the FIRST
      // version of a posting it meets (dedup_include_language off) or every
      // version in this order (on) — either way this is what makes it keep
      // the preferred one. The result flags (ultiproTruncated /
      // peoplesoftIncomplete) live on `items` and are unaffected by reordering.
      const ordered = preferredLanguages.length ? preferredLanguagePick(items, preferredLanguages) : items;
      // Stamp company name on each (Greenhouse fills its own; Ashby/Lever do not),
      // plus the portals ENTRY the row was fetched for (`_entry`): the snapshot
      // carry-over (R-12, CAR-91) must match the failed set against the entry,
      // never against `source` — a failed entry named "Lever" used to keep
      // every successfully-rescanned company's lever-source rows.
      const withCo = ordered.map((i) => ({
        ...i,
        company: i.company || c.name,
        _entry: c.name,
        // CAR-180 — stated years for the years_min filter and the #/scan
        // badge; undefined when the description states no gating figure.
        // L262-R3 — skipped entirely when years_min is not configured.
        ...(yearsMinConfigured ? { yearsMin: statedYearsMin(i) } : {}),
      }));
      log('stdout', `  ✓ ${label} ${c._api.type.padEnd(10)} ${items.length} jobs`);
      // CAR-256 (parent parity, #6636) — ANY partial read (the canonical
      // `truncated` shape or a legacy `<name>Truncated|Incomplete` tag) lands
      // in partialSources so the scan result says which boards were read only
      // partly. The two tags this file names explicitly keep their richer
      // stderr lines below; every other shape gets the generic parent
      // fragment. A source that stopped early is reported, never silently
      // presented as the whole board.
      const truncation = boardTruncation(items);
      if (truncation) {
        partialSources.push({ company: String(c.name ?? c._api.url), ...truncation });
        if (!items.ultiproTruncated && !items.peoplesoftIncomplete) {
          log('stderr', `  ⚠ ${describeTruncation(String(c.name ?? ''), truncation)} — board only partly read`);
        }
      }
      // A source that stopped early tags its result array; say so instead of
      // presenting a partial board as the whole one. The flag itself is lost
      // by the withCo map below, so the company name is collected for the
      // scan result (`truncatedSources`).
      if (items.ultiproTruncated) {
        log('stderr', `  ⚠ ${c.name}: result list truncated at the page cap — some postings were not read`);
      }
      const ps = items.peoplesoftIncomplete;
      if (ps) {
        const of = ps.reportedTotal != null ? ` of ${ps.reportedTotal}` : '';
        log('stderr', `  ⚠ ${c.name}: listing incomplete (${ps.reason || 'stopped early'}; ${ps.collected ?? withCo.length}${of} read)`);
      }
      return withCo;
    } catch (e) {
      fetchFailures += 1;
      failedCompanies.add(c.name);
      errors.push(`${c.name}: ${e.message}`);
      log('stderr', `  ✗ ${label} ${c._api.type.padEnd(10)} ${e.message}`);
      // v1.80.0 — a permanent 404/410 quarantines the source so future scans
      // skip it (until the retry window lapses).
      if (quarantineOn && isPermanentFailure(e)) {
        quarantineAdd(quarantine, c.name, { url: c._api.url, status: e.status || 'HTTP 404/410' });
        quarantineChanged = true;
      }
      // CAR-256 (#6675) — a transient failure is queued for ONE retry after
      // the sweep; a 4xx will not change in seconds and is not. The pMap
      // index rides along so the retry result replaces the sweep's slot.
      if (isTransientFetchError(e)) transientFailures.push({ company: c, idx });
      return [];
    } finally {
      if (countProgress) onProgress(++progressDone, withApi.length);
    }
  };
    // CAR-256 (parent parity, #6675) — the post-sweep retry pass. Failed
    // boards run one at a time (the contention that broke them is gone), the
    // sweep's error for a board that recovers is removed and it leaves the
    // failed set, so its rows count normally and the R-12 snapshot guard no
    // longer keeps its old rows. One extra attempt per board, never a second.
    const retryTransientFailures = async (rows) => {
      if (transientFailures.length === 0 || signal?.aborted) return;
      const pending = transientFailures.splice(0);
      log('stderr', `scan: retrying ${pending.length} board(s) that failed on a transient error, one at a time: ${pending.map((p) => p.company.name).join(', ')}`);
      for (const { company, idx } of pending) {
        if (signal?.aborted) break;
        const prefix = `${company.name}: `;
        const at = errors.findIndex((e) => typeof e === 'string' && e.startsWith(prefix));
        if (at !== -1) errors.splice(at, 1);
        fetchFailures -= 1;
        failedCompanies.delete(company.name);
        if (transientRetryGapMs > 0) await new Promise((r) => setTimeout(r, transientRetryGapMs));
        // The retry's own catch re-records the error (and can quarantine) if
        // it fails again; no third attempt is ever queued.
        rows[idx] = await fetchCompany(company, { countProgress: false });
      }
    };
    const fetchAllBoards = async () => {
      const rows = await pMap(withApi, (c, idx) => fetchCompany(c, { idx }), scanConcurrency);
      await retryTransientFailures(rows);
      return rows;
    };
    const rows = await fetchAllBoards();
    const stats = boardCacheStats();
    if (stats && (stats.hits > 0 || stats.revalidated > 0)) {
      const parts = [];
      if (stats.hits > 0) {
        parts.push(`reused ${stats.hits} board response${stats.hits === 1 ? '' : 's'} fetched in the last ${formatBoardCacheWindow(cacheTtlMs)}`);
      }
      if (stats.revalidated > 0) {
        parts.push(`rechecked ${stats.revalidated} older board response${stats.revalidated === 1 ? '' : 's'} with If-None-Match`);
      }
      log('stderr', `scan: ${parts.join(', and ')}. Set CAREER_OPS_HTTP_CACHE=0 to always download.`);
    }
    return rows;
  });

  // Persist quarantine changes (skip in dry-run, like the other scan writes).
  if (quarantineOn && writeFiles && quarantineChanged) {
    saveQuarantine(pruneQuarantine(quarantine));
  }

  const perCo = fetchedPerCo.map((list) => (Array.isArray(list) ? list : []));
  // CAR-256 (#6636) — the bare names every snapshot consumer already reads;
  // `partialSources` above carries the reason + counts.
  const truncatedSources = partialSources.map((p) => p.company);
  const allRaw = perCo.flat();
  // v1.33.0 (WS4) — optional portals.yml location_filter. No key → pass-all.
  const locOk = buildLocationFilter(portals.location_filter);
  // v1.75.0 (#974) — optional content_filter on a posting's description/snippet.
  // No key → pass-all; only sources that ship a description are affected.
  const contentOk = buildContentFilter(portals.content_filter);
  // CAR-180 — optional portals.yml `years_min: N` (jd-years.mjs, upstream
  // #6154): a posting whose JD states a required overall minimum BELOW N is
  // cut and recorded as an observational `skipped_experience` history row
  // (never a pin: change years_min and it comes back). No key → pass-all,
  // and a posting with no stated figure always passes.
  const yearsOk = buildYearsMinFilter(portals.years_min);
  // Optional portals.yml `skip_tiers` (top-level list): drop postings whose
  // seniority tier is in the list. No key → pass-all.
  const tierOk = buildTierFilter(portals.skip_tiers);
  // Apply title filter (positive must match, negative must NOT match)
  // + location + tier + content filters, and stamp `_boosted` for any title containing a
  // seniority_boost keyword. The boost stamp is INFORMATIONAL — it
  // doesn't filter; the SPA uses it to surface a badge so users see why
  // a row is ranked higher.
  const basePasses = (j) => titleOk(j.title)
    && locOk(j.location)
    && tierOk(j.title)
    && contentOk(j.description ?? j.snippet);
  const passes = (j) => basePasses(j) && yearsOk(j.yearsMin);
  // v1.80.0 — per-source cap (0 = unlimited), applied AFTER the filters so a
  // source contributes up to N MATCHING jobs; capping the raw list first let
  // irrelevant rows eat the quota.
  let cappedAway = 0;
  const yearsSkipped = [];
  const matched = perCo.flatMap((list) => {
    const kept = list.filter((j) => {
      if (!basePasses(j)) return false;
      if (!yearsOk(j.yearsMin)) { yearsSkipped.push(j); return false; }
      return true;
    });
    if (maxPerSource > 0 && kept.length > maxPerSource) {
      cappedAway += kept.length - maxPerSource;
      return kept.slice(0, maxPerSource);
    }
    return kept;
  });
  const removedTitle = allRaw.length - matched.length - cappedAway - yearsSkipped.length;
  // Within-run dedup on the normalised URL: the same posting reached twice
  // (two queries, a tracking-parameter variant) is ONE row — otherwise it was
  // appended to pipeline/history twice and read as a repost later. Behind
  // dedup_include_language (CAR-223, #4789) a same-key row passes as a
  // language version none of the rows this run kept was in; an
  // unknown-language candidate keeps the duplicate.
  const runKeys = new Set();
  const runVariants = new Map();
  const unique = matched.filter((j) => {
    const key = normalizeUrl(j.url) || j.url;
    if (runKeys.has(key)) {
      if (!dedupIncludeLanguage) return false;
      return isUnseenLanguageVersion(runVariants.get(key),
        { languages: languageFormsForDedup(j.language), title: j.title },
        siblingsByUrl.get(key));
    }
    runKeys.add(key);
    recordUrlVariant(runVariants, key, languageFormsForDedup(j.language), j.title);
    return true;
  });
  const runDup = matched.length - unique.length;
  const filtered = unique
    .map((j) => {
      let out = j;
      if (boosts.length && j.title) {
        const t = j.title.toLowerCase();
        const hit = boosts.find((b) => t.includes(b));
        if (hit) out = { ...out, _boosted: true, _boostedBy: hit };
      }
      if (trustOn) {
        const v = trust(out);
        out = { ...out, _trustScore: v.score, _trustLevel: v.level, _trustFlags: v.flags };
      }
      return out;
    });
  // v1.84.0 — re-apply cooldown. Drop roles
  // at companies you applied to recently, so the scan stays focused on NEW
  // openings. Config: config/profile.yml::re_apply_windows. Off when unset.
  const cooldownToday = new Date().toISOString().slice(0, 10);
  const cooldownFilter = buildCooldownFilter(loadReApplyWindows(PATHS.profile), cooldownToday);
  const afterCooldown = filtered.filter((j) => !cooldownFilter(j).skip);
  const cooldownSkipped = filtered.length - afterCooldown.length;
  // Cross-run dedup on the normalised URL. Behind dedup_include_language
  // (CAR-223, #4789) a seen URL key passes only as a language version of that
  // posting no seen row was in — the seen rows' languages and titles come
  // from collectSeenUrls, the candidate's siblings from this run's own fetch.
  // An unknown-language candidate keeps the duplicate.
  const fresh = afterCooldown.filter((j) => {
    const key = normalizeUrl(j.url) || j.url;
    if (!seen.has(key)) return true;
    if (!dedupIncludeLanguage) return false;
    return isUnseenLanguageVersion(seenVariants.get(key),
      { languages: languageFormsForDedup(j.language), title: j.title },
      siblingsByUrl.get(key));
  });
  const dup = afterCooldown.length - fresh.length;

  log('stdout', '');
  log('stdout', '━'.repeat(60));
  log('stdout', `Total found:           ${allRaw.length}`);
  log('stdout', `Filtered by title:     ${removedTitle} removed`);
  if (yearsSkipped.length) log('stdout', `Filtered by experience: ${yearsSkipped.length} removed (years_min: ${portals.years_min})`);
  if (cappedAway) log('stdout', `Per-source cap:        ${cappedAway} removed (max ${maxPerSource} per source)`);
  if (runDup) log('stdout', `Duplicate in run:      ${runDup} skipped`);
  if (cooldownSkipped) log('stdout', `Cooldown skipped:      ${cooldownSkipped} (re-applied roles, re_apply_windows)`);
  log('stdout', `Already-seen dedup:    ${dup} skipped`);
  log('stdout', `New offers added:      ${fresh.length}`);
  log('stdout', '━'.repeat(60));

  // CAR-256 (parent parity, upstream #6636) — the run-summary call-out for
  // boards read only PARTLY (page cap, 429, fetch error): postings beyond the
  // cut were never scanned, so the run must say so rather than present the
  // partial board as the whole one. The per-board fetch-time ⚠ lines above can
  // drown in the concurrent sweep; this block is the one that survives.
  if (partialSources.length > 0) {
    log('stderr', `⚠️  ${partialSources.length} board(s) only PARTLY read — postings beyond the cut were not scanned:`);
    for (const t of partialSources) log('stderr', `   • ${describeTruncation(t.company, t)}`);
    log('stderr', `   For a page cap, raise max_pages on the entry or narrow its search; a fetch error or rate limit that repeats points at the board's host.`);
  }

  if (writeFiles) {
    if (fresh.length) {
      await appendToPipeline(fresh);
      appendToHistory(fresh);
      log('stdout', `→ Appended ${fresh.length} URLs to data/pipeline.md`);
    }
    // CAR-180 — postings the years_min filter cut are recorded as
    // observational parent-format rows (status column last, like the parent's
    // skipped_location/skipped_age), so the user can see what was dropped and
    // why it can come back: every reader treats the status as non-seeing.
    if (yearsSkipped.length) {
      const recorded = appendSkippedHistory(yearsSkipped);
      if (recorded) log('stdout', `→ Recorded ${recorded} skipped_experience row(s) in data/scan-history.tsv`);
    }
    // Save BOTH fresh (new) and filtered (all matching positives, even dups)
    // so the UI can show a richer list to browse.
    // R-12 — never replace the snapshot with an emptier one: an aborted scan or
    // one where every source failed keeps the previous snapshot, and a
    // single-company scan merges into it instead of replacing it.
    const keepReason = snapshotKeepReason({
      aborted: signal?.aborted,
      attempted: withApi.length + detectFailures,
      failed: fetchFailures + detectFailures,
    });
    if (keepReason) {
      log('stderr', `last-scan snapshot kept (${keepReason})`);
    } else {
      // R-12 (CAR-91) — full-replace carry-over: a source this run FAILED to
      // scan contributed nothing, so its previous snapshot rows survive instead
      // of silently vanishing (one timed-out board among fifty used to erase
      // that board's rows on every scan). Successfully-scanned sources are
      // replaced; single-company scans keep their merge semantics unchanged.
      // Review round 2 — carried rows re-run THIS run's filters (the config
      // may have changed since their run) and are never re-flagged as fresh.
      const saveOpts = companyName
        ? { mergeCompanies: withApi.map((c) => c.name) }
        : (failedCompanies.size
          ? { keepSources: [...failedCompanies], carriedCheck: (j) => passes(j) && !cooldownFilter(j).skip }
          : {});
      await saveLastScan({
        kind: 'en',
        when: new Date().toISOString(),
        fresh,
        filtered: afterCooldown, // v1.76.0 — full matched set, no cap; #/scan paginates client-side (v1.84.0: post-cooldown)
        errors,
        truncatedSources, // v1.242.0 — sources whose board hit the page cap
        partialSources, // CAR-256 (#6636) — WHY each was partial (reason + counts)
      }, saveOpts);
    }
  }

  if (errors.length) {
    log('stderr', `\n${errors.length} error(s):`);
    errors.slice(0, 5).forEach((e) => log('stderr', '  · ' + e));
    if (errors.length > 5) log('stderr', `  …and ${errors.length - 5} more`);
  }

  return {
    counts: { raw: allRaw.length, removedTitle, yearsSkipped: yearsSkipped.length, cooldownSkipped, dup, fresh: fresh.length, skipped, runDup, capped: cappedAway },
    fresh,
    errors,
    truncatedSources,
    partialSources,
  };
}

// FULL-R1 (finding 2) — the scanner's own append raced routes/pipeline.mjs's
// withFileLock(PATHS.pipeline)-protected POST/DELETE/restore (and, until
// the same change, auto-pipeline's markPipelineRejected): the hourly timer
// finishing a scan while a user added or rejected a URL could silently
// drop one side's update. Sharing the SAME lock key here serializes every
// pipeline.md read-modify-write regardless of which writer runs it.
async function appendToPipeline(jobs) {
  await withFileLock(PATHS.pipeline, async () => {
    let content = '';
    try { content = readFileSync(PATHS.pipeline, 'utf8'); } catch {}
    let updated = content;
    // v1.75.0 (#1098) — normalize external URLs (drop smuggled whitespace/newlines)
    // before they reach the fenced pipeline list.
    // v1.84.0 (#1017) — persist compensation as an optional trailing column
    // (`url | <salary>`); web-ui jobs already carry a display salary string.
    for (const j of jobs) updated = addPipelineUrl(updated, normalizeScanUrl(j.url), { comp: j.salary });
    mkdirSync(PATHS.pipeline.replace(/\/[^/]+$/, ''), { recursive: true });
    atomicWrite(PATHS.pipeline, updated);
  });
}
function appendToHistory(jobs) {
  mkdirSync(PATHS.scanHistory.replace(/\/[^/]+$/, ''), { recursive: true });
  // v1.75.0 (#1098) — sanitize every TSV cell so an external company/title with
  // a newline can't inject a row and a leading =+-@ can't become a formula.
  // CAR-256 (#6597) — a 7th `closes_at` cell (the posting's close day,
  // YYYY-MM-DD, or empty) is appended to every newer row: the day GET
  // /api/pipeline joins back onto the queue for the #/pipeline close-date
  // chip. Rows written before the column stop short at 6 cells; readers
  // index positionally, so an appended column never moves an old field.
  const lines = jobs.map((j) =>
    [new Date().toISOString().slice(0, 10), j.source, j.id, j.company, j.title, normalizeScanUrl(j.url), closesAtIso(j.closesAt) || closesAtIso(j)]
      .map(sanitizeTsvField)
      .join('\t')
  );
  appendFileSync(PATHS.scanHistory, lines.join('\n') + '\n');
}

/**
 * CAR-180 — record postings the years_min filter cut as parent-format
 * observational rows: `url  date  portal  title  company  skipped_experience`.
 * Parent shape, not the web-ui row above, because the meaning is the parent's
 * (a recorded cut, not a seen posting): `loadSeenUrls` already skips these
 * statuses, so the URL can come back the moment the threshold drops, and
 * detect-reposts ignores every non-`added` parent row. One row per posting —
 * a URL already carrying skipped_experience is never appended again.
 * @param {Array<{url: string, source?: string, title?: string, company?: string}>} jobs
 * @returns {number} rows actually appended
 */
function appendSkippedHistory(jobs) {
  let existing = '';
  try { existing = readFileSync(PATHS.scanHistory, 'utf8'); } catch {}
  const recorded = new Set(
    existing.split('\n')
      .map((line) => line.split('\t'))
      .filter((cells) => /^https?:\/\//i.test(cells[0] || '') && String(cells[5] || '').trim() === 'skipped_experience')
      .map((cells) => normalizeUrl(cells[0]) || cells[0])
  );
  const rows = [];
  const seen = new Set();
  for (const j of jobs) {
    const url = normalizeScanUrl(j.url);
    const key = normalizeUrl(url) || url;
    if (recorded.has(key) || seen.has(key)) continue;
    seen.add(key);
    rows.push([
      url,
      new Date().toISOString().slice(0, 10),
      sanitizeTsvField(String(j.source ?? '')),
      sanitizeTsvField(String(j.title ?? '')),
      sanitizeTsvField(String(j.company ?? '')),
      'skipped_experience',
    ].join('\t'));
  }
  if (!rows.length) return 0;
  mkdirSync(PATHS.scanHistory.replace(/\/[^/]+$/, ''), { recursive: true });
  appendFileSync(PATHS.scanHistory, rows.join('\n') + '\n');
  return rows.length;
}

const LAST_SCAN_PATH = PATHS.applications.replace(/applications\.md$/, 'last-scan.json');

/**
 * R-12 — why a finished scan must NOT overwrite the saved snapshot, or null
 * when it may. Shared by both scanners.
 * @param {{ aborted?: boolean, attempted: number, failed: number }} run
 * @returns {string|null}
 */
export function snapshotKeepReason({ aborted, attempted, failed }) {
  if (aborted) return 'scan aborted';
  // CAR-91 — a scan that attempted nothing (missing/empty portals.yml, every
  // company quarantined, RU `sources: []`) must not be mistaken for a
  // legitimate empty result: overwriting would wipe the snapshot #/scan reads.
  if (attempted === 0) return 'nothing scanned';
  if (failed >= attempted) return 'every source failed';
  return null;
}

/** The snapshot file, or the empty shape when it is missing, corrupt or not an object (`null`). */
function readLastScanFile() {
  try {
    const raw = JSON.parse(readFileSync(LAST_SCAN_PATH, 'utf8'));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  } catch {}
  return { en: null, ru: null };
}

/**
 * Fold a partial (single-company) scan into the previous snapshot: rows of the
 * scanned companies are replaced wholesale — a role the company closed must
 * drop out — and every other company's rows are kept.
 * @param {any} old previous snapshot for this kind
 * @param {any} payload this run's snapshot
 * @param {string[]} companies names of the companies this run scanned
 */
function mergeSnapshot(old, payload, companies) {
  const lc = (v) => String(v ?? '').toLowerCase();
  const key = (j) => normalizeUrl(j.url) || j.url;
  const newRows = [...(payload.fresh || []), ...(payload.filtered || [])];
  // A source may stamp its own spelling of the employer (Greenhouse
  // company_name), so this run's row companies count as "scanned" too.
  const scanned = new Set([...companies, ...newRows.map((j) => j && j.company)].map(lc).filter(Boolean));
  const newKeys = new Set(newRows.map(key));
  const keep = (rows) => (Array.isArray(rows) ? rows : [])
    .filter((j) => j && typeof j === 'object' && !newKeys.has(key(j)) && !scanned.has(lc(j.company)));
  return {
    ...payload,
    fresh: [...keep(old.fresh), ...(payload.fresh || [])],
    filtered: [...keep(old.filtered), ...(payload.filtered || [])],
  };
}

/**
 * R-12 (CAR-91) — full-replace carry-over: rows whose entry/source belongs to
 * a source this run FAILED to scan survive into the new snapshot — a failed
 * source contributes no information, so a successful scan of the other sources
 * must not silently erase its rows (one timed-out board among fifty used to
 * drop that board's rows on every scan; hh.ru 451-ing from a non-RU IP wiped
 * every hh row). Rows of every successfully-scanned source are replaced
 * wholesale, exactly as a plain full replace would: a role the company closed
 * must still drop out.
 * Review round 2 — two corrections to the matching and the carry itself:
 *   · EN (`bySource` unset) matches the failed set against the portals ENTRY
 *     the row was fetched for (`_entry`, stamped at fetch time; `company` for
 *     rows saved by an older build) and NEVER against `source` — the failed
 *     set holds entry names, so a failed entry named "Lever" used to keep
 *     every successfully-rescanned company's lever-source rows, and a failed
 *     company name kept rows that came from a succeeded aggregator. RU
 *     (`bySource`) rows carry no entry; they match on `source` only.
 *   · Carried rows are HISTORY, not new offers: they re-run the current run's
 *     filters through `opts.carriedCheck` (cooldown, title/location — the
 *     config may have changed since their run) and land in `filtered` only,
 *     never in `fresh`, so they are never re-appended to pipeline/history or
 *     re-shown as new. Rows are deduped by canonical URL (old `fresh` is a
 *     subset of old `filtered` — both were carried before, doubling each row).
 *   Review round 3 (CAR-92 r2 / M1) — the carry is bounded and marked. A
 *     source that fails EVERY scan would re-carry its rows forever (closed
 *     vacancies never dropping), so each carried row is stamped — `carried:
 *     true`, `carriedSince` (the snapshot `when` of the run that FIRST
 *     carried it, preserved) and `carriedCount` — and a row is retired once
 *     it has been carried MAX_CARRIED_RUNS times or its first-carry stamp
 *     ages past MAX_CARRIED_AGE_DAYS days (both overridable through opts for
 *     tests). Carried rows are appended AFTER this run's rows (current offers
 *     first in #/scan) and carry the `carried` flag so the UI can badge them.
 * @param {any} old previous snapshot for this kind
 * @param {any} payload this run's snapshot
 * @param {string[]} failed companies / sources this run failed to scan
 * @param {{ bySource?: boolean, carriedCheck?: (job: any) => boolean,
 *           carryMaxRuns?: number, carryMaxAgeDays?: number }} [opts]
 *   bySource        — match the failed set against `j.source` (RU) instead of the entry stamp
 *   carriedCheck    — re-run the current filters on a carried row; false drops it
 *   carryMaxRuns    — retire a row after this many carries (default MAX_CARRIED_RUNS)
 *   carryMaxAgeDays — retire a row first carried longer than this many days ago
 *                     (default MAX_CARRIED_AGE_DAYS)
 */
export const MAX_CARRIED_RUNS = 5;
export const MAX_CARRIED_AGE_DAYS = 30;

function keepFailedSourcesSnapshot(old, payload, failed, opts = {}) {
  const lc = (v) => String(v ?? '').toLowerCase();
  const key = (j) => normalizeUrl(j.url) || j.url;
  const failedSet = new Set((Array.isArray(failed) ? failed : []).map(lc).filter(Boolean));
  const matchesFailure = opts.bySource
    ? (j) => failedSet.has(lc(j.source))
    : (j) => failedSet.has(lc(j._entry ?? j.company));
  const newKeys = new Set([...(payload.fresh || []), ...(payload.filtered || [])].map(key));
  const check = typeof opts.carriedCheck === 'function' ? opts.carriedCheck : null;
  const maxRuns = Number.isFinite(opts.carryMaxRuns) ? opts.carryMaxRuns : MAX_CARRIED_RUNS;
  const maxAgeMs = (Number.isFinite(opts.carryMaxAgeDays) ? opts.carryMaxAgeDays : MAX_CARRIED_AGE_DAYS) * 86400_000;
  const now = Date.now();
  // Stamp + retire. The age clock reads the PRESERVED first-carry stamp: a
  // row carried for the first time is stamped (old.when — an upper bound on
  // the row's age) and survives; from its second carry on, a stamp older than
  // maxAgeMs retires it.
  const stamp = (j) => {
    const count = (Number(j.carriedCount) || 0) + 1;
    if (count > maxRuns) return null;
    if (j.carriedSince) {
      const since = Date.parse(j.carriedSince);
      if (Number.isFinite(since) && now - since > maxAgeMs) return null;
    }
    return { ...j, carried: true, carriedSince: j.carriedSince || old.when, carriedCount: count };
  };
  const carry = (rows) => (Array.isArray(rows) ? rows : [])
    .filter((j) => j && typeof j === 'object'
      && matchesFailure(j)
      && !newKeys.has(key(j))
      && (!check || check(j) !== false))
    .map(stamp)
    .filter(Boolean);
  const seenKeys = new Set();
  const carried = [...carry(old.fresh), ...carry(old.filtered)].filter((j) => {
    const k = key(j);
    if (seenKeys.has(k)) return false;
    seenKeys.add(k);
    return true;
  });
  return {
    ...payload,
    fresh: [...(payload.fresh || [])],
    filtered: [...(payload.filtered || []), ...carried],
  };
}

/**
 * Persist one scanner's snapshot into data/last-scan.json (tmp + rename, so a
 * crash mid-write can't truncate the file the #/scan page reads).
 * @param {{ kind: 'en'|'ru', fresh: any[], filtered: any[] } & Record<string, any>} payload
 * @param {{ mergeCompanies?: string[], keepSources?: string[], bySource?: boolean, carriedCheck?: (job: any) => boolean }} [opts]
 *   mergeCompanies — single-company scan: fold into the previous snapshot
 *   keepSources    — full replace carrying over failed sources' rows (R-12, CAR-91)
 *   bySource       — keepSources match on `source` (RU) instead of the entry stamp
 *   carriedCheck   — re-run the current filters on carried rows (see keepFailedSourcesSnapshot)
 */
export async function saveLastScan(payload, opts = {}) {
  // FULL-R1 (finding 2) — this is a read-modify-write (read the whole file,
  // merge/replace ONE kind, write the whole file back), so the lock must
  // wrap the ENTIRE transaction, not just the final write: two snapshot
  // writers (today: EN then RU sequentially within one scan request,
  // guarded by routes/scan.mjs's single-flight slot; a future caller might
  // not be) must never both read the pre-update file and then each write
  // back a version missing the other's kind.
  await withFileLock(LAST_SCAN_PATH, async () => {
    const prev = readLastScanFile();
    const old = prev[payload.kind];
    prev[payload.kind] = Array.isArray(opts.mergeCompanies) && old && typeof old === 'object'
      ? mergeSnapshot(old, payload, opts.mergeCompanies)
      : Array.isArray(opts.keepSources) && opts.keepSources.length && old && typeof old === 'object'
        ? keepFailedSourcesSnapshot(old, payload, opts.keepSources, { bySource: opts.bySource, carriedCheck: opts.carriedCheck })
        : payload;
    mkdirSync(LAST_SCAN_PATH.replace(/\/[^/]+$/, ''), { recursive: true });
    atomicWrite(LAST_SCAN_PATH, JSON.stringify(prev, null, 2));
  });
}

export function loadLastScan() {
  return readLastScanFile();
}
