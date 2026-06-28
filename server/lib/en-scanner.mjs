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
import { readFileSync, existsSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import yaml from 'js-yaml';
import { PATHS } from './paths.mjs';
import { addPipelineUrl } from './parsers.mjs';
import { sanitizeTsvField, normalizeScanUrl } from './scan-sanitize.mjs';
import { buildLocationFilter, buildContentFilter, buildTitleFilter } from './location-filter.mjs';
import { buildTrustValidator } from './trust-validator.mjs';
import { loadQuarantine, isQuarantined, quarantineAdd, pruneQuarantine, saveQuarantine, isPermanentFailure, RETRY_AFTER_DAYS } from './scan-quarantine.mjs';
import { makeTimeoutFetch } from './fetch-timeout.mjs';
import { fetchGreenhouse } from './sources/greenhouse.mjs';
import { fetchAshby } from './sources/ashby.mjs';
import { fetchLever } from './sources/lever.mjs';
// v1.13.0 — adapter registry. detectApi() + FETCHERS below preserve the
// pre-registry API for backwards compatibility (any external caller of
// detectApi keeps working), but the registry is now the canonical truth.
// The next ATS we add goes only into ALL_ADAPTERS — no scanner change.
import { resolveAdapter, ALL_ADAPTERS } from './portals/registry.mjs';

const CONCURRENCY = 8;

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
export function detectApi(company) {
  const m = resolveAdapter(company);
  if (!m) return null;
  return { type: m.adapter.id, url: m.endpoint };
}

// v1.13.0 — FETCHERS table sourced from the registry. Any new adapter
// added to ALL_ADAPTERS automatically becomes callable here.
const FETCHERS = Object.fromEntries(ALL_ADAPTERS.map((a) => [a.id, a.fetch]));

function loadPortals() {
  if (!existsSync(PATHS.portals)) return {};
  return yaml.load(readFileSync(PATHS.portals, 'utf8')) || {};
}

function loadSeenUrls() {
  const seen = new Set();
  for (const p of [PATHS.scanHistory, PATHS.pipeline, PATHS.applications]) {
    try {
      const text = readFileSync(p, 'utf8');
      for (const m of text.matchAll(/https?:\/\/\S+/g)) seen.add(m[0]);
    } catch {}
  }
  return seen;
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
  const boosts = (tf.seniority_boost || []).map((s) => String(s).toLowerCase());
  // v1.76.0 — optional trust validation (parent career-ops v1.13.0). Off unless
  // `trust_filter:` is present and not disabled. Annotates each job with
  // _trustScore/_trustLevel/_trustFlags so the #/scan table can badge low-trust
  // postings — it NEVER drops a job.
  const trust = buildTrustValidator(portals.trust_filter);
  const trustOn = !!(portals.trust_filter && portals.trust_filter.enabled !== false);
  const seen = loadSeenUrls();

  let companies = portals.tracked_companies || portals.companies || [];
  companies = companies.filter((c) => c.enabled !== false);
  if (companyName) {
    companies = companies.filter((c) => c.name?.toLowerCase().includes(companyName.toLowerCase()));
  }

  const withApiAll = companies.map((c) => ({ ...c, _api: detectApi(c) })).filter((c) => c._api);
  const skipped = companies.length - withApiAll.length;

  // v1.80.0 — source quarantine. Skip sources that returned a permanent 404/410
  // on a prior run (self-healing: retried after RETRY_AFTER_DAYS). Can be turned
  // off with `scan_quarantine: false` in portals.yml.
  const quarantineOn = portals.scan_quarantine !== false;
  const quarantine = quarantineOn ? loadQuarantine() : { entries: {} };
  const withApi = quarantineOn ? withApiAll.filter((c) => !isQuarantined(quarantine, c.name)) : withApiAll;
  const quarantinedCount = withApiAll.length - withApi.length;
  let quarantineChanged = false;

  const log = (s, line) => onLog(s, line);
  log('stdout', '━'.repeat(60));
  log('stdout', `EN Portal Scan — ${new Date().toISOString().slice(0, 10)}`);
  log('stdout', '━'.repeat(60));
  log('stdout', `Enabled companies:    ${companies.length}`);
  log('stdout', `With API:             ${withApi.length}`);
  log('stdout', `Without API (skipped):${skipped}`);
  if (quarantinedCount) log('stdout', `Quarantined (skipped):${quarantinedCount} (dead 404/410 — auto-retried after ${RETRY_AFTER_DAYS} days)`);
  log('stdout', `Already seen:         ${seen.size} URLs`);
  log('stdout', '');

  const errors = [];
  let progressDone = 0;            // v1.63.2 — determinate % progress
  const fetchedPerCo = await pMap(withApi, async (c) => {
    if (signal?.aborted) return [];
    const fetcher = FETCHERS[c._api.type];
    try {
      // v1.75.0 — thread the resolved company entry through so config-driven
      // sources (ibm / arbeitsagentur / glints / jobstreet) can read their
      // `<provider>:` block. URL-detected ATS fetchers ignore the extra opt.
      const items = await fetcher(c._api.url, { fetchImpl, signal, company: c });
      // v1.80.0 — apply the per-source cap (0 = unlimited).
      const capped = maxPerSource > 0 ? items.slice(0, maxPerSource) : items;
      // Stamp company name on each (Greenhouse fills its own; Ashby/Lever do not)
      const withCo = capped.map((i) => ({ ...i, company: i.company || c.name }));
      const note = capped.length < items.length ? ` (capped from ${items.length})` : '';
      log('stdout', `  ✓ ${c.name.padEnd(28)} ${c._api.type.padEnd(10)} ${capped.length} jobs${note}`);
      return withCo;
    } catch (e) {
      errors.push(`${c.name}: ${e.message}`);
      log('stderr', `  ✗ ${c.name.padEnd(28)} ${c._api.type.padEnd(10)} ${e.message}`);
      // v1.80.0 — a permanent 404/410 quarantines the source so future scans
      // skip it (until the retry window lapses).
      if (quarantineOn && isPermanentFailure(e)) {
        quarantineAdd(quarantine, c.name, { url: c._api.url, status: e.status || 'HTTP 404/410' });
        quarantineChanged = true;
      }
      return [];
    } finally {
      onProgress(++progressDone, withApi.length);
    }
  }, CONCURRENCY);

  // Persist quarantine changes (skip in dry-run, like the other scan writes).
  if (quarantineOn && writeFiles && quarantineChanged) {
    saveQuarantine(pruneQuarantine(quarantine));
  }

  const allRaw = fetchedPerCo.flat();
  // v1.33.0 (WS4 / parent #570) — optional portals.yml location_filter.
  // Mirrors the parent scan.mjs semantics exactly. No key → pass-all.
  const locOk = buildLocationFilter(portals.location_filter);
  // v1.75.0 (#974) — optional content_filter on a posting's description/snippet.
  // No key → pass-all; only sources that ship a description are affected.
  const contentOk = buildContentFilter(portals.content_filter);
  // Apply title filter (positive must match, negative must NOT match)
  // + location filter, and stamp `_boosted` for any title containing a
  // seniority_boost keyword. The boost stamp is INFORMATIONAL — it
  // doesn't filter; the SPA uses it to surface a badge so users see why
  // a row is ranked higher.
  const filtered = allRaw
    .filter((j) => titleOk(j.title)
      && locOk(j.location)
      && contentOk(j.description ?? j.snippet))
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
  const removedTitle = allRaw.length - filtered.length;
  const fresh = filtered.filter((j) => !seen.has(j.url));
  const dup = filtered.length - fresh.length;

  log('stdout', '');
  log('stdout', '━'.repeat(60));
  log('stdout', `Total found:           ${allRaw.length}`);
  log('stdout', `Filtered by title:     ${removedTitle} removed`);
  log('stdout', `Already-seen dedup:    ${dup} skipped`);
  log('stdout', `New offers added:      ${fresh.length}`);
  log('stdout', '━'.repeat(60));

  if (writeFiles) {
    if (fresh.length) {
      appendToPipeline(fresh);
      appendToHistory(fresh);
      log('stdout', `→ Appended ${fresh.length} URLs to data/pipeline.md`);
    }
    // Save BOTH fresh (new) and filtered (all matching positives, even dups)
    // so the UI can show a richer list to browse.
    saveLastScan({
      kind: 'en',
      when: new Date().toISOString(),
      fresh,
      filtered, // v1.76.0 — full matched set, no cap; #/scan paginates client-side
      errors,
    });
  }

  if (errors.length) {
    log('stderr', `\n${errors.length} error(s):`);
    errors.slice(0, 5).forEach((e) => log('stderr', '  · ' + e));
    if (errors.length > 5) log('stderr', `  …and ${errors.length - 5} more`);
  }

  return {
    counts: { raw: allRaw.length, removedTitle, dup, fresh: fresh.length, skipped },
    fresh,
    errors,
  };
}

function appendToPipeline(jobs) {
  let content = '';
  try { content = readFileSync(PATHS.pipeline, 'utf8'); } catch {}
  let updated = content;
  // v1.75.0 (#1098) — normalize external URLs (drop smuggled whitespace/newlines)
  // before they reach the fenced pipeline list.
  for (const j of jobs) updated = addPipelineUrl(updated, normalizeScanUrl(j.url));
  mkdirSync(PATHS.pipeline.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(PATHS.pipeline, updated);
}
function appendToHistory(jobs) {
  mkdirSync(PATHS.scanHistory.replace(/\/[^/]+$/, ''), { recursive: true });
  // v1.75.0 (#1098) — sanitize every TSV cell so an external company/title with
  // a newline can't inject a row and a leading =+-@ can't become a formula.
  const lines = jobs.map((j) =>
    [new Date().toISOString().slice(0, 10), j.source, j.id, j.company, j.title, normalizeScanUrl(j.url)]
      .map(sanitizeTsvField)
      .join('\t')
  );
  appendFileSync(PATHS.scanHistory, lines.join('\n') + '\n');
}

const LAST_SCAN_PATH = PATHS.applications.replace(/applications\.md$/, 'last-scan.json');

export function saveLastScan(payload) {
  let prev = { en: null, ru: null };
  try {
    prev = JSON.parse(readFileSync(LAST_SCAN_PATH, 'utf8'));
  } catch {}
  prev[payload.kind] = payload;
  mkdirSync(LAST_SCAN_PATH.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(LAST_SCAN_PATH, JSON.stringify(prev, null, 2));
}

export function loadLastScan() {
  try {
    return JSON.parse(readFileSync(LAST_SCAN_PATH, 'utf8'));
  } catch {
    return { en: null, ru: null };
  }
}
