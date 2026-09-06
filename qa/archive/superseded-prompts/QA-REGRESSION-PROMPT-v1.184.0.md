# QA REGRESSION PROMPT — career-ops-ui **v1.184.0** (Dashboard grid alignment)

**Fixed (UI).** The Dashboard (Command Center) quick-action tiles used an `auto-fill` grid, so a group of 3 tiles rendered wider than a group of 4 → the sections stacked with a ragged right edge. Now fixed equal-width columns.

- **Under test:** `package.json` **1.184.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2479, exit 0 (capture $? directly, never | grep)
node --test tests/dashboard-grid-align.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.184.0
```

## §1 — Change

- `public/css/components.css` `.qa-grid`: `grid-template-columns` changed from `repeat(auto-fill, minmax(220px, 1fr))` to a fixed `repeat(4, minmax(0, 1fr))`, with breakpoints stepping to 3 (≤1180px), 2 (≤820px), 1 (≤480px). CSS only — no JS, no markup change.

## §2 — Manual check (open `#/dashboard` on a wide window)

- Every quick-action group ("Поиск и отклик" 3 tiles, "Исследование и подготовка" 4 tiles, etc.) must render tiles of the **same width**, and every group's **right edge must line up**. A 3-tile group leaves one empty cell on the right rather than stretching.
- Narrow the window: tiles reflow 4 → 3 → 2 → 1, staying equal-width at each step. No horizontal scroll.

## §3 — Invariants

- CSS-only; no route / CSP / SSRF / behaviour change. The `.qa-tile` styling, the 4-up metric `.card-row`, and every other view are untouched.

## §4 — Sign-off

Suite **2479** green (+2 grid guards) · `dashboard-grid-align` 2/2 · CHANGELOG parity ×17 at v1.184.0 · README badge + banner ×17 at 2479 / v1.184.0 · visual: dashboard action groups equal-width + right-aligned.
