# QA Regression Prompt — v1.269.0 (features: kanban funnel, detailed stats, report depth, hero video)

> Basis: v1.268.1 shipped & deployed (prod verified 2026-11-06, remote-QA No findings ×3, CAR-231 cache gate met at ~35–36k). This release adds features — nothing from the v1.268.1 contract changes.

## §0 Local gates (HEAD)

| Gate | Expected |
|---|---|
| npm run test:ci | **7627 tests · 7624 pass · 0 fail · 3 skip** (re-measure at merge; the docs pin the live number) |
| npm run test:e2e:browser | **196 pass · 0 fail · 1 opt-in skip** (incl. kanban 7/7 + stats-detail 6/6) |
| npm run test:coverage:gate | ≥ 98.53 / 90.35 ratchet — measured 98.55 / 90.41 |
| node evals/workflow/run.mjs | 0 ✗ |
| changelog parity | ✓ ×19 at 1.269.0, 488 releases each |
| /api/health | 1.269.0 / parent 1.38.0 |

## §1 Kanban funnel (CAR-237)

1. #/tracker → «Воронка» tab: columns = canonical statuses ×19-localized; cards render company/role/score/date/report link.
2. Drag card → column: ONE `POST /api/tracker/status` fires; optimistic move; a 502 reverts + toasts.
3. Reload: the status persisted (the fake writer fixture actually writes).
4. Keyboard: focus card → ArrowLeft/Right move; Enter opens the modal.
5. Modal: notes + interview time → Notes cell markers `[Заметки]` / `[Собеседование: …]`, status untouched.
6. Mobile <900px: horizontal strip; the modal's status <select> moves the card.
7. The «Таблица» tab keeps every table behavior (CAR-203/117/129 contracts).

## §2 Detailed stats (CAR-247)

8. «Детали» tab: currency selector reformats every figure + chart axis; unknown currency → USD.
9. Period month/quarter/year/all filters entries; persists across reload.
10. Search + facet chips AND-compose; counts correct; Reset restores.
11. Charts render with localized aria; empty states when filters exclude everything.
12. Drill-down row → report page.

## §3 Report depth (CAR-245)

13. New evaluate reports: every block ≥3 substantive bullets; body ≥2500 chars (below → a visible warning, never a rejection); every SAVED report carries `## Job Description (archived verbatim)` (parent contract; check via the report view + file).
14. The machine yaml block and header remain server-built; the display payload keeps the archive after SCORE_SUMMARY stripping.

## §4 Landing (cvstart.org)

15. Hero video: autoplay/muted/loop on desktop ≥640px with motion-ok; dark-overlay melt keeps AA contrast (ink-soft ≈4.7:1); poster fallback on mobile/reduced-motion; palette unchanged (no new hues); overlay pointer-events none.
16. /changelog/ (all 19): exactly ONE <h1>; pages ≤250KB.

## §5 Perf (CAR-236)

17. `BASE_URL=… BASIC_USER=… BASIC_PASS=… node scripts/remote-qa/perf-probe.mjs` — record the table; map/jobs and tracker medians drop vs the pre-fix baseline (findings doc); no endpoint regresses.

## Standard sweep

remote-QA (prod routes ×19, site ×19, links, live scan+LLM `save:false`) green; findings → Linear immediately.
