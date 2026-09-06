# QA REGRESSION PROMPT — career-ops-ui **v1.199.0** (wide tables scroll horizontally)

**Fixed (UI).** The shared `.table-wrap` wrapper — used by the **Scan** results table plus Tracker, Statistics, Usage, Dashboard, Activity and Mode-page tables — used `overflow: hidden`. A table wider than the viewport (nowrap columns) was **clipped with no scrollbar**, so the rightmost columns were unreachable (the reported scan-table "она вся не вмещается"). It now uses `overflow-x: auto` → a horizontal scrollbar on demand; the rounded border is preserved. Also **verified** the scan advanced filters still work end-to-end.

- **Under test:** `package.json` **1.199.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2540, exit 0 (capture $? directly, never | grep)
node --test tests/table-wrap-scroll.test.mjs   # 2 subtests
node --test tests/playwright-scan-filters.mjs  # 6 subtests (needs `npx playwright install chromium`)
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.199.0
```

## §1 — Change (`public/css/components.css`)

- `.table-wrap { … overflow: hidden }` → `overflow-x: auto`. One property. Any non-visible overflow still clips to the `border-radius`, so the rounded corners of every table card are unchanged.
- Mirrors the `.reports-scroll` container shipped in v1.180.0 for `#/reports`.

## §2 — Behaviour

- On a viewport narrower than the scan results table, a **horizontal scrollbar** appears at the bottom of the table card; every column (score, actions, salary, …) is reachable by scrolling. The page body itself does **not** scroll sideways (the wrapper owns the scroll).
- The same improvement applies to Tracker / Statistics / Usage / Dashboard / Activity / Mode-page tables — all use `.table-wrap`.
- **Regression (filters):** the scan advanced filters — text include, exclude, remote, salary min/max, source, country, scope, posted-within age, seniority, favourites — all still apply (Apply-driven; Enter on text/number fields, `change` on selects/checkbox). Confirmed by `tests/playwright-scan-filters.mjs` (6/6).

## §3 — Sign-off

Suite **2540** green (+2) · CHANGELOG parity ×17 at v1.199.0 · README badge+banner ×17 · site changelog ×17 · no server change, no new dependency.
