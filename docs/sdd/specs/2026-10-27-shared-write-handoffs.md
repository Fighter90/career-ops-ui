# SPEC — Shared-write hand-offs (FULL-M1 follow-ups)

- **Status:** Draft
- **Release:** v1.261.0 (or v1.262.0 if the wave window closes)
- **Related:** #526 (FULL-M1 base), #531 (m6s — env-config prerequisite), GLM review F3 of #526
- **Owner:** orchestrator

## Goal
The three routes/units FULL-M1 could not touch (outcome/followup spawns, tracker.mjs torn-write exposure, env-config .env torn-write) converge on the same lock + `atomicWrite` discipline as the rest of the app.

## Context
#526 landed `runTrackedScript` (runner.mjs) + `TRACKER_MUTATING` and hoisted PUT saves onto `withFileLock` + `atomicWrite`. Three surfaces remained outside that change's file ownership (review hand-offs): `routes/outcome.mjs` + `routes/followup.mjs` still call bare `runNodeScript` for tracker-mutating scripts; `routes/tracker.mjs:154,223` writes inside its lock with plain `writeFileSync` (lock ≠ crash safety — review F3); `env-config.mjs` writes .env non-atomically (blocked on #531 touching the same file — prerequisite now mergeable).

## Scope
1. `routes/outcome.mjs`: the `runNodeScript(SCRIPT, …)` call site → `runTrackedScript('outcome.mjs', …)` (roster entry already exists: outcome.mjs → applications).
2. `routes/followup.mjs`: `runNodeScript(SEED_SCRIPT, …)` → `runTrackedScript('followup-seed.mjs', …)` (roster: followUps).
3. `routes/tracker.mjs`: the two locked writes → `atomicWrite(PATHS.applications, …)` inside the EXISTING `withFileLock` blocks (no lock changes).
4. `server/lib/env-config.mjs`: `updateEnvFile`'s write path → `withFileLock(PATHS.envFile)` + `atomicWrite` (route-level lock in config.mjs stays; defense-in-depth at the writer).
5. Tests: flip `tests/m1-tracked-script-registry.test.mjs`'s interim contract for outcome/followup to the FIXED shape (forbid `runNodeScript(SCRIPT|SEED_SCRIPT)` const-indirection — the gate's own TODO); add atomicity canaries (no `.tmp` litter after PUT-style writes through tracker.mjs; env-config round-trip).

## Out of scope
- Batch-stream final-merge residual (documented in-code; a stream-scoped lock would freeze UI tracker edits — accepted).
- CLI-side parent writes (single-user accepted residual, documented in runner.mjs).
- reconcile/assessments spawns (outside TRACKER_MUTATING scope by the F2 note).

## Acceptance criteria
1. `tests/m1-tracked-script-registry.test.mjs` — the outcome/followup specs assert the FIXED shape (bare const-indirection forbidden) and stay green.
2. `tests/m1-put-atomic-writes.test.mjs` (or a sibling) — tracker.mjs writes go through atomicWrite (source-static, mirroring `tests/full-r1-atomic-write.test.mjs`'s gate) + no-temp-litter canary.
3. env-config: unit test — a forced throw mid-write leaves the previous .env intact and no temp behind (mirror `tests/full-r1-atomic-write.test.mjs`'s failure-path pattern against `updateEnvFile` via injected fs seam if needed).
4. Full `npm run test:ci` green; no behavior change for success paths (responses byte-identical).

## Plan
- T-1 [flash]: items 1–2 + gate flip (one commit; red = the flipped gate specs against current bare-const shape).
- T-2 [flash]: item 3 (red = new static gate on tracker.mjs).
- T-3 [flash, after #531 merges]: item 4 (red = injected-fs failure-path test).
- T-4 [orchestrator]: GLM fresh-context review of the combined diff → PR.

## Risks and invariants touched
- R-03 (routes validate input; spawns stay arg-array), R-11 (tracker/pipeline formats untouched — writes are content-preserving). The runner.mjs non-reentrant lock must not be nested: runTrackedScript callers stay top-level in route handlers.
