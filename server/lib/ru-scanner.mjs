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
import { makeTimeoutFetch } from './fetch-timeout.mjs';
import { saveLastScan, MAX_STORED_RESULTS } from './en-scanner.mjs';
import { buildLocationFilter, buildContentFilter } from './location-filter.mjs';

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

export function loadConfig() {
  let portals = {};
  if (existsSync(PATHS.portals)) {
    try {
      portals = yaml.load(readFileSync(PATHS.portals, 'utf8')) || {};
    } catch {}
  }
  const ru = portals.russian_portals || {};
  const titleFilter = portals.title_filter || {};

  const queries = ru.queries || DEFAULT_QUERIES;
  const negative = (titleFilter.negative || DEFAULT_NEGATIVE).map((s) => s.toLowerCase());
  // v1.12.0 — surface seniority_boost on the regional scanner too.
  // Lowercased once here for cheap per-row matching downstream.
  const boosts = (titleFilter.seniority_boost || []).map((s) => String(s).toLowerCase());
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
    sources: ru.sources || [...RU_CONFIG_KEYS],
    area: ru.area ?? 113, // Russia
    perPage: ru.per_page ?? 50,
    onlyRemote: ru.only_remote ?? false,
    // v1.33.0 (WS4 / parent #570) — optional portals.yml location_filter.
    // Top-level key (same as parent scan.mjs), not under russian_portals.
    locationFilter: portals.location_filter || null,
    // v1.75.0 (#974) — optional content_filter (top-level key, like parent).
    contentFilter: portals.content_filter || null,
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
  const seen = new Set();
  const tryRead = (p) => {
    try {
      return readFileSync(p, 'utf8');
    } catch {
      return '';
    }
  };
  // scan-history.tsv: columns include the URL — match http(s)
  const scanHist = tryRead(PATHS.scanHistory);
  for (const m of scanHist.matchAll(/https?:\/\/\S+/g)) seen.add(m[0]);
  // pipeline.md
  const pipeline = tryRead(PATHS.pipeline);
  for (const m of pipeline.matchAll(/https?:\/\/\S+/g)) seen.add(m[0]);
  // applications.md (already-tracked offers)
  const apps = tryRead(PATHS.applications);
  for (const m of apps.matchAll(/https?:\/\/\S+/g)) seen.add(m[0]);
  return seen;
}

function passesNegative(title, negativeKeywords) {
  const t = (title || '').toLowerCase();
  return !negativeKeywords.some((n) => t.includes(n));
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

  const allFound = [];
  const errors = [];
  // Track repeated source-level failures (e.g., 10x hh.ru 403) — show once.
  const sourceFailures = {};
  let hhDisabled = false;

  let qDone = 0;                    // v1.63.2 — determinate % progress
  for (const q of cfg.queries) {
    if (signal?.aborted) {
      log('stderr', `aborted — stopping after "${q}" was about to run`);
      break;
    }
    log('stdout', `▸ "${q}"`);
    const results = await runQuery(q, cfg, fetchImpl, errors, sourceFailures, hhDisabled, log, signal);
    log('stdout', `  → ${results.length} hits`);
    onProgress(++qDone, cfg.queries.length);
    allFound.push(...results);
    // First hh.ru 403 → disable for rest of run + log once. hh.ru is scraped
    // from its public website now; a 403 means the site served an anti-bot
    // challenge (rare), not a geo/API block.
    if (sourceFailures.hh?.geoBlocked && !hhDisabled) {
      hhDisabled = true;
      log('stderr', '  ⚠ hh.ru disabled for this run (website returned HTTP 403)');
      log('stderr', '    hh.ru/search/vacancy served an anti-bot challenge — retry later.');
    }
  }

  // Dedup within this batch
  const uniq = new Map();
  for (const j of allFound) uniq.set(j.url, j);
  const flat = [...uniq.values()];

  // Apply negative-filter + location-filter (parent #570 parity),
  // then stamp boost flags. Boost is informational only — it doesn't
  // change which rows are returned, only marks the boosted ones so the
  // SPA can render a "⬆ boosted" badge on them.
  const locOk = buildLocationFilter(cfg.locationFilter);
  const contentOk = buildContentFilter(cfg.contentFilter);
  const filteredRaw = flat.filter((j) => passesNegative(j.title, cfg.negative)
    && locOk(j.location)
    && contentOk(j.description ?? j.snippet));
  const filtered = applyBoostStamps(filteredRaw, cfg.boosts);
  const removedNeg = flat.length - filtered.length;
  const fresh = filtered.filter((j) => !seen.has(j.url));
  const dup = filtered.length - fresh.length;

  log('stdout', '');
  log('stdout', '━'.repeat(60));
  log('stdout', `Total found:           ${flat.length}`);
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
    saveLastScan({
      kind: 'ru',
      when: new Date().toISOString(),
      fresh,
      filtered: filtered.slice(0, MAX_STORED_RESULTS), // cap display (not pipeline/history)
      errors,
    });
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
    counts: { raw: flat.length, removedNeg, dup, fresh: fresh.length },
    fresh,
    errors,
  };
}

async function runQuery(query, cfg, fetchImpl, errors, sourceFailures, hhDisabled, log, signal) {
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
