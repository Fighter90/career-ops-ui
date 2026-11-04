# SPEC — v1.266.0/v1.267.0 (CAR-223 personio + the 7d8feb6d port wave)

> Date: 2026-11-04 · Two releases in one session: v1.266.0 (CAR-223 personio language-dedup) + v1.267.0 (the 87-commit upstream delta port + CAR-228).

## Scope

- **v1.266.0**: personio language-dedup stack (#4789 scan-side dedup_include_language, #5044 personio per-language fan-out, #5285 preferred_languages + recruitee) — 3-agent fleet + the integration contract fix (variant machinery + parent pick semantics in language-preferences.mjs).
- **v1.267.0**: 4 new sources (GermanTechJobs #6346, Darwinbox #6416, Keka #6199, ApplicantPro/isolved #6252 → registry 129 = 124 EN + 5 RU · 124 adapters), ETag board-response reuse (#6105, in-memory deviation recorded), postedAt ×4 (#6274), misspelled portals-key rejection (#6107), getro featured-pin walk (#6406), CAR-228 scan-filter compat (GermanTechJobs salary from the title bracket + board-level Germany location; the rest audited clean — hand-off list empty).

## Out of scope

- RU scanner language-aware seen-filter + its misspelled-key gate wiring (hand-offs); client url-key.js mirror; portals-route validation wiring; personio #4789 follow-ups are DONE here; remoteok keeps its offset date string.

## Verification (real output, release/v1.267.0)

- `npm run test:ci` → **7398 tests · 7395 pass · 0 fail · 3 skip** (the live re-measure re-pins the under-counted chain; at the v1.267.0 merge the same runner read 7395/7392/0/3 — the wave notes tracked +105, the suites actually carry more; the integration first surfaced a 1397-fail contract break — fixed, documented)
- `npm run test:e2e:browser` → 174 / 173 pass / 0 fail / 1 opt-in skip
- `node evals/workflow/run.mjs` → 14 pass · 0 fail · 1 skip
- `npm run test:coverage:gate` → 98.47 line / 90.17 branch (no FAIL rows)
- site build + check-dist ✓, mirrors stamped 1.267.0
- Fork sync: cb0d7ca8 = merge upstream @ 7d8feb6d (ADR-0002 greps green post-merge)
