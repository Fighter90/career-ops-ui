# QA REGRESSION PROMPT — career-ops-ui **v1.208.0** (responsive app layout — no sideways overflow on a phone)

**Fixed.** The SPA used to overflow horizontally on a narrow viewport (the QA report's NEW-2). Every page now fits any width. **CSS-only + one `help.js` class swap; no server code changed.**

- **Under test:** `package.json` **1.208.0**.

## §0 — Gates

```bash
npm test                                     # 2621, exit 0
node --test tests/playwright-smoke.mjs       # 21 (incl. the new phone-width guard)
node scripts/check-changelog-parity.mjs      # 16 non-EN at v1.208.0
node --test tests/css-modularization.test.mjs  # each CSS file ≤ 800 LOC (761/754/748)
```

## §1 — Root cause + fixes

The universal cause was the classic flex/grid **`min-width: auto`** trap (an item won't shrink below its content's intrinsic width, so a wide child — a table, a code block, a long path — forces its track, the content column, and the page wider than the screen), plus a few unwrapped wide elements.

| # | Symptom | Fix |
|---|---|---|
| 1 | Top bar (search + Doctor/Open Scan/🔔/🌙) overflowed on every route | `.topbar { flex-wrap: wrap }` + `.searchbar { min-width: 0 }` + `.topbar-actions` wrap (≤900px) — actions drop to a 2nd row |
| 2 | Dashboard/table content wider than viewport | `.table-wrap { min-width: 0; max-width: 100% }` (table scrolls INSIDE) + grid items `min-width: 0` (`.grid-2/.grid-3/.qa-grid/.card-row/.help-grid > *`) + `.grid-2/.grid-3` mobile → `minmax(0,1fr)` |
| 3 | Help article at 1172px | `.md { overflow-wrap: break-word }` + `.md table { display: block; overflow-x: auto }`; `.help-grid` columns moved from an **inline** `240px 1fr` to CSS so `@media (max-width:900px)` stacks it to `1fr` |
| 4 | Config tabs / CV toolbars overflowed | `.flex, .flex-between { flex-wrap: wrap }` (≤900px) |
| 5 | Config phantom overflow (no rect past the edge) | a long project PATH in `.page-subtitle` — `.page-title/.page-subtitle { overflow-wrap: anywhere }` |

## §2 — Verify

- **0 horizontal overflow** at **375 / 414 / 500 px** across all 16 routes (`documentElement.scrollWidth === clientWidth`).
- The Playwright guard asserts it at **375px** on 8 routes; it caught a config-only phantom the dev-server pass missed (the minimal-fixture harness shows a long `mktemp` path in the subtitle — hence `overflow-wrap: anywhere`).
- **Desktop unchanged:** every fix is either mobile-scoped (`@media (max-width:900px)`) or a shrink-only property (`min-width:0`, `overflow-wrap`) that is inert when there's room. No RTL regression (`min-width`/`overflow-wrap` are direction-agnostic).

## §3 — Sign-off

Suite **2621** green · Playwright **21** (+1 phone-width guard) · CHANGELOG parity ×17 at v1.208.0 · README badge+banner ×17 · CSS ≤800 LOC each · CSS-only + 1 view class swap, no new dependency, no server/parent edits. Deploy: cvstart.org Pages refresh (version) + resumecraft.ru rsync of `public/css/*` + `public/js/views/help.js` (static — **no restart**).
