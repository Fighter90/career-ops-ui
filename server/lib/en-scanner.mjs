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
import { buildLocationFilter } from './location-filter.mjs';
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

function passesPositive(title, positives) {
  if (!positives.length) return true;
  const t = (title || '').toLowerCase();
  return positives.some((p) => t.includes(p.toLowerCase()));
}
function passesNegative(title, negatives) {
  const t = (title || '').toLowerCase();
  return !negatives.some((n) => t.includes(n.toLowerCase()));
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
  const { writeFiles = true, companyName, onLog = () => {}, fetchImpl = makeTimeoutFetch(), signal } = opts;
  const portals = loadPortals();
  const tf = portals.title_filter || {};
  const positives = tf.positive || [];
  const negatives = tf.negative || [];
  // v1.12.0 — surface seniority_boost from portals.yml. Canonical
  // career-ops.org schema documents this as keywords that "rank matching
  // positions higher without filtering" (third list alongside positive /
  // negative). The scanner persists a `_boosted` flag on every job whose
  // title contains a boost keyword (case-insensitive); SPA renders a
  // "⬆ boosted" badge on those rows so the user can see WHY they're
  // ranked higher.
  const boosts = (tf.seniority_boost || []).map((s) => String(s).toLowerCase());
  const seen = loadSeenUrls();

  let companies = portals.tracked_companies || portals.companies || [];
  companies = companies.filter((c) => c.enabled !== false);
  if (companyName) {
    companies = companies.filter((c) => c.name?.toLowerCase().includes(companyName.toLowerCase()));
  }

  const withApi = companies.map((c) => ({ ...c, _api: detectApi(c) })).filter((c) => c._api);
  const skipped = companies.length - withApi.length;

  const log = (s, line) => onLog(s, line);
  log('stdout', '━'.repeat(60));
  log('stdout', `EN Portal Scan — ${new Date().toISOString().slice(0, 10)}`);
  log('stdout', '━'.repeat(60));
  log('stdout', `Enabled companies:    ${companies.length}`);
  log('stdout', `With API:             ${withApi.length}`);
  log('stdout', `Without API (skipped):${skipped}`);
  log('stdout', `Already seen:         ${seen.size} URLs`);
  log('stdout', '');

  const errors = [];
  const fetchedPerCo = await pMap(withApi, async (c) => {
    if (signal?.aborted) return [];
    const fetcher = FETCHERS[c._api.type];
    try {
      const items = await fetcher(c._api.url, { fetchImpl, signal });
      // Stamp company name on each (Greenhouse fills its own; Ashby/Lever do not)
      const withCo = items.map((i) => ({ ...i, company: i.company || c.name }));
      log('stdout', `  ✓ ${c.name.padEnd(28)} ${c._api.type.padEnd(10)} ${items.length} jobs`);
      return withCo;
    } catch (e) {
      errors.push(`${c.name}: ${e.message}`);
      log('stderr', `  ✗ ${c.name.padEnd(28)} ${c._api.type.padEnd(10)} ${e.message}`);
      return [];
    }
  }, CONCURRENCY);

  const allRaw = fetchedPerCo.flat();
  // v1.33.0 (WS4 / parent #570) — optional portals.yml location_filter.
  // Mirrors the parent scan.mjs semantics exactly. No key → pass-all.
  const locOk = buildLocationFilter(portals.location_filter);
  // Apply title filter (positive must match, negative must NOT match)
  // + location filter, and stamp `_boosted` for any title containing a
  // seniority_boost keyword. The boost stamp is INFORMATIONAL — it
  // doesn't filter; the SPA uses it to surface a badge so users see why
  // a row is ranked higher.
  const filtered = allRaw
    .filter((j) => passesPositive(j.title, positives)
      && passesNegative(j.title, negatives)
      && locOk(j.location))
    .map((j) => {
      if (!boosts.length || !j.title) return j;
      const t = j.title.toLowerCase();
      const hit = boosts.find((b) => t.includes(b));
      return hit ? { ...j, _boosted: true, _boostedBy: hit } : j;
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
      filtered: filtered.slice(0, 500), // cap to keep file small
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
  for (const j of jobs) updated = addPipelineUrl(updated, j.url);
  mkdirSync(PATHS.pipeline.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(PATHS.pipeline, updated);
}
function appendToHistory(jobs) {
  mkdirSync(PATHS.scanHistory.replace(/\/[^/]+$/, ''), { recursive: true });
  const lines = jobs.map((j) =>
    [new Date().toISOString().slice(0, 10), j.source, j.id, j.company, j.title, j.url]
      .map((x) => String(x ?? '').replace(/\t/g, ' '))
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
