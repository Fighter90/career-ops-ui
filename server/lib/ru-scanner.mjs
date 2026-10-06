/**
 * RU portal scanner — orchestrates every Russian source the registry
 * knows about (v1.29.0: hh.ru + Habr Career + Trudvsem + GetMatch +
 * GeekJob).
 *
 * Reads search keywords + filters from portals.yml (or sensible defaults).
 * Filters by negative keywords. Dedups against data/scan-history.tsv.
 * Appends new URLs to data/pipeline.md and the scan-history TSV.
 *
 * Designed to be invoked from `/api/stream/scan?source=regional` (or
 * `source=both`) and stream live progress via an `onLog(stream, line)`
 * callback. v1.18.0 retired the legacy `/api/stream/scan-ru` alias.
 *
 * v1.29.0 — added Trudvsem (API), GetMatch (HTML), GeekJob (HTML).
 * The default `sources` list pulled in from
 * `server/lib/sources/registry.mjs::RU_CONFIG_KEYS` so adding a sixth
 * source = one entry in the registry + one new adapter file. The
 * dispatcher loop below uses `RU_DISPATCH` to map config-key → adapter.
 */
import { readFileSync, existsSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import yaml from 'js-yaml';
import { PATHS } from './paths.mjs';
import { searchHH } from './sources/hh.mjs';
import { searchHabr } from './sources/habr.mjs';
import { searchTrudvsem } from './sources/trudvsem.mjs';
import { searchGetMatch } from './sources/getmatch.mjs';
import { searchGeekJob } from './sources/geekjob.mjs';
import { RU_CONFIG_KEYS } from './sources/registry.mjs';
import { addPipelineUrl } from './parsers.mjs';
import { sanitizeTsvField, normalizeScanUrl } from './scan-sanitize.mjs';
import { normalizeUrl } from './url-key.mjs';
import { makeTimeoutFetch } from './fetch-timeout.mjs';
import { saveLastScan, snapshotKeepReason, loadSeenUrls as loadSeenUrlsShared } from './en-scanner.mjs';
import { buildLocationFilter, buildContentFilter, compileKeyword, compileKeywordList, foldAccents, cleanStringList } from './location-filter.mjs';
import { buildTierFilter } from './classify-tier.mjs';
import { buildTrustValidator } from './trust-validator.mjs';

/**
 * v1.29.0 — dispatch table from `russian_portals.sources[*]` key to its
 * adapter + display label + extra opts. ONE entry per RU adapter.
 * Adding a new source = adding an adapter file + one row here + one
 * row in `server/lib/sources/registry.mjs`. No changes to the
 * scanner's loop body.
 */
const RU_DISPATCH = {
  hh:       { label: 'hh.ru',       search: searchHH,       hhAware: true },
  habr:     { label: 'habr',        search: searchHabr },
  trudvsem: { label: 'trudvsem',    search: searchTrudvsem },
  getmatch: { label: 'getmatch',    search: searchGetMatch },
  geekjob:  { label: 'geekjob',     search: searchGeekJob },
};

/**
 * Default Russian-language search queries — used when portals.yml lacks a
 * russian_portals.queries section. Picked from typical hh.ru naming.
 */
const DEFAULT_QUERIES = [
  'Senior PHP',
  'PHP Symfony',
  'PHP Laravel',
  'Senior Go',
  'Golang Backend',
  'Backend Senior',
  'Tech Lead PHP',
  'Tech Lead Go',
];

const DEFAULT_NEGATIVE = [
  'junior', 'стажёр', 'стажер', 'младший', 'intern',
  'java', 'kotlin', 'scala', 'ruby', 'rails',
  'python', 'node.js',
  'ios', 'android', 'mobile',
  'frontend',
];

/**
 * A config list that falls back to `defaults` only when the key is ABSENT.
 * A bare string is one entry (YAML `queries: Senior Go` — iterating the string
 * scanned one query per character); blank / non-string entries are dropped
 * (a null in `title_filter.negative` used to throw on toLowerCase).
 * @param {unknown} value
 * @param {string[]} defaults
 */
function configList(value, defaults) {
  if (value == null) return defaults;
  if (typeof value === 'string') return cleanStringList([value]);
  return cleanStringList(value);
}

export function loadConfig() {
  let portals = {};
  if (existsSync(PATHS.portals)) {
    // A malformed portals.yml is an error, as it is for the EN scanner — not a
    // silent fallback to the built-in defaults (which scanned queries the user
    // never configured and hid the typo).
    try {
      portals = yaml.load(readFileSync(PATHS.portals, 'utf8')) || {};
    } catch (e) {
      throw new Error(`portals.yml: ${e.message}`);
    }
  }
  if (typeof portals !== 'object' || Array.isArray(portals)) portals = {};
  const ru = (portals.russian_portals && typeof portals.russian_portals === 'object') ? portals.russian_portals : {};
  const titleFilter = (portals.title_filter && typeof portals.title_filter === 'object') ? portals.title_filter : {};

  const queries = configList(ru.queries, DEFAULT_QUERIES);
  const negative = configList(titleFilter.negative, DEFAULT_NEGATIVE).map((s) => s.toLowerCase());
  // v1.12.0 — surface seniority_boost on the regional scanner too.
  // Lowercased once here for cheap per-row matching downstream.
  const boosts = cleanStringList(titleFilter.seniority_boost).map((s) => s.toLowerCase());
  // FIX-H3 — surface the most common config mistake: a query keyword
  // also appears in the negative list, so every result is filtered out.
  // Caller can ignore `warnings` if it doesn't care.
  const warnings = collisionWarnings(queries, negative);

  return {
    queries,
    negative,
    boosts,
    // v1.29.0 — default now pulls every RU source from the registry
    // (hh, habr, trudvsem, getmatch, geekjob). User's portals.yml
    // takes precedence if it explicitly lists `sources: [...]`.
    sources: configList(ru.sources, [...RU_CONFIG_KEYS]),
    area: ru.area ?? 113, // Russia
    perPage: ru.per_page ?? 50,
    onlyRemote: ru.only_remote ?? false,
    // v1.33.0 (WS4) — optional portals.yml location_filter.
    // Top-level key, not under russian_portals.
    locationFilter: portals.location_filter || null,
    // v1.75.0 (#974) — optional content_filter (top-level key, like parent).
    contentFilter: portals.content_filter || null,
    // v1.76.0 — optional trust_filter (top-level key, like parent v1.13.0).
    trustFilter: portals.trust_filter || null,
    // optional skip_tiers (top-level list): drop postings by seniority tier.
    skipTiers: portals.skip_tiers || null,
    warnings,
  };
}

/** Stamp `_boosted: true` on every job whose title contains a boost keyword. */
function applyBoostStamps(jobs, boosts) {
  if (!boosts.length) return jobs;
  return jobs.map((j) => {
    if (!j || !j.title) return j;
    const t = String(j.title).toLowerCase();
    const hit = boosts.find((b) => t.includes(b));
    return hit ? { ...j, _boosted: true, _boostedBy: hit } : j;
  });
}

/**
 * Detect query↔negative collisions that would silently zero out scan
 * results. Returns one warning string per offending overlap.
 */
function collisionWarnings(queries, negative) {
  const negSet = new Set(negative);
  const seen = new Set();
  const out = [];
  for (const q of queries) {
    for (const w of String(q).toLowerCase().split(/\s+/)) {
      if (!w || seen.has(w)) continue;
      if (negSet.has(w)) {
        out.push(`query "${q}" contains "${w}" which is in the negative list — results will be filtered out`);
        seen.add(w);
      }
    }
  }
  return out;
}

/**
 * Read every URL ever seen (across data/scan-history.tsv AND
 * data/pipeline.md AND data/applications.md) so we never re-add a known one.
 */
export function loadSeenUrls() {
  // One implementation for both scanners (en-scanner.mjs): normalised URLs, and
  // parent skipped_location / skipped_age history rows don't count as seen.
  return loadSeenUrlsShared();
}

// v1.76.0 — compile the negative list once (word-boundary matching for short
// ASCII acronyms, malformed-config guard). Cyrillic negatives have no 2-3 ASCII
// form, so they fall through to substring matching unchanged.
export function passesNegative(title, negativeMatchers) {
  // Accent-folded on both sides, like the EN title filter (parent aa453bd8).
  const t = foldAccents((title || '').toLowerCase());
  return !negativeMatchers.some((m) => m(t));
}

/**
 * Run a full RU scan. Calls onLog(stream, line) for each progress line.
 *
 * Options:
 *   writeFiles  — when true (default), append findings to pipeline.md +
 *                 scan-history.tsv. When false, do everything in-memory only
 *                 (used by tests + dry-run mode).
 *   onLog       — function(stream:'stdout'|'stderr', line:string)
 *   fetchImpl   — override for tests (default: global fetch)
 */
export async function runRuScan(opts = {}) {
  // REVIEW-B3 — `signal` lets the SSE handler abort in-flight fetches
  // when the client disconnects, instead of running every query to
  // completion and dropping the events on the floor.
  // fetchImpl defaults to a timeout-wrapped fetch so a stalled source
  // (e.g. api.hh.ru from a blocked IP) can't hang the whole scan (v1.63.0).
  const { writeFiles = true, onLog = () => {}, onProgress = () => {}, fetchImpl = makeTimeoutFetch(), signal } = opts;
  const cfg = loadConfig();
  const seen = loadSeenUrls();

  const log = (s, line) => onLog(s, line);
  log('stdout', '━'.repeat(60));
  log('stdout', `RU Portal Scan — ${new Date().toISOString().slice(0, 10)}`);
  log('stdout', '━'.repeat(60));
  // FIX-H3 — surface query/negative collisions before running so the user
  // can see WHY their PHP scan returns nothing instead of staring at "0 NEW".
  for (const w of cfg.warnings || []) log('stderr', `⚠ config: ${w}`);
  log('stdout', `Sources: ${cfg.sources.join(', ')}`);
  log('stdout', `Queries: ${cfg.queries.length}`);
  log('stdout', `Negatives: ${cfg.negative.length}`);
  log('stdout', `Already seen: ${seen.size} URLs`);
  log('stdout', '');

  // v1.227.5 — dedup by URL AS WE GO rather than accumulating every raw hit
  // and deduping at the end. Behaviourally identical (same iteration order,
  // same last-wins Map, so every reported count is unchanged),
  // but peak memory becomes the number of UNIQUE urls instead of the total
  // number of hits across all queries.
  //
  // That distinction is the whole bug: the query list is deliberately full of
  // near-synonyms ("Golang", "Go разработчик", "Golang разработчик",
  // "Senior Go"…), so the same vacancy comes back once per query and the raw
  // total is several times the unique count. At 21 queries the accumulated
  // array reached ~742MB locally; the server caps Node's heap at 490MB on its
  // 956MB of RAM, so the scan OOM-killed the process four times in one day.
  // It only started failing when the list grew 14 -> 21 queries.
  // Every URL ever seen this run — strings only, so the "Total found" count
  // survives without holding the objects behind it.
  const allUrls = new Set();
  // Only jobs that PASS the filters are retained. Descriptions are the bulk of
  // a job object and nearly all of them are filtered out at the end anyway, so
  // keeping the rejects until then is what actually blew the heap.
  const uniq = new Map();
  const errors = [];
  // Track repeated source-level failures (e.g., 10x hh.ru 403) — show once.
  const sourceFailures = {};
  // Per-call tally for the R-12 snapshot guard (every call failed → keep).
  const calls = { attempted: 0, failed: 0 };
  let hhDisabled = false;

  // Compiled once, then applied per query. Previously this ran after the loop,
  // which meant every raw hit had to be held until then.
  const locOk = buildLocationFilter(cfg.locationFilter);
  const contentOk = buildContentFilter(cfg.contentFilter);
  const tierOk = buildTierFilter(cfg.skipTiers);
  const negativeMatchers = compileKeywordList(cfg.negative, (kw) => compileKeyword(foldAccents(kw)));
  const passesAll = (j) => passesNegative(j.title, negativeMatchers)
    && locOk(j.location)
    && tierOk(j.title)
    && contentOk(j.description ?? j.snippet);

  let qDone = 0;                    // v1.63.2 — determinate % progress
  for (const q of cfg.queries) {
    if (signal?.aborted) {
      log('stderr', `aborted — stopping after "${q}" was about to run`);
      break;
    }
    log('stdout', `▸ "${q}"`);
    const results = await runQuery(q, cfg, fetchImpl, errors, sourceFailures, hhDisabled, log, signal, calls);
    log('stdout', `  → ${results.length} hits`);
    onProgress(++qDone, cfg.queries.length);
    for (const job of results) {
      // Keyed on the canonical (url-key) form, like the seen-set: a tracking-
      // parameter variant of one posting is the same posting, not a second row.
      const key = normalizeUrl(job.url) || job.url;
      allUrls.add(key);
      // Last-wins per URL, exactly as the old end-of-run dedup did: a later
      // duplicate that fails the filters must REMOVE an earlier one that passed,
      // or this would keep a row the previous implementation dropped.
      if (passesAll(job)) uniq.set(key, job);
      else uniq.delete(key);
    }
    // First hh.ru 403/451 → disable for rest of run + log once. hh.ru is
    // scraped from its public website now; a 403 means an anti-bot challenge
    // (rare), a 451 means the regional legal block hh.ru serves to
    // non-Russian IPs (since July 2026) — either way, retrying the remaining
    // queries against hh this run would only burn doomed requests.
    if (sourceFailures.hh?.geoBlocked && !hhDisabled) {
      hhDisabled = true;
      const failMsg = sourceFailures.hh.firstMessage || '';
      const isVpnCheck = /VPN-check/i.test(failMsg);
      const is451 = !isVpnCheck && /451/.test(failMsg);
      log('stderr', `  ⚠ hh.ru disabled for this run (${failMsg})`);
      log('stderr', isVpnCheck
        ? '    hh.ru flagged this network as a VPN/proxy and served its /vpncheeck interstitial — make sure traffic really exits via a residential IP (system-wide VPN/proxy off, not just the browser toggle), then rescan. See help §7.'
        : is451
          ? '    hh.ru geo-blocks requests from outside Russia (HTTP 451) — scan via a Russian IP / VPN exit node. See help §7.'
          : '    hh.ru/search/vacancy served an anti-bot challenge — retry later.');
    }
  }

  // Dedup and filtering both happened per-query above. `uniq` holds exactly the
  // survivors the old end-of-run pass produced; `allUrls.size` is the unique
  // total it used to report as `flat.length`. Boost stamps are informational
  // only — they don't change which rows are returned, just mark the boosted
  // ones so the SPA can render a "⬆ boosted" badge.
  const totalUnique = allUrls.size;
  let filtered = applyBoostStamps([...uniq.values()], cfg.boosts);
  // v1.76.0 — optional trust annotation. Off unless
  // `trust_filter:` is present and not disabled. Never drops a job.
  if (cfg.trustFilter && cfg.trustFilter.enabled !== false) {
    const trust = buildTrustValidator(cfg.trustFilter);
    filtered = filtered.map((j) => {
      const v = trust(j);
      return { ...j, _trustScore: v.score, _trustLevel: v.level, _trustFlags: v.flags };
    });
  }
  const removedNeg = totalUnique - filtered.length;
  const fresh = filtered.filter((j) => !seen.has(normalizeUrl(j.url) || j.url));
  const dup = filtered.length - fresh.length;

  log('stdout', '');
  log('stdout', '━'.repeat(60));
  log('stdout', `Total found:           ${totalUnique}`);
  log('stdout', `Filtered by negative:  ${removedNeg} removed`);
  log('stdout', `Already-seen dedup:    ${dup} skipped`);
  log('stdout', `New offers added:      ${fresh.length}`);
  log('stdout', '━'.repeat(60));

  if (writeFiles) {
    if (fresh.length) {
      appendToPipeline(fresh);
      appendToHistory(fresh);
      log('stdout', `→ Appended ${fresh.length} URLs to data/pipeline.md`);
    }
    // R-12 — an aborted run, or one where every source call failed, keeps the
    // previous snapshot instead of replacing it with an emptier one.
    const keepReason = snapshotKeepReason({ aborted: signal?.aborted, ...calls });
    if (keepReason) {
      log('stderr', `last-scan snapshot kept (${keepReason})`);
    } else {
      saveLastScan({
        kind: 'ru',
        when: new Date().toISOString(),
        fresh,
        filtered, // v1.76.0 — full matched set, no cap; #/scan paginates client-side
        errors,
      });
    }
  }

  // One concise summary line per failed source (instead of N repeats)
  if (Object.keys(sourceFailures).length) {
    log('stderr', '');
    for (const [src, info] of Object.entries(sourceFailures)) {
      log('stderr', `  ⚠ ${src}: ${info.count} queries failed (${info.firstMessage})`);
    }
  }

  return {
    cfg,
    counts: { raw: totalUnique, removedNeg, dup, fresh: fresh.length },
    fresh,
    errors,
  };
}

async function runQuery(query, cfg, fetchImpl, errors, sourceFailures, hhDisabled, log, signal, calls = { attempted: 0, failed: 0 }) {
  const out = [];
  // v1.29.0 — single loop over the dispatch table. Adding a new source =
  // adding an entry to RU_DISPATCH above. The scanner doesn't need to
  // know about hh.ru, Habr Career, Trudvsem, GetMatch, or GeekJob
  // individually past the registry.
  for (const key of cfg.sources) {
    const entry = RU_DISPATCH[key];
    if (!entry) {
      // Unknown config-key — log once for visibility and skip.
      log('stderr', `  ⚠ unknown source "${key}" in russian_portals.sources — skipped`);
      continue;
    }
    if (key === 'hh' && hhDisabled) continue;
    calls.attempted += 1;
    try {
      const items = await entry.search(query, {
        // Common opts every adapter accepts (extras like area/perPage are
        // honored by adapters that care about them, ignored by the rest).
        area: cfg.area,
        perPage: cfg.perPage,
        onlyRemote: cfg.onlyRemote,
        fetchImpl,
        signal,
      });
      out.push(...items);
      log('stdout', `    ${entry.label.padEnd(8)} ${items.length}`);
    } catch (e) {
      calls.failed += 1;
      const failKey = key;
      const firstFailure = !sourceFailures[failKey];
      sourceFailures[failKey] = sourceFailures[failKey] || {
        count: 0, firstMessage: e.message, geoBlocked: e.geoBlocked,
      };
      sourceFailures[failKey].count += 1;
      errors.push(`${entry.label} "${query}": ${e.message}`);
      // v1.63.2 — surface the first detailed failure per source to the
      // console (timeout / 403 / network), then suppress repeats (the
      // count keeps accumulating for the run summary).
      if (firstFailure) {
        const kind = e?.name === 'TimeoutError' ? 'timed out' : 'failed';
        log('stderr', `    ⚠ ${entry.label} ${kind}: ${e.message}`);
      }
    }
  }
  return out;
}

function appendToPipeline(jobs) {
  let content = '';
  try {
    content = readFileSync(PATHS.pipeline, 'utf8');
  } catch {}
  let updated = content;
  // v1.75.0 (#1098) — see en-scanner: normalize external URLs before write.
  for (const j of jobs) updated = addPipelineUrl(updated, normalizeScanUrl(j.url));
  mkdirSync(PATHS.pipeline.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(PATHS.pipeline, updated);
}

function appendToHistory(jobs) {
  mkdirSync(PATHS.scanHistory.replace(/\/[^/]+$/, ''), { recursive: true });
  // v1.75.0 (#1098) — sanitize every TSV cell (newline-row-injection + formula).
  const lines = jobs.map((j) =>
    [
      new Date().toISOString().slice(0, 10),
      j.source,
      j.id,
      j.company,
      j.title,
      normalizeScanUrl(j.url),
    ]
      .map(sanitizeTsvField)
      .join('\t')
  );
  appendFileSync(PATHS.scanHistory, lines.join('\n') + '\n');
}
