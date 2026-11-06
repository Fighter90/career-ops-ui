# SPEC — CAR-247: `#/stats` → «Детали» tab (currencies, periods, search, facets, charts, drill-down)

- **Status:** Done
- **Release:** next minor (feature branch `feat/car247-stats-detail`, no PR — orchestrator integrates)
- **Related:** Linear CAR-247 (owner request 2026-11-05 — "статистика очень корявая"), CAR-120 (real-data Overview, the tab pattern), v1.140.0 salary table + per-year/per-month toggle, v1.243.0 `TrackerStages` fold in stats, `docs/adr/` — none new
- **Owner:** career-ops-ui owner (Сергей); subagent executes

## Goal

A genuinely detailed statistics tab: every application and scanned posting as one
filterable dataset — salary in a chosen display currency, a time-period selector,
text search, facet chips (country / status / source), four SVG charts, and a
sortable drill-down table that deep-links into `#/reports`.

## Context

CAR-247 (Linear, priority Urgent) asks for detail the current tabs do not give:
salary across currencies (one selector, all charts honor it), period selection
(month / quarter / year / all), search + facet chips "как на #/scan", charts
(salary range by country, status funnel, monthly dynamics, top companies), and a
sortable per-vacancy drill-down into reports. Existing surfaces to keep working:
Overview / My pipeline / Target-role trend / Funnel / Lifetime / Patterns /
Upskill / Rejection / Market. The aggregator `RoleStats` (`public/js/lib/role-stats.js`)
already parses salaries to USD and aggregates by country — extend it, do not duplicate.

## Scope

- `public/js/lib/role-stats.js` — new pure, testable API:
  `DISPLAY_CURRENCIES`, `USD_TO_DISPLAY` (static, documented approximate rates),
  `convertFromUsd(v, cur)` (unknown currency → USD passthrough — never a guess),
  `buildEntries(trackerRows, jobs, deps)` (tracker rows + scan postings joined by
  normalized URL; a matched posting enriches its tracked row instead of
  duplicating), `filterPeriod(entries, period, now)` (month=30d / quarter=91d /
  year=365d / all; undated entries excluded from bounded windows — honest, not
  guessed), `searchEntries` (company/role substring, case-insensitive),
  `facetCounts` / `facetFilter` (within a group OR, across groups AND),
  `salaryRangeByCountry` (min/median/max USD per country, top-N by count),
  `monthlyCounts`, `topCompanies`, `stageFunnelCounts`.
- `public/js/views/stats.js` — a new **«Детали» (Details)** tab in the existing
  tab strip (after «Target-role trend», before the funnel tabs): controls card
  (search input, currency + period selects, Reset), facet chip rows built from
  the data, KPI cards, four inline-SVG charts (existing `barChart` + a new
  range-chart for salary min/median/max, `direction=ltr` pinned, localized
  `aria-label`s), and a sortable drill-down table (company cell is a real link →
  `#/reports/{slug}` when the row carries a report). Currency + period persist to
  `localStorage` (`career-ops-ui:statsCurrency` / `career-ops-ui:statsPeriod`).
  Pure helpers stay in `role-stats.js`; the view is thin wiring.
- `public/css/stats-detail.css` (NEW) + one `<link>` in `public/index.html`.
- i18n: `statsd.*` keys + `stats.hint.details` appended at the END of all 19
  `i18n-dict.*.js` files (another branch adds `kanban.*` keys to the same files —
  orchestrator resolves + regenerates the snapshot).
- `tests/fixtures/i18n-dict.snapshot.json` regenerated from the live dicts.
- Tests: `tests/stats-detail.test.mjs` (unit, red-first), `tests/playwright-stats-detail.mjs` (browser),
  registered in `package.json` `test:e2e:browser`.

## Out of scope

- **No server changes.** Everything aggregates client-side over the existing
  `GET /api/tracker`, `GET /api/tracker/stages`, `GET /api/scan-results` payloads
  (the established tab pattern) — `server/lib/routes/stats.mjs` untouched.
- No live FX rates — the USD→display table is static and documented (same caveat
  the existing salary charts already carry: "approximate FX").
- No `kanban.css` touch (another agent owns it).
- No splitting of `stats.js` (already >800 LOC — known debt; this change adds
  thin wiring only, heavy logic lives in `role-stats.js`; the extraction point is
  marked with a `TODO: split by concern`).
- No per-role target matching in the Details dataset (search covers roles).

## Acceptance criteria

1. Currency math: `convertFromUsd(1000,'EUR') === 920`, `RUB → 90000`, unknown
   currency → USD passthrough, `null` → `null` — `tests/stats-detail.test.mjs`.
2. Period boundaries: month/quarter/year edges inclusive at exactly N days,
   undated entries excluded from bounded periods, `all` includes everything.
3. Facets: within-group OR, cross-group AND; chip counts computed from the
   period+search-filtered set; Reset clears.
4. `buildEntries`: tracker rows keep score/status/reportPath; postings carry
   parsed salary/country/source; a URL-matched posting enriches its tracked row
   (no duplicate row).
5. Playwright: currency switch changes the salary figure glyph (USD `$` → EUR `€`)
   and persists across reload; period=last month drops older entries; search
   narrows the drill-down table; chips AND-compose — `tests/playwright-stats-detail.mjs`.
6. i18n: every new key present ×19 (`tests/i18n-coverage.test.mjs`),
   snapshot regenerated (`tests/i18n-locale-files.test.mjs`).
7. Full gates green: `npm run test:ci` 0 fail; `npm run test:e2e:browser` 0 fail.

## Plan

1. Unit tests red (`tests/stats-detail.test.mjs`) → `role-stats.js` extensions green.
2. View tab + CSS + index.html registration.
3. i18n ×19 + snapshot regeneration.
4. Playwright suite + `package.json` registration.
5. Gates: `node --test tests/stats-detail.test.mjs tests/role-stats.test.mjs tests/stats-*.test.mjs tests/i18n-coverage.test.mjs tests/i18n-locale-files.test.mjs` → `npm run test:ci` → `npm run test:e2e:browser`.

## Risks and invariants touched

- **R-07 (CSP-safe DOM)** — all rendering via `UI.el`; charts follow the CAR-120
  SVG pattern (`role="img"`/`group`, `aria-label`, `direction=ltr`); no raw HTML.
- **R-08 (i18n parity)** — new keys appended ×19; the coverage gate fails on a miss.
- **a11y** — search input `aria-label`ed; chips are `<button aria-pressed>`; the
  table company cell is a real `<a>` (keyboard-operable drill-down, no mouse-only
  row handler without it).
- **Snapshot determinism** — regenerated from the live assembled dict, never hand-edited.

## Verification

Filled with the REAL output (branch `feat/car247-stats-detail`, 2026-11-06):

| Gate | Command | Result |
|---|---|---|
| Targeted unit set | `node --test tests/stats-detail.test.mjs tests/role-stats.test.mjs tests/stats-*.test.mjs tests/i18n-coverage.test.mjs tests/i18n-locale-files.test.mjs tests/i18n-no-latin-leaks.test.mjs tests/i18n-alias.test.mjs` | **101 pass / 0 fail** |
| Full unit gate | `npm run test:ci` | **7624 pass / 0 fail / 3 skipped** (was 7602 — +22 stats-detail unit tests) |
| Browser suite | `npm run test:e2e:browser` | **188 pass / 0 fail / 1 skipped** (the pre-existing opt-in layout-capture skip; includes the new `tests/playwright-stats-detail.mjs`, 6 specs) |
| Coverage ratchet | `npm run test:coverage:gate` | exit 0 — mean **98.54 % line / 90.38 % branch** (ratchet 98.53/90.35 held) |
| Workflow evals | `node evals/workflow/run.mjs` | **16 pass / 0 fail / 1 skip** |
| i18n parity | `tests/i18n-coverage.test.mjs` + snapshot | 29 new keys ×19 locales; snapshot regenerated from the live dict (1850 keys) |

Notes:
- `tests/help-hint.test.mjs` tab-count gate moved 9 → 10 (the new Details tab ships its own `?` hint, `stats.hint.details`).
- The map/scan-redesign failures seen mid-session were the transient Playwright browser-cache wipe (documented PROGRESS.md hazard) — reinstalled chromium, all green.
- Another agent's `kanban.*` keys share the dict files: every statsd block is APPENDED at file end; the orchestrator merges + regenerates the snapshot.
