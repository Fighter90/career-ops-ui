# SPEC — CAR-236: prod read-path latency, findings + probe

- **Status:** Done (investigation; fixes are future work)
- **Release:** unplanned (analysis branch `analysis/car236-perf-probe`, no PR by design)
- **Related:** Linear CAR-236 (prod pages like `#/pipeline` load slowly on resumecraft.ru); v1.238.3 report-list cache (`store.mjs`); `#/pipeline` mount fan-out (CAR-116)
- **Owner:** maintainer (picks which ranked fix ships first)

## Goal

Name exactly why `#/pipeline` (and friends) are slow on a big dataset
(1000+ reports, large `applications.md`), and leave a probe that measures it
against prod so each fix has a before/after number.

## Context

All read paths below are **synchronous, on the event loop** — a slow read
blocks every other request, which is why slowness is page-wide rather than
per-endpoint. The dataset: `reports/` grows unboundedly (auto-pipeline writes
one per evaluation), `jds/` grows with it, `data/scan-history.tsv` grows every
scan, `applications.md` accumulates rows forever.

What each hot GET does per request:

| Endpoint | Reads/parses per request | Cached? |
|---|---|---|
| `GET /api/pipeline` | `readFileSync(pipeline.md)` + `parsePipeline` (one fence regex) | no, but file is small — cheap |
| `GET /api/tracker` | `readFileSync(applications.md)` + `parseApplications` (full re-parse) | **no** |
| `GET /api/tracker/stages` | `templates/states.yml` read + yaml parse | yes — memoized (`states.mjs:39,51,83`) + `Cache-Control: max-age=300` (`tracker.mjs:89`) — **not a latency source** |
| `GET /api/reports` | `readdir` + N×(open+fstat+close); on a cache miss: full file read + `parseReportHeader` | headers cached by mtime+size (`store.mjs:35`), **directory walk is not** |
| `GET /api/dashboard` | ALL of the above three (`safeReadApps` + `safeReadPipeline` + `safeListReports`) | only the report headers |
| `GET /api/map/jobs` | pipeline.md + **full text of every `jds/*.md`** + **full `scan-history.tsv`** + `safeReadApps` **again** + a **per-row uncached full-report read+parse** when the row has no `url` column | **no** (self-admitted: `map.mjs:48`) |

Client fan-out: the `#/pipeline` mount fires **5 GETs in parallel**
(`pipeline.js:1084-1092`) — `/api/pipeline`, `/api/tracker`, `/api/tracker/stages`,
`/api/reports`, `/api/map/jobs` — and its `refresh()` re-fires the first two
(`pipeline.js:1002-1007`). So the page's latency = its slowest member, and
`applications.md` is parsed **twice per mount** (tracker + map/jobs).

## Top-3 latency sources

### 1. `GET /api/map/jobs` — reads every JD capture + full scan history + re-parses the tracker, all sync, per request

`server/lib/routes/map.mjs:140-158`:

- `readJds()` (`map.mjs:69-73`) reads the **full text** of every `jds/*.md`,
  then `buildLocationIndex` uses only `text.slice(0, 1500)` (`map.mjs:61`) —
  tens of MB of wasted I/O per request on a busy install.
- `read(PATHS.scanHistory)` (`map.mjs:144`) loads the whole TSV (unbounded
  growth) and re-splits every line (`map.mjs:53-58`).
- `safeReadApps()` **again** (`map.mjs:153`) — the tracker's second full
  parse within the same `#/pipeline` mount.
- Worst per-row case: a tracker row without a `url` column triggers
  `reportUrl(reportPath)` (`map.mjs:76-81`, called at `:154`) — a
  **synchronous full-report read + the entire ~15-regex `parseReportHeader`
  suite, bypassing the v1.238.3 header cache**, once per such row per request.

The code itself admits it: `// ponytail: rebuilt per request … cache by mtime
if it gets slow` (`map.mjs:48`). On prod this fires on **every** `#/pipeline`
view, not just `#/map`.

### 2. `GET /api/reports` — the O(n) sync directory walk returns, and every miss parses ~15 regex passes over the whole report

`server/lib/store.mjs:38-75` (`safeListReports`), called by `/api/reports`
(`reports.mjs:38-40`) and `/api/dashboard` (`health.mjs:232`):

- **Warm hits still cost 3 syscalls per report per request**
  (`openSync`+`fstatSync`+`closeSync`, `store.mjs:49-51`) plus a
  `{ ...hit.entry }` shallow copy (`store.mjs:64`) — 1000+ reports ≈ 3000+
  sync syscalls on the event loop every time the list is fetched.
- The **final sorted array is rebuilt every call** (`store.mjs:74`), with a
  `new Date()` allocated per comparison.
- Any **new or changed report is a synchronous full-file read + header parse
  inline with the request** — and new reports appear exactly when the user is
  watching pages load (auto-pipeline during/after a scan). The v1.238.3
  comment records the pre-cache measurement: ~3.7 s per `/api/reports` or
  `/api/dashboard` at "hundreds of reports" (`store.mjs:31-34`); each cold
  entry still pays a slice of that.
- `parseReportHeader` (`parsers.mjs:901-986`) runs **unanchored full-text
  regex matches** for the 6 EN labels (`parsers.mjs:926-936`), a Machine
  Summary search + up to 6 `yamlValue` matches (`parsers.mjs:740-758`), two
  `String(src).split('\n')` allocations (`parsers.mjs:770,789`), bold/prose
  fallbacks over the whole body — a no-match report pays every pass over its
  full 10-40 KB.
- Payload: every list entry carries `scoreEvidence` + `confidenceGaps` +
  `file` + `mtime` (spread at `store.mjs:64`) — hundreds of KB of JSON for
  1000+ reports, though `#/pipeline` uses it only for enrichment chips and
  `/api/dashboard` needs only `reports[0]` (`health.mjs:257`).

### 3. `GET /api/tracker` (legacy shape) — full `applications.md` re-parse + full-history JSON, no cache, hit repeatedly per navigation

`server/lib/routes/tracker.mjs:43-47`: **without query params the route
returns ALL rows** (`res.json({ rows: all })`) — the pagination/funnel params
it already supports (`tracker.mjs:36-65`) are never sent by the SPA
(`tracker.js:28`, `pipeline.js:1086`, `stats.js:316,577`, `llm-page-kit.js:389`).
Underneath, `safeReadApps` (`store.mjs:14-20`) re-reads and re-parses the file
on **every** call — `parseApplications` walks every line char-by-char
(`splitUnescaped`, `parsers.mjs:12-30`) plus 2 regex replaces per cell
(`parsers.mjs:65`) — and `/api/map/jobs` calls it a second time per
`#/pipeline` mount. On a 1000-row tracker the cost is parse × N calls + a
full-history payload × N calls.

## Recommended fixes, ranked (endpoint → cache/invalidation)

1. **`/api/map/jobs`** — biggest win, smallest blast radius:
   - Cache `buildLocationIndex` keyed on (scan-history mtime+size, `jds/`
     readdir signature); invalidate the same way `reportCache` does.
   - Read only the first ~2 KB of each JD (the index consumes 1500 bytes) —
     `openSync`+`read` with a byte cap, never `readFileSync` whole.
   - Drop the per-row `reportUrl()` full-report parse: resolve report URLs
     once via the cached `safeListReports()` map instead.
   - Stop returning the full tracker payload — `#/pipeline` already has it
     from `/api/tracker`; gate the `tracker` array behind a query flag only
     `#/map` sends.
2. **`/api/reports` (+ `/api/dashboard`)** — cache the final sorted list:
   - Memoize the sorted array keyed on a cheap directory signature (readdir
     names + sizes, or a coarse interval invalidation of 1-2 s); a write
     through `reports.mjs` POST or auto-pipeline bumps it.
   - Add `?page&pageSize` (tracker precedent) and/or a `?fields=summary` trim
     (drop `scoreEvidence`/`confidenceGaps`/`file` from list entries);
     `/api/dashboard` should request `limit=1`-shaped data instead of the full
     list it only uses `reports[0]` from (`health.mjs:257`).
   - Keep the per-file header cache as-is — the miss path is fine, the
     every-request stat walk and re-sort are what to remove.
3. **`/api/tracker`** — cache the parse, use the existing pagination:
   - Memoize `parseApplications` by `applications.md` mtime+size (the exact
     `reportCache` pattern); every write site already goes through
     `withFileLock`/`atomicWrite`, so a shared mtime-keyed reader is safe.
   - Have the SPA send `?page&pageSize` where it only needs counts/first page
     (`pipeline.js` overview needs the funnel, not the rows) — the route
     already answers `{rows: slice, total, funnel}` (`tracker.mjs:53-65`).

Non-goals: `/api/tracker/stages` needs nothing (memoized + browser-cached);
`GET /api/pipeline` is cheap; `/api/reports/:slug` returning the full markdown
is per-slug and intentional.

## Verification

- Probe (committed in the same change):
  `BASE_URL=https://<prod> BASIC_USER=… BASIC_PASS=… node scripts/remote-qa/perf-probe.mjs`
  — markdown table + per-endpoint verdict, >2000 ms → SLOW. Run before/after
  each ranked fix; the SLOW lines are the acceptance check.
- Sanity run of the probe verified locally against a throwaway server
  (artificial 50 ms delay on one endpoint lands in the table, exit codes 0/1
  behave) and against a dead port (clean ERR table, exit 1).
