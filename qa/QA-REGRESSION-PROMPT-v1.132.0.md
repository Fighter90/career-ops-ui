# QA REGRESSION PROMPT — career-ops-ui **v1.132.0** (`#/scan` results-subsystem extraction)

Delta regression for the `#/scan` view refactor (results-rendering subsystem moved to its own module) + README banner slim + CodeQL test cleanup. Pairs with `qa/QA-REGRESSION-PROMPT.md` and the whole-project `qa/QA-FULL-REGRESSION.md`.

- **Under test:** `package.json` **1.132.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                        # full suite — 2138, exit 0 (capture $? directly, never | grep)
node --test tests/playwright-scan-filters.mjs   # in-browser: seeds data/last-scan.json, drives every filter, exact counts
node --test tests/scan-paginator.test.mjs       # SR.render()/SR.getRows() wiring + pager.slice(sortedAll)
node --test tests/scan-fallback-sources.test.mjs # FALLBACK_SOURCES now read from scan-results.js, value+label parity
node --test tests/scan-seniority-facet-v1129.test.mjs tests/scan-i18n-gaps.test.mjs tests/scan-advanced-disclosure.test.mjs tests/scan-pipeline-ui-v1109.test.mjs  # source-static scan tests via loadScanSrc()
node --test tests/design-polish-v1115.test.mjs tests/managed-focus-no-ring.test.mjs tests/toast-fab-clearance.test.mjs tests/wcag-target-size.test.mjs  # CodeQL cleanup — still green after dead-import removal
node scripts/check-changelog-parity.mjs          # all 16 locales at v1.132.0
```

## §1 — What changed

**Pure refactor — no user-visible behaviour change on `#/scan`.** The results-rendering subsystem (`renderResults`, `buildChipRow`, `getRows`, the row/facet builders, the seniority/country option painters, and the `FALLBACK_SOURCES` registry mirror) moved verbatim out of `public/js/views/scan.js` (~1254 → ~906 LOC) into a NEW module `public/js/lib/scan-results.js` exposing `window.ScanResults = { FALLBACK_SOURCES, create(ctx) }`. The view builds `const SR = window.ScanResults.create({...})` and calls `SR.render()` / `SR.getRows()`. `public/index.html` loads `/js/lib/scan-results.js` **before** `scan.js`.

Housekeeping: README "Latest release" banner slimmed to one line + a link to the full changelog (×17); CodeQL cleanup removed dead `readFileSync`/`resolve`/`APP_CSS` imports from four CSS source-guard tests (closes 8 `js/unused-local-variable` alerts).

## §2 — Manual browser pass (`#/scan`)

Run a scan (or seed `data/last-scan.json`), then confirm the results table renders identically to v1.131.2:

1. **Rows render** — company / title / badges / source / seniority / age columns all present; brand logos (if enabled) resolve; repost/ghost panel unchanged.
2. **Every filter works** — text include (comma-OR), Exclude, Remote, Salary min/max, Source dropdown, Country, Seniority, Scope, Age ("posted within"), favorites-only. Apply-driven (v1.68.0) — click **Apply**; **Reset** clears. Pager resets to page 1 on Apply.
3. **Paginator** — pages over the FULL sorted set (`pager.slice(sortedAll)`), "N–M of T" summary correct, page change re-renders via `SR.render()`.
4. **Saved searches + favorites** round-trip (localStorage).
5. **Source dropdown offline fallback** lists all 72 sources (from `window.ScanResults.FALLBACK_SOURCES`).
6. **Two-pager `◎` fit badge** still appears on rows when `config/two-pager.yml` exists.
7. **No console errors** — the highest-risk failure mode of a mechanical move is a missed closure-var rewire that throws `ReferenceError` at runtime. Open DevTools, exercise every filter + a page change, confirm zero errors.

## §3 — Contract & security invariants

- **CSP-safe.** No inline handlers anywhere in `scan-results.js`; all events via `addEventListener` / `UI.el` onClick; `UI.md()` stays the render boundary; no new inline scripts, no `unsafe-eval`.
- **ctx factory closure.** Every value the moved code needs comes from `ctx.*` — `twoPagerData` passed by value (set once via `await` before `create()`), `lastResults` via a `getLastResults()` getter (it's reassigned in `refreshResults`). No stale free variables.
- **i18n.** `t()` is passed via `ctx`; no hardcoded user-facing strings introduced. No new i18n keys this release.
- **No server change.** No new/changed routes; parent-project read-only contract untouched.

## §4 — Sign-off

All §0 gates green (2138, exit 0) · `#/scan` renders + every filter/pager/saved-search behaves exactly as v1.131.2 · **zero console errors** across all filters + a page change · `scan.js` ~906 LOC, `scan-results.js` present + loaded before `scan.js` · README banner slim ×17 · CHANGELOG parity ×17 · 8 CodeQL `js/unused-local-variable` alerts closed at source · CSP / ctx-wiring / read-only invariants intact.
