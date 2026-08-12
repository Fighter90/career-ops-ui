# QA REGRESSION PROMPT — career-ops-ui **v1.145.0** (a rebuildable chart)

User-reported UX request (no parent-sync). The `#/stats` **Target-role trend** tab gets a "Build a chart" metric × dimension widget that re-renders live. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.145.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite — 2372, exit 0 (capture $? directly, never | grep)
node --test tests/stats-custom-chart.test.mjs  # metric×dimension wiring + EN keys
node tools/i18n-audit.mjs                       # dictionary clean; snapshot 1208 keys
node scripts/check-changelog-parity.mjs        # all 16 locales at v1.145.0
```

## §1 — What changed (client only; reuses the existing aggregation)

- `public/js/views/stats.js` `renderTrend()` (the **Target-role trend** tab — the one with the scan-derived role/country/salary aggregation): a new `customChart()` builder with a **metric** select (Vacancies / Median salary / Average salary) and a **dimension** select (By country / By role) that re-render the bar chart on change.
- Salary metrics honor the tab's existing **currency** + **per-year ⇄ per-month** controls; vacancies are a plain count. Built from `RoleStats.aggregate` — no new data/endpoint.
- 8 new i18n keys × 17 (`stats.customChart`/`metric`/`dimension`/`metricVacancies`/`metricMedian`/`metricAvg`/`dimCountry`/`dimRole`); snapshot 1200→1208.

## §2 — Manual browser pass (needs target roles in Profile + scan results)

1. **`#/stats` → "Target-role trend"** — a "Build a chart" card at the top with a **Metric** + **Dimension** select and a bar chart.
2. Switch **Metric** → "Median salary" and **Dimension** → "By role" → the chart re-renders to median salary per role. Try each of the 6 metric×dimension combos.
3. **Currency + period** — for a salary metric, change currency / toggle per-month → the custom chart's bars reformat / ÷12.
4. **Localization** — non-EN locale: the "Build a chart" title, metric/dimension labels, and options are translated; RTL (العربية) mirrors.
5. **No data combo** — a metric×dimension with no parseable values shows the "no data" line, not an empty/broken card.
6. **No console errors.**

## §3 — Invariants

- **No new data** — the widget only re-slices `agg` (perRole / byCountry / salaryByCountry) already computed for the tab; no new fetch/route.
- **Existing charts intact** — vacancies-by-country, salary-by-country + the min·avg·median·max table are unchanged.
- **i18n parity** — 17 locales, audit clean, snapshot 1208.

## §4 — Not in this release (see `docs/UX-ROADMAP.md`)

Further interactive-chart work (more dimensions/metrics, export). The scan-filter visual redesign + portals→settings nav move (Phase 4). Nous Research / Hermes → Phase 5 / 5b.

## §5 — Sign-off

Suite **2372** green · Build-a-chart renders + re-renders on metric/dimension change · salary metrics honor currency+period · localized ×17 · RTL mirrored · no-data combo handled · 0 console errors · i18n 17/17 · CHANGELOG parity ×17.
