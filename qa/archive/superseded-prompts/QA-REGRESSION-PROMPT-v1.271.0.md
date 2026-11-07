# QA Regression Prompt — v1.271.0 (Career tasks kanban)

> Release: **v1.271.0** (2026-11-07) — the Career tasks kanban feature release: new `#/tasks` view (Growth group), 3-column board (Backlog / In-Progress / Done) with live counts, drag=PUT optimistic+revert, keyboard ←/→/Enter, mobile select, per-column «+», details modal, `data/career-tasks.json` (locked + atomic, rate-limited), 24 i18n keys ×19, help §27 «Career tasks board» ×19 (H3 132), README ×19, CodeQL wave 22 (hirehive includes-check, avature dead branch unwrapped, unused import/helper dropped, archival writes documented), remote-qa `perf` dispatch (`perf-probe.mjs`, ROUNDS=5, exit 1 on SLOW), routes 39 → **40**.
> Prod target: resumecraft.ru = **1.271.0**, parent **1.39.0**.
> Basis: v1.270.0 shipped & deployed (parent-sync features wave). Nothing from the v1.270.0 contract changes; this release is a self-contained feature on top of it.

## §0 Local gates (HEAD — real numbers, no re-derivation by hand)

| Gate | Expected |
|---|---|
| npm run test:ci | **7921 tests · 7918 pass · 0 fail · 3 skip** |
| npm run test:e2e:browser | **209 pass · 0 fail · 1 opt-in skip** |
| npm run test:coverage:gate | **98.59 line / 90.57 branch** (tasks.mjs added to the exempt baseline) |
| node evals/workflow/run.mjs | **0 ✗** except the known `site-build-after-fanout` (site rebuild follows the fan-out) |
| changelog parity | **✓ ×19 at 1.271.0, 492 releases each** |
| /api/health | **1.271.0 / parent 1.39.0** |

A red §0 gate is a finding, not a sweep item: triage before touching the manual checklist.

## §1 What shipped (verify these first)

1. **`#/tasks` Career tasks board** in the Growth nav group: 3 columns — Backlog / In-Progress / Done — each with a live task count in its header.
2. **Drag-and-drop moves a task** between columns → `PUT` to the server with an optimistic UI update; a failed PUT reverts the card to its original column and toasts the error.
3. **Keyboard path:** ←/→ moves the focused task between columns, Enter opens the details modal — no mouse required.
4. **Mobile 390:** each column carries its own «+» create button and a per-task select for column moves where drag is unavailable.
5. **Details modal:** create/edit per task (title, notes); modal closes without leaving stale listeners behind.
6. **Persistence:** `data/career-tasks.json` — writes go through the file lock + atomic rename and are rate-limited like every other mutating endpoint; surviving a reload is asserted in §2.
7. **Isolation from the tracker:** the tasks board reads/writes only `career-tasks.json` — the applications tracker funnel (`#/tracker`, kanban stage tabs) is untouched by tasks data.
8. **i18n ×19 + help §27 ×19:** 24 new keys in every locale; help §27 «Career tasks board» present in every localized guide (H3 132); README carries the feature.

## §2 Manual spot checks

- [ ] **Localized nav item ×19.** Switch the UI through all 19 locales → the Growth group shows the localized «Career tasks» item in every locale (RU shows the Russian label, ar renders RTL correctly, etc.).
- [ ] **Create → drag → reload → persists.** Create a task via the column «+», drag it to In Progress, reload the page → the task is still in In Progress (server round-trip confirmed, not just optimistic state).
- [ ] **PUT failure simulation → revert + toast.** Simulate a failed PUT (kill the server or block the request) → the dragged card snaps back to its original column and an error toast appears; no silent data loss in the UI.
- [ ] **Keyboard path.** Tab to a task card, press → to move it to the next column, Enter to open the details modal, Escape to close — the whole flow works with keyboard only.
- [ ] **Mobile 390 select.** At 390 px width the board fits without horizontal overflow; a task can be moved via the per-task select (drag is desktop-only).
- [ ] **Two boards don't touch each other.** Create a task, then open `#/tracker` → the applications funnel (counts, stage tabs, kanban) is unchanged by tasks data; edit tracker status → tasks board unchanged on return.

## Locale sweep

All 19 UI locales render unchanged except the new `#/tasks` surfaces (§2 first item + board chrome) — one sanity render per locale group (en, ru, ja, ar on `#/tasks`) plus the ×19 nav-label pass above. Help §27 opens in at least one non-EN locale (e.g. ru) with the section present and the H3 parity intact (132).

## remote-QA (standard)

remote-QA on prod (routes ×19, site ×19, links, live scan + LLM `save:false`) green; findings → Linear immediately.

**New `perf` leg:** remote-QA now supports `-f perf=true` — runs `perf-probe.mjs` against prod with `ROUNDS=5` per probe and **exits 1 on a SLOW verdict**. Run it once on this release: `gh workflow run remote-qa.yml -f perf=true` and confirm the perf leg passes (no SLOW) alongside the standard sweep.
