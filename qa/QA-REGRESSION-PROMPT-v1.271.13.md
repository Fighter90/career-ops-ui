# QA regression prompt — v1.271.13

The parent-sync wave against upstream `d8b292df` (88 commits; fork pushed as `da28ef95`, ADR divergences defended) + the CodeQL hygiene wave.

**Story:** the scan page's data sources got the parent's bounds and correctness work — Ashby's posting API its own 64 MB ceiling with an embed-listing fallback (#6674), SmartRecruiters opt-in `max_pages` raises with pacing/retries/truncation warnings + `listingIdentity` (#6799/#6936), SuccessFactors a public-https host guard with opt-in ceilings (#6697), Amazon a hit-bounded walk (#6938), Join republish-stable `listingIdentity` (#6950), OracleCloud a total-sized page budget, Darwinbox/Jobstreet/Platsbanken/TheHub/A16z/Arbeitnow/Greenhouse fixes; scanner bounds (`max_response_mb`, workplace-policy dedup, time-limit-keeps-roles); the `_salary-text` helper; CodeQL hygiene (jd-parse dead code, exact test needles, the release-manager TDZ fix).

## §0 Gates at ship time

- `npm run test:ci` — **8428 tests / 8411 pass / 0 fail** (local Node 22, 2026-11-12).
- `node evals/workflow/run.mjs` — 0 ✗.
- CI on main: green (the release-commit run).

## §1 What changed

- 16 `server/lib/sources/*.mjs` updated (three-file contract; adapters unchanged — no detection/endpoint diffs), `server/lib/sources/_salary-text.mjs` NEW, `server/lib/en-scanner.mjs` + `server/lib/location-filter.mjs` bounds, ~30 test files extended; +99 tests vs v1.271.12.
- `scripts/swarm/orchestrator.mjs` — the release-manager TDZ fix (a variable used before declaration would have crashed the swarm's next release).
- CodeQL: `server/lib/jd-parse.mjs` dead code, URL-shaped test needles → exact cell/token matches, unused imports removed.
- CHANGELOG ×19 + README ×19 (banners v1.271.13, badges 8411) + baselines + `qa/QA-REGRESSION-PROMPT-v1.271.13.md` (this file; v1.271.12's archived).

## §2 Manual browser pass

- `#/scan` on a big-board entry (Ashby/SmartRecruiters/SuccessFactors): the walk completes or reports `partial` with the canonical page-cap tag instead of stopping silently at 25/30 pages.
- No new console errors on `#/scan`, `#/tracker`.

## §3 Contract invariants

- Registry counts unchanged (140 = 135 EN + 5 RU · 135 adapters) — ports only, no new sources.
- Deliberate no-ports: Workable (feed-walker only), Google (already at parity), scan filtering/dedup, `/api/pipeline`.

## §4 Sign-off

Release train: fork sync (divergences defended, parent tree green) → 4 port agents (disjoint file groups, tests green per group) → full gates → docs ×19 (agents) → tag → Release/Publish/Pages → resumecraft deploy/verify → full browser regression + remote-qa → wiki ×19.
