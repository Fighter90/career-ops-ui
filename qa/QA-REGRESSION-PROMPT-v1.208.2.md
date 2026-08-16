# QA REGRESSION PROMPT — career-ops-ui **v1.208.2** (mobile top-bar buttons no longer overlap the search box)

**Fixed.** A v1.208.1 follow-up. v1.208.1 stopped the wrapped top-bar row from spilling *vertically* over the page heading, but a *horizontal* collision remained: on a narrow-but-not-narrowest phone the 🔔 / 🌙 (and Diagnostics) could sit **on top of the search box**. It only reproduced in **long-label locales** (Russian «Открыть Scan» / «Диагностика») — English labels are too short to trigger it, which is why both prior guards (they run in English) missed it. **CSS-only + one test.**

- **Under test:** `package.json` **1.208.2**.

## §0 — Gates

```bash
npm test                                     # 2621, exit 0
node --test tests/playwright-smoke.mjs       # 22 (new: topbar-controls-never-overlap, RU × 565-640px)
node scripts/check-changelog-parity.mjs      # 16 non-EN at v1.208.2
```

## §1 — Root cause + fix

The base `.topbar` is `justify-content: space-between`. On a phone at ~565–640px the single row is *almost* full, so flexbox keeps everything on one line and distributes the **negative** free space as **overlap** — a known `space-between` artifact — dropping the action icons on top of `#global-search`. Reproduced with a Playwright width×locale sweep: `global-search` overlapped `notif-bell` / `theme-toggle` / `btn-doctor` at 580/590/640px in **ru**, clean in **en**.

**Fix (CSS-only, `@media (max-width:900px)`):** drop the whole `.topbar-actions` onto its own full-width second row via `flex-basis: 100%` (+ `.searchbar input { min-width: 0 }` so the input can shrink). This removes the fragile band entirely and is **locale-independent** — the search box stays fully readable on row one at every mobile width. (Chosen over `justify-content: flex-start`, which also removed the overlap but squeezed the search box to a useless «Пои» stub — both were screenshotted; the full-second-row layout won.)

## §2 — Test

The v1.208.0 guard (horizontal page overflow) and the v1.208.1 guard (vertical topbar spill) both run in **English** and so were blind to this. Added a dedicated guard that reproduces the exact trigger — **Russian locale** across **[580, 590, 640]px** — and asserts no two of `{sidebar-toggle, global-search, notif-bell, theme-toggle, btn-doctor, btn-quick-scan}` share pixels. Proven **red→green**: without the fix it reports `not ok` with the exact overlapping pairs; with the fix, `ok`.

## §3 — Sign-off

Suite **2621** green · Playwright **22** (new topbar-overlap guard, RU) · CHANGELOG parity ×17 at v1.208.2 · CSS-only + one test, no new dependency, no server/parent edits. Verified clean across **39** combinations (13 widths × ru/en/de) — no overlap, no vertical spill, no horizontal page scroll. Deploy: resumecraft.ru rsync of `public/css/app.css` (static — **no restart**) + cvstart.org Pages version refresh.
