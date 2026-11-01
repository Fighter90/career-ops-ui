# SPEC — v1.265.0 parent-sync wave (career-ops @ fe857ecf)

> Date: 2026-11-01 · Scope: the recorded port-list (BACKLOG) against the fork's updated main (0595b5d1 → fe857ecf, 121 commits).

## Goal

Port the parent delta the web-ui mirrors depend on; document the rest.

## Scope

1. **New sources**: apple (#5496+#6196, hydration-blob, entry-driven queries/teams) + bulldogjob (#6253, `__NEXT_DATA__`, path-filters) → registry 123→125 = 120 EN + 5 RU · 120 adapters, count gates ×8 regenerated, FALLBACK_SOURCES + Sources.astro + help §17 ×19 + CONTEXT/CLAUDE.
2. **Ports**: IBM max_pages/pacing/retry (#6273) · justjoin lastPublishedAt (#6254) · jobvite shared-URL fold (#6127) · liveness UltiPro rung (#6090) · liveness Built In hard-expired (#6336).
3. **No-ports (verified present/position-independent/parent-side)**: icims #6130, workday #6143, Bulgarian apply #6192, smartrecruiters #6303, Machine Summary #6157, liveness flags #6086.
4. **Deferred**: personio language-dedup #4789 (3-commit stack, own release).

## Out of scope

- The parent-side scan.mjs location-compiler half of #6127 (USPS compiler = documented no-port); the parent's `note` field for PIPE (web-ui job shape has none — rides in `snippet`).

## Verification (real output)

- `npm test` → **7138 tests · 7135 pass · 0 fail · 3 skip** (first run 15 env-fails from a wiped Playwright cache; green after `npx playwright install chromium`)
- Red-first: justjoin/jobvite/BuiltIn — 3 red on the unfixed tree via `git stash`, then 76/76
- New suites: sources-apple 12/12 · sources-bulldogjob 11/11 · liveness-api-ultipro 8/8 · sources-ibm 16/16 (incl. 7 new)
- `npm run test:ci` → exit 0 · parity ×19 @ 1.265.0 · evals 14/0/1 · coverage gate ≥ 98/89
