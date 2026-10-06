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
import { readFileSync, existsSync, writeFileSync, appendFileSync, mkdirSync, renameSync } from 'node:fs';
import yaml from 'js-yaml';
import { PATHS } from './paths.mjs';
import { addPipelineUrl } from './parsers.mjs';
import { sanitizeTsvField, normalizeScanUrl } from './scan-sanitize.mjs';
import { normalizeUrl } from './url-key.mjs';
import { buildLocationFilter, buildContentFilter, buildTitleFilter, cleanStringList } from './location-filter.mjs';
import { buildTrustValidator } from './trust-validator.mjs';
import { buildTierFilter } from './classify-tier.mjs';
import { loadQuarantine, isQuarantined, quarantineAdd, pruneQuarantine, saveQuarantine, isPermanentFailure, RETRY_AFTER_DAYS } from './scan-quarantine.mjs';
import { makeTimeoutFetch } from './fetch-timeout.mjs';
import { loadReApplyWindows, buildCooldownFilter } from './cooldown.mjs';
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

// v1.13.0 — fetchers sourced from the registry. Any new adapter added to
// ALL_ADAPTERS automatically becomes callable here. Looked up per scan (not
// snapshotted at import) so the fetcher always belongs to the adapter that
// detectApi just resolved.
const fetcherFor = (id) => ALL_ADAPTERS.find((a) => a.id === id)?.fetch;

function loadPortals() {
  if (!existsSync(PATHS.portals)) return {};
  return yaml.load(readFileSync(PATHS.portals, 'utf8')) || {};
}

// Parent-format scan-history rows (`url  first_seen  portal  title  company
// status …`) whose status only RECORDS that a posting was cut by the location
// or age filter. They are observations, not "seen": the parent never lets them
// pin a URL, so a posting that later passes (a widened allow list, a re-dated
// listing) must still come through here too.
const OBSERVATIONAL_HISTORY_STATUSES = new Set(['skipped_location', 'skipped_age']);

function isObservationalHistoryRow(line) {
  const cells = line.split('\t');
  return /^https?:\/\//i.test(cells[0] || '')
    && OBSERVATIONAL_HISTORY_STATUSES.has(String(cells[5] || '').trim());
}

/**
 * Every URL already known — scan-history.tsv, pipeline.md, applications.md —
 * normalised with url-key so tracking-parameter variants collapse. Shared by
 * the EN and RU scanners.
 * @returns {Set<string>}
 */
export function loadSeenUrls() {
  const seen = new Set();
  for (const p of [PATHS.scanHistory, PATHS.pipeline, PATHS.applications]) {
    let text = '';
    try { text = readFileSync(p, 'utf8'); } catch { continue; }
    for (const line of text.split('\n')) {
      if (p === PATHS.scanHistory && isObservationalHistoryRow(line)) continue;
      for (const m of line.matchAll(/https?:\/\/\S+/g)) seen.add(normalizeUrl(m[0]) || m[0]);
    }
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
  // Blank / non-string entries dropped: "" is a substring of every title.
  const boosts = cleanStringList(tf.seniority_boost).map((s) => s.toLowerCase());
  // v1.76.0 — optional trust validation. Off unless
  // `trust_filter:` is present and not disabled. Annotates each job with
  // _trustScore/_trustLevel/_trustFlags so the #/scan table can badge low-trust
  // postings — it NEVER drops a job.
  const trust = buildTrustValidator(portals.trust_filter);
  const trustOn = !!(portals.trust_filter && portals.trust_filter.enabled !== false);
  const seen = loadSeenUrls();

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
  // Detection runs per company, inside its own catch: an adapter that throws on
  // one misconfigured entry is that entry's error, not the end of the scan.
  const withApiAll = [];
  let detectFailures = 0;
  for (const c of companies) {
    let failed = false;
    const recordError = (msg) => {
      failed = true;
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
  const fetchedPerCo = await pMap(withApi, async (c) => {
    if (signal?.aborted) return [];
    const fetcher = fetcherFor(c._api.type);
    const label = String(c.name ?? '').padEnd(28);
    try {
      // v1.75.0 — thread the resolved company entry through so config-driven
      // sources (ibm / arbeitsagentur / glints / jobstreet) can read their
      // `<provider>:` block. URL-detected ATS fetchers ignore the extra opt.
      const items = await fetcher(c._api.url, { fetchImpl, signal, company: c });
      // Stamp company name on each (Greenhouse fills its own; Ashby/Lever do not)
      const withCo = items.map((i) => ({ ...i, company: i.company || c.name }));
      log('stdout', `  ✓ ${label} ${c._api.type.padEnd(10)} ${items.length} jobs`);
      // A source that stopped early tags its result array; say so instead of
      // presenting a partial board as the whole one.
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
      errors.push(`${c.name}: ${e.message}`);
      log('stderr', `  ✗ ${label} ${c._api.type.padEnd(10)} ${e.message}`);
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

  const perCo = fetchedPerCo.map((list) => (Array.isArray(list) ? list : []));
  const allRaw = perCo.flat();
  // v1.33.0 (WS4) — optional portals.yml location_filter. No key → pass-all.
  const locOk = buildLocationFilter(portals.location_filter);
  // v1.75.0 (#974) — optional content_filter on a posting's description/snippet.
  // No key → pass-all; only sources that ship a description are affected.
  const contentOk = buildContentFilter(portals.content_filter);
  // Optional portals.yml `skip_tiers` (top-level list): drop postings whose
  // seniority tier is in the list. No key → pass-all.
  const tierOk = buildTierFilter(portals.skip_tiers);
  // Apply title filter (positive must match, negative must NOT match)
  // + location + tier filters, and stamp `_boosted` for any title containing a
  // seniority_boost keyword. The boost stamp is INFORMATIONAL — it
  // doesn't filter; the SPA uses it to surface a badge so users see why
  // a row is ranked higher.
  const passes = (j) => titleOk(j.title)
    && locOk(j.location)
    && tierOk(j.title)
    && contentOk(j.description ?? j.snippet);
  // v1.80.0 — per-source cap (0 = unlimited), applied AFTER the filters so a
  // source contributes up to N MATCHING jobs; capping the raw list first let
  // irrelevant rows eat the quota.
  let cappedAway = 0;
  const matched = perCo.flatMap((list) => {
    const kept = list.filter(passes);
    if (maxPerSource > 0 && kept.length > maxPerSource) {
      cappedAway += kept.length - maxPerSource;
      return kept.slice(0, maxPerSource);
    }
    return kept;
  });
  const removedTitle = allRaw.length - matched.length - cappedAway;
  // Within-run dedup on the normalised URL: the same posting reached twice
  // (two queries, a tracking-parameter variant) is ONE row — otherwise it was
  // appended to pipeline/history twice and read as a repost later.
  const runKeys = new Set();
  const unique = matched.filter((j) => {
    const key = normalizeUrl(j.url) || j.url;
    if (runKeys.has(key)) return false;
    runKeys.add(key);
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
  const fresh = afterCooldown.filter((j) => !seen.has(normalizeUrl(j.url) || j.url));
  const dup = afterCooldown.length - fresh.length;

  log('stdout', '');
  log('stdout', '━'.repeat(60));
  log('stdout', `Total found:           ${allRaw.length}`);
  log('stdout', `Filtered by title:     ${removedTitle} removed`);
  if (cappedAway) log('stdout', `Per-source cap:        ${cappedAway} removed (max ${maxPerSource} per source)`);
  if (runDup) log('stdout', `Duplicate in run:      ${runDup} skipped`);
  if (cooldownSkipped) log('stdout', `Cooldown skipped:      ${cooldownSkipped} (re-applied roles, re_apply_windows)`);
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
      saveLastScan({
        kind: 'en',
        when: new Date().toISOString(),
        fresh,
        filtered: afterCooldown, // v1.76.0 — full matched set, no cap; #/scan paginates client-side (v1.84.0: post-cooldown)
        errors,
      }, companyName ? { mergeCompanies: withApi.map((c) => c.name) } : {});
    }
  }

  if (errors.length) {
    log('stderr', `\n${errors.length} error(s):`);
    errors.slice(0, 5).forEach((e) => log('stderr', '  · ' + e));
    if (errors.length > 5) log('stderr', `  …and ${errors.length - 5} more`);
  }

  return {
    counts: { raw: allRaw.length, removedTitle, cooldownSkipped, dup, fresh: fresh.length, skipped, runDup, capped: cappedAway },
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
  // v1.84.0 (#1017) — persist compensation as an optional trailing column
  // (`url | <salary>`); web-ui jobs already carry a display salary string.
  for (const j of jobs) updated = addPipelineUrl(updated, normalizeScanUrl(j.url), { comp: j.salary });
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

/**
 * R-12 — why a finished scan must NOT overwrite the saved snapshot, or null
 * when it may. Shared by both scanners.
 * @param {{ aborted?: boolean, attempted: number, failed: number }} run
 * @returns {string|null}
 */
export function snapshotKeepReason({ aborted, attempted, failed }) {
  if (aborted) return 'scan aborted';
  if (attempted > 0 && failed >= attempted) return 'every source failed';
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
 * Persist one scanner's snapshot into data/last-scan.json (tmp + rename, so a
 * crash mid-write can't truncate the file the #/scan page reads).
 * @param {{ kind: 'en'|'ru', fresh: any[], filtered: any[] } & Record<string, any>} payload
 * @param {{ mergeCompanies?: string[] }} [opts] merge instead of replace
 */
export function saveLastScan(payload, opts = {}) {
  const prev = readLastScanFile();
  const old = prev[payload.kind];
  prev[payload.kind] = Array.isArray(opts.mergeCompanies) && old && typeof old === 'object'
    ? mergeSnapshot(old, payload, opts.mergeCompanies)
    : payload;
  mkdirSync(LAST_SCAN_PATH.replace(/\/[^/]+$/, ''), { recursive: true });
  const tmp = `${LAST_SCAN_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(prev, null, 2));
  renameSync(tmp, LAST_SCAN_PATH);
}

export function loadLastScan() {
  return readLastScanFile();
}
