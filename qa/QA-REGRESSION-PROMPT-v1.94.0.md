# QA REGRESSION PROMPT — career-ops-ui **v1.94.0** (Epic 25: Statistics rework)

Delta regression for the reworked `#/stats` page. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.94.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                     # full suite (≥1643 cases; new: market-routes ×4)
node --test tests/market-routes.test.mjs     # region/currency bounding + honesty-labelled prompt + CV/profile-seeded manual mode
node --test tests/stats-routes.test.mjs      # existing snapshot/trend endpoints unchanged
node --test tests/i18n-coverage.test.mjs     # 36 new keys ×16 locales, zero missing
node tools/i18n-audit.mjs                     # clean
node scripts/check-changelog-parity.mjs       # all 15 locales at v1.94.0
```

## §1 — What changed

`#/stats` is now a **three-tab Statistics section** (nav label "Statistics" 📊).

1. **Market report tab** (new). Type a **Region / market**, pick a **Currency**, click **Generate market report** → `POST /api/stats/market`. With a provider key it returns a live Markdown report (salary by grade with P10/P25/P75/P90, top employers, skills, benefits, remote split, trends, negotiation). With **no key** it returns a copy-paste prompt (mode `manual`) — never a fabricated report. Every figure is labelled a **directional estimate** from the model's knowledge. The report knows your **target roles** because the prompt inlines cv.md + profile via `bundleProjectContext`. **Download .md / Save as PDF / Copy** all work (PDF via the existing `/api/stream/pdf/inline` runner).
2. **My pipeline tab** (new). Client-side charts from `GET /api/tracker`: total tracked, score distribution, status funnel, top companies, top roles, applications over time, conversion rates. Empty tracker → an honest empty state, never invented data.
3. **Target-role trend tab** (the original v1.86.0 view). Vacancy/salary by country from the latest scan + **currency selector** + a new **Postings by target role** chart + the save-snapshot trend line. `POST /api/stats/snapshot` / `GET /api/stats/trend` are unchanged.

## §2 — Contract & security invariants

- **Honesty.** The market report is analysis (like `/api/deep`), NOT candidate content — figures are model estimates, explicitly labelled, given as ranges. The prompt forbids inventing verified company salaries. No new factual claims about the user.
- **No writes.** `POST /api/stats/market` never writes a file. Only `POST /api/stats/snapshot` writes (unchanged, `data/role-stats.jsonl`). Export is client-side (Markdown blob) or the existing PDF runner.
- **Bounded.** `normalizeRegion` caps at 120 chars + strips newlines; `normalizeCurrency` whitelists ISO codes (default USD).
- **Rate-limited.** `POST /api/stats/market` carries `llmRateLimit` (the known CodeQL `js/missing-rate-limiting` FP may still flag — dismiss post-merge; also possible `js/http-to-file-access` FP is not applicable since there's no write).
- **CSP-safe.** The view uses `UI.el` + `addEventListener`; `UI.md()` renders report markdown (XSS boundary); `report-export.js` downloads via a user-clicked `<a download>` Blob (works under `default-src 'self'`).

## §3 — i18n

36 new keys (`stats.*` + `export.*`) present + translated in all **16** locales; `nav.stats` / `stats.title` reworded to the locale's "Statistics". Switch locale: tabs, market controls, pipeline chart titles, export buttons read in-language. Arabic RTL. Currency selector shows ISO codes (not localized).

## §4 — Sign-off

All §0 gates green · market report generates (or returns a manual prompt with no key) seeded from your target roles · currency selector changes the salary figures on the trend tab and the report's primary currency · pipeline charts reflect only your tracker · Download .md / Save as PDF / Copy all work · 36 keys ×16 · honesty / no-write / CSP invariants intact.
