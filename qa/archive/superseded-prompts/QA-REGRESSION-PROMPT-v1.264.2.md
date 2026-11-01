# QA Regression Prompt — v1.264.2

> Release: **v1.264.2** (2026-11-01) · wave PR **#613** (squash → `00364177`) + release train
> Prod target: resumecraft.ru = **1.264.2**, parent 1.38.0 @ `0595b5d1`
> Tests: **7082** unit (0 fail) · Playwright **176** (173 pass / 1 opt-in skip local) · registry 123 = 118 EN + 5 RU · 118 adapters · coverage 98.45/90.05 · evals 14/0/1skip
> Playwright arithmetic: 176 = the `test:e2e:browser` TAP total of **174** (173 pass / 0 fail / 1 skip — the
> opt-in `SCAN_REDESIGN_CAPTURE=1` layout-capture test in `scan-redesign-layout.test.mjs`) plus
> `tests/e2e.mjs` and `tests/e2e-comprehensive.mjs`, each counted as one script-level pass.

## What shipped (verify these first)

1. **CAR-219 — sidebar group headers.** Switch to **ru**, collapse/expand sidebar groups: long group
   labels (e.g. «Аналитика и отчёты», Favorites/Recents) show an **ellipsis** inside the group toggle,
   hovering the label shows a **localized tooltip**; the chevron never shrinks; the toggle still
   expands/collapses (aria-expanded flips); RTL (ar) keeps the ellipsis on the inline-end.
2. **CAR-220 — cvstart.org copy ×19.** Open cvstart.org in **de / ja / ru** (language switcher):
   the help-teaser card («What is career-ops-ui») and the FAQ answer №2 must read in the locale
   (kanban/undo/command-menu phrasing), the meta description in the page source must no longer be EN-only.
3. **Docs hygiene (CAR-221/222).** `docs/reviews/REVIEW-2026-10-31-v1.264.1.md` exists (0 HIGH / 0 MED);
   BACKLOG carries the parent-sync port-list (6 PORT / 3 VERIFY) — no UI surface change.

## Standard sweep (every release)

- [ ] All views render; 19 locales switch cleanly (no Latin leaks, RTL holds); dark/light across sidebar/tracker/scan.
- [ ] Mobile 390 px: sidebar drawer, scan table, tracker — no horizontal overflow.
- [ ] `#/health` all green; `/api/health` reports `1.264.2`.
- [ ] cvstart.org: /changelog paginated mirrors stamped `v1.264.2` on every page (the new mirror footer).
- [ ] README ×19 banners name v1.264.2 (lead) / v1.264.1 (previous).

## Not in scope (by design)

- Remaining unthrottled mutating POSTs + trust-proxy bucket coupling — BACKLOG, next hardening wave.
- CAR-141 demo video — owner.
