# QA Regression Prompt — v1.269.1 (docs + perf-paging patch on v1.269.0's features)

> Release: **v1.269.1** (2026-11-07) · patch — live verification numbers + help ×19 fan-out + SPA tracker pagination (CAR-236 continuation) + tracker-v2 relabel
> Prod target: resumecraft.ru = **1.269.1**, parent 1.38.0 (fork unchanged — no parent-sync in this release)
> Basis: v1.269.0 shipped & deployed (kanban funnel, detailed stats, report depth, perf). Nothing from the v1.269.0 feature contract changes; this release documents the live verification and finishes the tracker read path.

## §0 Local gates (HEAD — real numbers, no re-derivation by hand)

| Gate | Expected |
|---|---|
| npm run test:ci | **7699 tests · 7696 pass · 0 fail · 3 skip** |
| npm run test:e2e:browser | **201 pass · 0 fail · 1 opt-in skip** |
| npm run test:coverage:gate | **98.55 line / 90.41 branch** (above ratchet) |
| node evals/workflow/run.mjs | **0 ✗** — 16 pass, incl. evaluate-locale-parity **0.0** + evaluate-repeatability **0.0** (offline stubs) |
| changelog parity | **✓ ×19 at 1.269.1, 489 releases each** |
| /api/health | **1.269.1 / parent 1.38.0** |

A red §0 gate is a finding, not a sweep item: triage before touching the manual checklist.

## §1 What shipped (verify these first)

1. **Help ×19 kanban+stats sections (H3 131).** Every localized guide (`docs/help/<locale>.md`, 19 files) carries the new subsections — §11 Tracker → «Kanban funnel board» (CAR-237) and §26 Statistics → «Detailed statistics» (CAR-247). The 33 H2 / **131 H3** structure gate is green ×19. Verify a couple of non-EN locales in the app's `#/help`, not just the files.

2. **Live verification numbers recorded (the v1.268.0 failure mode is closed).** The determinism graders now measure, on this train: **locale-parity spread 0.0** (1 JD × 19 locales, all scores identical) and **repeatability 0.0** (en/ru/de × 3 repeats, identical) — the v1.268.0-era 1.5-spread failure mode is confirmed gone. The numbers are documented in the release docs and the evals pass offline (stub provider). `node evals/workflow/run.mjs` must stay 0 ✗.

3. **SPA tracker pagination (one shared read per mount + server-side table paging).** `#/tracker` mounts ONE shared rows loader: the table pages server-side (`GET /api/tracker?page=N&pageSize=200`, route caps pageSize at 500, answers `{rows, total, page, pageSize, funnel}`), the kanban board reads ALL rows. Verify with DevTools Network on a tracker with >200 rows:
   - the «Таблица» tab shows **200 rows/page** (pager below, next page = one follow-up `?page=2` GET);
   - the «Воронка» tab shows **ALL rows**, not a 200-row slice;
   - navigating to `#/tracker` fires **exactly ONE `GET /api/tracker`** per mount — no duplicate fetch from tab switches, no per-render re-fetch.

4. **Tracker-v2 relabel.** The v2 tracker UI copy is renamed (view labels/titles; canonical statuses and API payloads untouched). Spot-check `#/tracker` chrome in ru + en: no stale «v2»-era wording, status vocabulary still canonical.

## §2 Manual spot checks

- [ ] **Kanban drag → status persists on reload** (CAR-237 contract from v1.269.0, re-verified on the pagination loader): drag a card to another column → ONE `POST /api/tracker/status` → reload → the card sits in the new column.
- [ ] **Stats currency/period/facets** (CAR-247 contract, re-verified): «Детали» tab — currency selector reformats figures + chart axes; period month/quarter/year/all filters; search + facet chips AND-compose; Reset restores.
- [ ] **Help §11/§26 new subsections visible** in the app's localized guide: open `#/help` → §11 Tracker (Kanban funnel board) and §26 Statistics (Detailed statistics) render in the active locale; switch to one more locale and confirm again.
- [ ] **/changelog: exactly ONE `<h1>`** on every one of the 19 locales (the check-dist 2×h1 guard from v1.269.0 must hold after this release's docs wave).

## Locale sweep

All 19 UI locales render the changed surfaces (`#/tracker` chrome, `#/stats` «Детали», `#/help` §11/§26) with no untranslated strings and no Latin leaks in non-Latin locales.

## remote-QA (standard)

remote-QA on prod (routes ×19, site ×19, links, live scan + LLM `save:false`) green; findings → Linear immediately.
