# QA REGRESSION PROMPT — career-ops-ui **v1.148.0** (cleaner scan filters)

A senior-designer polish pass (no parent-sync, no server code). The `#/scan` result-filter panel is redesigned from a ragged flex-wrap into a responsive grid, with a separated right-aligned Apply/Reset row. **Same filters, same behaviour** — CSS + one small DOM cleanup. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.148.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2381, exit 0 (capture $? directly, never | grep)
node --test tests/scan-filters-grid.test.mjs   # grid + actions-row layout contract (3 tests)
npm run test:e2e:browser                    # (optional) Playwright scan-filter flow still green — ids unchanged
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.148.0
node tools/i18n-audit.mjs                    # app dict clean; snapshot UNCHANGED 1208 (no new keys)
```

## §1 — What changed (CSS + one small DOM cleanup; ZERO behaviour/route/i18n change)

- **`.scan-filters` → responsive grid** (`public/css/components.css`) — was `display: flex; flex-wrap: wrap` with rigid `flex: 1 1 160px; min/max-width` fields; now `display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))` with even gutters, so the 11 labelled filters align into tidy columns at every width.
- **`.scan-filters__actions`** now `grid-column: 1 / -1` — a full-width, hairline-separated (`border-top`), right-aligned row so Apply/Reset read as the primary action.
- **`scan.js`** — dropped the old `visibility:hidden` placeholder `<label>` + inner flex wrapper in the actions row; `applyBtn`/`resetBtn` are now direct children of `.scan-filters__actions`.

## §2 — Manual browser pass (needs scan results to see the table; the panel renders regardless)

1. **`#/scan`** — the filter panel is a tidy grid of labelled controls that reflows column count with window width (4-ish columns wide, fewer when narrow); labels align, gutters are even.
2. **Apply / Reset** sit on their own row at the bottom, separated by a thin line, right-aligned; **Apply** is the primary (pink) button.
3. **Filtering still works** — set Search / Source / Seniority / Work type / Posted-within / Salary from-to / Country / Scope / ★ Favorites and press **Apply**; the results table filters exactly as before; **Reset** clears every field.
4. **RTL** (العربية) — the grid mirrors; actions align to the (RTL) end.
5. **Dark theme** — the hairline (`--line`) and labels remain legible.
6. **No console errors.**

## §3 — Invariants

- **No behaviour change** — every `#scan-filter-*` id, `#scan-apply`, and the `SR.render()` / `applyFilters()` / `resetFilters()` wiring are unchanged; the Playwright scan-filter flow is untouched.
- **No new i18n keys** — app dict snapshot stays **1208**.
- **Only `#/scan` filter layout changed** — no other view, route, or `server/` file touched.
- **CHANGELOG parity** — 17 locales, newest `## [1.148.0]`.

## §4 — Not in this release (see `docs/UX-ROADMAP.md` Phase 4)

- **Overall visual polish across all pages** — a subjective, whole-app senior-designer pass, left for explicit user direction.
- **`#/portals` → settings-nav move** — still open.

## §5 — Sign-off

Suite **2381** green · scan-filters-grid canary 3/3 · panel renders as a reflowing grid with a separated right-aligned actions row · filtering + Reset unchanged · RTL mirrored · 0 console errors · i18n snapshot 1208 · CHANGELOG parity ×17.
