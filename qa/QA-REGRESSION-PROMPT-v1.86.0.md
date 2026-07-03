# QA REGRESSION PROMPT — career-ops-ui **v1.86.0** (Statistics by target roles · `#/stats`)

Delta-focused regression for the new **Target-role market statistics** page. Pairs with the whole-project driver `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.86.0**.
- **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates (all green)

```bash
npm test                                    # full suite (≥1566 cases)
node --test tests/role-stats.test.mjs       # 9/9 — aggregator unit
node --test tests/stats-routes.test.mjs     # 6/6 — routes + rate-limit + sanitization
node scripts/check-changelog-parity.mjs     # "all 15 locales at v1.86.0"
node tools/i18n-audit.mjs                   # clean (26 new stats.*/nav.stats keys ×16)
```

## §1 — What changed (verify each)

1. **Target roles are dynamic** — the page reads `GET /api/profile` → `summary.target_roles` (from `config/profile.yml`), **never hard-coded**. Empty profile → the "Open Profile" empty state (`stats.noProfile`).
2. **Client aggregator** — `public/js/lib/role-stats.js` (`window.RoleStats`): `parseSalaryUSD` (currency → USD via approximate FX; a **bare `¥` is dropped** — JPY/CNY ambiguity), `matchRole` (majority-token fuzzy), `aggregate` (per-role × country, reuses `window.Countries`). Gate: `tests/role-stats.test.mjs`.
3. **View `#/stats`** — nav item under **Analytics**; inline-SVG **vacancies-by-country** + **median-salary-by-country** bars; **role + country filters**; **trend** line; **Save snapshot**. No scan yet → "Run a scan" empty state.
4. **Snapshot store** — `POST /api/stats/snapshot` → append to `data/role-stats.jsonl` (server-stamped `ts`, sanitized+bounded by `toCompactSnapshot`, **rate-limited** by `llmRateLimit`); `GET /api/stats/trend[?role=]` reads back (tail-capped at `MAX_TREND_SNAPSHOTS`). Gate: `tests/stats-routes.test.mjs` (incl. public-bind 429 + non-object body).
5. **i18n** — 26 new keys (`nav.stats` + 25 `stats.*`) in **all 16 locales**; `stats.title` translated in native script for non-Latin locales.
6. **Screenshots** — all 16 `images/dashboard-*.png` regenerated at v1.86.0 (incl. new `dashboard-{de,it,tr}.png`); translated READMEs point at their own.

## §2 — Footguns

- **Aggregation is CLIENT-side** (reuses `window.Countries`) — the server is a thin snapshot store. There is **no** `GET /api/stats/roles`.
- **CodeQL `js/missing-rate-limiting`** on the snapshot POST is a known **false positive** (dismissed): the route IS rate-limited via `llmRateLimit` (CodeQL can't model the custom middleware). Sibling write routes (`/api/jds`, `/api/tracker`) have no limiter and sit accepted in the baseline.
- **CSP-safe:** charts built via `document.createElementNS` + `addEventListener` — no inline handlers, no `eval`.
- **"Sparse data" is expected** — salaries with no parseable amount are dropped (not fabricated); the page shows a sample-size caveat. USD amounts use locale grouping but **Latin digits** (`numberingSystem:'latn'`).
- Parent boundary: the only write is `data/role-stats.jsonl` inside `CAREER_OPS_ROOT/data/` — never CV/profile.

## §3 — Sign-off

All §0 gates green · `#/stats` renders in all 16 locales with target roles from the profile · Save snapshot → trend updates · CHANGELOG parity at 1.86.0 across 16 files.
