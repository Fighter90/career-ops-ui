# QA REGRESSION PROMPT — career-ops-ui **v1.140.0** (Insightful stats: richer salary figures)

User-reported UX pass (no parent-sync). The `#/stats` "My pipeline" salary breakdown now shows the average, a per-year⇄per-month toggle, and a min·avg·median·max table per country. First slice of roadmap Phase 3. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.140.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite — 2361, exit 0 (capture $? directly, never | grep)
node --test tests/role-stats.test.mjs          # salaryStats.avgUsd + average-right-skew case
node --test tests/i18n-coverage.test.mjs tests/i18n-locale-files.test.mjs   # 17-locale parity + snapshot (1183 keys)
node scripts/check-changelog-parity.mjs        # all 16 locales at v1.140.0
```

## §1 — What changed (all `#/stats` "My pipeline" tab + the shared salary lib)

- `public/js/lib/role-stats.js::salaryStats` now returns **`avgUsd`** (mean) alongside `minUsd`/`medianUsd`/`maxUsd`.
- `public/js/views/stats.js` renderPipeline: a **Period** select (Per year / Per month, ÷12) in the filter bar, and a **`salaryTable`** (Country · n · Min · Avg · Median · Max) under the "salary by country" chart. Both honor the currency + period selectors.
- 8 new i18n keys × 17 locales (`stats.period`, `stats.perYear`, `stats.perMonth`, `stats.colCountry`, `stats.colMin`, `stats.colAvg`, `stats.colMedian`, `stats.colMax`).

## §2 — Manual browser pass (needs tracked applications with parseable salaries)

1. **`#/stats` → "My pipeline"** — if you have applications with salaries, the "salary by country" section shows the median bar chart **plus** a table with **Min · Avg · Median · Max** per country. (No salary data → the existing "No parseable salaries" empty message; that's expected.)
2. **Period toggle** — switch **Per year ⇄ Per month**: every salary figure (chart + table) divides by 12 for monthly.
3. **Currency** — switch currency: all figures reformat in the chosen currency (approximate FX).
4. **Avg vs median** — where a country has a few very-high postings, **Avg > Median** (right-skew visible); with one sample they're equal.
5. **Localization** — switch to a non-EN locale: the column headers (Country/Min/Avg/Median/Max) and Period options are translated; RTL (العربية) mirrors the table.
6. **No console errors.**

## §3 — Invariants

- **Median unchanged** — the existing median bar chart + `medianUsd` trend snapshot are untouched; `avgUsd` is additive.
- **Caveat stays** — salary figures are still only from postings/applications with a parseable salary, USD-normalized (indicative), and the caveat line remains under the section.
- **i18n parity** — 17 locales, no missing/empty/dup keys (`tools/i18n-audit.mjs` clean); snapshot regenerated (1183 keys).
- **No parent write / CSP / SSRF** — read-only client aggregation over `/api/tracker`; no new server route.

## §4 — Not in this release (see `docs/UX-ROADMAP.md`)

Interactive/rebuildable charts, the **"Unknown" archetype fix** (orientation — it's LLM output, a prompt-quality fix), and **funded-company enrichment** (logo / description / salary range / vacancies) are the remaining Phase 3 items. Portals→settings + filter redesign → Phase 4 / v1.141.0. Nous Research / Hermes → Phase 5 / 5b.

## §5 — Sign-off

Suite **2361** green · `avgUsd` computed + shown · per-year/month toggle divides by 12 · min·avg·median·max table per country · avg>median under skew · localized headers ×17 · RTL mirrored · 0 console errors · i18n 17/17 · CHANGELOG parity ×17.
