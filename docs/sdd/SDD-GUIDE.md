# SDD-GUIDE — Spec-Driven Development for career-ops-ui

> The pipeline every non-trivial change goes through. Built on the `gsd-*` skills shipped with `superpowers@claude-plugins-official`. Trivial changes (single-file fix, typo, version bump) skip it; everything else doesn't.

## Why SDD here

The codebase has three properties that punish spec-less coding:

1. **Two-process boundary.** This UI talks to a parent project it must not edit. Drift between assumed and actual parent layout = silent breakage at runtime.
2. **Security envelope.** CSP, SSRF guards, sanitizers — every new route can re-open a closed hole.
3. **Vanilla SPA without a type system.** A planned interface contract is the only thing keeping API ↔ view in sync.

A 30-minute spec session catches all three before they cost a 3-day debugging session.

## The pipeline

```
   ┌────────┐   ┌──────┐   ┌──────┐   ┌─────────┐   ┌────────┐   ┌────────┐
   │discuss │ → │ spec │ → │ plan │ → │ execute │ → │ verify │ → │ review │
   └────────┘   └──────┘   └──────┘   └─────────┘   └────────┘   └────────┘
       │            │          │           │             │           │
   gsd-explore   gsd-spec   gsd-plan   gsd-execute   gsd-verify  gsd-code-
                  -phase     -phase     -phase        -work       review
```

Each box is a GSD skill. Each produces a Markdown artifact under `.planning/phases/P-NN-<slug>/`. The next box reads the previous artifact as input.

## Step by step

### 1. discuss — `/gsd-explore`

Open-ended ideation. Pin down user need, constraints, alternatives. Output: a concise problem statement + scope boundaries. Skip if the problem is already crisp.

### 2. spec — `/gsd-spec-phase`

Write the contract. Inputs, outputs, error cases, security guarantees, observable behavior. Output: `SPEC.md` in the phase folder. Includes:

- **Goal.** One sentence.
- **User stories.** As a <role>, I want <action>, so that <outcome>.
- **API contract.** New routes, request/response shapes, status codes.
- **Data invariants.** What state changes, where, under which user action.
- **Out of scope.** Explicit list of "not this phase."
- **Acceptance criteria.** Test names that must exist and pass.

If the phase touches the SPA: add a `gsd-ui-phase` UI-SPEC.md alongside.
If the phase calls an LLM: add a `gsd-ai-integration-phase` AI-SPEC.md.

### 3. plan — `/gsd-plan-phase`

Decompose the spec into tasks. Output: `PLAN.md` with ordered steps, file-level changes, dependency graph, risk callouts, test plan. The orchestrator may spawn `gsd-pattern-mapper` (find existing analogs in the codebase) and `gsd-phase-researcher` (web research) in parallel.

A plan reviewer (`gsd-plan-checker`) verifies the plan would actually achieve the spec's goal — goal-backward analysis. Iterate until convergent.

### 4. execute — `/gsd-execute-phase`

Implement the plan with **TDD discipline** by default — red → green → refactor. Each task in `PLAN.md` becomes one atomic commit. The executor checkpoints at risky steps (large refactors, schema changes, security-sensitive code) and asks the user to confirm before proceeding.

Hard rules during execute:

- Never deviate from the plan silently. If reality doesn't match, stop and either revise PLAN.md or ask the user.
- Never use `--no-verify`, never `git push --force`, never `git reset --hard` without explicit user approval.
- Pre-commit hook fails → fix the cause, never skip.

### 5. verify — `/gsd-verify-work`

Goal-backward check: does the codebase actually deliver the phase goal? Reads SPEC.md and grep-tests the implemented code against each acceptance criterion. Output: `VERIFICATION.md`.

If criteria fail: re-enter execute, don't paper over.

### 6. review — `/gsd-code-review` (or `/gsd-ns-review`)

Final code-quality gate. Severity-classified findings written to `REVIEW.md`. Pair with `/gsd-secure-phase` if the phase touched security-sensitive code (auth, URL validation, sanitizers, CSP).

For routes specifically, also run the `web-ui-route-reviewer` subagent (defined in `.claude/agents/`).
For SPA views, also run `spa-view-reviewer`.
For tests, also run `test-isolation-reviewer`.

## When NOT to use SDD

| Situation | Use instead |
|---|---|
| Single-file typo / version bump | Direct commit. |
| Adding one test for a known bug | TDD without a phase. |
| Bug fix < 10 LOC, no new behavior | `/gsd-quick` for atomic-commit guarantees, no spec ceremony. |
| Reverting a known-bad commit | Direct revert. |

If you find yourself reaching for SDD for these, you're over-engineering.

## Conflict resolution

If the gsd-* skills and the user's instruction conflict, the user wins. If `~/.claude/CLAUDE.md` and the project CLAUDE.md conflict, the project CLAUDE.md wins inside this repo. If a GSD skill says "always TDD" and a phase explicitly says "spike, no tests yet" — the phase wins for that phase only.

## Artifacts directory

```
.planning/                       (gitignored)
├── PROJECT.md                  — symlink or copy of docs/PROJECT.md
├── ROADMAP.md                  — GSD-managed source of truth
├── CHANGELOG.md                — phase completion log
└── phases/
    └── P-NN-<slug>/
        ├── STATE.json          — { active | pending | complete, started, finished }
        ├── DISCUSS.md
        ├── SPEC.md
        ├── PLAN.md
        ├── EXECUTION.md
        ├── VERIFICATION.md
        └── REVIEW.md
```

When a phase completes and its outputs are valuable beyond execution (e.g. a long-form architecture decision), promote them:

- `SPEC.md` → `docs/sdd/specs/<topic>.md`
- Architecture decision → `docs/adr/NNNN-<title>.md`
- New data contract → update `docs/architecture/DATA-FLOWS.md`

## Daily commands cheat-sheet

| Command | Purpose |
|---|---|
| `/gsd-explore` | Brainstorm a fuzzy idea before committing to a phase. |
| `/gsd-plan-phase` | Standard entry — produces a phase folder with SPEC + PLAN. |
| `/gsd-spec-phase` | Spec-only (when the plan will come later). |
| `/gsd-execute-phase` | Run the plan with TDD + checkpoints. |
| `/gsd-quick <task>` | Minimal pipeline for trivial-but-not-zero changes. |
| `/gsd-verify-work` | Goal-backward verification on the active phase. |
| `/gsd-code-review` | Final review of the active phase. |
| `/gsd-secure-phase` | Security-only audit of the active phase. |
| `/gsd-progress` | Show roadmap status. |
| `/gsd-resume-work` | Continue across sessions. |
| `/sdd-status` (custom, see `.claude/commands/`) | One-shot triage of GSD state. |
