# QA REGRESSION PROMPT — career-ops-ui **v1.208.1** (mobile top-bar no longer overlaps the page)

**Fixed.** A v1.208.0 follow-up: on a phone, the top-bar action buttons (Diagnostics / Open Scan / notifications / theme) wrapped to a second row but the bar kept a fixed height, so the wrapped row spilled out and sat on top of the page heading (user-reported). **CSS-only + test.**

- **Under test:** `package.json` **1.208.1**.

## §0 — Gates

```bash
npm test                                     # 2621, exit 0
node --test tests/playwright-smoke.mjs       # 21 (phone-width guard now also checks topbar spill)
node scripts/check-changelog-parity.mjs      # 16 non-EN at v1.208.1
```

## §1 — Root cause + fix

v1.208.0 added `@media (max-width:900px){ .topbar { flex-wrap: wrap } }`, but the **base** `.topbar { height: var(--topbar-h) }` (app.css:449) sits **after** the mobile block (line 332) in source order — same specificity, so it **won**. The bar stayed a fixed 80px while `flex-wrap` pushed the 2nd row out of the box (`scrollHeight 109 > clientHeight 80`), overlapping the page header.

**Fix:** the base `.topbar` `height` → **`min-height`**, so the bar grows to fit its wrapped rows on any width. Desktop is unchanged (one row always fits within `--topbar-h`). Verified: at 360/390px the topbar box equals its content height (166/110px) and the page header sits below it — **0 overlap**.

## §2 — Test

The v1.208.0 responsive guard only checked **horizontal** overflow (`rect.right`), so it missed this **vertical** spill. Extended `tests/playwright-smoke.mjs` to also assert, per route at 375px, that `.topbar.scrollHeight <= .topbar.clientHeight` (the bar's content doesn't overflow its box onto the page).

## §3 — Sign-off

Suite **2621** green · Playwright **21** (guard now covers vertical top-bar spill) · CHANGELOG parity ×17 at v1.208.1 · CSS-only + one test, no new dependency, no server/parent edits. Deploy: resumecraft.ru rsync of `public/css/app.css` (static — **no restart**) + cvstart.org Pages version refresh.
