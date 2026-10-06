# SPEC — Raise test coverage to ≥ 90 % on line **and** branch (v1.241.0)

- **Status:** In progress
- **Release:** v1.241.0 (planned)
- **Related:** `docs/sdd/CONVENTIONS.md` §Testing (floor: 80 % line / 75 % branch), the 2026-10-06 code review (`PROGRESS.md`)
- **Owner:** maintainer — done when the measured numbers below are met on a clean checkout

## Goal
Every source file under `server/` and `public/` reaches at least **90 % line and 90 % branch** coverage, and the project-wide figures are published from a measurement, not an estimate.

## Context (measured 2026-10-06, `npm run test:coverage`, 4056 tests)
- `server/` + `public/`: **301 files**, mean line **97.4 %**, mean branch **86.0 %**, mean function **96.8 %**.
- Below 90 % **line**: 10 files — `server/index.mjs`, `cv-import.mjs`, `en-scanner.mjs`, `llm-dispatch.mjs`, `routes/assessments.mjs`, `routes/auto-pipeline.mjs`, `routes/cv-studio.mjs`, `routes/discover-ats.mjs`, `routes/stats.mjs`, `ru-scanner.mjs`.
- Below 90 % **branch**: 168 files; below 80 %: 70; below 70 %: 33. The gap is branches (error paths, empty/malformed inputs), not lines.
- The README's "~93 % line / ~83 % branch" was a hand-written estimate and is replaced by the measured table.
- Several review findings sit exactly on uncovered branches (e.g. `routes/cv-studio.mjs` URL path, `routes/auto-pipeline.mjs` slug collision, malformed-body handling in sources) — covering a branch and fixing it are the same task.

## Scope
1. A script `scripts/coverage-report.mjs` that runs the suite with coverage and prints a per-directory table plus the list of files under the thresholds; exits non-zero below the gate. Wired as `npm run coverage:gate`.
2. New tests, written **with** the review fixes, per file group (below). Tests are CI-isolated: dynamic imports in `before()`, `CAREER_OPS_ROOT` temp dir **containing `cv.md`**, injected `fetchImpl`, no network.
3. Gate lowered to a ratchet: the committed baseline can only go up.

## Out of scope
Coverage of `tests/` themselves, generated files (`site/src/generated`), vendored code, and the `site/` Astro build. Branches that exist only to satisfy the type of an `unreachable` guard are annotated, not tested.

## Acceptance criteria
1. `node scripts/coverage-report.mjs` prints **line ≥ 90 % and branch ≥ 90 %** for every file in `server/` and `public/` (or a documented, reviewed exemption list of ≤ 5 files with the reason each is untestable). *(the script's own exit code)*
2. The 10 files named above reach ≥ 90 % line. *(report)*
3. `README.md` ×17 and `docs/architecture/TESTING.md` quote the measured numbers and the date. *(`tests/readme-counts.test.mjs` if present, else manual diff)*
4. No new test touches the network or the real parent. *(`tests/test-isolation.test.mjs` guard: a test run with `CAREER_OPS_ROOT` set must not read `../` — added in this spec)*

## Plan
Fix-and-cover agents, **one file group each**, each owning only its group's source files and its test files (no shared files):

| Group | Files | Review findings folded in |
|---|---|---|
| A | `server/index.mjs`, `lib/security.mjs`, `lib/http-json.mjs`, `lib/safe-fetch.mjs`, `lib/rate-limit.mjs` | Host/Origin guard, unhandled-rejection guard |
| B | `routes/llm.mjs`, `routes/auto-pipeline.mjs`, `routes/career-plan.mjs`, `routes/batch.mjs`, `routes/cv-studio.mjs` | the two process-crash bugs, URL path, slug collision, provider cascade |
| C | `routes/interview.mjs`, `networking.mjs`, `jds.mjs`, `logos.mjs`, `activity.mjs`, `docs-assistant.mjs`, `discover-ats.mjs`, `assessments.mjs`, `stats.mjs` | history slice, overwrite, CJK tokenizer |
| D | `lib/en-scanner.mjs`, `ru-scanner.mjs`, `cv-import.mjs`, `llm-dispatch.mjs` + scan helpers | truncation flags, error swallowing |
| E | sources 1–55 (alphabetical) | malformed-200-throws, host assert |
| F | sources 56–109 | same |
| G | `public/js/router.js`, `api.js`, `lib/*` | skip-link route, double error, privacy, countries, fit-score |
| H | `public/js/views/*` | per review slice |

## Risks and invariants touched
`TRACEABILITY.md` **R-06** (SSRF envelope — Host/Origin guard changes every route), **R-03** (route conventions), **R-07** (CSP-safe DOM). A behaviour fix that changes a response shape updates the matching test in the same commit.

## Verification
*(filled when done: the table from `coverage-report.mjs` before/after, test count, CI link.)*
