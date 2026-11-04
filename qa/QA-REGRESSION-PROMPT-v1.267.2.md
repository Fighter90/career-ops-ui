# QA Regression Prompt — v1.267.2

> Release: **v1.267.2** (2026-11-04) · second parent-sync wave against career-ops @ `7d8feb6d` (87 commits) + CAR-228 filter compat
> Prod target: resumecraft.ru = **1.267.2**, parent 1.38.0 @ `7d8feb6d`
> Tests: **7398** unit (0 fail) · Playwright **176** (174 harness: 173 pass / 0 fail / 1 opt-in skip · e2e 21/0 · comprehensive 23/23) · registry **129 = 124 EN + 5 RU · 124 adapters**

## What shipped (verify these first)

1. **Four new sources in `#/scan` → Source dropdown**: GermanTechJobs (provider-explicit), Darwinbox
   (`<tenant>.darwinbox.in/ms/candidatev2/<id>/careers`), Keka (`<tenant>.keka.com/careers`),
   ApplicantPro (`<tenant>.applicantpro.com/jobs/`). Run one scan each: rows carry dates, and —
   **CAR-228** — GermanTechJobs rows carry `salary: '48.000 - 70.000 €'` (from the title bracket, never
   annualized) and `location: 'Germany'` (board-level country so the country filter sees it).
2. **Salary facet on the new boards**: set a salary filter — Darwinbox `INR` display strings parse;
   GermanTechJobs German `48.000` grouping parses (48 000, not 48).
3. **Age filter on the new boards**: every new source emits `date` — "Posted within: 30 days" keeps
   fresh rows and hides old ones (ApplicantPro rows are dated WITHOUT `fetchDetails` — `startDateRef`).
4. **ETag reuse (#6105)**: run two scans of the same portals config within 15 minutes — the server log
   says `reused N board responses fetched in the last 15 minutes`; a board that answers 304 keeps its rows.
5. **Misspelled portals key (#6107)**: add `titel_filter:` to portals.yml → the scan fails with a named
   error naming the key and the nearest valid key. Remove it — scans run again.
6. **getro featured pin (#6406)**: a board with an old featured pin paginates past it (no early stop).
7. **Dates ×4 (#6274)**: remoteok/remotive/workingnomads/IBM rows are dated; remotive's age is
   machine-independent (UTC-normalized).

## Standard sweep (every release)

- [ ] All views render; 19 locales switch cleanly (no Latin leaks, RTL holds); dark/light across sidebar/tracker/scan.
- [ ] Mobile 390 px: sidebar drawer, scan table, tracker — no horizontal overflow.
- [ ] `#/health` all green; `/api/health` reports `1.267.2`.
- [ ] cvstart.org: mirrors stamped `v1.267.2`; the Sources section shows 129.
- [ ] README ×19 banners name v1.267.2 (lead) / v1.266.0 (previous); badges tests-7398 / release-v1.267.2.

## Not in scope (by design)

- RU scanner language-aware seen-filter + misspelled-key gate wiring — hand-offs in the wave spec.
- remoteok keeps its offset-bearing date string (deterministic through Date.parse).
